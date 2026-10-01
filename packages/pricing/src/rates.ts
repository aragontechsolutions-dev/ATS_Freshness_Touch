import {
  EDITABLE_SERVICE_TYPES,
  OFFERED_ADD_ON_CODES,
  type OfferedAddOnCode,
  type PricingRates,
  type ServiceType,
} from '@freshness/types';
import type { PricingConfig } from './config';

/**
 * LAS TARIFAS EDITABLES, ENCHUFADAS AL MOTOR
 * ------------------------------------------
 * El puente entre lo que se guarda en la base y la configuracion completa
 * que usa el motor. Dos funciones, y las dos existen para evitar el mismo
 * fallo: **que las tarifas vivan en dos sitios**.
 *
 *   - `defaultPricingRates` se DERIVA de `defaultPricingConfig` en vez de
 *     repetir los numeros. Repetidos, un cambio en el codigo dejaria la
 *     tabla de partida apuntando a precios viejos y nadie lo notaria hasta
 *     que un despliegue nuevo cotizara distinto que el anterior.
 *
 *   - `applyPricingRates` construye la configuracion final a partir de la
 *     del codigo, sustituyendo solo lo editable. Asi lo que NO se edita
 *     —duraciones, limites, impuesto, los servicios a consultar, si un
 *     extra es plano o por unidad— sigue teniendo un unico origen.
 */

/** Las tarifas de partida, sacadas de la configuracion del codigo. */
export function defaultPricingRates(config: PricingConfig): PricingRates {
  const addOns = {} as PricingRates['addOns'];
  for (const codigo of OFFERED_ADD_ON_CODES) {
    addOns[codigo] = {
      unitAmountCents: config.addOns[codigo].unitAmountCents,
      maxQuantity: config.addOns[codigo].maxQuantity,
    };
  }

  return {
    /*
     * Copia, no la misma lista. La configuracion del codigo la comparte todo
     * el proceso: devolver la referencia dejaria que quien guarde tarifas
     * desde el panel modificara de paso los precios de partida, y hasta los
     * de las pruebas.
     */
    sizeBands: config.sizeBands.map((banda) => ({ ...banda })),
    addOns,
    depositCents: config.deposit.amountCents,
    travel: { ...config.travel },
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
 *   - `instantQuote` de cada servicio. Que la post-obra no de precio
 *     automatico es una regla de negocio, no una tarifa.
 *   - Los servicios que no se tarifan, enteros.
 *   - `unit` y `offered` de cada extra. Plano o por unidad cambia el
 *     significado de la cantidad maxima y el de cada linea de los
 *     presupuestos anteriores.
 */
export function applyPricingRates(config: PricingConfig, rates: PricingRates): PricingConfig {
  const addOns = { ...config.addOns };
  for (const codigo of OFFERED_ADD_ON_CODES) {
    const editable = rates.addOns[codigo];
    if (!editable) continue;
    addOns[codigo] = {
      unit: config.addOns[codigo].unit,
      offered: config.addOns[codigo].offered,
      /*
       * Tambien del codigo: si un extra cobra por tamano es producto, no
       * tarifa. Editable desde el panel, el precio del horno podria pasar a
       * leerse de la columna de ventanas sin que nadie lo pidiera.
       */
      pricedBySize: config.addOns[codigo].pricedBySize,
      unitAmountCents: editable.unitAmountCents,
      maxQuantity: editable.maxQuantity,
    };
  }

  return {
    ...config,
    /*
     * LA TABLA GUARDADA MANDA ENTERA. No se mezcla con la del codigo tramo a
     * tramo: una tabla a medias —unos tramos de una version y otros de
     * otra— no es la tabla de nadie, y produciria un precio que no esta
     * escrito en ningun sitio.
     */
    sizeBands: rates.sizeBands.map((banda) => ({ ...banda })),
    /*
     * `services` NO se toca: desde la etapa 3.4 ya no lleva importes, solo
     * dice que columna de la tabla lee cada cadencia. Eso es producto y vive
     * en el codigo.
     */
    addOns,
    deposit: { amountCents: rates.depositCents },
    travel: { ...rates.travel },
  };
}

/** Guardia: los servicios a consultar nunca se tocan desde el panel. */
export function isEditableService(
  tipo: ServiceType,
): tipo is (typeof EDITABLE_SERVICE_TYPES)[number] {
  return (EDITABLE_SERVICE_TYPES as readonly ServiceType[]).includes(tipo);
}

/** Si ese extra se ofrece hoy. */
export function isOfferedAddOn(codigo: string): codigo is OfferedAddOnCode {
  return (OFFERED_ADD_ON_CODES as readonly string[]).includes(codigo);
}
