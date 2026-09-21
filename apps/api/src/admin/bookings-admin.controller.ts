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
  Query,
  Req,
  UsePipes,
} from '@nestjs/common';
import {
  AdminBookingQuerySchema,
  AdminCaptureDepositSchema,
  AdminReleaseDepositSchema,
  AdminStatusChangeSchema,
  type AdminBookingDetail,
  type AdminBookingList,
  type AdminBookingQuery,
  type AdminCaptureDeposit,
  type AdminReleaseDeposit,
  type AdminStatusChange,
  type AuthenticatedStaff,
} from '@freshness/types';
import type { Request } from 'express';
import { ADMIN_ROUTE, CurrentStaff, Roles } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { BookingActionsService } from './booking-actions.service';
import { BookingsAdminService } from './bookings-admin.service';

/**
 * Agenda y reservas del panel.
 *
 * La guarda global ya exige sesion por estar bajo /admin. Aqui solo se afina
 * QUIEN de dentro puede ver que.
 */
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
