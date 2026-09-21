import { BadRequestException, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { estimateDurationMinutes } from '@freshness/pricing';
import {
  API_ERROR_CODES,
  type AvailabilityRequest,
  type AvailabilityResponse,
} from '@freshness/types';
import { PrismaService } from '../database/prisma.service';
import { BusinessSettingsService } from '../settings/business-settings.service';
import type { Prisma } from '../generated/prisma/client';
import { BookingStatus } from '../generated/prisma/enums';
import { defaultSchedulingConfig, type SchedulingConfig } from './scheduling.config';
import { generateSlots, type OccupiedInterval } from './slots';

@Injectable()
export class AvailabilityService {
  /**
   * Reglas que NO se editan desde el panel: zona horaria, equipos, antelacion
   * minima y plazos. El horario que trae es solo el de partida; para agendar
   * se usa `schedulingConfig()`, que lee el vigente.
   */
  readonly config: SchedulingConfig = defaultSchedulingConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: BusinessSettingsService,
  ) {}

  /**
   * Las reglas fijas con el horario que la empresa tiene puesto ahora mismo.
   *
   * Se resuelve en cada peticion y no se guarda en el servicio: si se
   * calculara una sola vez al arrancar, cambiar el horario desde el panel no
   * tendria efecto hasta el siguiente despliegue, que es exactamente lo que
   * este trabajo viene a evitar. La lectura esta cacheada en el servicio de
   * configuracion, asi que no cuesta una consulta por peticion.
   */
  async schedulingConfig(): Promise<SchedulingConfig> {
    return { ...this.config, businessHours: await this.settings.hours() };
  }

  async getAvailability(
    request: AvailabilityRequest,
    now: Date = new Date(),
  ): Promise<AvailabilityResponse> {
    const durationMinutes = this.durationFor(request);
    this.assertDateInRange(request.date, now);

    const config = await this.schedulingConfig();
    const occupied = await this.findOccupied(request.date, now);
    const { businessOpen, slots } = generateSlots({
      date: request.date,
      durationMinutes,
      now,
      occupied,
      config,
    });

    return {
      date: request.date,
      timezone: this.config.timezone,
      durationMinutes,
      businessOpen,
      slots,
    };
  }

  /** Duracion del trabajo; rechaza lo que no se puede agendar solo. */
  durationFor(request: {
    service: AvailabilityRequest['service'];
    bedrooms: number;
    bathrooms: number;
    squareFeet: number;
    addOns: AvailabilityRequest['addOns'];
  }): number {
    const durationMinutes = estimateDurationMinutes(request);

    if (durationMinutes === 0) {
      // Comercial: se cotiza y se agenda tras la visita, no desde la web.
      throw new BadRequestException({
        code: API_ERROR_CODES.BOOKING_NOT_QUOTABLE,
        messageKey: 'booking.errorRequiresWalkthrough',
      });
    }

    return durationMinutes;
  }

  /** La agenda no se abre indefinidamente hacia el futuro ni hacia el pasado. */
  assertDateInRange(date: string, now: Date): void {
    const day = DateTime.fromISO(date, { zone: this.config.timezone }).startOf('day');
    const today = DateTime.fromJSDate(now).setZone(this.config.timezone).startOf('day');

    const fueraDeRango =
      !day.isValid || day < today || day > today.plus({ days: this.config.maxAdvanceDays });

    if (fueraDeRango) {
      throw new BadRequestException({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        messageKey: 'booking.errorDateOutOfRange',
      });
    }
  }

  /**
   * Citas que ocupan equipo ese dia.
   *
   * Cuentan las confirmadas y las que estan en curso, y ademas las pendientes
   * de pago recientes: esas retienen la franja un rato para que dos personas
   * no paguen el mismo hueco. Pasado el plazo dejan de contar, porque un
   * formulario abandonado no puede bloquear la agenda para siempre.
   */
  async findOccupied(
    date: string,
    now: Date,
    /**
     * Cliente alternativo. Al reservar se pasa el de la transaccion, para que
     * la comprobacion vea lo mismo que la escritura y el bloqueo sirva de algo.
     */
    client?: Prisma.TransactionClient,
  ): Promise<OccupiedInterval[]> {
    const day = DateTime.fromISO(date, { zone: this.config.timezone });
    const dayStart = day.startOf('day').toJSDate();
    const dayEnd = day.endOf('day').toJSDate();
    const holdCutoff = new Date(now.getTime() - this.config.paymentHoldMinutes * 60_000);

    const db = client ?? this.prisma.db;
    const bookings = await db.booking.findMany({
      where: {
        scheduledStart: { lt: dayEnd },
        scheduledEnd: { gt: dayStart },
        OR: [
          { status: { in: [BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS] } },
          { status: BookingStatus.PENDING_PAYMENT, createdAt: { gt: holdCutoff } },
        ],
      },
      select: { scheduledStart: true, scheduledEnd: true },
    });

    return bookings.map((booking) => ({
      startsAt: booking.scheduledStart,
      endsAt: booking.scheduledEnd,
    }));
  }
}
