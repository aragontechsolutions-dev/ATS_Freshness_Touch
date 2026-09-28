import { describe, expect, it } from 'vitest';
import type { QuoteRequest } from '@freshness/types';
import { calculateQuote, type QuoteContext } from './engine';
import { defaultPricingConfig } from './config';

const NOW = new Date('2026-09-20T12:00:00.000Z');
const QUOTE_ID = '11111111-2222-4333-8444-555555555555';

function buildRequest(overrides: Partial<QuoteRequest> = {}): QuoteRequest {
  return {
    service: 'STANDARD',
    frequency: 'ONE_TIME',
    // Sin habitaciones ni banos, que es lo que manda el cotizador: el
    // precio no los mira y por eso dejaron de preguntarse.
    squareFeet: 1800,
    addOns: [],
    destination: { postalCode: '30303', state: 'GA' },
    locale: 'en',
    ...overrides,
  };
}

function buildContext(miles: number, overrides: Partial<QuoteContext> = {}): QuoteContext {
  return {
    quoteId: QUOTE_ID,
    now: NOW,
    distance: {
      miles,
      durationMinutes: Math.round(miles * 1.8),
      provider: 'mock',
      estimated: true,
      cached: false,
    },
    ...overrides,
  };
}

describe('calculateQuote - que datos entran y cuales no', () => {
  it('la linea del servicio no nombra habitaciones ni banos', () => {
    /*
     * Ninguno de los dos mueve la cifra, y leerlos junto al importe hace
     * pensar que si: quien ve «3 hab / 2 banos · 185 $» da por hecho que
     * con cuatro costaria mas, y llama para discutirlo.
     */
    const quote = calculateQuote(buildRequest(), buildContext(10));
    const linea = quote.lines.find((item) => item.kind === 'SERVICE_BASE');

    expect(linea?.labelParams).toEqual({ squareFeet: 1800, frequency: 'ONE_TIME' });
  });

  it('el presupuesto devuelto tampoco los lleva', () => {
    // Devolver un numero que quiza no se recibio seria inventarselo.
    const quote = calculateQuote(buildRequest(), buildContext(10));

    expect(quote.input).not.toHaveProperty('bedrooms');
    expect(quote.input).not.toHaveProperty('bathrooms');
  });

  it('si llegan de todas formas, el precio no se mueve', () => {
    /*
     * Una pestana abierta con el paquete anterior los sigue mandando. El
     * contrato los admite, y aqui se comprueba que ademas no hacen nada:
     * admitirlos y que cambiaran el precio seria peor que rechazarlos.
     */
    const sin = calculateQuote(buildRequest(), buildContext(10));
    const con = calculateQuote(buildRequest({ bedrooms: 12, bathrooms: 12 }), buildContext(10));

    expect(con.totals.totalCents).toBe(sin.totals.totalCents);
  });
});

