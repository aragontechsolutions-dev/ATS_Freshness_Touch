import { z } from 'zod';
import { StaffRoleSchema } from './auth';

/**
 * LAS NOTIFICACIONES DEL PANEL
 * ============================
 * Lo que una persona del equipo tiene que enterarse al entrar, sin que nadie
 * se lo cuente.
 *
 * ========================================================================
 * NO SON LOS AVISOS QUE YA EXISTIAN
 * ========================================================================
 * La tabla `notifications` es el REGISTRO DE ENVIOS al cliente: que correo
 * salio, a que direccion, si fallo. Mira hacia fuera y cuelga de una reserva.
 *
 * Esto mira hacia dentro: es la bandeja del equipo. Son dos cosas distintas
 * y mezclarlas habria obligado a una de las dos a fingir que es la otra.
 *
 * ========================================================================
 * VAN A UN PUESTO, NO A UNA PERSONA — SALVO CUANDO SI
 * ========================================================================
 * «Hay una reserva nueva» le toca a coordinacion, sea quien sea quien entre
 * ese dia; dirigirla a una persona concreta significaria que si esa persona
 * libra, nadie la ve.
 *
 * Pero «te han asignado un trabajo» es de quien lo tiene asignado y de nadie
 * mas. Por eso `audience` dice el puesto y `staffId` lo estrecha a una
 * persona cuando hace falta.
 *
 * ========================================================================
 * EL TEXTO NO SE GUARDA, SE GUARDAN LOS DATOS
 * ========================================================================
 * En la fila van `kind` y `params`; el texto lo compone el panel en el
 * idioma de quien mira. Guardar la frase ya escrita significaria que una
 * notificacion de ayer se ve en el idioma de quien la provoco, y que
 * corregir una errata no arregla las que ya estan.
 *
 * Y `params` NO LLEVA NOMBRES NI DIRECCIONES, igual que el registro de
 * auditoria: esto se mira en una pantalla compartida y se queda meses.
 */

export const STAFF_NOTIFICATION_KINDS = [
  /** Una reserva nueva quedo confirmada: hay que asignarle equipo. */
  'booking.confirmed',
  /**
   * Una reserva cerrada se quedo con el deposito retenido. Es dinero
   * bloqueado en la tarjeta de alguien que nadie va a mirar.
   */
  'booking.hold_open',
  /** El proveedor acabo rechazando una devolucion: el dinero sigue aqui. */
  'payment.refund_failed',
  /** Un cliente retiro sus fotos el mismo, desde el enlace de su correo. */
  'media_consent.self_revoked',
  /** Un trabajo asignado a quien lo va a hacer. */
  'job.assigned',
  /**
   * Una serie no pudo crear su cita porque la franja estaba llena.
   *
   * El barrido NO dobla equipos por su cuenta, asi que esa semana la clienta
   * de siempre se queda sin cita hasta que alguien lo mire. Es de las pocas
   * cosas que de verdad hay que mirar hoy.
   */
  'series.slot_taken',
  /**
   * Un aviso al cliente no salio, y ya no se va a reintentar mas.
   *
   * Es el unico aviso de la bandeja que significa que ALGUIEN QUE PAGO SE HA
   * QUEDADO SIN NADA POR ESCRITO. Se emite al agotar los reintentos, no al
   * primer fallo: avisar del primero seria avisar de casi todos los hipos de
   * un proveedor de correo, y la bandeja dejaria de leerse.
   */
  'notification.failed',
] as const;
export const StaffNotificationKindSchema = z.enum(STAFF_NOTIFICATION_KINDS);
export type StaffNotificationKind = z.infer<typeof StaffNotificationKindSchema>;

/**
 * Cuantas se ensenan en el desplegable antes de mandar a la lista completa.
 *
 * Cinco: lo que cabe sin que la lista tape la pantalla en un movil, y lo
 * suficiente para que lo de hoy se vea sin abrir nada.
 */
export const NOTIFICATION_PREVIEW_COUNT = 5;

/** A partir de aqui el contador deja de contar y dice «+9». */
export const NOTIFICATION_BADGE_MAX = 9;

/**
 * Lo que pone el globo del icono.
 *
 * SE PARA EN «+9» porque el numero exacto no cambia ninguna decision: con
 * diez sin leer y con cuarenta se hace lo mismo —abrirlas—, y un «47» en un
 * globo de dieciseis pixeles no se lee, solo ensucia.
 *
 * Cero devuelve cadena vacia: el globo no se pinta. Un globo con un cero
 * dentro es ruido que pide atencion para decir que no pasa nada.
 */
export function notificationBadge(unread: number): string {
  if (unread <= 0) return '';
  return unread > NOTIFICATION_BADGE_MAX ? `+${String(NOTIFICATION_BADGE_MAX)}` : String(unread);
}

/**
 * Una notificacion tal y como la lee el panel.
 *
 * TOLERANTE CON CAMPOS NUEVOS, como todo lo que lee un navegador: el panel y
 * la API se despliegan por separado y un contrato estricto aqui vaciaria la
 * bandeja entera el dia que la API devuelva un campo de mas.
 */
export const StaffNotificationSchema = z.object({
  id: z.uuid(),
  kind: StaffNotificationKindSchema,
  /** A que se refiere, para poder abrirlo. `null` si no cuelga de nada. */
  entityType: z.string().nullable().default(null),
  entityId: z.string().nullable().default(null),
  /**
   * Lo que hace falta para componer el texto: una referencia, un importe,
   * unos dias. NUNCA un nombre ni una direccion.
   */
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  createdAt: z.string(),
  read: z.boolean().default(false),
});
export type StaffNotification = z.infer<typeof StaffNotificationSchema>;

export const StaffNotificationListSchema = z.object({
  notifications: z.array(StaffNotificationSchema).default([]),
  /**
   * Cuantas sin leer en total, no cuantas vienen en esta pagina.
   *
   * Es lo que pinta el globo, y tiene que contarlas TODAS: un globo que dice
   * «5» porque solo se pidieron cinco es un globo que miente en cuanto hay
   * una sexta.
   */
  unreadCount: z.int().default(0),
});
export type StaffNotificationList = z.infer<typeof StaffNotificationListSchema>;

/** A quien le toca cada clase de notificacion, si nadie dice otra cosa. */
export const NOTIFICATION_AUDIENCE: Record<
  StaffNotificationKind,
  z.infer<typeof StaffRoleSchema>
> = {
  'booking.confirmed': 'DISPATCHER',
  'booking.hold_open': 'ADMIN',
  'payment.refund_failed': 'ADMIN',
  'media_consent.self_revoked': 'ADMIN',
  'job.assigned': 'CLEANER',
  'series.slot_taken': 'DISPATCHER',
  /* A administracion: quien puede llamar al cliente y rehacer el envio. */
  'notification.failed': 'ADMIN',
};
