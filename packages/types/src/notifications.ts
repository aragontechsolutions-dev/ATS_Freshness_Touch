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
export const NOTIFICATION_EVENTS = [
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'BOOKING_REMINDER',
  /**
   * El equipo ficho la entrada LEJOS de la casa del cliente.
   *
   * No se avisa de cada llegada, solo de las que no cuadran. Un mensaje por
   * cada fichaje normal serian varios al dia de pura rutina, y lo que se
   * lee todos los dias sin que pase nada se deja de leer. Si este suena,
   * hay algo que mirar.
   */
  'TEAM_ARRIVED_FAR',
  /** Se asigno equipo a una reserva, o se cambio el que habia. */
  'JOB_ASSIGNED',
  /**
   * La cita cambio de fecha o de hora.
   *
   * SE PUEDE REPETIR, como `JOB_ASSIGNED` y por el mismo motivo: una cita se
   * mueve del martes al jueves y el jueves al sabado, y el segundo correo
   * hace mas falta que el primero. La migracion 20261030100100 lo saca del
   * indice unico de envios.
   */
  'BOOKING_RESCHEDULED',
] as const;
/**
 * LOS QUE ADEMAS VAN POR CORREO.
 *
 * No todos los avisos tienen las dos salidas, y conviene que el compilador lo
 * sepa. `TEAM_ARRIVED_FAR` y `JOB_ASSIGNED` son SOLO de Telegram: el primero
 * porque es util en el momento o no es util, y el segundo porque el equipo de
 * limpieza no tiene por que tener correo de empresa.
 *
 * Esto salio de un error de compilacion al anadirlos: el despachador tenia un
 * mapa de plantillas indexado por evento y dio por supuesto que todo evento
 * tiene una. Sin este tipo, el arreglo facil habria sido poner `undefined` en
 * el mapa y descubrir el hueco en produccion.
 */
export const EMAIL_NOTIFICATION_EVENTS = [
  'BOOKING_CONFIRMED',
  'BOOKING_CANCELLED',
  'BOOKING_REMINDER',
  'BOOKING_RESCHEDULED',
] as const;
export type EmailNotificationEvent = (typeof EMAIL_NOTIFICATION_EVENTS)[number];

/**
 * GUARDIA DE COMPILACION: todo evento de correo tiene que ser un evento.
 * Si alguien renombra uno arriba y se olvida aqui, esto deja de compilar.
 */
type EventoDeCorreoDesconocido = Exclude<
  EmailNotificationEvent,
  (typeof NOTIFICATION_EVENTS)[number]
>;
const _correosClasificados: EventoDeCorreoDesconocido extends never ? true : never = true;
void _correosClasificados;

export const NotificationEventSchema = z.enum(NOTIFICATION_EVENTS);
export type NotificationEvent = z.infer<typeof NotificationEventSchema>;

/** Por dónde sale cada aviso. */
export const NOTIFICATION_CHANNELS = ['EMAIL', 'TELEGRAM'] as const;
export const NotificationChannelSchema = z.enum(NOTIFICATION_CHANNELS);
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;

/**
 * A quién va dirigido. DECIDE QUÉ DATOS PUEDE LLEVAR DENTRO, y eso no es una
 * frase de relleno: es la regla que impide que un importe acabe en el grupo
 * del equipo de limpieza.
 *
 *   CUSTOMER  el cliente. Su reserva, su precio, su dirección.
 *   INTERNAL  operaciones. Lo ve quien lleva el negocio: importes incluidos.
 *   CLEANING  el equipo que va a la casa. Dirección y hora, NUNCA dinero.
 *
 * `CLEANING` existe precisamente por esa última línea. El mensaje de reserva
 * nueva lleva el total dentro, así que reenviarlo al grupo del equipo habría
 * puesto el precio de cada casa delante de quien la limpia. El contrato de
 * la PWA (`MyJob`) ya tiene esa misma prohibición; esto la extiende a los
 * avisos.
 */
