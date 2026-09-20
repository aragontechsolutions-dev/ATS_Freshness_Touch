/**
 * CONFIGURACION DE AGENDA
 * -----------------------
 * Horario comercial, capacidad y reglas de reserva.
 *
 * Vive aqui como constante mientras no exista el panel de administracion.
 * En la Etapa 2.3 pasara a la tabla `business_settings`, para que la empresa
 * pueda cambiar su horario sin tocar codigo ni desplegar.
 */

export interface BusinessHours {
  /** Hora local de apertura, HH:MM en 24 horas. */
  open: string;
  /** Hora local de cierre. El trabajo debe TERMINAR antes de esta hora. */
  close: string;
}

export interface SchedulingConfig {
  /**
   * Zona horaria de la empresa. Todo el horario comercial se interpreta aqui
   * y se convierte a UTC para guardarlo: Georgia cambia de hora dos veces al
   * ano y una cita calculada con un desfase fijo se desplazaria una hora.
   */
  timezone: string;

  /** Horario por dia de la semana: 1 = lunes ... 7 = domingo. null = cerrado. */
  businessHours: Record<number, BusinessHours | null>;

  /** Cada cuantos minutos se ofrece una hora de inicio. */
  slotIntervalMinutes: number;

  /**
   * Equipos que pueden trabajar a la vez. Es el limite real de cuantas citas
   * se solapan. Con 2 equipos caben 2 trabajos simultaneos, no mas.
   */
  crews: number;

  /**
   * Antelacion minima. Sin este margen no da tiempo a organizar al equipo ni
   * a comprar material, y se acaba cancelando al cliente.
   */
  minLeadTimeHours: number;

  /** Hasta cuando se puede reservar. Mas alla, la agenda es pura especulacion. */
  maxAdvanceDays: number;

  /**
   * Cuanto retiene la franja una reserva pendiente de pago. Pasado ese tiempo
   * el hueco vuelve a ofrecerse: si no se retiene, dos personas pueden pagar
   * la misma franja; si se retiene para siempre, un formulario abandonado
   * bloquea la agenda.
   */
  paymentHoldMinutes: number;
}

export const defaultSchedulingConfig: SchedulingConfig = {
  timezone: 'America/New_York',

  businessHours: {
    1: { open: '08:00', close: '18:00' },
    2: { open: '08:00', close: '18:00' },
    3: { open: '08:00', close: '18:00' },
    4: { open: '08:00', close: '18:00' },
    5: { open: '08:00', close: '18:00' },
    6: { open: '09:00', close: '16:00' },
    7: null, // domingo cerrado
  },

  slotIntervalMinutes: 30,
  crews: 2,
  minLeadTimeHours: 24,
  maxAdvanceDays: 90,
  paymentHoldMinutes: 30,
};
