import type { BookingStatus } from './booking';

/**
 * CICLO DE VIDA DE UNA RESERVA
 * ----------------------------
 * No todo estado puede llevar a cualquier otro, y la regla vive aquí, en un
 * sitio, en vez de repartida entre los botones del panel.
 *
 * Por qué importa: una reserva ya completada que alguien vuelve a poner en
 * "pendiente de pago" descuadra la facturación; una cancelada que revive
 * ocupa un hueco que el sistema ya dio por libre y que puede estar vendido.
 * El panel puede equivocarse, pero el servidor no debe dejarle.
 */
export const BOOKING_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  /** Sin depósito retenido. Se confirma a mano (pago por teléfono) o se cancela. */
  PENDING_PAYMENT: ['CONFIRMED', 'CANCELLED'],
  /** En firme. El equipo puede empezar, o el cliente cancelar, o no estar. */
  CONFIRMED: ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
  /** El equipo está en el domicilio. */
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],

  /*
   * Estados finales. Se corrige un error creando una reserva nueva, no
   * reabriendo la vieja: así el histórico sigue contando lo que de verdad
   * pasó, que es lo que hace falta ante una reclamación.
   */
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
} as const;

/** ¿Se puede pasar de un estado a otro? */
export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

/** Estados a los que se puede ir desde el actual. Para pintar los botones. */
export function allowedTransitions(from: BookingStatus): readonly BookingStatus[] {
  return BOOKING_TRANSITIONS[from];
}

/** true si la reserva ya no admite ningún cambio de estado. */
export function isFinalStatus(status: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[status].length === 0;
}