export const NOTIFICATION_AUDIENCES = ['CUSTOMER', 'INTERNAL', 'CLEANING'] as const;
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

  /**
   * EL CHAT DE OPERACIONES. Reservas nuevas, llegadas que no cuadran.
   *
   * ========================================================================
   * SE SIGUE LLAMANDO `telegramChatId` Y NO ES DESCUIDO
   * ========================================================================
   * El nombre natural seria `telegramOperationsChatId`. No se renombra por un
   * motivo que ya costo diez dias de produccion en otro sitio del sistema:
   * estos ajustes se guardan como UN JSON validado con `strictObject`, y una
   * clave que cambia de nombre convierte la fila guardada en invalida. El
   * servicio hace entonces lo prudente —devolver los valores de partida— y
   * eso apagaria el chat que la empresa ya tenia puesto, en silencio.
   *
   * Exactamente lo que le paso a la tabla de tarifas con `services` y
   * `sizeBands`. Un nombre feo es mas barato que una caida muda.
   */
  telegramChatId: TelegramChatIdSchema.nullable(),

  /**
   * EL GRUPO DEL EQUIPO DE LIMPIEZA. Solo trabajos asignados, SIN importes.
   *
   * Es un grupo y no un mensaje privado a cada persona porque un bot de
   * Telegram NO PUEDE escribirle a quien no le haya escrito antes al bot. Los
   * mensajes individuales exigirian que cada persona enlazara su cuenta y que
   * el bot recibiera mensajes, que es infraestructura que este sistema no
   * tiene. Ver `docs/31`.
   *
   * CONSECUENCIA QUE HAY QUE SABER: en un grupo, todo el equipo ve la calle y
   * la ciudad de todos los trabajos, no solo de los suyos. Es una decision
   * del negocio, tomada a sabiendas.
   */
  telegramCleaningChatId: TelegramChatIdSchema.nullable().default(null),

  /**
   * EL CHAT TECNICO. Solo fallos del sistema (etapa 3.12).
   *
   * Separado de operaciones porque son avisos de naturaleza distinta y para
   * personas distintas: «entro una reserva» le sirve a quien lleva el
   * negocio, «faltan migraciones» le sirve a quien lo mantiene. Mezclarlos
   * hace que quien no puede actuar sobre la mitad de los mensajes aprenda a
   * no leer ninguno.
   *
   * SIN CHAT TECNICO, LOS FALLOS VAN AL DE OPERACIONES. Es deliberado: un
   * aviso de sistema roto molestando a quien no toca es mucho menos grave que
   * un aviso de sistema roto que no le llega a nadie.
   */
  telegramTechChatId: TelegramChatIdSchema.nullable().default(null),

  /**
   * Avisar por Telegram cuando entra una reserva confirmada.
   *
   * Solo se avisa de las CONFIRMADAS, es decir, las que ya tienen el depósito
   * retenido. Un formulario que alguien empieza y abandona no es una reserva,
   * y avisar de esos llenaría el teléfono de ruido hasta que se dejara de
   * mirar, que es la forma más silenciosa de perder un aviso importante.
   */
  telegramOnNewBooking: z.boolean(),

  /**
   * Avisar a operaciones cuando el equipo ficha lejos de la casa.
   *
   * Lo que cuenta como «lejos» lo decide `isFarFromHouse`, que descuenta el
   * margen de error del propio GPS: un movil impreciso no acusa a nadie.
   */
  telegramOnTeamArrivedFar: z.boolean().default(true),

  /** Avisar al grupo del equipo cuando se le asigna o cambia un trabajo. */
  telegramOnJobAssigned: z.boolean().default(true),

  /** Correo de confirmación al cliente cuando su reserva queda en firme. */
  emailBookingConfirmed: z.boolean(),

  /** Correo al cliente cuando su reserva se cancela, sea quien sea quien cancele. */
  emailBookingCancelled: z.boolean(),

  /**
   * Recordatorio al cliente la vispera del servicio.
   *
   * Reduce las ausencias, que son el gasto mas tonto de este negocio: el
   * equipo se desplaza, no puede entrar y la franja ya no se puede vender.
   */
  emailBookingReminder: z.boolean(),

  /**
   * Cuantas horas antes se avisa.
   *
   * El limite inferior son 2 horas por una razon concreta: la antelacion
   * minima para reservar son 24, asi que alguien puede reservar para manana
   * mismo. Con un valor muy bajo el recordatorio le llegaria pegado a la
   * confirmacion, y dos correos casi identicos en cinco minutos se leen como
   * un fallo del sistema.
   *
   * El limite superior son 72 porque mas alla deja de ser un recordatorio:
   * avisar con cuatro dias no evita que a nadie se le olvide.
   */
  reminderHoursBefore: z.number().int().min(2).max(72),
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
  telegramCleaningChatId: null,
  telegramTechChatId: null,
  telegramOnNewBooking: true,
  telegramOnTeamArrivedFar: true,
  telegramOnJobAssigned: true,
  emailBookingConfirmed: true,
  emailBookingCancelled: true,
  emailBookingReminder: true,
  reminderHoursBefore: 24,
};

/* -------------------------------------------------------------------------- */
/*  A qué chat va cada aviso                                                   */
/* -------------------------------------------------------------------------- */

