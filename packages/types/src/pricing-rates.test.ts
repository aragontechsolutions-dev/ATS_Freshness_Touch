import { describe, expect, it } from 'vitest';
import {
  EDITABLE_SERVICE_TYPES,
  EditableDepositRuleSchema,
  EditableServiceRateSchema,
  FrequencyDiscountsSchema,
  PricingRatesSchema,
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

const TARIFA_VALIDA = {
  baseCents: 6500,
  perBedroomCents: 1200,
  perBathroomCents: 1500,
  centsPerSquareFoot: 3,
  minimumCents: 12000,
};

const RATES: PricingRates = {
  services: Object.fromEntries(
    EDITABLE_SERVICE_TYPES.map((tipo) => [tipo, TARIFA_VALIDA]),
  ) as PricingRates['services'],
  addOns: {
    INSIDE_FRIDGE: { unitAmountCents: 3500, maxQuantity: 1 },
    INSIDE_OVEN: { unitAmountCents: 3500, maxQuantity: 1 },
    INSIDE_CABINETS: { unitAmountCents: 4500, maxQuantity: 1 },
    INTERIOR_WINDOWS: { unitAmountCents: 600, maxQuantity: 40 },
    LAUNDRY: { unitAmountCents: 2000, maxQuantity: 6 },
    BASEMENT: { unitAmountCents: 4000, maxQuantity: 1 },
    GARAGE: { unitAmountCents: 4500, maxQuantity: 1 },
    PET_HAIR: { unitAmountCents: 3000, maxQuantity: 1 },
    PATIO: { unitAmountCents: 2500, maxQuantity: 1 },
    BED_LINENS: { unitAmountCents: 1000, maxQuantity: 10 },
  },
  frequencyDiscounts: { weeklyPercent: 15, biweeklyPercent: 10, monthlyPercent: 5 },
  deposit: {
    baseCents: 3000,
    freeRadiusMiles: 20,
    roundTrip: true,
    minCents: 3000,
    maxCents: 12000,
  },
};

describe('la tabla de partida vale', () => {
  it('las tarifas de ejemplo pasan el contrato', () => {
    expect(PricingRatesSchema.safeParse(RATES).success).toBe(true);
  });

  it('el comercial NO esta entre los editables', () => {
    /*
     * No tiene precio automatico: se visita y se propone a mano. Cualquier
     * cifra que se pusiera no se usaria jamas, y un campo que no hace nada
     * es peor que ninguno.
     */
    expect(EDITABLE_SERVICE_TYPES).not.toContain('COMMERCIAL');
  });

  it('hacen falta TODOS los servicios editables', () => {
    const incompleta = {
      ...RATES,
      services: { STANDARD: TARIFA_VALIDA },
    };

    /*
     * Si faltara uno, el motor se quedaria con la tarifa del codigo para ese
     * servicio sin decir nada: medio sistema con los precios nuevos y medio
     * con los viejos, que es el peor de los dos mundos.
     */
    expect(PricingRatesSchema.safeParse(incompleta).success).toBe(false);
  });

  it('hacen falta TODOS los extras', () => {
    const incompleta = {
      ...RATES,
      addOns: { INSIDE_FRIDGE: { unitAmountCents: 3500, maxQuantity: 1 } },
    };

    expect(PricingRatesSchema.safeParse(incompleta).success).toBe(false);
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
  it('rechaza un cargo base absurdo', () => {
    /*
     * ESTE ES EL FALLO REALISTA. No un precio negativo: un dedo que teclea
     * 120000 donde iban 12000. Sin tope, la siguiente cotizacion sale a
     * 1 200 $ y se descubre con la factura delante.
     */
    const resultado = EditableServiceRateSchema.safeParse({
      ...TARIFA_VALIDA,
      baseCents: 99_999_999,
    });

    expect(resultado.success).toBe(false);
  });

  it('rechaza un precio negativo', () => {
    expect(
      EditableServiceRateSchema.safeParse({ ...TARIFA_VALIDA, perBedroomCents: -100 }).success,
    ).toBe(false);
  });

  it('acepta decimales solo en el precio por pie cuadrado', () => {
    /*
     * Los demas son importes que se cobran tal cual y medio centavo no
     * existe. Este se multiplica por los pies antes de redondear, y la
     * diferencia entre 3 y 4 en una casa de 2 000 pies son veinte dolares.
     */
    expect(
      EditableServiceRateSchema.safeParse({ ...TARIFA_VALIDA, centsPerSquareFoot: 3.5 }).success,
    ).toBe(true);
    expect(
      EditableServiceRateSchema.safeParse({ ...TARIFA_VALIDA, baseCents: 6500.5 }).success,
    ).toBe(false);
  });

  it('el importe minimo no puede ser cero', () => {
    /*
     * El motor aplica el minimo como suelo. Sin suelo, el suelo es cero: una
     * casa pequena sin extras saldria gratis.
     */
    expect(EditableServiceRateSchema.safeParse({ ...TARIFA_VALIDA, minimumCents: 0 }).success).toBe(
      false,
    );
  });
});

describe('lo que no significa nada aunque cada numero valga', () => {
  it('el descuento no puede bajar al aumentar la frecuencia', () => {
    /*
     * Quince por ciento al mes y cinco a la semana: los dos numeros son
     * validos. Juntos significan que quien se compromete a una limpieza
     * semanal paga proporcionalmente mas que quien viene una vez al mes. Se
     * pierde dinero en cada reserva recurrente y no lo delata nada.
     */
    const alReves = { weeklyPercent: 5, biweeklyPercent: 10, monthlyPercent: 15 };

    expect(FrequencyDiscountsSchema.safeParse(alReves).success).toBe(false);
  });

  it('descuentos iguales sí valen', () => {
    // No es raro: la misma promoción para todas las recurrencias.
    const iguales = { weeklyPercent: 10, biweeklyPercent: 10, monthlyPercent: 10 };

    expect(FrequencyDiscountsSchema.safeParse(iguales).success).toBe(true);
  });

  it('rechaza un descuento por encima de la mitad', () => {
    expect(
      FrequencyDiscountsSchema.safeParse({
        weeklyPercent: 80,
        biweeklyPercent: 10,
        monthlyPercent: 5,
      }).success,
    ).toBe(false);
  });

  it('el minimo del deposito no puede superar al maximo', () => {
    /*
     * El deposito calculado se recorta a ese intervalo. Invertido, el
     * recorte no tiene solucion y el resultado depende del orden en que se
     * apliquen los dos limites: cifras distintas sin fallar por ningun
     * sitio.
     */
    const invertido = { ...RATES.deposit, minCents: 20000, maxCents: 5000 };

    expect(EditableDepositRuleSchema.safeParse(invertido).success).toBe(false);
  });

  it('el deposito base SI puede quedar por debajo del minimo', () => {
    /*
     * Es legitimo y hay que dejarlo pasar: la base es un componente del
     * calculo, no el resultado. Lo que se recorta al intervalo es el total,
     * ya con el recargo por distancia.
     */
    const bajo = { ...RATES.deposit, baseCents: 1000, minCents: 3000, maxCents: 12000 };

    expect(EditableDepositRuleSchema.safeParse(bajo).success).toBe(true);
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
