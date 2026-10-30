import { z } from 'zod';
import type { BookingStatus } from './booking';

/**
 * MOVER LA CITA
 * =============
 * Hasta esta etapa, reprogramar era CANCELAR Y CREAR OTRA. Y eso no es un
 * atajo incomodo: es otra cosa distinta.
 *
 *   - Se pierde el historial. Donde hubo un servicio quedan dos filas, una
 *     cancelada y una nueva, y la del medio —la que explica por que— no
 *     existe en ninguna parte.
 *   - Cambia la referencia. El cliente tiene por escrito `FT-2026-0041` y la
 *     cita que de verdad va a ocurrir es la `FT-2026-0052`. Eso es una
 *     llamada de telefono confusa garantizada.
 *   - Hay que decidir que hacer con la retencion. Cancelar no toca el dinero
 *     —a proposito— asi que una reprogramacion hecha a base de cancelar deja
 *     35 dolares bloqueados en una tarjeta y una cita nueva sin deposito.
 *
 * Y es la operacion que mas se va a pedir, porque es la que el sitio promete
 * por escrito en las preguntas frecuentes:
 *
 *   «Contact us at least 24 hours before your appointment and we will move it
 *   at no cost. Within 24 hours, or once our team is on the way, we charge the
 *   $35 deposit and nothing more.»
 *
 * ========================================================================
 * MOVER NO COBRA NADA, Y ES DELIBERADO
 * ========================================================================
 * Las 24 horas de la promesa estan aqui —`RESCHEDULE_FREE_NOTICE_HOURS`— y
 * el servidor dice si un movimiento cae dentro o fuera. Lo que NO hace es
 * cobrar el deposito por su cuenta.
 *
 * Son dos decisiones, igual que al cancelar: «mueve la agenda» lo hace
 * coordinacion, «cobra una tarjeta» lo hace administracion con el boton que
 * ya existe. Si mover cobrara, quien lleva la agenda estaria cobrandole a un
 * cliente sin pulsar nunca un boton de cobro, y esa separacion de permisos
 * es justo la que el panel mantiene en todas las demas acciones.
 *
 * Lo que si hace es dejarlo ANOTADO: el registro de auditoria guarda si el
 * movimiento fue tardio, para que al revisar el mes se vea cual de ellos
 * daba derecho a cobrar.
 */

/**
 * Las horas de antelacion con las que mover sale gratis.
 *
 * NO ES UN NUMERO LIBRE: es la promesa escrita de la pregunta frecuente
 * `faq.q6`. Cambiarlo aqui sin cambiar ese texto deja al sistema cobrando
 * algo que el sitio dice que es gratis, que es la peor clase de
 * inconsistencia porque la descubre el cliente.
 */
export const RESCHEDULE_FREE_NOTICE_HOURS = 24;

/**
 * Desde que estados se puede mover una cita.
 *
 *   - `PENDING_PAYMENT` si: todavia no hay nada en firme, y mover es mas util
 *     que obligar a empezar de cero.
 *   - `CONFIRMED` si: es el caso normal y el que promete el sitio.
 *
 * Y NINGUNO MAS, con un motivo cada uno:
 *
 *   - `IN_PROGRESS` NO. El equipo esta dentro de la casa. Mover una cita que
 *     ya esta pasando no es mover nada: es inventarse que no ha pasado.
 *   - `COMPLETED`, `CANCELLED`, `NO_SHOW` NO. Son finales por la misma razon
 *     que `BOOKING_TRANSITIONS` los deja sin salida: el historico tiene que
 *     seguir contando lo que de verdad paso. Una cancelada que reaparece en
 *     otra fecha ocupa un hueco que el sistema ya dio por libre.
 */
export const RESCHEDULABLE_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED'] as const;

export function canReschedule(status: BookingStatus): boolean {
  return (RESCHEDULABLE_STATUSES as readonly string[]).includes(status);
}

/**
 * ¿Este movimiento llega tarde?
 *
 * SE MIDE CONTRA LA CITA VIEJA, no contra la nueva, y es el sentido de la
 * promesa: lo que cuesta dinero a la empresa es quedarse sin el hueco de
 * manana con el equipo ya organizado. Mover esa cita de manana a dentro de
 * tres semanas sigue siendo tarde, aunque la fecha nueva este lejisimos.
 */
export function isLateReschedule(scheduledStart: Date, now: Date): boolean {
  const margenMs = RESCHEDULE_FREE_NOTICE_HOURS * 3_600_000;
  return scheduledStart.getTime() - now.getTime() < margenMs;
}

/**
 * Lo que manda el panel para mover una cita.
 *
 * ========================================================================
 * LOS DOS SALTOS SON LOS MISMOS QUE AL CREARLA A MANO, Y NO ES PEREZA
 * ========================================================================
 * `AdminBookingOverrides` ya resolvio esta pregunta para la reserva que mete
 * el panel: el horario y la antelacion son suposiciones razonables sobre un
 * desconocido y ninguna lo es sobre quien mira su propia agenda, mientras
 * que el choque de equipos avisa primero y solo se salta marcandolo.
 *
 * Mover tiene exactamente la misma forma, asi que repetir los nombres hace
 * que quien ya entendio uno entienda el otro. Lo que NO se hereda es el
 * precio: mover una cita no cambia lo que cuesta, y un
 * `priceOverrideCents` aqui seria una forma silenciosa de retarificar.
 */
export const AdminRescheduleSchema = z
  .strictObject({
    /** La hora nueva, en ISO con zona. */
    startsAt: z.iso.datetime(),

    /** Fuera del horario o sin la antelacion minima. Ver arriba. */
    allowOutsideHours: z.boolean().default(false),

    /** Aunque la franja nueva ya este llena. Avisa primero. */
    allowOverlap: z.boolean().default(false),

    /**
     * Si se le cuenta al cliente por correo.
     *
     * Encendido por defecto, y aqui pesa mas que en ninguna otra accion: una
     * cita que cambia de hora sin que el cliente lo sepa es una casa vacia
     * el dia del servicio, o alguien esperando una manana entera.
     */
    notifyCustomer: z.boolean().default(true),

    /**
     * Por que se movio.
     *
     * OBLIGATORIO EN CUANTO SE SALTA ALGO, igual que al crearla a mano. Y
     * tambien —esto no lo puede comprobar el esquema— cuando el movimiento
     * llega tarde: eso da derecho a cobrar 35 dolares, y lo que cuesta
     * dinero se explica en el momento y no medio ano despues mirando una
     * fila que solo dice que alguien lo hizo. Esa segunda mitad de la regla
     * vive en el servicio, que es quien sabe cuando era la cita vieja.
     */
    reason: z.string().trim().max(300).default(''),
  })
  .refine(
    (valor) => valor.reason.length >= 3 || (!valor.allowOutsideHours && !valor.allowOverlap),
    {
      message: 'Hace falta escribir por que se salta la norma',
      path: ['reason'],
    },
  );
export type AdminReschedule = z.infer<typeof AdminRescheduleSchema>;
export type AdminRescheduleInput = z.input<typeof AdminRescheduleSchema>;