/**
 * EL ENRUTADOR, EN UNA SOLA FUNCIÓN.
 *
 * ==========================================================================
 * POR QUÉ ESTÁ AQUÍ Y NO EN CADA SITIO QUE ENVÍA
 * ==========================================================================
 * La regla «los importes no van al equipo de limpieza» solo se sostiene si
 * hay UN sitio que decide el destino. Repartida por los tres servicios que
 * mandan avisos, basta con que alguien copie y pegue el bloque equivocado
 * una vez para que el precio de una casa acabe en el grupo de quien la
 * limpia, y eso no lo cazaría ninguna prueba de las que existen.
 *
 * Con esto, la pregunta «¿a dónde va esto?» tiene una sola respuesta y un
 * solo sitio donde cambiarla.
 *
 * EL RESPALDO DEL CHAT TÉCNICO ES INTENCIONADO. Si no hay chat técnico
 * configurado, los fallos del sistema van al de operaciones. Molestar a quien
 * no puede arreglarlo es mucho menos grave que un sistema roto del que no se
 * entera nadie.
 */
export function telegramChatForAudience(
  audience: NotificationAudience,
  settings: Pick<
    NotificationSettings,
    'telegramChatId' | 'telegramCleaningChatId' | 'telegramTechChatId'
  >,
): string | null {
  switch (audience) {
    case 'INTERNAL':
      return settings.telegramChatId;
    case 'CLEANING':
      return settings.telegramCleaningChatId;
    case 'CUSTOMER':
      /*
       * NUNCA. Un cliente no tiene chat de Telegram con la empresa, y
       * devolver aquí cualquiera de los otros mandaría al equipo un mensaje
       * redactado para el cliente. Se devuelve null y el envío se salta.
       */
      return null;
  }
}

/**
 * El chat al que van los fallos del sistema.
 *
 * Va aparte de `telegramChatForAudience` porque la alarma de estado NO es un
 * aviso de una reserva: no tiene `bookingId`, no se registra en la tabla de
 * avisos y no tiene audiencia. Forzarla dentro del mismo enumerado habría
 * añadido una audiencia que no le corresponde a nadie.
 */
export function telegramChatForSystemAlerts(
  settings: Pick<NotificationSettings, 'telegramChatId' | 'telegramTechChatId'>,
): string | null {
  return settings.telegramTechChatId ?? settings.telegramChatId;
}

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

/* ========================================================================== */
/*  CUANDO UN AVISO AL CLIENTE NO SALE                                        */
/* ========================================================================== */

/**
 * EL FALLO QUE NO SE VEIA
 * =======================
 * Hasta la etapa 3.30, un correo que fallaba se guardaba con `status:
 * 'FAILED'` y su motivo, y ahi se quedaba. No habia reintento y no habia
 * aviso.
 *
 * Si el proveedor de correo estaba caido el minuto en que alguien confirmaba
 * su reserva, esa persona HABIA PAGADO Y NO TENIA NADA POR ESCRITO, y nadie
 * se enteraba hasta que alguien mirase el registro de envios — que no tiene
 * pantalla.
 *
 * El recordatorio de la vispera si se reintentaba, porque lo manda un barrido
 * que vuelve a pasar. La confirmacion no vuelve a pasar nunca.
 *
 * ========================================================================
 * SOLO SE REINTENTA LO QUE TIENE A ALGUIEN ESPERANDO QUE NO SEAMOS NOSOTROS
 * ========================================================================
 * El correo al CLIENTE si. Los avisos a Telegram no: son nuestros, los lee el
 * equipo, y cuando fallan suele ser por configuracion —un grupo que no
 * existe— asi que reintentarlos cuatro veces no arregla nada y llena el
 * registro. De esos avisa el estado del sistema.
 */

/**
 * Cuanto se espera antes de cada reintento, en minutos.
 *
 * CRECIENTE Y CORTO AL PRINCIPIO: la mayoria de los fallos de un proveedor de
 * correo duran segundos, asi que el primer reintento a los cinco minutos
 * resuelve casi todos sin que el cliente note nada. Los siguientes se
 * espacian porque, si a la media hora sigue fallando, no es un hipo: o el
 * proveedor esta caido de verdad o la direccion no existe, y en los dos casos
 * insistir cada cinco minutos solo gasta cuota.
 *
 * CUATRO Y SE ACABA. Un reintento infinito sobre una direccion mal escrita no
 * entrega nada y esconde el problema para siempre; al cuarto se deja de
 * intentar y se avisa a una persona, que es quien puede llamar por telefono.
 */
export const NOTIFICATION_RETRY_DELAYS_MINUTES = [5, 30, 120, 360] as const;

/** Cuantas veces se intenta en total: el primer envio mas los reintentos. */
export const NOTIFICATION_MAX_ATTEMPTS = NOTIFICATION_RETRY_DELAYS_MINUTES.length + 1;

/**
 * Cuando toca el siguiente intento, o `null` si ya no hay mas.
 *
 * `intentos` es cuantos van hechos, incluido el primero. Con uno hecho toca
 * esperar cinco minutos; con cinco, ya no se intenta mas.
 */
export function nextRetryAt(intentos: number, ahora: Date): Date | null {
  const espera = NOTIFICATION_RETRY_DELAYS_MINUTES[intentos - 1];
  if (espera === undefined) return null;
  return new Date(ahora.getTime() + espera * 60_000);
}
