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
  /*
   * EL PRECIO DEL TRAMO MAS PEQUENO es lo que se publica como «desde». Es el
   * minimo real al que se puede contratar, y sale de la tabla en vez de
   * escribirse a mano: el dia que cambien los precios, el sitio dice la
   * verdad sin que nadie se acuerde de tocarlo.
   */
  const primerTramo = config.sizeBands[0] ?? null;

  /*
   * SOLO LOS SERVICIOS QUE SE OFRECEN HOY. Los retirados siguen en la
   * configuracion para poder releer reservas antiguas, pero el sitio no
   * tiene por que ensenarlos: desde la etapa 3.4 la post-obra, el cambio de
   * Airbnb y el comercial no se ofrecen.
   *
   * FILTRAR AQUI Y NO EN CADA PANTALLA es lo que hace que no se escape por
   * ningun lado: la lista de servicios, el cotizador y el formulario de
   * reserva leen todos de aqui.
   */
  const services: CatalogService[] = (Object.keys(config.services) as ServiceType[])
    .filter((code) => config.services[code].offered)
    .map((code) => {
      const rates = Object.fromEntries(
        FRECUENCIAS.map((frecuencia) => {
          const columna = config.services[code].byFrequency[frecuencia];
          return [
            frecuencia,
            columna === null || primerTramo === null ? null : { fromCents: primerTramo[columna] },
          ];
        }),
      ) as CatalogService['rates'];

      /*
       * El «desde X» de la pagina de servicios: el mas bajo de los de arriba.
       * Se calcula y no se asume que sea el de la cadencia mas frecuente: el
       * dia que alguien ponga la mensual mas barata que la semanal —que ya
       * pasa en el tramo de 900 pies de la tabla actual—, el sitio dira la
       * verdad.
       */
      const minimos = FRECUENCIAS.map((f) => config.services[code].byFrequency[f])
        .filter((columna): columna is NonNullable<typeof columna> => columna !== null)
        .map((columna) => primerTramo?.[columna] ?? 0);

      return {
        code,
        instantQuote: config.services[code].instantQuote,
        rates,
        fromCents: minimos.length > 0 ? Math.min(...minimos) : null,
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
      /*
       * El de ventanas y gabinetes publica el precio del tramo mas pequeno:
       * su `unitAmountCents` es cero porque el importe sale de la tabla, y
       * ensenar un cero en el sitio diria que es gratis.
       */
      unitAmountCents: config.addOns[code].pricedBySize
        ? (primerTramo?.windowsAndCabinetsCents ?? 0)
        : config.addOns[code].unitAmountCents,
      unit: config.addOns[code].unit,
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
