import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UsePipes,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  API_ERROR_CODES,
  AdminAssignmentsUpdateSchema,
  AdminBookingQuerySchema,
  AdminBookingRequestSchema,
  AdminCaptureDepositSchema,
  AdminChargeBalanceSchema,
  AdminRefundPaymentSchema,
  AdminReleaseDepositSchema,
  AdminStatusChangeSchema,
  FieldAdjustmentDecisionSchema,
  type AdminAssignmentsUpdate,
  type AdminBookingDetail,
  type AdminBookingList,
  type AdminBookingQuery,
  type AdminBookingRequest,
  type BookingResponse,
  type AdminCaptureDeposit,
  type AdminChargeBalance,
  type AdminRefundPayment,
  type AdminReleaseDeposit,
  type AdminStaffList,
  type AdminStatusChange,
  type AuthenticatedStaff,
  type FieldAdjustmentDecision,
} from '@freshness/types';
import type { Request } from 'express';
import { ADMIN_ROUTE, CurrentStaff, Roles } from '../auth/auth.decorators';
import { BookingsService } from '../bookings/bookings.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SKIP_QUOTE_THROTTLER } from '../common/throttling';
import { AssignmentsService } from './assignments.service';
import { BookingActionsService } from './booking-actions.service';
import { BookingsAdminService } from './bookings-admin.service';
import { FieldAdjustmentsService } from './field-adjustments.service';

/**
 * Agenda y reservas del panel.
 *
 * La guarda global ya exige sesion por estar bajo /admin. Aqui solo se afina
 * QUIEN de dentro puede ver que.
 */
@SkipThrottle(SKIP_QUOTE_THROTTLER)
@Controller(`${ADMIN_ROUTE}/bookings`)
export class BookingsAdminController {
  constructor(
    private readonly bookings: BookingsAdminService,
    /**
     * EL MISMO SERVICIO QUE EL SITIO PUBLICO, no uno paralelo. Si hubiera
     * dos, el dia que cambie el calculo del precio o el bloqueo del dia solo
     * cambiaria uno de los dos.
     */
    private readonly creacion: BookingsService,
  ) {}

  /**
   * CREA UNA RESERVA A MANO: la clienta de siempre que llama por telefono.
   *
   * No es un recordatorio ni una nota: es una reserva igual que las demas,
   * con su precio, su equipo, su lista de tareas y su factura. Y sobre todo,
   * OCUPA LA FRANJA — que es lo que hasta ahora no pasaba y hacia que el
   * cotizador publico vendiera por segunda vez un martes ya comprometido.
   *
   * Nace CONFIRMED y sin retencion en tarjeta: ver `OpcionesDeAdministracion`.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('ADMIN', 'DISPATCHER')
  crear(
    /*
     * EL ESQUEMA SE APLICA AL CUERPO, no al metodo entero: con `@UsePipes` a
     * nivel de metodo, Nest tambien se lo aplica a la sesion y a la IP, y
     * todo responde 400 sin llegar nunca aqui. Ver el mismo comentario en
     * `cambiarEstado`.
     */
    @Body(new ZodValidationPipe<AdminBookingRequest>(AdminBookingRequestSchema))
    peticion: AdminBookingRequest,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Ip() ip: string,
  ): Promise<BookingResponse> {
    /*
     * EL PRECIO PACTADO ES SOLO DE ADMINISTRACION.
     *
     * Coordinacion agenda, y para agendar no hace falta poder cambiar lo que
     * se cobra. Separarlo aqui es la misma linea que ya separa «mover una
     * cita» de «mover dinero» en el controlador de abajo.
     */
    if (peticion.overrides.priceOverrideCents !== null && staff.role !== 'ADMIN') {
      throw new ForbiddenException({
        code: API_ERROR_CODES.FORBIDDEN,
        messageKey: 'admin.errorPriceNeedsAdmin',
      });
    }

    return this.creacion.create(peticion.booking, new Date(), ip, {
      staff,
      overrides: peticion.overrides,
    });
  }

  /**
   * Listado filtrable.
   *
   * El personal de limpieza (CLEANER) no entra: solo debe ver los trabajos
   * que tiene asignados, y esa vista se construye en el bloque siguiente. Es
   * preferible que de momento no vea nada a que vea la agenda completa con
   * los datos de todos los clientes.
   */
  @Get()
  @Roles('ADMIN', 'DISPATCHER')
  @UsePipes(new ZodValidationPipe<AdminBookingQuery>(AdminBookingQuerySchema))
  list(@Query() query: AdminBookingQuery): Promise<AdminBookingList> {
    return this.bookings.list(query);
  }

  /**
   * Detalle de una reserva, con la direccion y las instrucciones de acceso.
   *
   * El identificador se valida como UUID antes de llegar a la base de datos:
   * asi un valor con formato raro se rechaza con un 400 claro en vez de
   * provocar un error del controlador de base de datos.
   */
  @Get(':bookingId')
  @Roles('ADMIN', 'DISPATCHER')
  detail(
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) bookingId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Ip() ip: string,
  ): Promise<AdminBookingDetail> {
    /*
     * ESTA ES LA UNICA LECTURA QUE SE AUDITA, y hace falta explicar por que.
     *
     * Auditar cada consulta convertiria el registro en un listado de agendas
     * donde lo importante queda enterrado. Pero esta pantalla no es una mas:
     * es la que ensena el nombre, el telefono, el correo, la direccion
     * completa y —sobre todo— las instrucciones de acceso a la casa de un
     * cliente. El codigo de una puerta.
     *
     * Un cambio deja rastro solo. Una MIRADA no deja ninguno, y es justo lo
     * que hace alguien que fisgonea: abrir fichas y no tocar nada. Sin esto,
     * ese comportamiento es indistinguible de no haber pasado.
     */
    return this.bookings.detail(bookingId, { staff, ip });
  }
}

