import { z } from 'zod';
import { AddOnCodeSchema, AddOnUnitSchema, FrequencySchema, ServiceTypeSchema, ServiceZoneSchema } from './enums';
import { QuoteTaxSchema } from './quote';

/**
 * El catalogo publico permite que el formulario del sitio web se construya
 * a partir de la configuracion del servidor: los precios NO se duplican en
 * el front. Si Freshness Touch cambia una tarifa, cambia en un solo sitio.
 */
export const CatalogServiceSchema = z.strictObject({
  code: ServiceTypeSchema,
  /** Precio minimo facturable del servicio. */
  minimumCents: z.int().nonnegative(),
  /** false para servicios que requieren visita previa (comercial). */
  instantQuote: z.boolean(),
});
export type CatalogService = z.infer<typeof CatalogServiceSchema>;

export const CatalogAddOnSchema = z.strictObject({
  code: AddOnCodeSchema,
  unit: AddOnUnitSchema,
  unitAmountCents: z.int().nonnegative(),
  maxQuantity: z.int().min(1),
});
export type CatalogAddOn = z.infer<typeof CatalogAddOnSchema>;

export const CatalogFrequencySchema = z.strictObject({
  code: FrequencySchema,
  discountPercent: z.number().min(0).max(100),
});
export type CatalogFrequency = z.infer<typeof CatalogFrequencySchema>;

export const CatalogZoneSchema = z.strictObject({
  code: ServiceZoneSchema,
  /** Limite superior en millas; null para la zona final. */
  maxMiles: z.number().nullable(),
  surchargeCents: z.int().nonnegative(),
  serviceable: z.boolean(),
});
export type CatalogZone = z.infer<typeof CatalogZoneSchema>;

export const CatalogDepositSchema = z.strictObject({
  baseCents: z.int().nonnegative(),
  freeRadiusMiles: z.number().nonnegative(),
  mileageRateCentsPerMile: z.number().nonnegative(),
  minCents: z.int().nonnegative(),
  maxCents: z.int().nonnegative(),
});
export type CatalogDeposit = z.infer<typeof CatalogDepositSchema>;

export const CatalogLimitsSchema = z.strictObject({
  bedrooms: z.strictObject({ min: z.int(), max: z.int() }),
  bathrooms: z.strictObject({ min: z.int(), max: z.int() }),
  squareFeet: z.strictObject({ min: z.int(), max: z.int() }),
  addOnsMax: z.int(),
});
export type CatalogLimits = z.infer<typeof CatalogLimitsSchema>;

export const CatalogResponseSchema = z.strictObject({
  currency: z.literal('USD'),
  /** Base de operaciones (origen del calculo de distancia). */
  baseOfOperations: z.strictObject({
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
  }),
  services: z.array(CatalogServiceSchema),
  addOns: z.array(CatalogAddOnSchema),
  frequencies: z.array(CatalogFrequencySchema),
  zones: z.array(CatalogZoneSchema),
  deposit: CatalogDepositSchema,
  limits: CatalogLimitsSchema,
  tax: QuoteTaxSchema,
});
export type CatalogResponse = z.infer<typeof CatalogResponseSchema>;
