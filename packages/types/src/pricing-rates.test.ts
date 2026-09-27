import { describe, expect, it } from 'vitest';
import {
  EDITABLE_SERVICE_TYPES,
  EditableAddOnRateSchema,
  EditableTravelRuleSchema,
  FrequencyRateSchema,
  OFFERED_ADD_ON_CODES,
  PricingRatesSchema,
  QUOTE_ONLY_SERVICE_TYPES,
  ServiceRatesSchema,
  nextPricingVersion,
  type PricingRates,
} from './pricing-rates';

/**
 * EL CONTRATO DE LAS TARIFAS
 * --------------------------
 * Esto se prueba con mas insistencia que el resto de los contratos por un
 * motivo concreto: **un precio equivocado no rompe nada**. Cotiza, cobra y
 * factura, con la cifra mal, y no hay pantalla roja que avise. Lo unico que
 * se interpone entre un dedo y una factura absurda son estas reglas.
 */

/** La estandar real: plana, y mas barata cuanto mas se repite. */
const ESTANDAR = {
  ONE_TIME: { flatCents: 18_500, centsPerSquareFoot: null },
  MONTHLY: { flatCents: 15_000, centsPerSquareFoot: null },
  BIWEEKLY: { flatCents: 13_500, centsPerSquareFoot: null },
  WEEKLY: { flatCents: 12_000, centsPerSquareFoot: null },
};

/** La profunda real: solo puntual, y mirando los pies cuadrados. */
const POR_TAMANO = {
  ONE_TIME: { flatCents: 25_000, centsPerSquareFoot: 30 },
  MONTHLY: null,
  BIWEEKLY: null,
  WEEKLY: null,
};

const RATES: PricingRates = {
  services: {
    STANDARD: ESTANDAR,
    DEEP: POR_TAMANO,
    MOVE_IN_OUT: POR_TAMANO,
  },
  addOns: {
    INSIDE_OVEN: { unitAmountCents: 5000, maxQuantity: 1 },
    INSIDE_FRIDGE: { unitAmountCents: 5000, maxQuantity: 1 },
    INSIDE_CABINETS: { unitAmountCents: 2500, maxQuantity: 1 },
    INTERIOR_WINDOWS: { unitAmountCents: 600, maxQuantity: 40 },
  },
  depositCents: 3500,
  travel: { freeRadiusMiles: 35, roundTrip: true, centsPerMile: null },
};

describe('la tabla de partida vale', () => {
  it('las tarifas de ejemplo pasan el contrato', () => {
    expect(PricingRatesSchema.safeParse(RATES).success).toBe(true);
  });

  it('los servicios que se cotizan a mano NO estan entre los editables', () => {
    /*
     * Post-obra, rotacion de Airbnb y comercial se visitan y se proponen a
     * mano. Cualquier cifra que se pusiera no se usaria jamas, y un campo
     * que no hace nada es peor que ninguno.
     */
    for (const tipo of QUOTE_ONLY_SERVICE_TYPES) {
      expect(EDITABLE_SERVICE_TYPES).not.toContain(tipo);
    }
  });

  it('hacen falta TODOS los servicios editables', () => {
    const incompleta = { ...RATES, services: { STANDARD: ESTANDAR } };

    /*
     * Si faltara uno, el motor se quedaria con la tarifa del codigo para ese
     * servicio sin decir nada: medio sistema con los precios nuevos y medio
     * con los viejos, que es el peor de los dos mundos.
     */
    expect(PricingRatesSchema.safeParse(incompleta).success).toBe(false);
  });

  it('hacen falta TODOS los extras que se ofrecen', () => {
    const incompleta = {
      ...RATES,
      addOns: { INSIDE_OVEN: { unitAmountCents: 5000, maxQuantity: 1 } },
    };

    expect(PricingRatesSchema.safeParse(incompleta).success).toBe(false);
  });

  it('un extra retirado no se cuela en la tabla', () => {
    /*
     * Su codigo sigue existiendo para poder releer presupuestos antiguos,
     * pero tarifarlo lo devolveria al catalogo por la puerta de atras.
     */
    expect(OFFERED_ADD_ON_CODES).not.toContain('LAUNDRY');

    const conRetirado = {
      ...RATES,
      addOns: { ...RATES.addOns, LAUNDRY: { unitAmountCents: 2000, maxQuantity: 6 } },
    };

    expect(PricingRatesSchema.safeParse(conRetirado).success).toBe(false);
  });

  it('un campo de mas se rechaza, no se ignora', () => {
    const conSobra = { ...RATES, taxRatePercent: 7 };

    /*
     * El impuesto NO es editable: en Georgia la limpieza esta exenta por
     * ley. Aceptarlo en silencio dejaria a alguien convencido de que lo
     * cambio.
     */
    expect(PricingRatesSchema.safeParse(conSobra).success).toBe(false);
  });
});

