import { DateTime, Interval } from 'luxon';
import type { AvailabilitySlot, SlotUnavailableReason } from '@freshness/types';
import type { SchedulingConfig } from './scheduling.config';

/** Cita ya existente que ocupa equipo. */
export interface OccupiedInterval {
  startsAt: Date;
  endsAt: Date;
}

export interface SlotGenerationInput {
  /** Dia a calcular, AAAA-MM-DD en la zona horaria de la empresa. */
  date: string;
  durationMinutes: number;
  now: Date;
  occupied: OccupiedInterval[];
  config: SchedulingConfig;
}

export interface SlotGenerationResult {
  businessOpen: boolean;
  slots: AvailabilitySlot[];
}

/**
 * GENERACION DE FRANJAS HORARIAS
 * ------------------------------
 * Funcion pura: entran el dia, la duracion y las citas ya ocupadas, y salen
 * las franjas con su motivo de no disponibilidad. No toca la base de datos ni
 * el reloj, asi que se puede probar a fondo con fechas fijas, incluido el fin
 * de semana del cambio de hora.
 *
 * Una franja se ofrece si se cumplen las tres condiciones:
 *   1. El trabajo TERMINA antes de la hora de cierre. No vale empezar a las
 *      17:30 un trabajo de tres horas.
 *   2. Empieza con la antelacion minima.
 *   3. Queda algun equipo libre durante todo el trabajo.
 */
export function generateSlots(input: SlotGenerationInput): SlotGenerationResult {
  const { config, durationMinutes } = input;

  const dayStart = DateTime.fromISO(input.date, { zone: config.timezone }).startOf('day');
  if (!dayStart.isValid) {
    return { businessOpen: false, slots: [] };
  }

  const hours = config.businessHours[dayStart.weekday];
  if (!hours) {
    return { businessOpen: false, slots: [] };
  }

  const open = applyLocalTime(dayStart, hours.open);
  const close = applyLocalTime(dayStart, hours.close);
  const earliestStart = DateTime.fromJSDate(input.now).plus({ hours: config.minLeadTimeHours });

  // Las citas ocupadas se convierten una sola vez a intervalos comparables.
  const occupied = input.occupied.map((item) =>
    Interval.fromDateTimes(DateTime.fromJSDate(item.startsAt), DateTime.fromJSDate(item.endsAt)),
  );

  const slots: AvailabilitySlot[] = [];

  for (
    let start = open;
    start.plus({ minutes: durationMinutes }) <= close;
    start = start.plus({ minutes: config.slotIntervalMinutes })
  ) {
    const end = start.plus({ minutes: durationMinutes });
    const reason = unavailableReason({ start, end, earliestStart, occupied, crews: config.crews });

    slots.push({
      startsAt: start.toUTC().toISO() ?? '',
      endsAt: end.toUTC().toISO() ?? '',
      localTime: start.toFormat('HH:mm'),
      available: reason === null,
      reason,
    });
  }

  return { businessOpen: true, slots };
}

function applyLocalTime(dayStart: DateTime, time: string): DateTime {
  const [hour, minute] = time.split(':').map(Number);
  return dayStart.set({ hour: hour ?? 0, minute: minute ?? 0, second: 0, millisecond: 0 });
}

function unavailableReason(args: {
  start: DateTime;
  end: DateTime;
  earliestStart: DateTime;
  occupied: Interval[];
  crews: number;
}): SlotUnavailableReason | null {
  if (args.start < args.earliestStart) {
    return 'TOO_SOON';
  }

  const candidate = Interval.fromDateTimes(args.start, args.end);
  // Se cuentan los trabajos que se solapan: si todos los equipos estan
  // ocupados en algun momento del intervalo, la franja no se puede ofrecer.
  const overlapping = args.occupied.filter((busy) => busy.overlaps(candidate)).length;

  return overlapping >= args.crews ? 'FULLY_BOOKED' : null;
}

/**
 * Comprueba que una hora de inicio concreta sigue siendo valida.
 *
 * Se usa al reservar, y no basta con confiar en lo que envia el navegador:
 * entre que el cliente ve las franjas y pulsa "reservar" pueden pasar minutos
 * y otra persona puede haber ocupado el hueco.
 */
export function isSlotStillAvailable(
  startsAt: Date,
  input: Omit<SlotGenerationInput, 'date'>,
): boolean {
  const start = DateTime.fromJSDate(startsAt).setZone(input.config.timezone);
  const date = start.toFormat('yyyy-MM-dd');

  const { slots } = generateSlots({ ...input, date });
  const target = start.toUTC().toISO();

  return slots.some((slot) => slot.startsAt === target && slot.available);
}
