import { describe, expect, it } from 'vitest';
import {
  EDITABLE_SERVICE_TYPES,
  EditableAddOnRateSchema,
  EditableTravelRuleSchema,
  OFFERED_ADD_ON_CODES,
  PricingRatesSchema,
  QUOTE_ONLY_SERVICE_TYPES,
  nextPricingVersion,
  type PricingRates,
} from './pricing-rates';
import { PricingSizeBandsSchema, sizeBandFor } from './pricing-size-bands';

/**
 * EL CONTRATO DE LAS TARIFAS
 * --------------------------
 * Esto se prueba con mas insistencia que el resto de los contratos por un
 * motivo concreto: **un precio equivocado no rompe nada**. Cotiza, cobra y
 * factura, con la cifra mal, y no hay pantalla roja que avise. Lo unico que
 * se interpone entre un dedo y una factura absurda son estas reglas.
 */

/** Dos tramos reales de la hoja del cliente. */
const BANDAS = [
  {
    maxSquareFeet: 900,
    deepCents: 26_000,
    standardMonthlyCents: 16_000,
    standardBiweeklyCents: 13_500,
    standardWeeklyCents: 12_000,
    windowsAndCabinetsCents: 3000,
  },
  {
    maxSquareFeet: 1200,
    deepCents: 27_000,
    standardMonthlyCents: 15_000,
    standardBiweeklyCents: 14_000,
    standardWeeklyCents: 13_000,
    windowsAndCabinetsCents: 3000,
  },
];

const RATES: PricingRates = {
  sizeBands: BANDAS,
  addOns: {
    INSIDE_OVEN: { unitAmountCents: 5000, maxQuantity: 1 },
    INSIDE_FRIDGE: { unitAmountCents: 5000, maxQuantity: 1 },
  },
  depositCents: 3500,
  travel: { freeRadiusMiles: 35, roundTrip: true, centsPerMile: null },
};

/** Un tramo con un cambio encima, para probar una regla cada vez. */
const tramo = (cambios: Partial<(typeof BANDAS)[number]> = {}) => ({ ...BANDAS[0], ...cambios });

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

  it('hace falta la tabla de tramos entera', () => {
    /*
     * Sin ella el motor se quedaria con la del codigo sin decir nada: medio
     * sistema con los precios nuevos y medio con los viejos, que es el peor
     * de los dos mundos.
     *
     * Desde la etapa 3.4 los servicios ya no llevan importes —la tabla los
     * tiene todos—, asi que lo que no puede faltar es la tabla.
     */
    const { sizeBands: _descartada, ...sinTabla } = RATES;

    expect(PricingRatesSchema.safeParse(sinTabla).success).toBe(false);
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
    expect(PricingSizeBandsSchema.safeParse([tramo({ deepCents: 99_999_999 })]).success).toBe(
      false,
    );
  });

  it('rechaza un precio negativo', () => {
    expect(PricingSizeBandsSchema.safeParse([tramo({ deepCents: -100 })]).success).toBe(false);
  });

  it('rechaza centavos partidos', () => {
    // Medio centavo no existe, y un decimal aqui viene de una division que
    // alguien hizo mal, no de un precio que alguien quiso poner.
    expect(PricingSizeBandsSchema.safeParse([tramo({ deepCents: 26_000.5 })]).success).toBe(false);
  });

  it('un tramo SI puede costar cero: se regala, no se retira', () => {
    /*
     * Distinto del importe plano del modelo anterior, que tenia un suelo de
     * un centavo. Aqui un cero es una decision legitima —una promocion, un
     * extra incluido— y no deja nada roto: la casa paga cero por esa
     * columna y el resto del presupuesto sigue cuadrando.
     */
    expect(PricingSizeBandsSchema.safeParse([tramo({ windowsAndCabinetsCents: 0 })]).success).toBe(
      true,
    );
  });

  it('rechaza un tramo de un tamano imposible', () => {
    expect(PricingSizeBandsSchema.safeParse([tramo({ maxSquareFeet: 0 })]).success).toBe(false);
    expect(PricingSizeBandsSchema.safeParse([tramo({ maxSquareFeet: 999_999 })]).success).toBe(
      false,
    );
  });

  it('el deposito no puede ser cero', () => {
    // Sin garantia no hay nada que retener: la regla dejaria de existir.
    expect(PricingRatesSchema.safeParse({ ...RATES, depositCents: 0 }).success).toBe(false);
  });
});

