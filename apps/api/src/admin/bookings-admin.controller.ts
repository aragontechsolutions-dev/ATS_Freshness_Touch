import { Controller, Get, Param, ParseUUIDPipe, Query, UsePipes } from '@nestjs/common';
import {
  AdminBookingQuerySchema,
  type AdminBookingDetail,
  type AdminBookingList,
  type AdminBookingQuery,
} from '@freshness/types';
import { ADMIN_ROUTE, Roles } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
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
