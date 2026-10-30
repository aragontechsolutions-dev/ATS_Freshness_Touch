import { describe, expect, it } from 'vitest';
import { BOOKING_TRANSITIONS } from './booking-transitions';
import {
  AdminRescheduleSchema,
  RESCHEDULABLE_STATUSES,
  RESCHEDULE_FREE_NOTICE_HOURS,
  canReschedule,
  isLateReschedule,
} from './reschedule';

const AHORA = new Date('2026-11-02T14:00:00.000Z');
const enHoras = (horas: number): Date => new Date(AHORA.getTime() + horas * 3_600_000);

describe('desde que estados se puede mover una cita', () => {
  it('pendiente de pago y confirmada, si', () => {
    expect(canReschedule('PENDING_PAYMENT')).toBe(true);
    expect(canReschedule('CONFIRMED')).toBe(true);
  });

  it('UNA QUE YA ESTA PASANDO, NO', () => {
    /*
     * El equipo esta dentro de la casa. Mover eso no es mover una cita: es
     * inventarse que no ha pasado, y el historico es justo lo que hace falta
     * cuando hay una reclamacion.
     */
    expect(canReschedule('IN_PROGRESS')).toBe(false);
  });

  it('y ninguno de los finales', () => {
    expect(canReschedule('COMPLETED')).toBe(false);
    expect(canReschedule('CANCELLED')).toBe(false);
    expect(canReschedule('NO_SHOW')).toBe(false);
  });

  it('la lista no se queda atras si manana hay un estado nuevo', () => {
    /*
     * `BOOKING_TRANSITIONS` es un `Record<BookingStatus, ...>`, asi que el
     * compilador ya obliga a que tenga todos los estados. Esta cuenta cierra
     * el circulo: si manana hay un estado nuevo, falla aqui y obliga a venir
     * y DECIDIR si desde el se puede mover, en vez de que el silencio decida
     * que no.
     */
    expect(Object.keys(BOOKING_TRANSITIONS)).toHaveLength(6);
    expect(RESCHEDULABLE_STATUSES).toHaveLength(2);
  });
});

describe('cuando un movimiento llega tarde', () => {
  it(`mas de ${RESCHEDULE_FREE_NOTICE_HOURS} h antes de la cita vieja, es a tiempo`, () => {
    expect(isLateReschedule(enHoras(25), AHORA)).toBe(false);
    expect(isLateReschedule(enHoras(24.5), AHORA)).toBe(false);
  });

  it('justo en el limite, es a tiempo', () => {
    // La promesa dice «al menos 24 horas antes». Exactamente 24 cumple.
    expect(isLateReschedule(enHoras(RESCHEDULE_FREE_NOTICE_HOURS), AHORA)).toBe(false);
  });

  it('por debajo del limite, es tarde', () => {
    expect(isLateReschedule(enHoras(23.9), AHORA)).toBe(true);
    expect(isLateReschedule(enHoras(1), AHORA)).toBe(true);
  });

  it('SE MIDE CONTRA LA CITA VIEJA, no contra la nueva', () => {
    /*
     * Es el sentido de la promesa: lo que cuesta dinero a la empresa es
     * quedarse sin el hueco de manana con el equipo ya organizado. Que la
     * fecha nueva este a tres semanas no lo arregla.
     */
    const citaDeManana = enHoras(3);

    expect(isLateReschedule(citaDeManana, AHORA)).toBe(true);
  });

  it('una cita que ya paso tambien cuenta como tarde', () => {
    // No deberia llegar aqui —el estado lo impide— pero si llega, la
    // respuesta honesta es «tarde», no «a tiempo por mucho».
    expect(isLateReschedule(enHoras(-5), AHORA)).toBe(true);
  });
});

describe('lo que manda el panel', () => {
  const minimo = { startsAt: '2026-11-10T14:00:00.000Z' };

  it('con la hora nueva basta, y lo demas tiene valores por defecto', () => {
    const parsed = AdminRescheduleSchema.safeParse(minimo);

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.allowOutsideHours).toBe(false);
    expect(parsed.data.allowOverlap).toBe(false);
    // Encendido por defecto: una cita que cambia de hora sin que el cliente
    // lo sepa es una casa vacia el dia del servicio.
    expect(parsed.data.notifyCustomer).toBe(true);
    expect(parsed.data.reason).toBe('');
  });

  it('una hora que no es una fecha no pasa', () => {
    expect(AdminRescheduleSchema.safeParse({ startsAt: 'manana a las nueve' }).success).toBe(false);
  });

  it('SALTARSE UNA NORMA EXIGE ESCRIBIR POR QUE', () => {
    expect(AdminRescheduleSchema.safeParse({ ...minimo, allowOutsideHours: true }).success).toBe(
      false,
    );
    expect(AdminRescheduleSchema.safeParse({ ...minimo, allowOverlap: true }).success).toBe(false);

    expect(
      AdminRescheduleSchema.safeParse({
        ...minimo,
        allowOverlap: true,
        reason: 'Entra Marta a echar una mano',
      }).success,
    ).toBe(true);
  });

  it('NO SE PUEDE RETARIFICAR AL MOVER', () => {
    /*
     * `AdminBookingOverrides` si lleva `priceOverrideCents`, porque al crear
     * una cita a mano hay un precio que pactar. Mover no cambia lo que
     * cuesta el trabajo, y aceptarlo aqui seria una forma silenciosa de
     * cambiar un precio ya acordado desde una pantalla que dice «mover».
     */
    expect(AdminRescheduleSchema.safeParse({ ...minimo, priceOverrideCents: 9900 }).success).toBe(
      false,
    );
  });

  it('ni cambiar el estado, ni la direccion, ni el cliente', () => {
    for (const colado of [
      { status: 'COMPLETED' },
      { customerId: '8f2c1a94-1d3e-4f55-9b77-2c0a5e6d7f88' },
      { squareFeet: 4000 },
    ]) {
      expect(
        AdminRescheduleSchema.safeParse({ ...minimo, ...colado }).success,
        `deberia rechazar: ${JSON.stringify(colado)}`,
      ).toBe(false);
    }
  });
});