/* -------------------------------------------------------------------------- */

/**
 * Acciones que CAMBIAN algo.
 *
 * Van en su propio controlador para que los permisos se lean de un vistazo:
 * mover una cita es una cosa y mover dinero es otra.
 *
 * Todas dejan rastro en el registro de auditoria, dentro de la misma
 * transaccion que el cambio.
 */
@SkipThrottle(SKIP_QUOTE_THROTTLER)
@Controller(`${ADMIN_ROUTE}/bookings/:bookingId`)
export class BookingActionsController {
  constructor(
    private readonly actions: BookingActionsService,
    private readonly bookings: BookingsAdminService,
    private readonly adjustments: FieldAdjustmentsService,
  ) {}

  /**
   * Aprueba o rechaza un ajuste de campo.
   *
   * ======================================================================
   * APROBAR ES LO UNICO DEL SISTEMA QUE MUEVE UN PRECIO YA PACTADO
   * ======================================================================
   * Hasta esta etapa, `serviceCents`, `totalCents` y `lines` estaban
   * congelados desde que se reservaba. Aqui es donde se descongelan, y por
   * eso va en el controlador de ACCIONES y no en el de lectura: los permisos
   * se leen de un vistazo.
   *
   * ADMIN Y COORDINACION, y no solo ADMIN. No es lo mismo que cobrar: aqui
   * no se toca la tarjeta de nadie, se corrige lo que dice la ficha para que
   * refleje el trabajo que de verdad se hizo. Quien lleva la agenda es quien
   * habla con el cliente cuando la casa no era la que dijo, y hacerle pasar
   * por administracion para cada metro cuadrado dejaria el ajuste sin usar.
   */
  @Post('adjustment/:adjustmentId')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'DISPATCHER')
  async resolveAdjustment(
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) bookingId: string,
    @Param('adjustmentId', new ParseUUIDPipe({ version: '4' })) adjustmentId: string,
    @Body(new ZodValidationPipe<FieldAdjustmentDecision>(FieldAdjustmentDecisionSchema))
    decision: FieldAdjustmentDecision,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Req() request: Request,
  ): Promise<AdminBookingDetail> {
    await this.adjustments.resolve(bookingId, adjustmentId, decision, staff, request.ip ?? null);
    // La reserva ya re-tarificada, como el resto de acciones: el panel pinta
    // lo que decidio el servidor en vez de suponer que hizo lo pedido.
    return this.bookings.detail(bookingId);
  }

  /** Cambia el estado de la reserva. Coordinacion tambien puede. */
  @Patch('status')
  @Roles('ADMIN', 'DISPATCHER')
  async changeStatus(
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) bookingId: string,
    /*
     * El esquema se aplica AL CUERPO, no al metodo entero. Con @UsePipes a
     * nivel de metodo, Nest se lo aplica tambien al parametro de la ruta y el
     * identificador falla la validacion: todo responde 400 sin llegar nunca
     * al controlador.
     */
    @Body(new ZodValidationPipe<AdminStatusChange>(AdminStatusChangeSchema))
    change: AdminStatusChange,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Req() request: Request,
  ): Promise<AdminBookingDetail> {
    await this.actions.changeStatus(bookingId, change, staff, request.ip ?? null);
    // Se devuelve la reserva ya actualizada: asi el panel no tiene que
    // adivinar el nuevo estado ni hacer una segunda peticion.
    return this.bookings.detail(bookingId);
  }

  /**
   * Cobra el deposito retenido.
   *
   * SOLO ADMINISTRACION. Coordinacion mueve la agenda, no el dinero de la
   * tarjeta de un cliente: quien puede cambiar una cita no tiene por que poder
   * cobrarle.
   */
  @Post('payment/capture')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  async captureDeposit(
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) bookingId: string,
    @Body(new ZodValidationPipe<AdminCaptureDeposit>(AdminCaptureDepositSchema))
    body: AdminCaptureDeposit,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Req() request: Request,
  ): Promise<AdminBookingDetail> {
    await this.actions.captureDeposit(bookingId, body, staff, request.ip ?? null);
    return this.bookings.detail(bookingId);
  }

  /**
   * Cobra el saldo final de un trabajo terminado.
   *
   * SOLO ADMINISTRACION, como el resto del dinero. Es ademas el unico cobro
   * que se hace SIN EL CLIENTE DELANTE, con la tarjeta que guardo el
   * proveedor al reservar.
   *
   * El cuerpo va vacio a proposito: no hay nada que elegir. Se cobra lo que
   * la reserva dice que se debe. Aun asi pasa por el esquema, que es
   * estricto: un campo de mas —un importe inventado— se rechaza.
   */
  @Post('payment/charge-balance')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  async chargeBalance(
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) bookingId: string,
    @Body(new ZodValidationPipe<AdminChargeBalance>(AdminChargeBalanceSchema))
    _body: AdminChargeBalance,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Req() request: Request,
  ): Promise<AdminBookingDetail> {
    await this.actions.chargeBalance(bookingId, staff, request.ip ?? null);
    return this.bookings.detail(bookingId);
  }

  /**
   * Devuelve dinero ya cobrado, entero o en parte.
   *
   * SOLO ADMINISTRACION, por el mismo motivo que el cobro: mueve dinero de
   * verdad. Que la direccion sea la contraria no lo hace inocuo —el dinero
   * sale de la empresa— y la pregunta de dentro de tres meses es la misma:
   * quien lo autorizo y por que.
   *
   * El cuerpo dice QUE se devuelve: el deposito o el saldo final. Sin
   * indicarlo, el deposito, que es lo que habia antes de la etapa 3.24.
   */
  @Post('payment/refund')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  async refundDeposit(
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) bookingId: string,
    @Body(new ZodValidationPipe<AdminRefundPayment>(AdminRefundPaymentSchema))
    body: AdminRefundPayment,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Req() request: Request,
  ): Promise<AdminBookingDetail> {
    await this.actions.refundPayment(bookingId, body, staff, request.ip ?? null);
    return this.bookings.detail(bookingId);
  }

  /** Libera la retencion sin cobrar. Tambien solo administracion. */
  @Post('payment/release')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  async releaseDeposit(
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) bookingId: string,
    @Body(new ZodValidationPipe<AdminReleaseDeposit>(AdminReleaseDepositSchema))
    body: AdminReleaseDeposit,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Req() request: Request,
  ): Promise<AdminBookingDetail> {
    await this.actions.releaseDeposit(bookingId, body, staff, request.ip ?? null);
    return this.bookings.detail(bookingId);
  }
}

