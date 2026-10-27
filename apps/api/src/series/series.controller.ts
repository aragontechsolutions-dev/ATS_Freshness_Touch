import { Body, Controller, Get, Ip, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  SeriesFromBookingSchema,
  SeriesUpdateSchema,
  type AuthenticatedStaff,
  type SeriesFromBooking,
  type SeriesItem,
  type SeriesList,
  type SeriesUpdate,
} from '@freshness/types';
import { ADMIN_ROUTE, CurrentStaff, Roles } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SKIP_QUOTE_THROTTLER } from '../common/throttling';
import { SeriesService } from './series.service';

/**
 * LAS CLIENTAS DE SIEMPRE
 * -----------------------
 * ADMINISTRACION Y COORDINACION, igual que la agenda: una serie es agenda,
 * no dinero. Limpieza no entra, por lo mismo que no ve el listado completo
 * de reservas.
 *
 * El precio pactado SI es dinero, y por eso va aparte: se hereda de la
 * reserva de la que nace la serie, que ya comprobo que solo administracion
 * puede ponerlo.
 */
@SkipThrottle(SKIP_QUOTE_THROTTLER)
@Controller(`${ADMIN_ROUTE}/series`)
export class SeriesController {
  constructor(private readonly series: SeriesService) {}

  @Get()
  @Roles('ADMIN', 'DISPATCHER')
  listar(): Promise<SeriesList> {
    return this.series.listar();
  }

  /**
   * Pausar, reanudar o terminar.
   *
   * NO TOCA LAS CITAS YA CREADAS: pausar porque la clienta se va de viaje no
   * es cancelar las tres citas que ya estan en la agenda con su equipo
   * asignado. Eso lo decide una persona, mirandolas.
   */
  @Patch(':seriesId')
  @Roles('ADMIN', 'DISPATCHER')
  cambiar(
    @Param('seriesId', new ParseUUIDPipe({ version: '4' })) seriesId: string,
    @Body(new ZodValidationPipe<SeriesUpdate>(SeriesUpdateSchema)) cambio: SeriesUpdate,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Ip() ip: string,
  ): Promise<SeriesItem> {
    return this.series.cambiarEstado(seriesId, cambio, staff, ip);
  }
}

/* -------------------------------------------------------------------------- */

/**
 * Convertir una reserva en serie.
 *
 * Cuelga de la reserva y no de `/series` porque eso es lo que es: no se crea
 * una serie de la nada, se dice de una cita concreta que se repite. Ver
 * `SeriesService`.
 */
@SkipThrottle(SKIP_QUOTE_THROTTLER)
@Controller(`${ADMIN_ROUTE}/bookings/:bookingId/series`)
export class BookingSeriesController {
  constructor(private readonly series: SeriesService) {}

  @Post()
  @Roles('ADMIN', 'DISPATCHER')
  crear(
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) bookingId: string,
    @Body(new ZodValidationPipe<SeriesFromBooking>(SeriesFromBookingSchema))
    peticion: SeriesFromBooking,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Ip() ip: string,
  ): Promise<SeriesItem> {
    return this.series.crearDesdeReserva(bookingId, peticion, staff, ip);
  }
}
