import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  AdminAssignmentsUpdateSchema,
  AdminBookingQuerySchema,
  AdminCaptureDepositSchema,
  AdminReleaseDepositSchema,
  AdminStatusChangeSchema,
  type AdminAssignmentsUpdate,
  type AdminBookingDetail,
  type AdminBookingList,
  type AdminBookingQuery,
  type AdminCaptureDeposit,
  type AdminReleaseDeposit,
  type AdminStaffList,
  type AdminStatusChange,
  type AuthenticatedStaff,
} from '@freshness/types';
import type { Request } from 'express';
import { ADMIN_ROUTE, CurrentStaff, Roles } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SKIP_QUOTE_THROTTLER } from '../common/throttling';
import { AssignmentsService } from './assignments.service';
import { BookingActionsService } from './booking-actions.service';
import { BookingsAdminService } from './bookings-admin.service';

/**
 * Agenda y reservas del panel.
 *
 * La guarda global ya exige sesion por estar bajo /admin. Aqui solo se afina
 * QUIEN de dentro puede ver que.
 */
@SkipThrottle(SKIP_QUOTE_THROTTLER)
@Controller(`${ADMIN_ROUTE}/bookings`)
export class BookingsAdminController {
  constructor(private readonly bookings: BookingsAdminService) {}

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
  ): Promise<AdminBookingDetail> {
    return this.bookings.detail(bookingId);
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
  ) {}

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
