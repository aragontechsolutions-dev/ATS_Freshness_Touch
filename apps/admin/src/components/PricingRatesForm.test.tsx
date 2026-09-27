import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminPricingRates, PricingRates } from '@freshness/types';
import '../i18n';

/**
 * LA PANTALLA DE TARIFAS
 * ----------------------
 * Es la pantalla mas peligrosa del panel, y no porque pueda romper nada:
 * es peligrosa justamente porque NO rompe nada. Un precio equivocado cotiza,
 * cobra y factura con total normalidad.
 *
 * Lo que se comprueba aqui es lo que NO se ve leyendo el componente:
 *
 *   1. QUE UN CAMPO VACIO NO SE GUARDE COMO CERO. Borrar un precio y pulsar
 *      guardar es un gesto de un segundo; si el vacio se leyera como cero,
 *      ese servicio pasaria a ser gratis sin que nadie escribiera un cero.
 *
 *   2. QUE LAS REGLAS DEL CONJUNTO PAREN EL ENVIO Y SE EXPLIQUEN EN CASTELLANO.
 *      Cada numero por separado puede ser valido y el conjunto no significar
 *      nada —la semanal mas cara que la puntual—, y el aviso tiene que decir
 *      que pasa, no soltar el texto tecnico de Zod en ingles.
 *
 *   3. QUE UN NUMERO FUERA DE RANGO DIGA QUE CAMPO REVISAR. El fallo real no
 *      es un precio negativo: es un cero de mas.
 *
 *   4. QUE LO QUE VIAJA AL SERVIDOR SEAN CENTAVOS. La pantalla se escribe en
 *      dolares y el contrato es en centavos; un factor cien mal puesto aqui
 *      es una factura cien veces mayor.
 */

const fetchPricingRates = vi.fn<() => Promise<AdminPricingRates>>();
const savePricingRates = vi.fn<(rates: PricingRates) => Promise<AdminPricingRates>>();

vi.mock('../lib/api', () => ({
  fetchPricingRates: () => fetchPricingRates(),
  savePricingRates: (rates: PricingRates) => savePricingRates(rates),
  ApiClientError: class ApiClientError extends Error {},
}));

