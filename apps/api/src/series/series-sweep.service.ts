import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DateTime } from 'luxon';
import { SERIES_HORIZON_WEEKS, seriesOccurrences, type SeriesFrequency } from '@freshness/types';
import type { Env } from '../common/config/env';
import { BookingsService } from '../bookings/bookings.service';
import { PrismaService } from '../database/prisma.service';
import { SweepHeartbeatService } from '../health/sweep-heartbeat.service';
import { StaffNotificationsService } from '../staff-notifications/staff-notifications.service';
import { comoFecha } from '../common/fechas';
import { SeriesService } from './series.service';

/** Retraso de la primera pasada tras arrancar, para no competir con el arranque. */
const RETRASO_INICIAL_MS = 210_000;

/**
 * LAS CITAS DE LAS CLIENTAS DE SIEMPRE
 * ====================================
 * Mantiene creadas las citas de las proximas semanas de cada serie activa.
 *
 * ========================================================================
 * POR QUE POR ADELANTADO Y NO UNA A UNA AL TERMINAR LA ANTERIOR
 * ========================================================================
 * Porque el objetivo no es acordarse de la proxima: es QUE LA AGENDA DIGA LA
 * VERDAD. Si la cita del martes que viene no existe hasta que termine la de
 * esta semana, el cotizador publico sigue ofreciendo ese martes y lo vende.
 *
 * ========================================================================
 * Y POR QUE NO HASTA EL INFINITO
 * ========================================================================
 * Seis semanas. Un ano de citas generadas es un ano de citas que hay que
 * cancelar una a una el dia que la clienta se va, y una agenda llena de
 * compromisos que nadie ha confirmado.
 *
 * ========================================================================
 * LO QUE NO HACE: NO PISA NADA
 * ========================================================================
 * Si la franja esta llena NO crea la cita y NO dobla el equipo por su
 * cuenta: avisa a coordinacion y sigue. Un barrido que decide solo doblar
 * turnos es un barrido que un lunes por la manana sorprende a alguien con
 * dos trabajos a la vez.
 */
