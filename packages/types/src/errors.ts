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
  /** La retencion no esta en un estado sobre el que se pueda actuar. */
  PAYMENT_NOT_CAPTURABLE: 'PAYMENT_NOT_CAPTURABLE',
  PAYMENT_UNAVAILABLE: 'PAYMENT_UNAVAILABLE',
  WEBHOOK_SIGNATURE_INVALID: 'WEBHOOK_SIGNATURE_INVALID',
  BOOKING_NOT_QUOTABLE: 'BOOKING_NOT_QUOTABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
