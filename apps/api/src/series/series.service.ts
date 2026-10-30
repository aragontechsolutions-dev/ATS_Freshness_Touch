import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  API_ERROR_CODES,
  SERIES_FREQUENCIES,
  SeriesItemSchema,
  type AuthenticatedStaff,
  type SeriesFromBooking,
  type SeriesFrequency,
  type SeriesItem,
  type SeriesList,
  type SeriesUpdate,
} from '@freshness/types';
import { AuditService } from '../audit/audit.service';
import { comoFecha } from '../common/fechas';
import { PrismaService } from '../database/prisma.service';
import { AvailabilityService } from '../scheduling/availability.service';

/**
 * LAS CLIENTAS DE SIEMPRE
 * =======================
 * «Ana, todos los martes a las nueve.» Una serie no es una cita larga: es
 * una fabrica de citas normales, cada una con su equipo, su lista de tareas
 * y su factura. Si una semana hay que moverla, se mueve esa y la serie sigue.
 *
 * ========================================================================
 * SE CREA DESDE UNA RESERVA QUE YA EXISTE, NO CON UN FORMULARIO PROPIO
 * ========================================================================
 * Un formulario de serie pediria otra vez el cliente, la direccion, el
 * servicio, el tamano y la hora: exactamente lo que se acaba de escribir al
 * meter la primera cita. Dos formularios que piden lo mismo se separan solos
 * —uno valida el codigo postal y el otro se olvida— y obligan a teclear dos
 * veces.
 *
 * Asi el camino es el natural: se mete la primera cita y desde su ficha se
 * dice «esto se repite». El dia de la semana, la hora y la duracion salen de
 * ella.
 */
@Injectable()
export class SeriesService {
  private readonly logger = new Logger(SeriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly availability: AvailabilityService,
  ) {}

