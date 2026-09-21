import { z } from 'zod';

/**
 * AVISOS
 * ------
 * Qué se avisa, por qué canal y qué puede configurar la empresa.
 *
 * DOS DESTINATARIOS MUY DISTINTOS, y conviene no confundirlos nunca:
 *
 *   - EL CLIENTE recibe correo. Es correo transaccional: confirma algo que
 *     acaba de pedir. No necesita consentimiento comercial (por eso el
 *     `marketingOptIn` del cliente NO se consulta aquí) y no se le puede
 *     desactivar desde el panel sin más, porque sin confirmación por escrito
 *     una reserva es la palabra de uno contra la del otro.
 *
 *   - LA EMPRESA recibe Telegram, y opcionalmente una copia por correo. Es un
 *     aviso interno: "ha entrado una reserva". Ahí sí tiene sentido poder
 *     apagarlo, porque quien lo recibe es quien decide si le molesta.
 */

/** Los hechos que merecen un aviso. */
export const NOTIFICATION_EVENTS = ['BOOKING_CONFIRMED', 'BOOKING_CANCELLED'] as const;
export const NotificationEventSchema = z.enum(NOTIFICATION_EVENTS);
export type NotificationEvent = z.infer<typeof NotificationEventSchema>;

/** Por dónde sale cada aviso. */
export const NOTIFICATION_CHANNELS = ['EMAIL', 'TELEGRAM'] as const;
export const NotificationChannelSchema = z.enum(NOTIFICATION_CHANNELS);
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

/** A quién va dirigido. Decide qué datos puede llevar dentro. */
export const NOTIFICATION_AUDIENCES = ['CUSTOMER', 'INTERNAL'] as const;
export const NotificationAudienceSchema = z.enum(NOTIFICATION_AUDIENCES);
export type NotificationAudience = z.infer<typeof NotificationAudienceSchema>;

/**
 * Identificador de chat de Telegram.
 *
 * Es un número entero, negativo cuando es un grupo. Se valida con una forma
 * estricta porque acaba dentro de la dirección a la que se hace la petición:
 * texto libre ahí permitiría apuntar el aviso a otra ruta de la API del
 * proveedor.
 */
export const TelegramChatIdSchema = z
  .string()
  .trim()
  .regex(
    /^-?\d{1,20}$/,
    'El identificador de chat de Telegram es un número, por ejemplo 123456789',
  );

/**
 * Lo que la empresa puede cambiar sin tocar código.
 *
 * AQUÍ NO HAY NINGUNA CREDENCIAL, y es deliberado. La clave del proveedor de
 * correo y el token del bot viven en variables de entorno del servidor, como
 * la clave de Stripe. Ponerlas en un formulario significaría guardarlas en la
 * base de datos, que se copia en cada respaldo y la lee cualquiera con acceso
 * a ella. Un identificador de chat no es un secreto: sin el token no sirve
 * para enviar nada.
 */
export const NotificationSettingsSchema = z.strictObject({
  /**
   * Copia interna de los avisos del cliente, por correo. `null` = sin copia.
   * No es el correo público de la empresa: puede ser un buzón del equipo.
   */
  internalEmail: z.string().trim().toLowerCase().email().max(160).nullable(),

  /** A qué chat de Telegram avisar. `null` = sin avisos por Telegram. */
  telegramChatId: TelegramChatIdSchema.nullable(),

  /**
   * Avisar por Telegram cuando entra una reserva confirmada.
   *
   * Solo se avisa de las CONFIRMADAS, es decir, las que ya tienen el depósito
   * retenido. Un formulario que alguien empieza y abandona no es una reserva,
   * y avisar de esos llenaría el teléfono de ruido hasta que se dejara de
   * mirar, que es la forma más silenciosa de perder un aviso importante.
   */
  telegramOnNewBooking: z.boolean(),

  /** Correo de confirmación al cliente cuando su reserva queda en firme. */
  emailBookingConfirmed: z.boolean(),

  /** Correo al cliente cuando su reserva se cancela, sea quien sea quien cancele. */
  emailBookingCancelled: z.boolean(),
});
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;

/**
 * Valores de partida.
 *
 * Los correos al cliente nacen ENCENDIDOS y los avisos internos apagados. El
 * criterio: lo que el cliente espera recibir debe funcionar desde el primer
 * día sin que nadie configure nada; lo que interrumpe a una persona concreta
 * no se enciende sin que esa persona lo pida.
 */
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  internalEmail: null,
  telegramChatId: null,
  telegramOnNewBooking: true,
  emailBookingConfirmed: true,
  emailBookingCancelled: true,
};

/** Cómo acabó un envío. */
export const NOTIFICATION_STATUSES = ['SENT', 'FAILED', 'SKIPPED'] as const;
export const NotificationStatusSchema = z.enum(NOTIFICATION_STATUSES);
export type NotificationStatus = z.infer<typeof NotificationStatusSchema>;

/**
 * Un envío, tal y como se ve desde el panel.
 *
 * Existe para responder a "¿le llegó el correo al cliente?" sin abrir la base
 * de datos. `SKIPPED` es tan informativo como `FAILED`: significa que el aviso
 * estaba apagado o sin configurar, y es la explicación de la mitad de los
 * "no me ha llegado nada".
 */
export const NotificationRecordSchema = z.strictObject({
  event: NotificationEventSchema,
  channel: NotificationChannelSchema,
  audience: NotificationAudienceSchema,
  status: NotificationStatusSchema,
  /**
   * A dónde se envió, ya recortado para no reconstruir el correo entero del
   * cliente desde una pantalla que ve todo el personal.
   */
  target: z.string().nullable(),
  /** Motivo del fallo, en lenguaje llano. `null` si salió bien. */
  failureReason: z.string().nullable(),
  createdAt: z.string(),
});
export type NotificationRecord = z.infer<typeof NotificationRecordSchema>;

/**
 * Enmascara un correo para enseñarlo en el panel.
 *
 * `ana.garcia@example.com` queda como `an…@example.com`. El equipo necesita
 * saber a qué buzón salió el aviso; no necesita la lista de correos de los
 * clientes a la vista en una pantalla que se consulta a diario y que puede
 * quedarse abierta en un portátil compartido.
 */
export function maskEmail(email: string): string {
  const arroba = email.lastIndexOf('@');
  if (arroba <= 0) return '…';

  const usuario = email.slice(0, arroba);
  const dominio = email.slice(arroba);

  return usuario.length <= 2
    ? `${usuario.slice(0, 1)}…${dominio}`
    : `${usuario.slice(0, 2)}…${dominio}`;
}

/**
 * Enmascara un identificador de chat de Telegram.
 *
 * Mismo criterio: confirma que está configurado y cuál es, a grandes rasgos,
 * sin dejar el destino exacto de los avisos internos a la vista.
 */
export function maskChatId(chatId: string): string {
  return chatId.length <= 4 ? '…' : `…${chatId.slice(-4)}`;
}
