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
/*
 * DE MENOS COMPROMISO A MAS, y por eso importa el orden: el sitio ensena el
 * precio de cada cadencia, asi que en este orden la lista baja sola —185,
 * 150, 135, 120— y se entiende de un vistazo que comprometerse sale mas
 * barato. Alfabetico o al azar, las mismas cuatro cifras parecen desordenadas
 * y hay que compararlas a mano.
 */
const FRECUENCIAS: Frequency[] = ['ONE_TIME', 'MONTHLY', 'BIWEEKLY', 'WEEKLY'];

export function buildCatalog(
  now: Date,
  config: PricingConfig = defaultPricingConfig,
): CatalogResponse {
  const services: CatalogService[] = (Object.keys(config.services) as ServiceType[]).map((code) => {
    const rates = Object.fromEntries(
      FRECUENCIAS.map((frecuencia) => {
        const tarifa = config.services[code].byFrequency[frecuencia];
        return [
          frecuencia,
          tarifa === null
            ? null
            : {
                flatCents: tarifa.flatCents,
                centsPerSquareFoot: tarifa.centsPerSquareFoot,
              },
        ];
      }),
    ) as CatalogService['rates'];

    /*
     * El «desde X» de la pagina de servicios: el importe plano mas bajo
     * al que se puede contratar. Es el precio de la cadencia mas
     * frecuente, pero se calcula y no se asume: el dia que alguien ponga
     * la mensual mas barata que la semanal, el sitio dira la verdad.
     */
    const planos = FRECUENCIAS.map((f) => config.services[code].byFrequency[f])
      .filter((tarifa): tarifa is NonNullable<typeof tarifa> => tarifa !== null)
      .map((tarifa) => tarifa.flatCents);

    return {
      code,
      instantQuote: config.services[code].instantQuote,
      rates,
      fromCents: planos.length > 0 ? Math.min(...planos) : null,
    };
  });

  /*
   * SOLO LOS EXTRAS QUE SE OFRECEN. Los retirados siguen en la
   * configuracion para poder releer presupuestos antiguos, pero el sitio no
   * tiene por que ensenarlos.
   */
  const addOns: CatalogAddOn[] = (Object.keys(config.addOns) as AddOnCode[])
    .filter((code) => config.addOns[code].offered)
    .map((code) => ({
      code,
      unit: config.addOns[code].unit,
      unitAmountCents: config.addOns[code].unitAmountCents,
      maxQuantity: config.addOns[code].maxQuantity,
    }));

  const frequencies: CatalogFrequency[] = FRECUENCIAS.map((code) => ({ code }));

  return {
    currency: config.currency,
    baseOfOperations: config.baseOfOperations,
    services,
    addOns,
    frequencies,
    zones: config.zones.map((zone) => ({
      code: zone.code,
      maxMiles: zone.maxMiles,
      serviceable: zone.serviceable,
      instantQuote: zone.instantQuote,
    })),
    deposit: { amountCents: config.deposit.amountCents },
    travel: {
      freeRadiusMiles: config.travel.freeRadiusMiles,
      centsPerMile: config.travel.centsPerMile ?? resolveMileageRate(now).centsPerMile,
      roundTrip: config.travel.roundTrip,
    },
    limits: config.limits,
    tax: {
      ratePercent: config.taxRatePercent,
      exempt: config.taxExempt,
      reasonKey: config.taxReasonKey,
    },
  };
}
