import { describe, expect, it } from 'vitest';
import { BookingStatusSchema } from './booking';
import {
  BOOKING_TRANSITIONS,
  allowedTransitions,
  canTransition,
  isFinalStatus,
} from './booking-transitions';

describe('ciclo de vida de una reserva', () => {
  it('cubre TODOS los estados del contrato', () => {
    // Si manana se anade un estado y se olvida aqui, el panel no sabria que
    // hacer con el y este test lo dice antes de que llegue a produccion.
    expect(Object.keys(BOOKING_TRANSITIONS).sort()).toEqual(
      [...BookingStatusSchema.options].sort(),
    );
  });

  it('el camino normal funciona de principio a fin', () => {
    expect(canTransition('PENDING_PAYMENT', 'CONFIRMED')).toBe(true);
    expect(canTransition('CONFIRMED', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
  });

  it('se puede cancelar mientras la reserva sigue viva', () => {
    for (const estado of ['PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'] as const) {
      expect(canTransition(estado, 'CANCELLED'), estado).toBe(true);
    }
  });

  it('solo se marca "no estaban" desde una reserva confirmada', () => {
    // Sin confirmar no hay cita a la que faltar, y si el equipo ya entro
    // (IN_PROGRESS) es que el cliente si estaba.
    expect(canTransition('CONFIRMED', 'NO_SHOW')).toBe(true);
    expect(canTransition('PENDING_PAYMENT', 'NO_SHOW')).toBe(false);
    expect(canTransition('IN_PROGRESS', 'NO_SHOW')).toBe(false);
  });

  it('los estados finales no admiten vuelta atras', () => {
    /*
     * Reabrir una reserva completada descuadra la facturacion, y revivir una
     * cancelada ocupa un hueco que el sistema ya dio por libre y que puede
     * estar vendido. Se corrige creando una reserva nueva.
     */
    for (const estado of ['COMPLETED', 'CANCELLED', 'NO_SHOW'] as const) {
      expect(isFinalStatus(estado), estado).toBe(true);
      expect(allowedTransitions(estado), estado).toEqual([]);
    }
  });

  it('no se puede saltar la ejecucion del trabajo', () => {
    // Pasar de confirmada a completada sin pasar por "en curso" dejaria sin
    // registrar cuando empezo y acabo el equipo.
    expect(canTransition('CONFIRMED', 'COMPLETED')).toBe(false);
  });

  it('ningun estado puede transicionar a si mismo', () => {
    for (const estado of BookingStatusSchema.options) {
      expect(canTransition(estado, estado), estado).toBe(false);
    }
  });
});
