import { describe, expect, it } from 'vitest';
import type { QuoteRequest } from '@freshness/types';
import { maxPricedSquareFeet } from '@freshness/types';
import { calculateQuote, type QuoteContext } from './engine';
import { defaultPricingConfig } from './config';

/**
 * LA TABLA DEL CLIENTE, FILA A FILA
 * =================================
 * Esta prueba existe porque veintiseis filas por cinco columnas son ciento
 * treinta numeros transcritos a mano de una hoja de calculo, y un digito
 * cambiado no rompe nada: cotiza, cobra y factura con total normalidad.
 *
 * LOS NUMEROS DE AQUI SE ESCRIBIERON LEYENDO LA HOJA, NO COPIANDO EL CODIGO.
 * Si se hubieran sacado de `config.ts` esto no probaria nada: comprobaria
 * que un archivo es igual a si mismo. Al venir de la fuente, un error de
 * transcripcion aparece como una diferencia entre los dos.
 *
 * Y HAY UNA COMPROBACION MAS FUERTE: la suma de toda la tabla tiene que dar
 * 47.275 dolares, que es el total que mostraba Google Sheets con las ocho
 * columnas seleccionadas. Un error compensado —dos digitos cambiados que se
 * anulan— es lo unico que pasaria las dos, y eso ya no es un descuido.
 */

/** La hoja, en dolares: tope, profunda, mensual, quincenal, semanal, ventanas. */
const HOJA: readonly (readonly [number, number, number, number, number, number])[] = [
  [900, 260, 160, 135, 120, 30],
  [1200, 270, 150, 140, 130, 30],
  [1400, 290, 160, 150, 140, 30],
  [1500, 290, 160, 150, 140, 30],
  [1600, 290, 160, 150, 140, 40],
  [1700, 300, 175, 150, 140, 40],
  [1800, 310, 180, 160, 140, 45],
  [1900, 315, 180, 165, 140, 45],
  [2000, 320, 185, 165, 150, 50],
  [2200, 320, 190, 170, 160, 50],
  [2400, 325, 190, 170, 160, 50],
  [2600, 330, 190, 175, 165, 50],
  [2900, 330, 195, 180, 170, 55],
  [3100, 335, 200, 190, 170, 60],
  [3500, 345, 220, 190, 170, 60],
  [3600, 350, 230, 200, 180, 65],
  [3800, 375, 235, 205, 180, 65],
  [4000, 380, 280, 210, 185, 70],
  [4300, 400, 280, 230, 185, 70],
  [4800, 425, 305, 235, 190, 70],
  [5100, 450, 325, 240, 200, 75],
  [5400, 500, 340, 250, 200, 75],
  [5700, 530, 350, 255, 220, 80],
  [6000, 550, 355, 260, 240, 80],
  [6600, 585, 375, 280, 260, 85],
  [6900, 600, 395, 300, 270, 85],
];

const NOW = new Date('2026-10-01T12:00:00.000Z');

function cotizar(overrides: Partial<QuoteRequest>): ReturnType<typeof calculateQuote> {
  const request: QuoteRequest = {
    service: 'STANDARD',
    frequency: 'MONTHLY',
    squareFeet: 1800,
    addOns: [],
    destination: { postalCode: '30303', state: 'GA' },
    locale: 'en',
    ...overrides,
  };

  const context: QuoteContext = {
    quoteId: '11111111-2222-4333-8444-555555555555',
    now: NOW,
    // Cerca, para que el traslado no sume y el total sea el precio limpio.
    distance: { miles: 5, durationMinutes: 9, provider: 'mock', estimated: true, cached: false },
  };

  return calculateQuote(request, context);
}