describe('el cero de mas', () => {
  it('rechaza un importe absurdo', () => {
    /*
     * ESTE ES EL FALLO REALISTA. No un precio negativo: un dedo que teclea
     * 1850000 donde iban 18500. Sin tope, la siguiente cotizacion sale a
     * 18 500 $ y se descubre con la factura delante.
     */
    expect(
      FrequencyRateSchema.safeParse({ flatCents: 99_999_999, centsPerSquareFoot: null }).success,
    ).toBe(false);
  });

  it('rechaza un precio negativo', () => {
    expect(
      FrequencyRateSchema.safeParse({ flatCents: -100, centsPerSquareFoot: null }).success,
    ).toBe(false);
  });

  it('el importe plano no puede ser cero', () => {
    /*
     * Es el suelo del precio: con cero, una casa pequena de un servicio sin
     * precio por pie saldria gratis.
     */
    expect(FrequencyRateSchema.safeParse({ flatCents: 0, centsPerSquareFoot: null }).success).toBe(
      false,
    );
  });

  it('acepta decimales solo en el precio por pie cuadrado', () => {
    /*
     * El plano se cobra tal cual y medio centavo no existe. Este se
     * multiplica por los pies antes de redondear, y la diferencia entre 30 y
     * 31 centavos en una casa de 2 000 pies son veinte dolares.
     */
    expect(
      FrequencyRateSchema.safeParse({ flatCents: 25_000, centsPerSquareFoot: 30.5 }).success,
    ).toBe(true);
    expect(
      FrequencyRateSchema.safeParse({ flatCents: 18_500.5, centsPerSquareFoot: null }).success,
    ).toBe(false);
  });

  it('el deposito no puede ser cero', () => {
    // Sin garantia no hay nada que retener: la regla dejaria de existir.
    expect(PricingRatesSchema.safeParse({ ...RATES, depositCents: 0 }).success).toBe(false);
  });
});

describe('lo que no significa nada aunque cada numero valga', () => {
  it('siempre tiene que poderse contratar una vez', () => {
    /*
     * Sin la puntual, un servicio con precio automatico solo se podria
     * contratar comprometiendose de antemano, y el cotizador respondería
     * «elige otra frecuencia» a quien solo quiere una limpieza.
     */
    const sinPuntual = { ...ESTANDAR, ONE_TIME: null };

    expect(ServiceRatesSchema.safeParse(sinPuntual).success).toBe(false);
  });

  it('el precio no puede SUBIR al aumentar la frecuencia', () => {
    /*
     * 120 $ la puntual y 185 $ la semanal: los dos numeros son validos.
     * Juntos significan que quien se compromete a una limpieza semanal paga
     * mas que quien viene una vez. Se pierde la venta recurrente entera y no
     * lo delata nada.
     */
    const alReves = {
      ONE_TIME: { flatCents: 12_000, centsPerSquareFoot: null },
      MONTHLY: { flatCents: 13_500, centsPerSquareFoot: null },
      BIWEEKLY: { flatCents: 15_000, centsPerSquareFoot: null },
      WEEKLY: { flatCents: 18_500, centsPerSquareFoot: null },
    };

    expect(ServiceRatesSchema.safeParse(alReves).success).toBe(false);
  });

  it('el precio por pie cuadrado se vigila igual que el plano', () => {
    const alReves = {
      ONE_TIME: { flatCents: 25_000, centsPerSquareFoot: 14 },
      MONTHLY: { flatCents: 15_000, centsPerSquareFoot: 18 },
      BIWEEKLY: null,
      WEEKLY: null,
    };

    expect(ServiceRatesSchema.safeParse(alReves).success).toBe(false);
  });

  it('precios iguales en todas las cadencias SI valen', () => {
    // No es raro: un servicio que no premia el compromiso.
    const iguales = {
      ONE_TIME: { flatCents: 15_000, centsPerSquareFoot: null },
      MONTHLY: { flatCents: 15_000, centsPerSquareFoot: null },
      BIWEEKLY: { flatCents: 15_000, centsPerSquareFoot: null },
      WEEKLY: { flatCents: 15_000, centsPerSquareFoot: null },
    };

    expect(ServiceRatesSchema.safeParse(iguales).success).toBe(true);
  });

  it('un hueco en medio vale: se comparan solo las cadencias ofrecidas', () => {
    /*
     * Puntual y semanal sin mensual es raro, pero no es incoherente.
     * Rechazarlo seria inventarse una regla que el negocio no pidio.
     */
    const conHueco = {
      ONE_TIME: { flatCents: 18_500, centsPerSquareFoot: null },
      MONTHLY: null,
      BIWEEKLY: null,
      WEEKLY: { flatCents: 12_000, centsPerSquareFoot: null },
    };

    expect(ServiceRatesSchema.safeParse(conHueco).success).toBe(true);
  });

  it('solo puntual vale: es el caso de la profunda', () => {
    expect(ServiceRatesSchema.safeParse(POR_TAMANO).success).toBe(true);
  });
});

