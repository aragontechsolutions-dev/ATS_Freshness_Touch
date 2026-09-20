import type {
  AddOnCode,
  CatalogAddOn,
  CatalogFrequency,
  CatalogResponse,
  CatalogService,
  Frequency,
  ServiceType,
} from '@freshness/types';
import { defaultPricingConfig, type PricingConfig } from './config';
import { resolveMileageRate } from './mileage';

/**
 * Construye el catalogo publico que consume el formulario del sitio web.
 * De esta forma el front no duplica ni un solo precio: todo viene del
 * servidor y basta cambiar `pricing.config` para actualizar la web.
 */
export function buildCatalog(
  now: Date,
  config: PricingConfig = defaultPricingConfig,
): CatalogResponse {
  const services: CatalogService[] = (Object.keys(config.services) as ServiceType[]).map((code) => ({
    code,
    minimumCents: config.services[code].minimumCents,
    instantQuote: config.services[code].instantQuote,
  }));

  const addOns: CatalogAddOn[] = (Object.keys(config.addOns) as AddOnCode[]).map((code) => ({
    code,
    unit: config.addOns[code].unit,
    unitAmountCents: config.addOns[code].unitAmountCents,
    maxQuantity: config.addOns[code].maxQuantity,
  }));

  const frequencies: CatalogFrequency[] = (
    Object.keys(config.frequencyDiscountPercent) as Frequency[]
  ).map((code) => ({
    code,
    discountPercent: config.frequencyDiscountPercent[code],
  }));

  return {
    currency: config.currency,
    baseOfOperations: config.baseOfOperations,
    services,
    addOns,
    frequencies,
    zones: config.zones.map((zone) => ({
      code: zone.code,
      maxMiles: zone.maxMiles,
      surchargeCents: zone.surchargeCents,
      serviceable: zone.serviceable,
    })),
    deposit: {
      baseCents: config.deposit.baseCents,
      freeRadiusMiles: config.deposit.freeRadiusMiles,
      mileageRateCentsPerMile: resolveMileageRate(now).centsPerMile,
      minCents: config.deposit.minCents,
      maxCents: config.deposit.maxCents,
    },
    limits: config.limits,
    tax: {
      ratePercent: config.taxRatePercent,
      exempt: config.taxExempt,
      reasonKey: config.taxReasonKey,
    },
  };
}
