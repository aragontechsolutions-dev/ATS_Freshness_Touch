import { z } from 'zod';

/**
 * Formato unico de error de la API. Nunca expone detalles internos
 * (stack traces, SQL, rutas del servidor): solo un codigo estable,
 * una clave i18n y, para errores de validacion, que campo fallo.
 */
export const ApiErrorSchema = z.strictObject({
  statusCode: z.int(),
  /** Codigo estable para el cliente, p.ej. VALIDATION_ERROR. */
  code: z.string(),
  /** Clave i18n para mostrar un mensaje al usuario final. */
  messageKey: z.string(),
  /**
   * Detalle por campo, solo en errores de validacion.
   * `message` es texto tecnico para depuracion: la interfaz muestra al usuario
   * el `messageKey` general y resalta los campos indicados en `path`.
   *
   * UNICA EXCEPCION, y deliberada: en STAFF_DOUBLE_BOOKED el `message` lleva
   * el nombre de la persona y la referencia de la reserva con la que choca,
   * separados por ` · `. Son DATOS, no una frase, asi que no hay nada que
   * traducir y se pueden pintar tal cual. Sin ellos, un "no se puede asignar"
   * a secas obliga a buscar el choque a mano por toda la agenda.
   */
  fields: z.array(z.strictObject({ path: z.string(), message: z.string() })).optional(),
  requestId: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const API_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RATE_LIMITED: 'RATE_LIMITED',
  /** Falta sesion o el token no es valido. */
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** Hay sesion, pero esa persona no puede hacer esto. */
  FORBIDDEN: 'FORBIDDEN',
  OUT_OF_SERVICE_AREA: 'OUT_OF_SERVICE_AREA',
  DISTANCE_UNAVAILABLE: 'DISTANCE_UNAVAILABLE',
  DATABASE_UNAVAILABLE: 'DATABASE_UNAVAILABLE',
  SLOT_UNAVAILABLE: 'SLOT_UNAVAILABLE',
  DUPLICATE_BOOKING: 'DUPLICATE_BOOKING',
  /** El cambio de estado pedido no es valido desde el estado actual. */
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  /** Esa persona ya tiene otro trabajo que se solapa con este. */
  STAFF_DOUBLE_BOOKED: 'STAFF_DOUBLE_BOOKED',
  /** Ya hay personal con ese correo. */
  STAFF_EMAIL_TAKEN: 'STAFF_EMAIL_TAKEN',
  /**
   * El cambio dejaria el sistema sin ningun administrador activo.
   *
   * Es la unica puerta que no se puede cerrar desde dentro: sin
   * administradores nadie puede volver a dar de alta a uno, y la unica salida
   * seria entrar a la base de datos a mano.
   */
  STAFF_LAST_ADMIN: 'STAFF_LAST_ADMIN',
  /** Nadie puede cambiarse a si mismo el puesto ni darse de baja. */
  STAFF_SELF_CHANGE: 'STAFF_SELF_CHANGE',
  /** Esa persona ya tiene cuenta vinculada: invitarla otra vez crearia una segunda. */
  STAFF_ALREADY_INVITED: 'STAFF_ALREADY_INVITED',
  /**
   * El correo ya tiene cuenta, y esa cuenta es de OTRA ficha de personal.
   *
   * Antes esto reventaba con un 500 sin explicacion: se intentaba guardar en
   * una ficha un identificador de cuenta que ya estaba en otra, y saltaba la
   * restriccion de la base. Es un caso previsible —dos fichas para la misma
   * persona, o un correo reutilizado— y merece decirse con palabras.
   */
  STAFF_ACCOUNT_TAKEN: 'STAFF_ACCOUNT_TAKEN',
  /** Este despliegue no tiene configurado el envio de invitaciones. */
  STAFF_INVITE_UNAVAILABLE: 'STAFF_INVITE_UNAVAILABLE',
  /** El proveedor de identidad rechazo la invitacion. */
  STAFF_INVITE_FAILED: 'STAFF_INVITE_FAILED',
  /** La retencion no esta en un estado sobre el que se pueda actuar. */
  PAYMENT_NOT_CAPTURABLE: 'PAYMENT_NOT_CAPTURABLE',
  /**
   * No hay nada que devolver.
   *
   * ES DISTINTO DE `PAYMENT_NOT_CAPTURABLE`, y separarlos no es puntillismo:
   * «esta retencion no se puede cobrar» y «de este cobro no queda nada por
   * devolver» llevan a dos acciones distintas de quien lo lee. Mezclarlos
   * dejaria a administracion buscando un cobro que ya devolvio entera.
   */
  PAYMENT_NOT_REFUNDABLE: 'PAYMENT_NOT_REFUNDABLE',
  /** No hay saldo que cobrar, o ya se esta cobrando. */
  BALANCE_NOT_CHARGEABLE: 'BALANCE_NOT_CHARGEABLE',
  /**
   * No hay tarjeta guardada con la que cobrar.
   *
   * Pasa con las reservas anteriores a la etapa 3.23 y con las que nunca
   * llegaron a confirmar la tarjeta. No es un fallo del sistema: es que a esa
   * persona hay que cobrarle por otra via.
   */
  NO_CARD_ON_FILE: 'NO_CARD_ON_FILE',
  /**
   * El banco exige que el titular verifique el pago (3D Secure).
   *
   * Con el cliente delante se resuelve solo; cobrando sin el, no hay a quien
   * preguntar. Se distingue de un rechazo normal porque la accion es otra:
   * mandarle un enlace de pago en vez de pedirle otra tarjeta.
   */
  CARD_NEEDS_CUSTOMER: 'CARD_NEEDS_CUSTOMER',
  PAYMENT_UNAVAILABLE: 'PAYMENT_UNAVAILABLE',
  WEBHOOK_SIGNATURE_INVALID: 'WEBHOOK_SIGNATURE_INVALID',
  BOOKING_NOT_QUOTABLE: 'BOOKING_NOT_QUOTABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  /**
   * La serie no admite lo que se le pide: la reserva ya pertenece a una, o
   * se intenta revivir una terminada. Uno solo con dos mensajes y no dos
   * codigos, porque quien llama hace lo mismo en los dos casos —ensenar el
   * mensaje— y es la clave de texto la que explica cual es.
   */
  SERIES_CONFLICT: 'SERIES_CONFLICT',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