@Injectable()
export class SeriesSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SeriesSweepService.name);

  private temporizador: NodeJS.Timeout | null = null;
  private enCurso = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly series: SeriesService,
    private readonly bookings: BookingsService,
    private readonly bandeja: StaffNotificationsService,
    private readonly config: ConfigService<Env, true>,
    private readonly latidos: SweepHeartbeatService,
  ) {}

  onModuleInit(): void {
    const minutos = this.config.get('SERIES_SWEEP_MINUTES', { infer: true });

    if (minutos === 0) {
      this.logger.log('Generacion de citas recurrentes desactivada (SERIES_SWEEP_MINUTES=0)');
      return;
    }

    const cadaMs = minutos * 60_000;
    this.latidos.registrar('recurringSeries', cadaMs);

    this.temporizador = setInterval(() => void this.pasada(), cadaMs);
    this.temporizador.unref();

    setTimeout(() => void this.pasada(), RETRASO_INICIAL_MS).unref();
  }

  onModuleDestroy(): void {
    if (this.temporizador !== null) clearInterval(this.temporizador);
  }

  /** Una pasada. Publica para que las pruebas no dependan del reloj. */
  async pasada(ahora: Date = new Date()): Promise<void> {
    if (this.enCurso) return;
    this.enCurso = true;

    try {
      const zona = await this.series.zona();
      const hoy = DateTime.fromJSDate(ahora).setZone(zona).startOf('day');
      const horizonte = hoy.plus({ weeks: SERIES_HORIZON_WEEKS });

      const activas = await this.prisma.db.recurringSeries.findMany({
        where: { status: 'ACTIVE' },
        include: {
          customer: { select: { email: true, firstName: true, lastName: true, phone: true } },
          address: true,
        },
      });

      for (const serie of activas) {
        await this.generar(serie, hoy.toFormat('yyyy-MM-dd'), horizonte.toFormat('yyyy-MM-dd'));
      }

      this.latidos.anotar('recurringSeries', ahora.getTime());
    } catch (error) {
      this.logger.error(
        'No se pudieron generar las citas recurrentes: ' +
          (error instanceof Error ? error.message : 'error desconocido'),
      );
    } finally {
      this.enCurso = false;
    }
  }

  private async generar(
    serie: {
      id: string;
      frequency: string;
      startDate: Date;
      endDate: Date | null;
      startTime: string;
      service: string;
      bedrooms: number;
      bathrooms: number;
      squareFeet: number;
      addOns: unknown;
      priceOverrideCents: number | null;
      conflictNotifiedFor: Date | null;
      customer: { email: string; firstName: string; lastName: string; phone: string };
      address: {
        line1: string;
        line2: string | null;
        city: string;
        state: string;
        postalCode: string;
        accessNotes: string | null;
      };
    },
    desde: string,
    hasta: string,
  ): Promise<void> {
    if (!this.series.esFrecuenciaDeSerie(serie.frequency)) return;

    const zona = await this.series.zona();
    const fechas = seriesOccurrences(
      serie.startDate.toISOString().slice(0, 10),
      serie.frequency satisfies string as SeriesFrequency,
      desde,
      hasta,
      serie.endDate === null ? null : serie.endDate.toISOString().slice(0, 10),
    );

    /*
     * LAS QUE YA EXISTEN SE PIDEN DE UNA VEZ, no una consulta por fecha. Seis
     * semanas de una serie semanal son seis consultas por clienta y por
     * pasada para, casi siempre, no encontrar nada que hacer.
     */
    const existentes = await this.prisma.db.booking.findMany({
      where: { seriesId: serie.id, status: { not: 'CANCELLED' } },
      select: { scheduledStart: true, seriesOccurrenceDate: true },
    });

    /*
     * SE PREGUNTA POR LA OCURRENCIA, NO POR EL DIA EN QUE SE HACE, Y ES LA
     * DIFERENCIA ENTRE UNA CITA Y DOS.
     *
     * Mientras nadie mueva nada las dos fechas coinciden y esto parece una
     * vuelta inutil. Desde que se puede mover una cita (etapa 3.32) deja de
     * serlo: si se compara el dia en que la cita se hace, mover la del
     * martes 3 al jueves 5 deja el martes 3 sin cubrir, y en la pasada
     * siguiente este barrido crea otra cita el martes 3. La clienta acaba
     * con dos citas esa semana, la que pidio mover y una recien nacida en el
     * hueco que acababa de dejar.
     *
     * `seriesOccurrenceDate` no se mueve nunca. Para las citas creadas antes
     * de que existiera la columna se cae a su propia fecha, que es lo que
     * eran: nadie las habia podido mover.
     */
    const yaCreadas = new Set(
      existentes.map((fila) =>
        DateTime.fromJSDate(fila.seriesOccurrenceDate ?? fila.scheduledStart)
          .setZone(fila.seriesOccurrenceDate === null ? zona : 'utc')
          .toFormat('yyyy-MM-dd'),
      ),
    );

    let choque: string | null = null;

    for (const fecha of fechas) {
      if (yaCreadas.has(fecha)) continue;

      const inicio = DateTime.fromISO(`${fecha}T${serie.startTime}`, { zone: zona });
      if (!inicio.isValid) continue;

      try {
        await this.bookings.create(
          {
            service: serie.service as never,
            frequency: serie.frequency as never,
            bedrooms: serie.bedrooms,
            bathrooms: serie.bathrooms,
            squareFeet: serie.squareFeet,
            addOns: (serie.addOns ?? []) as never,
            startsAt: inicio.toUTC().toISO() ?? '',
            contact: {
              firstName: serie.customer.firstName,
              lastName: serie.customer.lastName,
              email: serie.customer.email,
              phone: serie.customer.phone,
              locale: 'en',
              marketingOptIn: false,
            },
            address: {
              line1: serie.address.line1,
              ...(serie.address.line2 === null ? {} : { line2: serie.address.line2 }),
              city: serie.address.city,
              state: serie.address.state,
              postalCode: serie.address.postalCode,
              ...(serie.address.accessNotes === null
                ? {}
                : { accessNotes: serie.address.accessNotes }),
            },
            mediaConsent: { granted: false, allowsBefore: false, occupiedByOthers: false },
          },
          new Date(),
          null,
          {
            staff: null,
            seriesId: serie.id,
            /*
             * EL DIA QUE LE TOCABA, que es el que se esta generando. A partir
             * de aqui la cita se puede mover sin que este barrido crea que
             * esta semana se quedo sin cita.
             */
            seriesOccurrenceDate: fecha,
            overrides: {
              source: 'ADMIN',
              /*
               * El horario y la antelacion no aplican: esta cita la pacto la
               * duena hace meses, no la acaba de pedir un desconocido.
               */
              allowOutsideHours: true,
              /*
               * PERO EL CHOQUE SI. Un barrido no decide doblar un equipo.
               */
              allowOverlap: false,
              priceOverrideCents: serie.priceOverrideCents,
              /*
               * SIN CORREO DE CONFIRMACION. Seis citas generadas de golpe
               * serian seis correos de algo que la clienta ya pacto por
               * telefono. El recordatorio de la vispera, que si existe, es
               * el aviso que sirve de algo.
               */
              notifyCustomer: false,
              reason: 'Generada por la serie recurrente',
            },
          },
        );
      } catch (error) {
        /*
         * LA PRIMERA FECHA QUE CHOCA ES LA QUE SE AVISA, y se sigue con las
         * demas: que el martes que viene este lleno no es motivo para dejar
         * sin crear el de dentro de un mes.
         */
        choque ??= fecha;

        this.logger.warn(
          `La serie ${serie.id} no pudo crear la cita del ${fecha}: ` +
            (error instanceof Error ? error.message : 'error desconocido'),
        );
      }
    }

    await this.anotarChoque(serie, choque);
  }

  /**
   * Avisa del choque UNA VEZ por fecha.
   *
   * El barrido pasa cada hora: sin recordar de que fecha ya se aviso, la
   * misma franja llena generaria un aviso cada hora hasta que alguien la
   * arreglara, y entonces la bandeja deja de servir para nada.
   */
  private async anotarChoque(
    serie: { id: string; conflictNotifiedFor: Date | null; startTime: string },
    choque: string | null,
  ): Promise<void> {
    const anotado =
      serie.conflictNotifiedFor === null
        ? null
        : serie.conflictNotifiedFor.toISOString().slice(0, 10);

    if (choque === anotado) return;

    await this.prisma.db.recurringSeries.update({
      where: { id: serie.id },
      data: { conflictNotifiedFor: choque === null ? null : comoFecha(choque) },
    });

    if (choque === null) return;

    await this.bandeja.emitir({
      kind: 'series.slot_taken',
      entityType: 'series',
      entityId: serie.id,
      /*
       * La fecha y la hora, nada de la clienta: la bandeja se mira en una
       * pantalla compartida. Quien abra la serie vera de quien es.
       */
      params: { when: choque, time: serie.startTime },
    });
  }
}
