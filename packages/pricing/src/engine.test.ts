import { describe, expect, it } from 'vitest';
import type { QuoteRequest } from '@freshness/types';
import { calculateQuote, type QuoteContext } from './engine';
import { defaultPricingConfig } from './config';

const NOW = new Date('2026-09-20T12:00:00.000Z');
const QUOTE_ID = '11111111-2222-4333-8444-555555555555';

function buildRequest(overrides: Partial<QuoteRequest> = {}): QuoteRequest {
  return {
    service: 'STANDARD',
    /*
     * MENSUAL Y NO PUNTUAL: desde la etapa 3.4 la estandar no se ofrece de
     * una sola vez —la tabla del cliente solo le pone precio recurrente— y
     * quien quiere una limpieza suelta contrata la profunda.
     */
    frequency: 'MONTHLY',
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

    expect(linea?.labelParams).toEqual({ squareFeet: 1800, frequency: 'MONTHLY' });
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
  it('el precio sale de la tabla y crece con la casa', () => {
    /*
     * ES EL CAMBIO DE LA ETAPA 3.4. Antes la estandar era plana —185 $
     * mirara el tamano que mirara— y ahora cada tramo tiene su precio.
     */
    const pequena = calculateQuote(buildRequest({ squareFeet: 600 }), buildContext(10));
    const grande = calculateQuote(buildRequest({ squareFeet: 3000 }), buildContext(10));

    // 600 pies caen en el primer tramo, el de 900: 160 $ mensuales.
    expect(pequena.totals.serviceCents).toBe(16_000);
    // 3.000 caen en el tramo de 3.100: 200 $.
    expect(grande.totals.serviceCents).toBe(20_000);
    expect(pequena.totals.taxCents).toBe(0);
  });

  it('una casa en un hueco de la tabla SUBE al siguiente tramo', () => {
    /*
     * LA REGLA QUE RELLENA LOS HUECOS DE LA HOJA DEL CLIENTE. Entre 900 y
     * 1.200 no hay nada escrito, y una casa de 1.000 pies tiene que pagar
     * algo: paga la fila de 1.200. Subir nunca cobra de menos, que es el
     * lado correcto del error cuando hay que elegir uno.
     */
    const enElHueco = calculateQuote(buildRequest({ squareFeet: 1000 }), buildContext(10));
    const enElTope = calculateQuote(buildRequest({ squareFeet: 1200 }), buildContext(10));

    expect(enElHueco.totals.serviceCents).toBe(enElTope.totals.serviceCents);
    expect(enElHueco.totals.serviceCents).toBe(15_000);
  });

  it('justo en el tope paga ese tramo, y un pie mas paga el siguiente', () => {
    // El borde es lo unico que puede quedar mal en una tabla de tramos.
    const enElTope = calculateQuote(buildRequest({ squareFeet: 1200 }), buildContext(10));
    const unPieMas = calculateQuote(buildRequest({ squareFeet: 1201 }), buildContext(10));

    expect(enElTope.totals.serviceCents).toBe(15_000);
    expect(unPieMas.totals.serviceCents).toBe(16_000);
  });

  it('el deposito son 35 del total, y el resto se cobra al terminar', () => {
    /*
     * El deposito NO es un cargo extra, y esta prueba existe para que nadie
     * lo convierta en uno. La casa de 1.800 pies paga 180 $ mensuales: 35
     * retenidos al reservar y 145 al terminar.
     */
    const quote = calculateQuote(buildRequest(), buildContext(10));

    expect(quote.totals.totalCents).toBe(18_000);
    expect(quote.deposit.amountCents).toBe(3500);
    expect(quote.balanceDueAtServiceCents).toBe(14_500);
  });

  it('la profunda y las dos de mudanza cobran lo mismo', () => {
    // Es el mismo trabajo con distinto nombre segun por que se pida, y en
    // la hoja del cliente comparten una sola columna.
    const profunda = calculateQuote(
      buildRequest({ service: 'DEEP', frequency: 'ONE_TIME', squareFeet: 2000 }),
      buildContext(5),
    );
    const mudanza = calculateQuote(
      buildRequest({ service: 'MOVE_IN_OUT', frequency: 'ONE_TIME', squareFeet: 2000 }),
      buildContext(5),
    );

    expect(profunda.totals.serviceCents).toBe(32_000);
    expect(mudanza.totals.serviceCents).toBe(32_000);
  });

  it('por encima del ultimo tramo NO se inventa un precio', () => {
    /*
     * La tabla acaba en 6.900 pies. Nada dice que la progresion continue, y
     * a ese tamano un precio extrapolado se equivoca por cientos de
     * dolares. Se recoge la solicitud y se va a ver la casa.
     */
    const enorme = calculateQuote(
      buildRequest({ service: 'DEEP', frequency: 'ONE_TIME', squareFeet: 9000 }),
      buildContext(5),
    );

    expect(enorme.manualReview.required).toBe(true);
    expect(enorme.totals.serviceCents).toBe(0);
    expect(enorme.manualReview.reasonKeys).toContain('quote.review.beyondSizeTable');
  });

  it('justo en el ultimo tramo SI hay precio', () => {
    const limite = calculateQuote(
      buildRequest({ service: 'DEEP', frequency: 'ONE_TIME', squareFeet: 6900 }),
      buildContext(5),
    );

    /*
     * SI pide revision, pero por SER GRANDE —umbral de 6.000 pies—, no por
     * salirse de la tabla. La diferencia importa: una pide una mirada, la
     * otra significa que no hay precio.
     */
    expect(limite.totals.serviceCents).toBe(60_000);
    expect(limite.manualReview.reasonKeys).not.toContain('quote.review.beyondSizeTable');
    expect(limite.manualReview.reasonKeys).toContain('quote.review.largeProperty');
  });

  it('la estandar NO se ofrece de una sola vez', () => {
    /*
     * La tabla del cliente solo le pone precio recurrente. No es «cara de
     * una vez», es que no se vende asi: quien quiere una limpieza suelta
     * contrata la profunda, que es practica habitual del sector.
     */
    const puntual = calculateQuote(
      buildRequest({ service: 'STANDARD', frequency: 'ONE_TIME' }),
      buildContext(10),
    );

    expect(puntual.manualReview.required).toBe(true);
    expect(puntual.manualReview.reasonKeys).toContain('quote.review.frequencyUnavailable');
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

  it('un extra retirado del catalogo NO se cobra, aunque lo pida la peticion', () => {
    /*
     * `INTERIOR_WINDOWS` se apago en la etapa 3.4 —ahora va junto con los
     * gabinetes en un solo extra—. Su codigo sigue existiendo para releer
     * presupuestos antiguos, y sin esta guardia alguien podria pedir por la
     * API algo que el sitio ya no ofrece.
     */
    const quote = calculateQuote(
      buildRequest({ addOns: [{ code: 'INTERIOR_WINDOWS', quantity: 10 }] }),
      buildContext(10),
    );

    expect(quote.lines.find((item) => item.code === 'ADDON_INTERIOR_WINDOWS')).toBeUndefined();
    expect(quote.totals.addOnsCents).toBe(0);
  });

  it('ventanas y gabinetes cuesta segun el tamano de la casa', () => {
    /*
     * ES EL UNICO EXTRA QUE MIRA EL TAMANO. En la hoja del cliente va de 30
     * a 85 dolares, porque una casa grande tiene mas ventanas. El horno y
     * la nevera son planos: limpiar un horno cuesta lo mismo en cualquier
     * sitio.
     */
    const pequena = calculateQuote(
      buildRequest({ squareFeet: 900, addOns: [{ code: 'WINDOWS_AND_CABINETS', quantity: 1 }] }),
      buildContext(10),
    );
    const grande = calculateQuote(
      buildRequest({ squareFeet: 6900, addOns: [{ code: 'WINDOWS_AND_CABINETS', quantity: 1 }] }),
      buildContext(10),
    );

    expect(pequena.totals.addOnsCents).toBe(3000);
    expect(grande.totals.addOnsCents).toBe(8500);
  });

  it('el horno cuesta lo mismo en cualquier casa', () => {
    const pequena = calculateQuote(
      buildRequest({ squareFeet: 900, addOns: [{ code: 'INSIDE_OVEN', quantity: 1 }] }),
      buildContext(10),
    );
    const grande = calculateQuote(
      buildRequest({ squareFeet: 6900, addOns: [{ code: 'INSIDE_OVEN', quantity: 1 }] }),
      buildContext(10),
    );

    expect(pequena.totals.addOnsCents).toBe(5000);
    expect(grande.totals.addOnsCents).toBe(5000);
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
    // La casa de 1.800 pies, en la fila de 1.800 de la hoja del cliente.
    const precios = { MONTHLY: 18_000, BIWEEKLY: 16_000, WEEKLY: 14_000 } as const;

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

  it('a mas compromiso, nunca mas caro, EN TODOS LOS TRAMOS', () => {
    /*
     * La promesa comercial de la empresa, comprobada en la tabla entera y no
     * en una casa de ejemplo: un solo tramo con la semanal mas cara que la
     * mensual perderia dinero en cada reserva recurrente de ese tamano, y no
     * lo delataria ninguna pantalla.
     */
    for (const banda of defaultPricingConfig.sizeBands) {
      const pies = banda.maxSquareFeet;
      const precioDe = (frequency: 'MONTHLY' | 'BIWEEKLY' | 'WEEKLY'): number =>
        calculateQuote(buildRequest({ frequency, squareFeet: pies }), buildContext(10)).totals
          .serviceCents;

      expect(precioDe('WEEKLY'), `tramo ${pies}`).toBeLessThanOrEqual(precioDe('BIWEEKLY'));
      expect(precioDe('BIWEEKLY'), `tramo ${pies}`).toBeLessThanOrEqual(precioDe('MONTHLY'));
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
    // 180 $ la mensual de 1.800 pies, mas el traslado.
    expect(quote.totals.totalCents).toBe(18_000 + 1520);
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
    /*
     * Una tabla con un solo tramo y un precio por debajo del deposito. No
     * es un caso real de hoy, pero es el que comprueba la regla: la
     * retencion es un adelanto del total y nunca puede pasarse de el.
     */
    const config = {
      ...defaultPricingConfig,
      sizeBands: [
        {
          maxSquareFeet: 20_000,
          deepCents: 2000,
          standardMonthlyCents: 2000,
          standardBiweeklyCents: 2000,
          standardWeeklyCents: 2000,
          windowsAndCabinetsCents: 0,
        },
      ],
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

  it('una casa grande pero dentro de la tabla se cotiza, marcada para revision', () => {
    /*
     * El umbral de revision —6.000 pies— y el final de la tabla —6.900— son
     * dos cosas distintas, y en medio queda una franja donde SI hay precio y
     * ADEMAS se pide una mirada. Es el caso que confunde los dos conceptos
     * si alguien los junta.
     */
    const quote = calculateQuote(buildRequest({ squareFeet: 6500 }), buildContext(10));

    expect(quote.manualReview.required).toBe(true);
    expect(quote.manualReview.reasonKeys).toContain('quote.review.largeProperty');
    expect(quote.manualReview.reasonKeys).not.toContain('quote.review.beyondSizeTable');
    expect(quote.totals.totalCents).toBeGreaterThan(0);
  });

  it('pasado el final de la tabla NO hay cifra, solo solicitud', () => {
    const quote = calculateQuote(buildRequest({ squareFeet: 9000 }), buildContext(10));

    expect(quote.manualReview.reasonKeys).toContain('quote.review.beyondSizeTable');
    expect(quote.totals.totalCents).toBe(0);
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
