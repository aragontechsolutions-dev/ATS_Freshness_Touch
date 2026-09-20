import { z } from 'zod';
import {
  AddOnCodeSchema,
  DistanceProviderNameSchema,
  FrequencySchema,
  LocaleSchema,
  QuoteLineKindSchema,
  ServiceTypeSchema,
  ServiceZoneSchema,
} from './enums';

/**
 * Destino del servicio.
 *
 * PRIVACIDAD (minimizacion de datos): en la fase de cotizacion NO pedimos la
 * direccion exacta. El codigo postal es suficiente para estimar distancia y
 * deposito. La direccion completa se recoge solo al confirmar la reserva
 * (Etapa 2), cuando ya existe una relacion comercial y consentimiento.
 */
export const QuoteDestinationSchema = z.strictObject({
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, 'El codigo postal debe tener 5 digitos (formato USA)'),
  city: z.string().trim().min(2).max(80).optional(),
  state: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase())
    .default('GA'),
});
export type QuoteDestination = z.infer<typeof QuoteDestinationSchema>;

/** Extra solicitado, con cantidad para los extras por unidad. */
export const QuoteAddOnInputSchema = z.strictObject({
  code: AddOnCodeSchema,
  quantity: z.int().min(1).max(50).default(1),
});
export type QuoteAddOnInput = z.infer<typeof QuoteAddOnInputSchema>;

/** Peticion de cotizacion instantanea. */
export const QuoteRequestSchema = z
  .strictObject({
    service: ServiceTypeSchema,
    frequency: FrequencySchema.default('ONE_TIME'),
    bedrooms: z.int().min(0).max(12),
    bathrooms: z.int().min(0).max(12),
    squareFeet: z.int().min(200).max(20000),
    addOns: z.array(QuoteAddOnInputSchema).max(20).default([]),
    destination: QuoteDestinationSchema,
    locale: LocaleSchema.default('en'),
  })
  .refine(
    (value) => new Set(value.addOns.map((addOn) => addOn.code)).size === value.addOns.length,
    { message: 'No se puede repetir el mismo extra', path: ['addOns'] },
  );
export type QuoteRequest = z.infer<typeof QuoteRequestSchema>;

/** Una linea del presupuesto. Los importes SIEMPRE en centavos enteros. */
export const QuoteLineSchema = z.strictObject({
  code: z.string(),
  kind: QuoteLineKindSchema,
  /** Clave i18n; el texto visible lo resuelve el cliente segun su idioma. */
  labelKey: z.string(),
  labelParams: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  quantity: z.number(),
  unitAmountCents: z.int(),
  /** Negativo en las lineas de tipo DISCOUNT. */
  amountCents: z.int(),
});
export type QuoteLine = z.infer<typeof QuoteLineSchema>;

/** Resultado del calculo de distancia usado para zona y deposito. */
export const QuoteDistanceSchema = z.strictObject({
  miles: z.number().nonnegative(),
  durationMinutes: z.number().nonnegative().nullable(),
  zone: ServiceZoneSchema,
  provider: DistanceProviderNameSchema,
  /** true cuando la distancia proviene de una estimacion y no de un ruteo real. */
  estimated: z.boolean(),
  /** true cuando la respuesta se sirvio desde cache. */
  cached: z.boolean(),
});
export type QuoteDistance = z.infer<typeof QuoteDistanceSchema>;

/**
 * Deposito reembolsable por desplazamiento.
 * Se retiene (no se cobra) al reservar y se descuenta del total al finalizar.
 */
export const QuoteDepositSchema = z.strictObject({
  amountCents: z.int().nonnegative(),
  baseCents: z.int().nonnegative(),
  freeRadiusMiles: z.number().nonnegative(),
  /** Millas facturables: ida y vuelta mas alla del radio libre. */
  billableMiles: z.number().nonnegative(),
  mileageRateCentsPerMile: z.number().nonnegative(),
  /** true si se aplico el tope maximo configurado. */
  capped: z.boolean(),
  /** El deposito se acredita contra el total final del servicio. */
  appliedToTotal: z.literal(true),
});
export type QuoteDeposit = z.infer<typeof QuoteDepositSchema>;

/** Totales agregados. discountCents se expresa en positivo (magnitud). */
export const QuoteTotalsSchema = z.strictObject({
  serviceCents: z.int().nonnegative(),
  addOnsCents: z.int().nonnegative(),
  surchargesCents: z.int().nonnegative(),
  discountCents: z.int().nonnegative(),
  taxCents: z.int().nonnegative(),
  totalCents: z.int().nonnegative(),
});
export type QuoteTotals = z.infer<typeof QuoteTotalsSchema>;

/**
 * Tratamiento fiscal. En Georgia los servicios de limpieza estan EXENTOS de
 * sales tax (O.C.G.A. 48-8-2(31) y 48-8-30(f)(1)), por eso rate = 0.
 * El motor mantiene el campo configurable por si se revenden productos.
 */
export const QuoteTaxSchema = z.strictObject({
  ratePercent: z.number().nonnegative(),
  exempt: z.boolean(),
  reasonKey: z.string(),
});
export type QuoteTax = z.infer<typeof QuoteTaxSchema>;

/** Motivos por los que un presupuesto necesita revision humana. */
export const ManualReviewSchema = z.strictObject({
  required: z.boolean(),
  reasonKeys: z.array(z.string()),
});
export type ManualReview = z.infer<typeof ManualReviewSchema>;

/** Respuesta completa del cotizador. */
export const QuoteResponseSchema = z.strictObject({
  quoteId: z.uuid(),
  generatedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  currency: z.literal('USD'),
  locale: LocaleSchema,
  input: z.strictObject({
    service: ServiceTypeSchema,
    frequency: FrequencySchema,
    bedrooms: z.int(),
    bathrooms: z.int(),
    squareFeet: z.int(),
    destination: QuoteDestinationSchema,
  }),
  distance: QuoteDistanceSchema,
  lines: z.array(QuoteLineSchema),
  totals: QuoteTotalsSchema,
  tax: QuoteTaxSchema,
  deposit: QuoteDepositSchema,
  /** Total menos deposito: lo que queda por pagar el dia del servicio. */
  balanceDueAtServiceCents: z.int(),
  manualReview: ManualReviewSchema,
  disclaimerKeys: z.array(z.string()),
});
export type QuoteResponse = z.infer<typeof QuoteResponseSchema>;

/**
 * Tipo de ENTRADA (antes de aplicar `default()` y transformaciones).
 * Es el que deben usar los clientes al construir el cuerpo de la peticion.
 */
export type QuoteRequestInput = z.input<typeof QuoteRequestSchema>;
