import { z } from 'zod';
import {
  AddOnCodeSchema,
  AddOnUnitSchema,
  FrequencySchema,
  ServiceTypeSchema,
  ServiceZoneSchema,
} from './enums';
import { QuoteTaxSchema } from './quote';

/**
 * El catalogo publico permite que el formulario del sitio web se construya
 * a partir de la configuracion del servidor: los precios NO se duplican en
 * el front. Si Freshness Touch cambia una tarifa, cambia en un solo sitio.
 */
/** La tarifa de un servicio en una cadencia: manda el mayor de los dos. */
export const CatalogRateSchema = z.strictObject({
  flatCents: z.int().nonnegative(),
  /** `null` cuando ese servicio no mira el tamano de la casa. */
  centsPerSquareFoot: z.number().nonnegative().nullable(),
});
export type CatalogRate = z.infer<typeof CatalogRateSchema>;

export const CatalogServiceSchema = z.strictObject({
  code: ServiceTypeSchema,
  /** false para servicios que requieren visita previa. */
  instantQuote: z.boolean(),
  /**
   * Lo que cuesta en cada cadencia. `null` = NO SE OFRECE ASI.
   *
   * Una limpieza profunda no se contrata cada semana: la casa ya esta
   * profunda. El sitio tiene que poder no ofrecer esa combinacion en vez de
   * ensenar un precio que nadie va a contratar.
   */
  rates: z.record(FrequencySchema, CatalogRateSchema.nullable()),
  /**
   * El importe plano mas bajo al que se puede contratar, para el «desde X»
   * de la pagina de servicios. `null` cuando no hay precio automatico.
   */
  fromCents: z.int().nonnegative().nullable(),
});
export type CatalogService = z.infer<typeof CatalogServiceSchema>;

export const CatalogAddOnSchema = z.strictObject({
  code: AddOnCodeSchema,
  unit: AddOnUnitSchema,
  unitAmountCents: z.int().nonnegative(),
  maxQuantity: z.int().min(1),
});
export type CatalogAddOn = z.infer<typeof CatalogAddOnSchema>;

/**
 * Las cadencias que existen.
 *
 * YA NO LLEVAN PORCENTAJE. La recurrencia dejo de ser un descuento sobre el
 * precio puntual y paso a ser su propia tarifa: se anuncia «120 a la
 * semana», no «185 menos un 35%». Lo que cuesta cada cadencia esta en
 * `rates` de cada servicio, porque depende del servicio.
 */
export const CatalogFrequencySchema = z.strictObject({
  code: FrequencySchema,
});
export type CatalogFrequency = z.infer<typeof CatalogFrequencySchema>;

export const CatalogZoneSchema = z.strictObject({
  code: ServiceZoneSchema,
  /** Limite superior en millas; null para la zona final. */
  maxMiles: z.number().nullable(),
  serviceable: z.boolean(),
  /**
   * Si en esta zona el precio sale solo.
   *
   * Atendida y con precio automatico NO son lo mismo, y la diferencia es lo
   * que permite cubrir todo Georgia sin prometer un precio imposible: cerca
   * el cotizador da la cifra al instante, lejos dice que se da en persona.
   */
  instantQuote: z.boolean(),
});
export type CatalogZone = z.infer<typeof CatalogZoneSchema>;

/** El deposito: una cifra fija que se descuenta del total. */
export const CatalogDepositSchema = z.strictObject({
  amountCents: z.int().nonnegative(),
});
export type CatalogDeposit = z.infer<typeof CatalogDepositSchema>;

/** Lo que hay que saber del traslado antes de pedir una cotizacion. */
export const CatalogTravelSchema = z.strictObject({
  freeRadiusMiles: z.number().nonnegative(),
  centsPerMile: z.number().nonnegative(),
  roundTrip: z.boolean(),
});
export type CatalogTravel = z.infer<typeof CatalogTravelSchema>;

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
    /*
     * Coordenadas del mismo punto desde el que se mide la distancia.
     *
     * Van aqui y no escritas en el sitio web porque el mapa de zonas se
     * centra en ellas: si se guardaran por separado, el dia que la empresa
     * se mude el mapa seguiria dibujando circulos alrededor del sitio
     * antiguo mientras los precios se calculan desde el nuevo. El mapa
     * mentiria, y nadie lo notaria hasta que un cliente reclamara.
     */
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  services: z.array(CatalogServiceSchema),
  addOns: z.array(CatalogAddOnSchema),
  frequencies: z.array(CatalogFrequencySchema),
  zones: z.array(CatalogZoneSchema),
  deposit: CatalogDepositSchema,
  travel: CatalogTravelSchema,
  limits: CatalogLimitsSchema,
  tax: QuoteTaxSchema,
});
export type CatalogResponse = z.infer<typeof CatalogResponseSchema>;
