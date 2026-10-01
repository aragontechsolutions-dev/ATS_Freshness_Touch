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

/**
 * Tres tramos reales de la tabla del cliente, no numeros inventados: son los
 * que alguien va a editar, y el de 900/1.200 lleva ademas la incoherencia de
 * la hoja —la casa mas grande, diez dolares mas barata al mes—, para que las
 * pruebas no den por hecho que eso no puede pasar.
 */
const RATES: PricingRates = {
  sizeBands: [
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
    {
      maxSquareFeet: 1400,
      deepCents: 29_000,
      standardMonthlyCents: 16_000,
      standardBiweeklyCents: 15_000,
      standardWeeklyCents: 14_000,
      windowsAndCabinetsCents: 3000,
    },
  ],
  addOns: {
    INSIDE_OVEN: { unitAmountCents: 5000, maxQuantity: 1 },
    INSIDE_FRIDGE: { unitAmountCents: 5000, maxQuantity: 1 },
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
const FILAS = (): HTMLTableRowElement[] => [
  ...contenedor.querySelectorAll<HTMLTableRowElement>('tbody tr'),
];

/**
 * Una celda de la tabla de tramos, por fila y por nombre de columna.
 *
 * Se busca por la etiqueta accesible y no por la posicion: una columna nueva
 * en medio dejaria las pruebas verdes apuntando a otro precio, que es
 * exactamente el fallo que esta pantalla no se puede permitir.
 */
function celda(fila: number, etiqueta: string): HTMLInputElement {
  const tr = FILAS()[fila];
  if (!tr) throw new Error(`No hay fila en la posicion ${fila}`);

  /*
   * Por el texto del `sr-only`, no por el del `label` entero: el label lleva
   * tambien el simbolo del dolar, asi que su `textContent` es «Monthly$».
   */
  const label = [...tr.querySelectorAll('label')].find(
    (candidata) => candidata.querySelector('.sr-only')?.textContent?.trim() === etiqueta,
  );
  const input = label?.querySelector('input');
  if (!input) throw new Error(`No hay celda «${etiqueta}» en la fila ${fila}`);

  return input as HTMLInputElement;
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
  it('pinta la tabla entera, una fila por tramo', async () => {
    await montar();

    expect(FILAS()).toHaveLength(3);
    expect(celda(0, 'Up to (sq ft)').value).toBe('900');
    expect(celda(2, 'Up to (sq ft)').value).toBe('1400');
  });

  it('pinta los precios en dolares, no en centavos', async () => {
    await montar();

    // 26000 centavos son 260,00 dolares. Nadie fija precios en centavos.
    expect(celda(0, 'Deep / Move').value).toBe('260.00');
    expect(celda(0, 'Monthly').value).toBe('160.00');
    expect(celda(0, 'Windows + cabinets').value).toBe('30.00');
  });

  it('acepta que un tramo mas grande sea mas barato, porque la hoja lo es', async () => {
    /*
     * La estandar mensual de 900 pies cuesta 160 $ y la de 1.200 cuesta 150.
     * Parece una errata del cliente, pero son SUS precios: una guardia que
     * lo rechazara le impediria guardar su propia tabla desde el panel.
     *
     * Esta prueba deja por escrito que esta visto y es deliberado, para que
     * nadie «arregle» la pantalla anadiendo esa validacion.
     */
    await montar();

    expect(celda(0, 'Monthly').value).toBe('160.00');
    expect(celda(1, 'Monthly').value).toBe('150.00');

    await guardar();
    expect(savePricingRates).toHaveBeenCalledTimes(1);
  });

  it('un campo vacio NO se guarda como cero', async () => {
    await montar();
    escribir(celda(0, 'Monthly'), '');
    await guardar();

    expect(savePricingRates).not.toHaveBeenCalled();
    expect(aviso()).toContain('one of the fields is not a number');
  });

  it('para el envio si la semanal sale mas cara que la mensual', async () => {
    await montar();
    /*
     * Cada numero por separado vale y el conjunto no significa nada: quien
     * se compromete a una limpieza semanal pagaria mas que quien viene una
     * vez al mes. Se perderia dinero en cada reserva recurrente, y no lo
     * delata ninguna pantalla.
     */
    escribir(celda(0, 'Weekly'), '300.00');
    await guardar();

    expect(savePricingRates).not.toHaveBeenCalled();
    expect(aviso()).toContain('cannot');
    // Y NO el texto tecnico de Zod, que ademas va siempre en ingles.
    expect(aviso()).not.toContain('expected');
  });

  it('para el envio si dos tramos tienen el mismo tope', async () => {
    /*
     * Con dos topes iguales, cual gana depende del orden de la lista: la
     * misma casa cotizaria distinto segun como estuviera guardada la tabla.
     */
    await montar();
    escribir(celda(1, 'Up to (sq ft)'), '900');
    await guardar();

    expect(savePricingRates).not.toHaveBeenCalled();
  });

  it('un cero de mas dice QUE campo revisar', async () => {
    await montar();
    escribir(celda(0, 'Deep / Move'), '9999999.00');
    await guardar();

    expect(savePricingRates).not.toHaveBeenCalled();
    expect(aviso()).toContain('is there an extra zero?');
  });

  it('lo que viaja al servidor son centavos enteros', async () => {
    await montar();
    escribir(celda(0, 'Deep / Move'), '199.99');
    await guardar();

    expect(savePricingRates).toHaveBeenCalledTimes(1);
    const enviado = savePricingRates.mock.calls[0]?.[0] as PricingRates;

    expect(enviado.sizeBands[0]?.deepCents).toBe(19_999);
    // Y lo que no se toco viaja igual que estaba.
    expect(enviado.sizeBands).toHaveLength(3);
    expect(enviado.depositCents).toBe(3500);
    expect(enviado.travel).toEqual({ freeRadiusMiles: 35, roundTrip: true, centsPerMile: null });
  });

  it('un tramo nuevo copia los precios del ultimo, no ceros', async () => {
    /*
     * Una tabla de precios crece por el final y cada tramo se parece al
     * anterior. Partir de ceros obliga a teclear seis numeros donde
     * normalmente se cambian dos, y un cero olvidado es una limpieza gratis
     * que nadie ve.
     */
    await montar();

    const boton = [...contenedor.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Add a bracket',
    );
    await act(async () => {
      boton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(FILAS()).toHaveLength(4);
    expect(celda(3, 'Deep / Move').value).toBe('290.00');
    // El tope SI cambia: dos tramos con el mismo tope no se pueden guardar.
    expect(celda(3, 'Up to (sq ft)').value).toBe('1500');
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