vi.mock('./ToastProvider', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

const { PricingRatesForm } = await import('./PricingRatesForm');

/** Las tarifas reales del negocio, que son las que alguien va a editar. */
const RATES: PricingRates = {
  services: {
    STANDARD: {
      ONE_TIME: { flatCents: 18_500, centsPerSquareFoot: null },
      MONTHLY: { flatCents: 15_000, centsPerSquareFoot: null },
      BIWEEKLY: { flatCents: 13_500, centsPerSquareFoot: null },
      WEEKLY: { flatCents: 12_000, centsPerSquareFoot: null },
    },
    DEEP: {
      ONE_TIME: { flatCents: 25_000, centsPerSquareFoot: 30 },
      MONTHLY: null,
      BIWEEKLY: null,
      WEEKLY: null,
    },
    MOVE_IN_OUT: {
      ONE_TIME: { flatCents: 25_000, centsPerSquareFoot: 30 },
      MONTHLY: null,
      BIWEEKLY: null,
      WEEKLY: null,
    },
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

const RESPUESTA: AdminPricingRates = {
  version: '2026.09.27.1',
  rates: RATES,
  updatedAt: '2026-09-27T12:00:00.000Z',
  updatedBy: 'Ada Jefa',
  versionCount: 1,
};

let contenedor: HTMLDivElement;
let root: Root;

async function montar(): Promise<void> {
  await act(async () => {
    root.render(<PricingRatesForm locale="es" onSessionLost={() => {}} />);
  });
}

/*
 * Las pruebas corren con los textos en ingles, que es el idioma por defecto
 * de i18n: `es.ts` se declara como `typeof en`, asi que el ingles es la
 * fuente de las claves.
 */
const IMPORTES_DE_SERVICIO = (): HTMLInputElement[] => {
  // La PRIMERA seccion es la de servicios. Los extras tambien tienen campos
  // llamados «Amount», y mezclarlos daria una posicion equivocada.
  const servicios = contenedor.querySelectorAll('section')[0];
  return [...(servicios?.querySelectorAll('label') ?? [])]
    .filter((label) => label.textContent?.startsWith('Amount'))
    .map((label) => label.querySelector('input') as HTMLInputElement);
};

/** El campo del importe plano de un servicio en una cadencia. */
function campoImporte(indice: number): HTMLInputElement {
  const input = IMPORTES_DE_SERVICIO()[indice];
  if (!input) throw new Error(`No hay campo de importe en la posicion ${indice}`);
  return input;
}

function escribir(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, valor);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function guardar(): Promise<void> {
  const form = contenedor.querySelector('form');
  await act(async () => {
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

const aviso = (): string => contenedor.querySelector('[role="alert"]')?.textContent ?? '';

beforeEach(() => {
  vi.clearAllMocks();
  fetchPricingRates.mockResolvedValue(RESPUESTA);
  savePricingRates.mockResolvedValue(RESPUESTA);
  contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
});

describe('la pantalla de tarifas', () => {
  it('pinta los precios en dolares, no en centavos', async () => {
    await montar();

    // 18500 centavos son 185,00 dolares. Nadie fija precios en centavos.
    expect(campoImporte(0).value).toBe('185.00');
  });

  it('una cadencia que no se ofrece aparece desmarcada y sin campos', async () => {
    await montar();

    /*
     * La profunda solo es puntual. Desmarcada significa «no se ofrece asi»,
     * que no es lo mismo que ponerla cara, y la pantalla tiene que enseñar
     * la diferencia.
     */
    expect(contenedor.textContent).toContain('Not offered at this frequency');

    // Estandar: cuatro cadencias. Profunda y mudanza: una cada una.
    expect(IMPORTES_DE_SERVICIO()).toHaveLength(6);
  });

  it('un campo vacio NO se guarda como cero', async () => {
    await montar();
    escribir(campoImporte(0), '');
    await guardar();

    expect(savePricingRates).not.toHaveBeenCalled();
    expect(aviso()).toContain('one of the fields is not a number');
  });

  it('para el envio si la semanal sale mas cara que la puntual', async () => {
    await montar();
    // La puntual a 100 $ con la semanal en 120 $: cada numero vale, el
    // conjunto no. Se perderia dinero en cada reserva recurrente.
    escribir(campoImporte(0), '100.00');
    await guardar();

    expect(savePricingRates).not.toHaveBeenCalled();
    expect(aviso()).toContain('The price cannot go up as the frequency goes up');
    // Y NO el texto tecnico de Zod, que ademas va siempre en ingles.
    expect(aviso()).not.toContain('expected');
  });

  it('un cero de mas dice QUE campo revisar', async () => {
    await montar();
    escribir(campoImporte(0), '9999999.00');
    await guardar();

    expect(savePricingRates).not.toHaveBeenCalled();
    expect(aviso()).toContain('is there an extra zero?');
  });

  it('lo que viaja al servidor son centavos enteros', async () => {
    await montar();
    escribir(campoImporte(0), '199.99');
    await guardar();

    expect(savePricingRates).toHaveBeenCalledTimes(1);
    const enviado = savePricingRates.mock.calls[0]?.[0] as PricingRates;

    expect(enviado.services.STANDARD.ONE_TIME?.flatCents).toBe(19_999);
    // Y lo que no se toco viaja igual que estaba.
    expect(enviado.depositCents).toBe(3500);
    expect(enviado.travel).toEqual({ freeRadiusMiles: 35, roundTrip: true, centsPerMile: null });
  });

  it('avisa de que lo ya reservado no cambia de precio', async () => {
    await montar();

    /*
     * Es la primera pregunta que hace cualquiera antes de tocar un precio, y
     * si la pantalla no la contesta, la contesta el miedo: no se toca nada.
     */
    expect(contenedor.textContent).toContain('Anything already booked does not change');
  });
});
