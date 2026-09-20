import { z } from 'zod';
import { ServiceTypeSchema } from './enums';
import { QuoteAddOnInputSchema } from './quote';

/**
 * CONTRATOS DE DISPONIBILIDAD
 * ---------------------------
 * La disponibilidad depende de cuanto dura el trabajo, y eso depende del
 * servicio y del tamano de la vivienda: una limpieza profunda de 2.600 pies
 * cuadrados no cabe en el mismo hueco que una rotacion de Airbnb. Por eso la
 * consulta lleva los datos del servicio y no solo la fecha.
 */

export const AvailabilityRequestSchema = z.strictObject({
  /** Dia a consultar, en la zona horaria de la empresa (AAAA-MM-DD). */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener el formato AAAA-MM-DD'),
  service: ServiceTypeSchema,
  bedrooms: z.coerce.number().int().min(0).max(12),
  bathrooms: z.coerce.number().int().min(0).max(12),
  squareFeet: z.coerce.number().int().min(200).max(20000),
  addOns: z.array(QuoteAddOnInputSchema).max(20).default([]),
});
export type AvailabilityRequest = z.infer<typeof AvailabilityRequestSchema>;
export type AvailabilityRequestInput = z.input<typeof AvailabilityRequestSchema>;

/** Motivo por el que una franja no se ofrece. */
export const SlotUnavailableReasonSchema = z.enum([
  /** No queda equipo libre a esa hora. */
  'FULLY_BOOKED',
  /** Demasiado pronto: no da tiempo a organizar el equipo. */
  'TOO_SOON',
  /** El trabajo no termina antes del cierre. */
  'DOES_NOT_FIT',
]);
export type SlotUnavailableReason = z.infer<typeof SlotUnavailableReasonSchema>;

export const AvailabilitySlotSchema = z.strictObject({
  /** Inicio de la franja, en UTC. Es el valor que se envia al reservar. */
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  /** Hora local de la empresa, lista para mostrar (HH:MM, 24 horas). */
  localTime: z.string(),
  available: z.boolean(),
  reason: SlotUnavailableReasonSchema.nullable(),
});
export type AvailabilitySlot = z.infer<typeof AvailabilitySlotSchema>;

export const AvailabilityResponseSchema = z.strictObject({
  date: z.string(),
  timezone: z.string(),
  /** Duracion estimada del trabajo consultado. */
  durationMinutes: z.int().positive(),
  /** false los dias que la empresa no abre. */
  businessOpen: z.boolean(),
  slots: z.array(AvailabilitySlotSchema),
});
export type AvailabilityResponse = z.infer<typeof AvailabilityResponseSchema>;