describe('calculateQuote - servicio base', () => {
  it('la estandar es plana: 185 dolares, mire el tamano que mire', () => {
    /*
     * ES EL PRECIO QUE SE DICE POR TELEFONO SIN PREGUNTAR NADA, y por eso
     * no mira habitaciones ni pies cuadrados. Dos casas muy distintas
     * pagan lo mismo, y es deliberado.
     */
    const pequena = calculateQuote(buildRequest({ squareFeet: 600 }), buildContext(10));
    const grande = calculateQuote(buildRequest({ squareFeet: 3000 }), buildContext(10));

    expect(pequena.totals.serviceCents).toBe(18500);
    expect(grande.totals.serviceCents).toBe(18500);
    expect(pequena.totals.taxCents).toBe(0);
  });

  it('el deposito son 35 de los 185, y los otros 150 se cobran al terminar', () => {
    /*
     * EL EJEMPLO DEL NEGOCIO, TAL CUAL. A la empresa le llegan 185: 35
     * retenidos al reservar y 150 al terminar. El deposito no es un cargo
     * extra, y esta prueba existe para que nadie lo convierta en uno.
     */
    const quote = calculateQuote(buildRequest(), buildContext(10));

    expect(quote.totals.totalCents).toBe(18500);
    expect(quote.deposit.amountCents).toBe(3500);
    expect(quote.balanceDueAtServiceCents).toBe(15000);
  });

  it('la profunda cobra el mayor entre el plano y los pies cuadrados', () => {
    // 700 pies * 30 centavos = 21 000 < 25 000 -> manda el plano.
    const pequena = calculateQuote(
      buildRequest({ service: 'DEEP', squareFeet: 700 }),
      buildContext(5),
    );
    expect(pequena.totals.serviceCents).toBe(25000);

    // 2 000 pies * 30 = 60 000 > 25 000 -> manda el tamano.
    const grande = calculateQuote(
      buildRequest({ service: 'DEEP', squareFeet: 2000 }),
      buildContext(5),
    );
    expect(grande.totals.serviceCents).toBe(60000);
  });

  it('NO HAY ESCALON al pasar del importe plano al precio por pie', () => {
    /*
     * ES EL MOTIVO DE USAR EL MAYOR Y NO UN UMBRAL. Con «hasta 809 pies lo
     * plano, por encima por pie» aparecia un salto hacia abajo: a 810 pies
     * saldrian 243 $ y a 809, 250 $. La casa mas grande, mas barata, y
     * nadie sabria explicarlo por telefono.
     */
    let anterior = 0;
    for (const pies of [600, 800, 809, 810, 833, 834, 900, 1500]) {
      const actual = calculateQuote(
        buildRequest({ service: 'DEEP', squareFeet: pies }),
        buildContext(5),
      ).totals.serviceCents;

      expect(actual).toBeGreaterThanOrEqual(anterior);
      anterior = actual;
    }
  });

  it('la suma de las lineas siempre cuadra con el total', () => {
    const quote = calculateQuote(
      buildRequest({
        service: 'DEEP',
        frequency: 'BIWEEKLY',
        addOns: [
          { code: 'INSIDE_OVEN', quantity: 1 },
          { code: 'INTERIOR_WINDOWS', quantity: 8 },
        ],
      }),
      buildContext(42),
    );

    const sum = quote.lines.reduce((acc, line) => acc + line.amountCents, 0);
    expect(sum).toBe(quote.totals.totalCents);
    expect(Number.isInteger(quote.totals.totalCents)).toBe(true);
  });
});

describe('calculateQuote - extras', () => {
  it('cobra los extras planos una sola vez aunque se pida mas cantidad', () => {
    const quote = calculateQuote(
      buildRequest({ addOns: [{ code: 'INSIDE_FRIDGE', quantity: 5 }] }),
      buildContext(10),
    );

    const line = quote.lines.find((item) => item.code === 'ADDON_INSIDE_FRIDGE');
    expect(line?.quantity).toBe(1);
    expect(quote.totals.addOnsCents).toBe(5000);
  });

  it('limita los extras por unidad a su cantidad maxima', () => {
    const quote = calculateQuote(
      buildRequest({ addOns: [{ code: 'INTERIOR_WINDOWS', quantity: 999 }] }),
      buildContext(10),
    );

    const line = quote.lines.find((item) => item.code === 'ADDON_INTERIOR_WINDOWS');
    expect(line?.quantity).toBe(defaultPricingConfig.addOns.INTERIOR_WINDOWS.maxQuantity);
    expect(line?.amountCents).toBe(40 * 600);
  });
});

