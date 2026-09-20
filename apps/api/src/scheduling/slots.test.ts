import { describe, expect, it } from 'vitest';
import { generateSlots, isSlotStillAvailable, type OccupiedInterval } from './slots';
import { defaultSchedulingConfig } from './scheduling.config';

const config = defaultSchedulingConfig;

/** Lunes 2026-10-05. Se fija el "ahora" muy anterior para que no estorbe. */
const LUNES = '2026-10-05';
const AHORA = new Date('2026-10-01T12:00:00Z');

function slotsDe(
  date: string,
  durationMinutes: number,
  occupied: OccupiedInterval[] = [],
  now: Date = AHORA,
) {
  return generateSlots({ date, durationMinutes, now, occupied, config });
}

describe('generacion de franjas', () => {
  it('el domingo la empresa esta cerrada', () => {
    const resultado = slotsDe('2026-10-04', 120); // domingo
    expect(resultado.businessOpen).toBe(false);
    expect(resultado.slots).toEqual([]);
  });

  it('un lunes abre a las 08:00 en hora local', () => {
    const { slots, businessOpen } = slotsDe(LUNES, 120);
    expect(businessOpen).toBe(true);
    expect(slots[0]?.localTime).toBe('08:00');
  });

  it('las franjas van de 30 en 30 minutos', () => {
    const { slots } = slotsDe(LUNES, 120);
    expect(slots.slice(0, 4).map((s) => s.localTime)).toEqual(['08:00', '08:30', '09:00', '09:30']);
  });

  it('el trabajo debe TERMINAR antes del cierre, no empezar antes', () => {
    // Cierre a las 18:00; un trabajo de 3 horas no puede empezar a las 15:30.
    const { slots } = slotsDe(LUNES, 180);
    expect(slots.at(-1)?.localTime).toBe('15:00');
  });

  it('un trabajo que no cabe en la jornada no ofrece ninguna franja', () => {
    const { slots, businessOpen } = slotsDe(LUNES, 600); // 10 horas, jornada de 10
    expect(businessOpen).toBe(true);
    expect(slots.length).toBeLessThanOrEqual(1);
  });

  it('el sabado el horario es mas corto', () => {
    const sabado = slotsDe('2026-10-03', 120);
    expect(sabado.slots[0]?.localTime).toBe('09:00');
    expect(sabado.slots.at(-1)?.localTime).toBe('14:00'); // cierra a las 16:00
  });
});

describe('antelacion minima', () => {
  it('marca como demasiado pronto lo que no respeta las 24 horas', () => {
    // "Ahora" es el mismo lunes a las 08:00 locales (12:00 UTC).
    const ahora = new Date('2026-10-05T12:00:00Z');
    const { slots } = slotsDe(LUNES, 120, [], ahora);

    expect(slots.every((slot) => !slot.available)).toBe(true);
    expect(slots[0]?.reason).toBe('TOO_SOON');
  });

  it('pasada la antelacion, las franjas se ofrecen', () => {
    const ahora = new Date('2026-10-03T12:00:00Z'); // dos dias antes
    const { slots } = slotsDe(LUNES, 120, [], ahora);
    expect(slots.some((slot) => slot.available)).toBe(true);
  });
});

describe('capacidad de equipos', () => {
  const manana = (hora: string) => new Date(`2026-10-05T${hora}:00Z`);

  it('con un equipo ocupado todavia queda sitio', () => {
    const { slots } = slotsDe(LUNES, 120, [{ startsAt: manana('12:00'), endsAt: manana('14:00') }]);
    const primera = slots.find((slot) => slot.localTime === '08:00');
    expect(primera?.available).toBe(true);
  });

  it('con los dos equipos ocupados la franja se cierra', () => {
    // 12:00 UTC = 08:00 locales en horario de verano del este.
    const { slots } = slotsDe(LUNES, 120, [
      { startsAt: manana('12:00'), endsAt: manana('14:00') },
      { startsAt: manana('12:00'), endsAt: manana('14:00') },
    ]);

    const primera = slots.find((slot) => slot.localTime === '08:00');
    expect(primera?.available).toBe(false);
    expect(primera?.reason).toBe('FULLY_BOOKED');
  });

  it('un solapamiento parcial tambien cuenta', () => {
    // Dos equipos ocupados de 09:00 a 11:00 locales chocan con un trabajo
    // que empieza a las 08:00 y dura dos horas.
    const { slots } = slotsDe(LUNES, 120, [
      { startsAt: manana('13:00'), endsAt: manana('15:00') },
      { startsAt: manana('13:00'), endsAt: manana('15:00') },
    ]);

    expect(slots.find((slot) => slot.localTime === '08:00')?.available).toBe(false);
    // A las 07:00 no hay franja; a las 11:00 locales ya ha terminado el choque.
    expect(slots.find((slot) => slot.localTime === '11:00')?.available).toBe(true);
  });
});

describe('cambio de hora', () => {
  /**
   * En 2026 el horario de verano del este de EE. UU. termina el 1 de noviembre.
   * Si el horario comercial se calculara con un desfase fijo respecto a UTC,
   * las citas del dia siguiente al cambio se desplazarian una hora.
   */
  it('la apertura sigue siendo a las 08:00 locales antes y despues del cambio', () => {
    const antes = slotsDe('2026-10-30', 120); // viernes, horario de verano
    const despues = slotsDe('2026-11-02', 120); // lunes, horario estandar

    expect(antes.slots[0]?.localTime).toBe('08:00');
    expect(despues.slots[0]?.localTime).toBe('08:00');
  });

  it('pero el instante real en UTC SI cambia una hora', () => {
    const antes = slotsDe('2026-10-30', 120).slots[0]?.startsAt ?? '';
    const despues = slotsDe('2026-11-02', 120).slots[0]?.startsAt ?? '';

    expect(antes).toContain('T12:00'); // UTC-4 en verano
    expect(despues).toContain('T13:00'); // UTC-5 en invierno
  });
});

describe('validacion de una franja concreta al reservar', () => {
  const base = { durationMinutes: 120, now: AHORA, config };

  it('acepta una franja que sigue libre', () => {
    const inicio = new Date(slotsDe(LUNES, 120).slots[0]?.startsAt ?? '');
    expect(isSlotStillAvailable(inicio, { ...base, occupied: [] })).toBe(true);
  });

  it('rechaza una franja que otro cliente ocupo mientras tanto', () => {
    const inicio = new Date(slotsDe(LUNES, 120).slots[0]?.startsAt ?? '');
    const ocupada = [
      { startsAt: inicio, endsAt: new Date(inicio.getTime() + 7_200_000) },
      { startsAt: inicio, endsAt: new Date(inicio.getTime() + 7_200_000) },
    ];

    expect(isSlotStillAvailable(inicio, { ...base, occupied: ocupada })).toBe(false);
  });

  it('rechaza una hora que no cae en ninguna franja', () => {
    const inicio = new Date('2026-10-05T12:07:00Z'); // 08:07 locales
    expect(isSlotStillAvailable(inicio, { ...base, occupied: [] })).toBe(false);
  });

  it('rechaza un domingo', () => {
    const domingo = new Date('2026-10-04T13:00:00Z');
    expect(isSlotStillAvailable(domingo, { ...base, occupied: [] })).toBe(false);
  });
});
