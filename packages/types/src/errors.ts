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
  /** Detalle por campo, solo en errores de validacion. */
  fields: z.array(z.strictObject({ path: z.string(), messageKey: z.string() })).optional(),
  requestId: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const API_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  OUT_OF_SERVICE_AREA: 'OUT_OF_SERVICE_AREA',
  DISTANCE_UNAVAILABLE: 'DISTANCE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