describe('calculateQuote - tarifa por cadencia', () => {
  /*
   * LA RECURRENCIA YA NO ES UN DESCUENTO, es su propia tarifa. Se anuncia
   * «120 a la semana», no «185 menos un 35%»: un porcentaje obliga a hacer
   * la cuenta para saber lo que se paga, y el redondeo lo dejaba en cifras
   * raras.
   */
  it('cada cadencia tiene su precio, y no hay linea de descuento', () => {
    const precios = {
      ONE_TIME: 18500,
      MONTHLY: 15000,
      BIWEEKLY: 13500,
      WEEKLY: 12000,
    } as const;

    for (const [cadencia, esperado] of Object.entries(precios)) {
      const quote = calculateQuote(
        buildRequest({ frequency: cadencia as keyof typeof precios }),
        buildContext(10),
      );

      expect(quote.totals.serviceCents).toBe(esperado);
      expect(quote.totals.discountCents).toBe(0);
      expect(quote.lines.some((line) => line.kind === 'DISCOUNT')).toBe(false);
    }
  });

  it('a mas compromiso, nunca mas caro', () => {
    const orden = ['ONE_TIME', 'MONTHLY', 'BIWEEKLY', 'WEEKLY'] as const;
    let tope = Number.POSITIVE_INFINITY;

    for (const cadencia of orden) {
      const actual = calculateQuote(buildRequest({ frequency: cadencia }), buildContext(10)).totals
        .serviceCents;
      expect(actual).toBeLessThanOrEqual(tope);
      tope = actual;
    }
  });

  it('una profunda semanal no se ofrece, y lo dice con su propio motivo', () => {
    /*
     * La casa ya esta profunda: no se contrata cada semana. Es distinto de
     * «este servicio no tiene precio automatico», y la diferencia le
     * importa a quien lo lee: aqui la salida es elegir otra frecuencia, no
     * esperar una llamada.
     */
    const quote = calculateQuote(
      buildRequest({ service: 'DEEP', frequency: 'WEEKLY' }),
      buildContext(10),
    );

    expect(quote.manualReview.required).toBe(true);
    expect(quote.manualReview.reasonKeys).toContain('quote.review.frequencyUnavailable');
    expect(quote.manualReview.reasonKeys).not.toContain('quote.review.commercialWalkthrough');
    expect(quote.totals.totalCents).toBe(0);
  });
});

describe('calculateQuote - traslado y deposito', () => {
  it('dentro de las 35 millas no se cobra traslado', () => {
    const quote = calculateQuote(buildRequest(), buildContext(12));

    expect(quote.distance.zone).toBe('A');
    expect(quote.totals.surchargesCents).toBe(0);
    expect(quote.travel.billableMiles).toBe(0);
    expect(quote.deposit.amountCents).toBe(3500);
  });

  it('mas alla del radio se cobran las millas que sobran, ida y vuelta', () => {
    const quote = calculateQuote(buildRequest(), buildContext(45));

    // 10 millas de exceso, ida y vuelta, a la tarifa del IRS de 2026.
    expect(quote.distance.zone).toBe('B');
    expect(quote.travel.billableMiles).toBe(20);
    expect(quote.travel.centsPerMile).toBe(76);
    expect(quote.totals.surchargesCents).toBe(1520);
    expect(quote.totals.totalCents).toBe(18500 + 1520);
  });

  it('el deposito son 35 dolares, este donde este la casa', () => {
    /*
     * Antes crecia con la distancia y dos clientes del mismo barrio veian
     * retenciones distintas. Lo que crece ahora es el traslado, que va en
     * el precio y se ve sumado.
     */
    for (const millas of [5, 30, 45, 58]) {
      expect(calculateQuote(buildRequest(), buildContext(millas)).deposit.amountCents).toBe(3500);
    }
  });

  it('el deposito nunca supera el total del trabajo', () => {
    const config = {
      ...defaultPricingConfig,
      services: {
        ...defaultPricingConfig.services,
        STANDARD: {
          instantQuote: true,
          byFrequency: {
            ...defaultPricingConfig.services.STANDARD.byFrequency,
            ONE_TIME: { flatCents: 2000, centsPerSquareFoot: null },
          },
        },
      },
    };

    const quote = calculateQuote(buildRequest(), buildContext(5, { config }));

    expect(quote.totals.totalCents).toBe(2000);
    expect(quote.deposit.amountCents).toBe(2000);
    expect(quote.deposit.capped).toBe(true);
    expect(quote.balanceDueAtServiceCents).toBe(0);
  });

  it('el saldo pendiente es siempre total menos deposito', () => {
    const quote = calculateQuote(buildRequest(), buildContext(45));
    expect(quote.balanceDueAtServiceCents).toBe(
      quote.totals.totalCents - quote.deposit.amountCents,
    );
  });
});