describe('lo que no significa nada aunque cada numero valga', () => {
  it('los tramos tienen que ir en orden', () => {
    /*
     * Con la tabla desordenada, cual tramo gana depende de como este
     * guardada: la misma casa cotizaria distinto segun el orden de la
     * lista. Es la clase de fallo que nadie encuentra.
     */
    const alReves = [tramo({ maxSquareFeet: 1200 }), tramo({ maxSquareFeet: 900 })];

    expect(PricingSizeBandsSchema.safeParse(alReves).success).toBe(false);
  });

  it('dos tramos no pueden tener el mismo tope', () => {
    const repetido = [tramo({ maxSquareFeet: 900 }), tramo({ maxSquareFeet: 900 })];

    expect(PricingSizeBandsSchema.safeParse(repetido).success).toBe(false);
  });

  it('la tabla no puede estar vacia', () => {
    // Sin una sola fila no hay precio para ninguna casa, y el cotizador
    // mandaria a revision manual absolutamente todo.
    expect(PricingSizeBandsSchema.safeParse([]).success).toBe(false);
  });

  it('el precio no puede SUBIR al comprometerse a mas limpiezas', () => {
    /*
     * Cada numero por separado es valido y el conjunto no significa nada:
     * quien se compromete a una limpieza semanal pagaria mas que quien
     * viene una vez al mes. Se pierde dinero en cada reserva recurrente y no
     * lo delata ninguna pantalla.
     */
    expect(PricingSizeBandsSchema.safeParse([tramo({ standardWeeklyCents: 99_000 })]).success).toBe(
      false,
    );
    expect(
      PricingSizeBandsSchema.safeParse([tramo({ standardBiweeklyCents: 99_000 })]).success,
    ).toBe(false);
  });

  it('precios iguales en todas las cadencias SI valen', () => {
    // No subir no es lo mismo que bajar: una empresa puede decidir que la
    // recurrencia no abarata, y eso es coherente aunque sea poco comun.
    const plano = tramo({
      standardMonthlyCents: 15_000,
      standardBiweeklyCents: 15_000,
      standardWeeklyCents: 15_000,
    });

    expect(PricingSizeBandsSchema.safeParse([plano]).success).toBe(true);
  });

  it('UN TRAMO MAS GRANDE SI PUEDE SER MAS BARATO, y es deliberado', () => {
    /*
     * LA REGLA QUE NO EXISTE, Y POR QUE.
     *
     * En la hoja del cliente, la estandar mensual de 900 pies cuesta 160 $ y
     * la de 1.200 cuesta 150: la casa mas grande, diez dolares mas barata.
     * Parece una errata suya, pero no es nuestra para corregirla.
     *
     * Una invariante de «el precio nunca baja al crecer la casa» rechazaria
     * SUS PROPIOS PRECIOS y le impediria guardarlos desde el panel. Esta
     * prueba deja por escrito que la ausencia de esa regla esta pensada.
     */
    expect(PricingSizeBandsSchema.safeParse(BANDAS).success).toBe(true);
  });
});

describe('a que tramo va cada casa', () => {
  it('justo en el tope, ese tramo', () => {
    expect(sizeBandFor(BANDAS, 900)?.maxSquareFeet).toBe(900);
    expect(sizeBandFor(BANDAS, 1200)?.maxSquareFeet).toBe(1200);
  });

  it('un pie mas, el siguiente', () => {
    expect(sizeBandFor(BANDAS, 901)?.maxSquareFeet).toBe(1200);
  });

  it('en un hueco de la tabla, sube', () => {
    // Entre 900 y 1.200 no hay nada escrito: una casa de 1.000 paga 1.200.
    expect(sizeBandFor(BANDAS, 1000)?.maxSquareFeet).toBe(1200);
  });

  it('mas pequena que el primer tramo, paga el primero', () => {
    expect(sizeBandFor(BANDAS, 100)?.maxSquareFeet).toBe(900);
  });

  it('mas grande que el ultimo, NO hay tramo', () => {
    // `null` no es un error: significa «esta casa no se tarifa sola».
    expect(sizeBandFor(BANDAS, 1201)).toBeNull();
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
