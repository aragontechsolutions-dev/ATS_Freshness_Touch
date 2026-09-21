import { DEFAULT_BUSINESS_SETTINGS, type WeeklyHours } from '@freshness/types';

/**
 * CONFIGURACION DE AGENDA
 * -----------------------
 * Capacidad y reglas de reserva.
 *
 * QUE SE EDITA Y QUE NO. El horario comercial ya NO vive aqui: se guarda en
 * `business_settings` y se cambia desde el panel, porque es una decision del
 * negocio que cambia con las estaciones. Lo que queda en este fichero son
 * reglas cuya modificacion cambia lo que el sistema le PROMETE al cliente
 * (cuanto se tarda en avisar al equipo, cuantas citas caben a la vez, cuanto
 * se retiene una tarjeta), y eso merece un cambio pensado y revisado, no un
 * campo de formulario.
 *
 * La zona horaria tampoco se edita, y es la que mas tentacion da: cambiarla
 * reinterpretaria la hora local de TODAS las citas ya guardadas, incluidas
 * las que ya estan confirmadas con el cliente.
 */

export interface SchedulingConfig {
  /**
   * Zona horaria de la empresa. Todo el horario comercial se interpreta aqui
   * y se convierte a UTC para guardarlo: Georgia cambia de hora dos veces al
   * ano y una cita calculada con un desfase fijo se desplazaria una hora.
   */
  timezone: string;

  /**
   * Horario por dia de la semana: 1 = lunes ... 7 = domingo. null = cerrado.
   * Se resuelve en cada peticion desde `BusinessSettingsService`; el valor de
   * esta constante es solo el punto de partida de una instalacion nueva.
   */
  businessHours: WeeklyHours;

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

  // Una sola fuente de verdad con el contrato compartido: si el horario de
  // partida cambia, cambia en un sitio y lo ven la API y el panel a la vez.
  businessHours: DEFAULT_BUSINESS_SETTINGS.hours,

  slotIntervalMinutes: 30,
  crews: 2,
  minLeadTimeHours: 24,
  maxAdvanceDays: 90,
  paymentHoldMinutes: 30,
};