describe('el traslado', () => {
  it('la tarifa por milla puede quedar en null: entonces manda el IRS', () => {
    /*
     * Es una cifra oficial y publicada: ante un cliente que discute el
     * recargo hay algo que ensenar que no se ha inventado la empresa.
     */
    expect(
      EditableTravelRuleSchema.safeParse({
        freeRadiusMiles: 35,
        roundTrip: true,
        centsPerMile: null,
      }).success,
    ).toBe(true);
  });

  it('rechaza una tarifa por milla de mudanza', () => {
    expect(
      EditableTravelRuleSchema.safeParse({
        freeRadiusMiles: 35,
        roundTrip: true,
        centsPerMile: 900,
      }).success,
    ).toBe(false);
  });

  it('el radio libre puede ser cero: cobrar desde la puerta es legitimo', () => {
    expect(
      EditableTravelRuleSchema.safeParse({
        freeRadiusMiles: 0,
        roundTrip: false,
        centsPerMile: 70,
      }).success,
    ).toBe(true);
  });

  it('el radio libre no puede ser mas grande que el estado', () => {
    expect(
      EditableTravelRuleSchema.safeParse({
        freeRadiusMiles: 5000,
        roundTrip: true,
        centsPerMile: null,
      }).success,
    ).toBe(false);
  });
});

describe('los extras', () => {
  it('un extra puede costar cero: se regala, no se retira', () => {
    expect(EditableAddOnRateSchema.safeParse({ unitAmountCents: 0, maxQuantity: 1 }).success).toBe(
      true,
    );
  });

  it('la cantidad maxima nunca es cero', () => {
    // Con cero, el extra se ofrece y luego no se cobra: peor que retirarlo.
    expect(
      EditableAddOnRateSchema.safeParse({ unitAmountCents: 600, maxQuantity: 0 }).success,
    ).toBe(false);
  });
});

describe('la numeracion de versiones', () => {
  const DIA = new Date('2026-09-27T18:00:00Z');

  it('empieza en 1 cuando no hay ninguna de ese dia', () => {
    expect(nextPricingVersion(DIA, [])).toBe('2026.09.27.1');
    expect(nextPricingVersion(DIA, ['2026.09.26.7'])).toBe('2026.09.27.1');
  });

  it('sigue a la mayor del dia, no a la ultima de la lista', () => {
    /*
     * Se cuenta sobre las versiones que YA EXISTEN, no sobre un contador
     * aparte: un contador es otro estado que se puede desincronizar de la
     * tabla que numera.
     */
    expect(nextPricingVersion(DIA, ['2026.09.27.1', '2026.09.27.3', '2026.09.27.2'])).toBe(
      '2026.09.27.4',
    );
  });

  it('ignora versiones con otro formato, como la semilla del codigo', () => {
    // La primera fila hereda la version que ya llevaban las cotizaciones.
    expect(nextPricingVersion(DIA, ['2026.09.1'])).toBe('2026.09.27.1');
  });

  it('las versiones de un mismo dia se ordenan como texto', () => {
    const generadas = ['2026.09.27.1', '2026.09.27.2', '2026.09.27.3'];

    expect([...generadas].sort()).toEqual(generadas);
  });
});