describe('la tabla de precios es la que mando el cliente', () => {
  it('tiene las 26 filas, en orden y sin repetir topes', () => {
    const topes = defaultPricingConfig.sizeBands.map((banda) => banda.maxSquareFeet);

    expect(topes).toHaveLength(26);
    expect(topes).toEqual(HOJA.map(([tope]) => tope));
    expect([...topes].sort((a, b) => a - b)).toEqual(topes);
    expect(new Set(topes).size).toBe(topes.length);
  });

  it.each(HOJA)(
    'tramo de %i pies: profunda %i, mensual %i, quincenal %i, semanal %i, ventanas %i',
    (tope, profunda, mensual, quincenal, semanal, ventanas) => {
      /*
       * Se cotiza EN EL TOPE del tramo, que es el punto donde la fila
       * manda. Un fallo de un tramo entero se ve igual, y ademas se
       * comprueba de paso que la busqueda del tramo acierta en el borde.
       */
      expect(
        cotizar({ service: 'DEEP', frequency: 'ONE_TIME', squareFeet: tope }).totals.serviceCents,
      ).toBe(profunda * 100);
      expect(cotizar({ frequency: 'MONTHLY', squareFeet: tope }).totals.serviceCents).toBe(
        mensual * 100,
      );
      expect(cotizar({ frequency: 'BIWEEKLY', squareFeet: tope }).totals.serviceCents).toBe(
        quincenal * 100,
      );
      expect(cotizar({ frequency: 'WEEKLY', squareFeet: tope }).totals.serviceCents).toBe(
        semanal * 100,
      );
      expect(
        cotizar({ squareFeet: tope, addOns: [{ code: 'WINDOWS_AND_CABINETS', quantity: 1 }] })
          .totals.addOnsCents,
      ).toBe(ventanas * 100);
    },
  );

  it('LA SUMA DE LA TABLA CUADRA CON EL TOTAL DE LA HOJA: 47.275', () => {
    /*
     * LA COMPROBACION QUE ATRAPA LO QUE LA DE ARRIBA NO.
     *
     * Google Sheets mostraba «Suma: 47,275.00» con el rango A1:H28
     * seleccionado. Ese total incluye tres cosas, y las tres se reconstruyen
     * aqui desde cero:
     *
     *   - La columna de pies cuadrados, pero SOLO donde es un numero: las
     *     filas que ponen «2.100-2.200» son texto y la hoja no las suma.
     *   - Las cinco columnas de precio de las 26 filas.
     *   - El horno y la nevera, 50 dolares en cada una de las 26 filas.
     */
    const PIES_QUE_LA_HOJA_SUMA = [900, 1200, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 3600];

    const precios = HOJA.reduce(
      (total, [, profunda, mensual, quincenal, semanal, ventanas]) =>
        total + profunda + mensual + quincenal + semanal + ventanas,
      0,
    );
    const hornoYNevera = 50 * HOJA.length * 2;
    const pies = PIES_QUE_LA_HOJA_SUMA.reduce((total, valor) => total + valor, 0);

    expect(pies + precios + hornoYNevera).toBe(47_275);
  });
});

describe('las reglas que rellenan y cierran la tabla', () => {
  it('una casa mas pequena que el primer tramo paga el primero', () => {
    // No hay nada por debajo de 900 pies, y un apartamento de 500 tiene que
    // poder reservar: paga el minimo de la tabla.
    expect(cotizar({ squareFeet: 300 }).totals.serviceCents).toBe(16_000);
  });

  it.each([
    [1000, 1200],
    [1250, 1400],
    [2050, 2200],
    [3550, 3600],
    [4500, 4800],
  ])('una casa de %i pies paga el tramo de %i', (casa, tramo) => {
    expect(cotizar({ squareFeet: casa }).totals.serviceCents).toBe(
      cotizar({ squareFeet: tramo }).totals.serviceCents,
    );
  });

  it('la tabla acaba en 6.900 pies', () => {
    expect(maxPricedSquareFeet(defaultPricingConfig.sizeBands)).toBe(6900);
  });

  it('un pie mas que el ultimo tramo y ya no hay precio', () => {
    const dentro = cotizar({ squareFeet: 6900 });
    const fuera = cotizar({ squareFeet: 6901 });

    expect(dentro.totals.serviceCents).toBeGreaterThan(0);
    expect(fuera.totals.serviceCents).toBe(0);
    expect(fuera.manualReview.reasonKeys).toContain('quote.review.beyondSizeTable');
  });
});

describe('la incoherencia de la hoja, conservada a proposito', () => {
  it('la mensual de 900 pies cuesta MAS que la de 1.200', () => {
    /*
     * 160 $ contra 150 $: la casa mas grande paga diez dolares menos al mes.
     * Es la unica columna donde el precio baja al crecer la casa, y parece
     * una errata del cliente.
     *
     * NO SE CORRIGE. Son sus precios, y arreglarlos en silencio seria cobrar
     * algo distinto de lo que dijo. Esta prueba lo deja por escrito para que
     * quien lo vea sepa que esta visto, y para que el dia que el cliente lo
     * confirme o lo cambie, sea un cambio consciente y no un «ah, pues ya
     * estaba mal».
     */
    expect(cotizar({ squareFeet: 900 }).totals.serviceCents).toBe(16_000);
    expect(cotizar({ squareFeet: 1200 }).totals.serviceCents).toBe(15_000);
  });

  it('y es la UNICA: en las demas columnas el precio nunca baja', () => {
    const COLUMNAS = [
      ['profunda', 1],
      ['quincenal', 3],
      ['semanal', 4],
      ['ventanas', 5],
    ] as const;

    for (const [nombre, indice] of COLUMNAS) {
      for (let i = 1; i < HOJA.length; i += 1) {
        const anterior = HOJA[i - 1]?.[indice] ?? 0;
        const actual = HOJA[i]?.[indice] ?? 0;
        expect(actual, `${nombre}, tramo ${HOJA[i]?.[0]}`).toBeGreaterThanOrEqual(anterior);
      }
    }
  });
});
