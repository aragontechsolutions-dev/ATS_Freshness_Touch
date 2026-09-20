import { z } from 'zod';
import { FrequencySchema, LocaleSchema, ServiceTypeSchema } from './enums';
import { QuoteAddOnInputSchema, QuoteDepositSchema, QuoteTotalsSchema } from './quote';

/**
 * CONTRATOS DE RESERVA
 * --------------------
 * Aqui SI se pide la direccion completa, a diferencia del cotizador, que solo
 * necesita el codigo postal. El cambio es deliberado: ahora hay una relacion
 * comercial y hace falta saber a donde ir.
 *
 * No se pide contrasena: se reserva como invitado. La cuenta es opcional y
 * posterior, porque cada paso extra en el formulario pierde clientes.
 */

/** Datos de contacto de quien reserva. */
export const BookingContactSchema = z.strictObject({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(160),
  /** Telefono de EE. UU. en cualquier formato legible; se normaliza despues. */
  phone: z
    .string()
    .trim()
    .min(7)
    .max(25)
    .regex(/^[+()\d\s.-]+$/, 'El telefono solo puede contener numeros y separadores'),
  locale: LocaleSchema.default('en'),
  /**
   * Consentimiento para comunicaciones comerciales. Separado del correo
   * transaccional (confirmacion, recordatorio), que no lo necesita.
   */
  marketingOptIn: z.boolean().default(false),
});
export type BookingContact = z.infer<typeof BookingContactSchema>;

/** Direccion del servicio. */
export const BookingAddressSchema = z.strictObject({
  line1: z.string().trim().min(3).max(120),
  line2: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2).max(80),
  state: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase())
    .default('GA'),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'El codigo postal debe tener 5 digitos (formato USA)'),
  /**
   * Codigo de puerta, donde esta la llave, si hay perro en el jardin.
   * DATO SENSIBLE: solo debe verlo el equipo asignado y administracion.
   */
  accessNotes: z.string().trim().max(500).optional(),
});
export type BookingAddress = z.infer<typeof BookingAddressSchema>;

/** Peticion de reserva. */
export const BookingRequestSchema = z
  .strictObject({
    // --- Que servicio ---
    service: ServiceTypeSchema,
    frequency: FrequencySchema.default('ONE_TIME'),
    bedrooms: z.int().min(0).max(12),
    bathrooms: z.int().min(0).max(12),
    squareFeet: z.int().min(200).max(20000),
    addOns: z.array(QuoteAddOnInputSchema).max(20).default([]),

    // --- Cuando ---
    /** Inicio de la cita, en UTC. Debe coincidir con una franja disponible. */
    startsAt: z.iso.datetime(),

    // --- Quien y donde ---
    contact: BookingContactSchema,
    address: BookingAddressSchema,

    customerNotes: z.string().trim().max(1000).optional(),
  })
  .refine(
    (value) => new Set(value.addOns.map((addOn) => addOn.code)).size === value.addOns.length,
    { message: 'No se puede repetir el mismo extra', path: ['addOns'] },
  );
export type BookingRequest = z.infer<typeof BookingRequestSchema>;
export type BookingRequestInput = z.input<typeof BookingRequestSchema>;

export const BookingStatusSchema = z.enum([
  'PENDING_PAYMENT',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

/** Respuesta al crear una reserva. */
export const BookingResponseSchema = z.strictObject({
  bookingId: z.uuid(),
  /** Referencia legible para hablar por telefono: FT-2026-0001. */
  reference: z.string(),
  status: BookingStatusSchema,

  scheduledStart: z.iso.datetime(),
  scheduledEnd: z.iso.datetime(),
  timezone: z.string(),
  durationMinutes: z.int().positive(),

  currency: z.literal('USD'),
  totals: QuoteTotalsSchema,
  deposit: QuoteDepositSchema,
  balanceDueAtServiceCents: z.int(),

  /**
   * Que falta para que la cita quede en firme. Mientras sea PAYMENT, la
   * reserva NO esta confirmada: solo retiene la franja un tiempo limitado.
   */
  nextStep: z.enum(['PAYMENT', 'NONE']),
  /** Momento en que se libera la franja si no se completa el pago. */
  holdExpiresAt: z.iso.datetime().nullable(),
});
export type BookingResponse = z.infer<typeof BookingResponseSchema>;