describe('calculateQuote - revision manual', () => {
  /*
   * ATENDIDA PERO SIN PRECIO AUTOMATICO. Es la diferencia que permite cubrir
   * todo Georgia: a 80 millas se va, pero el precio se da en persona porque
   * a esa distancia el traslado pesa mas que la limpieza.
   *
   * Lo que NO puede pasar es que se le diga a esa persona que esta fuera del
   * area: «no vamos» y «vamos, te llamamos con el precio» son dos respuestas
   * opuestas, y confundirlas pierde un cliente que si se podia atender.
   */
  it('a media distancia se atiende, pero sin precio automatico', () => {
    const quote = calculateQuote(buildRequest(), buildContext(80));

    expect(quote.distance.zone).toBe('C');
    expect(quote.manualReview.required).toBe(true);
    expect(quote.manualReview.reasonKeys).toContain('quote.review.farZone');
    expect(quote.manualReview.reasonKeys).not.toContain('quote.review.outOfServiceArea');
    // Sin precio no hay nada que cobrar ni que retener.
    expect(quote.totals.totalCents).toBe(0);
    expect(quote.deposit.amountCents).toBe(0);
    expect(quote.lines).toHaveLength(0);
  });

  it('mas alla del estado entero si queda fuera de area', () => {
    const quote = calculateQuote(buildRequest(), buildContext(400));

    expect(quote.distance.zone).toBe('OUT_OF_RANGE');
    expect(quote.manualReview.reasonKeys).toContain('quote.review.outOfServiceArea');
    expect(quote.manualReview.reasonKeys).not.toContain('quote.review.farZone');
    expect(quote.totals.totalCents).toBe(0);
    expect(quote.lines).toHaveLength(0);
  });

  /*
   * TRES BANDAS, no cinco anillos: dentro del radio libre, con traslado, y
   * el resto del estado sin precio automatico.
   */
  it('las tres bandas caen donde deben', () => {
    expect(calculateQuote(buildRequest(), buildContext(10)).distance.zone).toBe('A');
    expect(calculateQuote(buildRequest(), buildContext(35)).distance.zone).toBe('A');
    expect(calculateQuote(buildRequest(), buildContext(36)).distance.zone).toBe('B');
    expect(calculateQuote(buildRequest(), buildContext(60)).distance.zone).toBe('B');
    expect(calculateQuote(buildRequest(), buildContext(61)).distance.zone).toBe('C');

    const conTraslado = calculateQuote(buildRequest(), buildContext(55));
    expect(conTraslado.totals.surchargesCents).toBeGreaterThan(0);
    expect(conTraslado.manualReview.reasonKeys).not.toContain('quote.review.farZone');
  });

  it('el servicio comercial no recibe precio instantaneo', () => {
    const quote = calculateQuote(buildRequest({ service: 'COMMERCIAL' }), buildContext(10));

    expect(quote.manualReview.required).toBe(true);
    expect(quote.manualReview.reasonKeys).toContain('quote.review.commercialWalkthrough');
    expect(quote.totals.totalCents).toBe(0);
  });

  it('marca propiedades muy grandes para revision, pero igual las cotiza', () => {
    const quote = calculateQuote(buildRequest({ squareFeet: 9000 }), buildContext(10));

    expect(quote.manualReview.required).toBe(true);
    expect(quote.manualReview.reasonKeys).toContain('quote.review.largeProperty');
    expect(quote.totals.totalCents).toBeGreaterThan(0);
  });

  it('marca destinos fuera de Georgia', () => {
    const quote = calculateQuote(
      buildRequest({ destination: { postalCode: '35203', state: 'AL' } }),
      buildContext(10),
    );

    expect(quote.manualReview.reasonKeys).toContain('quote.review.outOfState');
  });
});

describe('calculateQuote - metadatos', () => {
  it('es exento de impuesto en Georgia', () => {
    const quote = calculateQuote(buildRequest(), buildContext(10));

    expect(quote.tax.exempt).toBe(true);
    expect(quote.tax.ratePercent).toBe(0);
    expect(quote.totals.taxCents).toBe(0);
    expect(quote.disclaimerKeys).toContain('quote.disclaimer.taxExempt');
  });

  it('caduca a los 7 dias', () => {
    const quote = calculateQuote(buildRequest(), buildContext(10));
    expect(quote.expiresAt).toBe('2026-09-27T12:00:00.000Z');
  });

  it('es determinista: las mismas entradas producen el mismo presupuesto', () => {
    const request = buildRequest({ frequency: 'MONTHLY' });
    const first = calculateQuote(request, buildContext(30));
    const second = calculateQuote(request, buildContext(30));
    expect(first).toEqual(second);
  });
});
