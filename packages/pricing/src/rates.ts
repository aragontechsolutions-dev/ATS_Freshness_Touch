import {
  EDITABLE_SERVICE_TYPES,
  type AddOnCode,
  type EditableServiceType,
  type Frequency,
  type PricingRates,
  type ServiceType,
} from '@freshness/types';
import type { PricingConfig, ServiceRate } from './config';

/**
 * LAS TARIFAS EDITABLES, ENCHUFADAS AL MOTOR
 * ------------------------------------------
 * El puente entre lo que se guarda en la base y la configuracion completa
 * que usa el motor. Dos funciones y nada mas, pero las dos existen para
 * evitar el mismo fallo: **que las tarifas vivan en dos sitios**.
 *
 *   - `defaultPricingRates` se DERIVA de `defaultPricingConfig` en vez de
 *     repetir los numeros. Repetidos, un cambio en el codigo dejaria la
 *     tabla de partida apuntando a precios viejos y nadie lo notaria hasta
 *     que un despliegue nuevo cotizara distinto que el anterior.
 *
 *   - `applyPricingRates` construye la configuracion final a partir de la
 *     del codigo, sustituyendo solo lo editable. Asi lo que NO se edita
 *     —duraciones, limites, impuesto, el servicio comercial— sigue teniendo
 *     un unico origen.
 */

/**
 * Las tarifas de partida, sacadas de la configuracion del codigo.
 *
 * Es lo que se guarda en la primera fila de la tabla de versiones, y lo que
 * se usa si la base no responde o la fila no cumple el contrato.
 */
export function defaultPricingRates(config: PricingConfig): PricingRates {
  return {
    services: Object.fromEntries(
      EDITABLE_SERVICE_TYPES.map((tipo) => {
        const tarifa = config.services[tipo];
        return [
          tipo,
          {
            baseCents: tarifa.baseCents,
            perBedroomCents: tarifa.perBedroomCents,
            perBathroomCents: tarifa.perBathroomCents,
            centsPerSquareFoot: tarifa.centsPerSquareFoot,
            minimumCents: tarifa.minimumCents,
          },
        ];
      }),
    ) as PricingRates['services'],

    addOns: Object.fromEntries(
      (Object.keys(config.addOns) as AddOnCode[]).map((codigo) => [
        codigo,
        {
          unitAmountCents: config.addOns[codigo].unitAmountCents,
          maxQuantity: config.addOns[codigo].maxQuantity,
        },
      ]),
    ) as PricingRates['addOns'],

    frequencyDiscounts: {
      weeklyPercent: config.frequencyDiscountPercent.WEEKLY,
      biweeklyPercent: config.frequencyDiscountPercent.BIWEEKLY,
      monthlyPercent: config.frequencyDiscountPercent.MONTHLY,
    },

    deposit: {
      baseCents: config.deposit.baseCents,
      freeRadiusMiles: config.deposit.freeRadiusMiles,
      roundTrip: config.deposit.roundTrip,
      minCents: config.deposit.minCents,
      maxCents: config.deposit.maxCents,
    },
  };
}

/**
 * La configuracion del motor, con las tarifas guardadas encima.
 *
 * NO MUTA NADA: devuelve objetos nuevos. La configuracion del codigo es un
 * valor compartido por todo el proceso, y escribir en ella haria que un
 * cambio de precios contaminara hasta las pruebas que usan los valores de
 * partida.
 *
 * QUE SE CONSERVA DEL CODIGO, Y ES DELIBERADO:
 *
 *   - `instantQuote` de cada servicio. Que el comercial no de precio
 *     automatico es una regla de negocio, no una tarifa.
 *   - `unit` de cada extra. Plano o por unidad cambia el significado de la
 *     cantidad maxima y el de cada linea de los presupuestos anteriores.
 *   - `ONE_TIME: 0`. Un servicio que no se repite no tiene descuento por
 *     repetirse.
 */
export function applyPricingRates(config: PricingConfig, rates: PricingRates): PricingConfig {
  const services = { ...config.services };
  for (const tipo of EDITABLE_SERVICE_TYPES) {
    services[tipo] = combinarServicio(config.services[tipo], rates.services[tipo]);
  }

  const addOns = { ...config.addOns };
  for (const codigo of Object.keys(addOns) as AddOnCode[]) {
    const editable = rates.addOns[codigo];
    if (!editable) continue;
    addOns[codigo] = {
      // El tipo de unidad se conserva: ver la cabecera.
      unit: config.addOns[codigo].unit,
      unitAmountCents: editable.unitAmountCents,
      maxQuantity: editable.maxQuantity,
    };
  }

  const frequencyDiscountPercent: Record<Frequency, number> = {
    ONE_TIME: 0,
    WEEKLY: rates.frequencyDiscounts.weeklyPercent,
    BIWEEKLY: rates.frequencyDiscounts.biweeklyPercent,
    MONTHLY: rates.frequencyDiscounts.monthlyPercent,
  };

  return {
    ...config,
    services,
    addOns,
    frequencyDiscountPercent,
    deposit: { ...config.deposit, ...rates.deposit },
  };
}

/* -------------------------------------------------------------------------- */

function combinarServicio(
  delCodigo: ServiceRate,
  editable: PricingRates['services'][EditableServiceType],
): ServiceRate {
  return {
    baseCents: editable.baseCents,
    perBedroomCents: editable.perBedroomCents,
    perBathroomCents: editable.perBathroomCents,
    centsPerSquareFoot: editable.centsPerSquareFoot,
    minimumCents: editable.minimumCents,
    // Regla de negocio, no tarifa.
    instantQuote: delCodigo.instantQuote,
  };
}

/** Guardia: el servicio comercial nunca se toca desde el panel. */
export function isEditableService(tipo: ServiceType): tipo is EditableServiceType {
  return (EDITABLE_SERVICE_TYPES as readonly ServiceType[]).includes(tipo);
}