/**
 * EQUIPO DE UNA RESERVA
 * ---------------------
 * ADMIN y DISPATCHER, igual que el cambio de estado: organizar quien va a
 * cada casa es coordinacion, no dinero.
 *
 * CLEANER queda fuera. No por desconfianza, sino porque asignarse trabajos a
 * uno mismo cambia quien cobra que y de quien es la responsabilidad si algo
 * sale mal en esa casa. Esa decision la toma quien coordina.
 */
@SkipThrottle(SKIP_QUOTE_THROTTLER)
@Controller(`${ADMIN_ROUTE}/bookings/:bookingId/assignments`)
export class AssignmentsController {
  constructor(
    private readonly assignments: AssignmentsService,
    private readonly bookings: BookingsAdminService,
  ) {}

  /**
   * Reemplaza el equipo entero.
   *
   * Es un PUT y no altas y bajas sueltas: el equipo se decide de golpe, y la
   * regla de "un solo responsable" solo se puede garantizar sobre el conjunto.
   *
   * El esquema va en el parametro del cuerpo, NO en `@UsePipes()`: a nivel de
   * metodo se aplicaria tambien al identificador de la URL.
   */
  @Put()
  @Roles('ADMIN', 'DISPATCHER')
  async setTeam(
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) bookingId: string,
    @Body(new ZodValidationPipe<AdminAssignmentsUpdate>(AdminAssignmentsUpdateSchema))
    body: AdminAssignmentsUpdate,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Req() request: Request,
  ): Promise<AdminBookingDetail> {
    await this.assignments.setTeam(bookingId, body.assignments, staff, request.ip ?? null);
    // Se devuelve la reserva ya actualizada, como el resto de acciones: asi el
    // panel pinta lo que decidio el servidor en vez de suponer que hizo lo pedido.
    return this.bookings.detail(bookingId);
  }
}

/**
 * PERSONAL AL QUE SE PUEDE ASIGNAR
 * --------------------------------
 * Devuelve nombre, apellido, puesto e identificador. NADA MAS.
 *
 * Es deliberado: para elegir a quien mandar a una casa basta con eso. Incluir
 * correo y telefono convertiria una pantalla que se abre a diario en la
 * agenda de contacto de toda la plantilla, expuesta a cualquiera con acceso
 * al panel y a cualquier sesion que se quede abierta en un portatil.
 */
@SkipThrottle(SKIP_QUOTE_THROTTLER)
@Controller(`${ADMIN_ROUTE}/staff`)
export class StaffListController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Get()
  @Roles('ADMIN', 'DISPATCHER')
  list(): Promise<AdminStaffList> {
    return this.assignments.listStaff();
  }
}