  /** Convierte una reserva en serie. La reserva se queda como esta. */
  async crearDesdeReserva(
    bookingId: string,
    peticion: SeriesFromBooking,
    staff: AuthenticatedStaff,
    ip: string | null,
  ): Promise<SeriesItem> {
    const reserva = await this.prisma.db.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        customerId: true,
        addressId: true,
        seriesId: true,
        service: true,
        bedrooms: true,
        bathrooms: true,
        squareFeet: true,
        addOns: true,
        scheduledStart: true,
        scheduledEnd: true,
        timezone: true,
      },
    });

    if (!reserva) {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        messageKey: 'admin.errorBookingNotFound',
      });
    }

    /*
     * UNA RESERVA PERTENECE A UNA SERIE COMO MUCHO. Dejar crear una segunda
     * desde la misma cita duplicaria la clienta en la agenda cada semana, y
     * el fallo no se veria hasta que aparecieran dos equipos el mismo dia.
     */
    if (reserva.seriesId !== null) {
      throw new ConflictException({
        code: API_ERROR_CODES.SERIES_CONFLICT,
        messageKey: 'admin.errorAlreadyInSeries',
      });
    }

    const zona = await this.zona();
    const inicio = DateTime.fromJSDate(reserva.scheduledStart).setZone(zona);

    const serie = await this.prisma.db.$transaction(async (tx) => {
      const creada = await tx.recurringSeries.create({
        data: {
          customerId: reserva.customerId,
          addressId: reserva.addressId,
          status: 'ACTIVE',
          frequency: peticion.frequency,
          service: reserva.service,
          bedrooms: reserva.bedrooms,
          bathrooms: reserva.bathrooms,
          squareFeet: reserva.squareFeet,
          addOns: reserva.addOns ?? [],
          /*
           * `luxon` cuenta 1 = lunes ... 7 = domingo y la columna guarda
           * 0 = domingo ... 6 = sabado, que es lo que usa `Date.getDay()` y
           * el resto del sistema. El domingo es el unico que no coincide.
           */
          dayOfWeek: inicio.weekday === 7 ? 0 : inicio.weekday,
          startTime: inicio.toFormat('HH:mm'),
          durationMinutes: Math.round(
            (reserva.scheduledEnd.getTime() - reserva.scheduledStart.getTime()) / 60_000,
          ),
          /*
           * ARRANCA EN LA CITA QUE LA ORIGINO, no al dia siguiente. Asi las
           * fechas que toca se cuentan desde un martes real y el barrido no
           * vuelve a crear esta, que ya existe: la encuentra ocupada por ella
           * misma.
           */
          startDate: comoFecha(inicio.toFormat('yyyy-MM-dd')),
          endDate: peticion.endDate === null ? null : comoFecha(peticion.endDate),
          priceOverrideCents: peticion.priceOverrideCents,
        },
      });

      /*
       * La cita que la origino pasa a ser la primera de la serie, y con ella
       * la ocurrencia que ocupa: su propio dia. Sin esto, mover esa primera
       * cita haria que el barrido generara otra en su sitio.
       */
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          seriesId: creada.id,
          seriesOccurrenceDate: comoFecha(inicio.toFormat('yyyy-MM-dd')),
        },
      });

      await this.audit.record(
        {
          staff,
          surface: 'PANEL',
          action: 'series.created',
          entityType: 'booking',
          entityId: bookingId,
          metadata: {
            seriesId: creada.id,
            frequency: peticion.frequency,
            agreedPrice: peticion.priceOverrideCents !== null,
            ...(peticion.endDate ? { endDate: peticion.endDate } : {}),
          },
          ipAddress: ip,
        },
        tx,
      );

      return creada;
    });

    this.logger.log(`Serie ${serie.id} creada desde la reserva ${bookingId}`);

    return this.aItem({ ...serie, customer: null, bookings: [] });
  }

  /** Todas las series, las activas primero. */
  async listar(): Promise<SeriesList> {
    const ahora = new Date();

    const filas = await this.prisma.db.recurringSeries.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        customer: { select: { firstName: true, lastName: true } },
        bookings: {
          where: { scheduledStart: { gte: ahora }, status: { not: 'CANCELLED' } },
          orderBy: { scheduledStart: 'asc' },
          select: { scheduledStart: true },
        },
      },
    });

    return { series: filas.map((fila) => this.aItem(fila)) };
  }

  /**
   * Pausar, reanudar o terminar.
   *
   * NO TOCA LAS CITAS YA CREADAS, y es deliberado. Pausar una serie porque la
   * clienta se va de viaje no significa cancelar las tres citas que ya estan
   * en la agenda con su equipo asignado: significa dejar de crear mas. Lo que
   * ya existe lo cancela una persona, mirandolo.
   */
  async cambiarEstado(
    id: string,
    cambio: SeriesUpdate,
    staff: AuthenticatedStaff,
    ip: string | null,
  ): Promise<SeriesItem> {
    const actual = await this.prisma.db.recurringSeries.findUnique({ where: { id } });

    if (!actual) {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        messageKey: 'admin.errorSeriesNotFound',
      });
    }

    /*
     * UNA SERIE TERMINADA NO SE REVIVE. Reanudarla meses despues volveria a
     * contar las fechas desde su `startDate` original y generaria la cita de
     * un martes que ya paso o de una clienta que ya no esta. Se crea otra.
     */
    if (actual.status === 'ENDED') {
      throw new ConflictException({
        code: API_ERROR_CODES.SERIES_CONFLICT,
        messageKey: 'admin.errorSeriesEnded',
      });
    }

    const serie = await this.prisma.db.$transaction(async (tx) => {
      const guardada = await tx.recurringSeries.update({
        where: { id },
        data: {
          status: cambio.status,
          /*
           * Al reanudar se olvida de que aviso: si la franja sigue llena, es
           * una noticia otra vez.
           */
          ...(cambio.status === 'ACTIVE' ? { conflictNotifiedFor: null } : {}),
        },
      });

      await this.audit.record(
        {
          staff,
          surface: 'PANEL',
          action: 'series.updated',
          entityType: 'booking',
          entityId: null,
          metadata: { seriesId: id, from: actual.status, to: cambio.status },
          ipAddress: ip,
        },
        tx,
      );

      return guardada;
    });

    return this.aItem({ ...serie, customer: null, bookings: [] });
  }

  /** La zona horaria del negocio, que es donde caen los martes. */
  async zona(): Promise<string> {
    return (await this.availability.schedulingConfig()).timezone;
  }

  /** Solo las frecuencias que de verdad se repiten. */
  esFrecuenciaDeSerie(valor: string): valor is SeriesFrequency {
    return (SERIES_FREQUENCIES as readonly string[]).includes(valor);
  }

  private aItem(fila: {
    id: string;
    status: string;
    frequency: string;
    service: string;
    dayOfWeek: number;
    startTime: string;
    durationMinutes: number;
    startDate: Date;
    endDate: Date | null;
    priceOverrideCents: number | null;
    addOns: unknown;
    customer: { firstName: string; lastName: string } | null;
    bookings: { scheduledStart: Date }[];
  }): SeriesItem {
    return SeriesItemSchema.parse({
      id: fila.id,
      status: fila.status,
      frequency: fila.frequency,
      service: fila.service,
      dayOfWeek: fila.dayOfWeek,
      startTime: fila.startTime,
      durationMinutes: fila.durationMinutes,
      startDate: fila.startDate.toISOString().slice(0, 10),
      endDate: fila.endDate === null ? null : fila.endDate.toISOString().slice(0, 10),
      priceOverrideCents: fila.priceOverrideCents,
      addOns: fila.addOns ?? [],
      customerName: fila.customer
        ? `${fila.customer.firstName} ${fila.customer.lastName}`.trim()
        : '',
      upcomingCount: fila.bookings.length,
      nextAt: fila.bookings[0]?.scheduledStart.toISOString() ?? null,
    });
  }
}
