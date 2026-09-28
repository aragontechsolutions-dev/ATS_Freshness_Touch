import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminCompanyLocation, AdminServiceArea, CompanyLocation } from '@freshness/types';
import '../i18n';

/**
 * LA PANTALLA DE LA UBICACION
 * ---------------------------
 * Este punto es el origen desde el que se mide cada distancia, cada milla de
 * traslado y cada zona. Equivocarse aqui NO ROMPE NADA: el sistema sigue
 * cotizando y facturando, desde el sitio equivocado.
 *
 * Lo que se comprueba es lo que no se ve leyendo el componente:
 *
 *   1. QUE UN PUNTO FUERA DE GEORGIA NO LLEGUE A LA API, y que el aviso diga
 *      POR QUE. El servidor lo rechazaria igual, pero con un texto tecnico
 *      en ingles y despues de una ida y vuelta.
 *   2. QUE UN CAMPO A MEDIAS NO SE GUARDE COMO CERO. Latitud cero y longitud
 *      cero es un punto real en el Atlantico.
 *   3. QUE EL MAPA NO SE COMA EL FALLO DE LA OTRA PETICION. El radio del
 *      circulo se pide aparte, y si eso falla la pantalla tiene que seguir
 *      sirviendo.
 */

const fetchCompanyLocation = vi.fn<() => Promise<AdminCompanyLocation>>();
const saveCompanyLocation = vi.fn<(s: CompanyLocation) => Promise<AdminCompanyLocation>>();
const fetchServiceArea = vi.fn<() => Promise<AdminServiceArea>>();

vi.mock('../lib/api', () => ({
  fetchCompanyLocation: () => fetchCompanyLocation(),
  saveCompanyLocation: (s: CompanyLocation) => saveCompanyLocation(s),
  fetchServiceArea: () => fetchServiceArea(),
  ApiClientError: class ApiClientError extends Error {},
}));

vi.mock('./ToastProvider', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

/*
 * Las pruebas corren con los textos en INGLES: es el idioma por defecto de
 * i18n, porque `es.ts` se declara como `typeof en`.
 *
 * El mapa se dobla porque carga Leaflet, que necesita un navegador de
 * verdad.
 */
vi.mock('./LocationPickerMap', () => ({
  default: () => null,
  LocationPickerMap: () => null,
}));

const { CompanyLocationForm } = await import('./CompanyLocationForm');

const ATLANTA: CompanyLocation = {
  latitude: 33.749,
  longitude: -84.388,
  city: 'Atlanta',
  state: 'GA',
  postalCode: '30303',
};

const RESPUESTA: AdminCompanyLocation = {
  settings: ATLANTA,
  updatedAt: '2026-09-28T12:00:00.000Z',
  updatedBy: 'Ada Jefa',
};

const AREA: AdminServiceArea = {
  settings: {
    zones: [
      { code: 'A', maxMiles: 35, instantQuote: true },
      { code: 'C', maxMiles: 325, instantQuote: false },
    ],
  },
  updatedAt: null,
  updatedBy: null,
};

let contenedor: HTMLDivElement;
let root: Root;

async function montar(): Promise<void> {
  await act(async () => {
    root.render(<CompanyLocationForm locale="es" onSessionLost={() => {}} />);
  });
}

function campo(etiqueta: string): HTMLInputElement {
  const label = [...contenedor.querySelectorAll('label')].find((l) =>
    l.textContent?.startsWith(etiqueta),
  );
  const input = label?.querySelector('input');
  if (!input) throw new Error(`No encontre el campo "${etiqueta}"`);
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
  fetchCompanyLocation.mockResolvedValue(RESPUESTA);
  saveCompanyLocation.mockResolvedValue(RESPUESTA);
  fetchServiceArea.mockResolvedValue(AREA);
  contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
});

describe('la pantalla de la ubicacion', () => {
  it('pinta la ubicacion guardada', async () => {
    await montar();

    expect(campo('Latitude').value).toBe('33.749');
    expect(campo('Longitude').value).toBe('-84.388');
    expect(campo('City').value).toBe('Atlanta');
  });

  it('un punto fuera de Georgia no llega a la API, y dice por que', async () => {
    /*
     * Chattanooga esta a 110 millas de Atlanta y es Tennessee. El servidor
     * lo rechazaria igual, pero despues de una ida y vuelta y con un texto
     * que no explica nada.
     */
    await montar();
    escribir(campo('Latitude'), '35.0456');
    escribir(campo('Longitude'), '-85.3097');
    await guardar();

    expect(saveCompanyLocation).not.toHaveBeenCalled();
    expect(aviso()).toContain('outside Georgia');
  });

  it('el signo cambiado en la longitud tampoco pasa', async () => {
    // Con +84 en vez de -84 la sede acaba en Asia.
    await montar();
    escribir(campo('Longitude'), '84.388');
    await guardar();

    expect(saveCompanyLocation).not.toHaveBeenCalled();
    expect(aviso()).toContain('outside Georgia');
  });

  it('un campo vacio NO se guarda como cero', async () => {
    /*
     * Latitud cero y longitud cero es un punto real: el Atlantico, frente a
     * Africa. Si el vacio se leyera como cero, borrar un campo y guardar
     * mandaria la empresa al oceano sin que nadie escribiera un cero.
     */
    await montar();
    escribir(campo('Latitude'), '');
    await guardar();

    expect(saveCompanyLocation).not.toHaveBeenCalled();
    expect(aviso()).toContain('not a number');
  });

  it('un punto valido dentro de Georgia si se guarda', async () => {
    await montar();
    escribir(campo('Latitude'), '32.0809');
    escribir(campo('Longitude'), '-81.0912');
    escribir(campo('City'), 'Savannah');
    escribir(campo('ZIP code'), '31401');
    await guardar();

    expect(saveCompanyLocation).toHaveBeenCalledTimes(1);
    expect(saveCompanyLocation.mock.calls[0]?.[0]).toEqual({
      latitude: 32.0809,
      longitude: -81.0912,
      city: 'Savannah',
      state: 'GA',
      postalCode: '31401',
    });
  });

  it('si falla la peticion del radio, la pantalla sigue sirviendo', async () => {
    /*
     * El radio solo dibuja un circulo. Si tumbara la pantalla, un detalle
     * decorativo impediria mover la sede.
     */
    fetchServiceArea.mockRejectedValue(new Error('sin red'));
    await montar();

    expect(campo('Latitude').value).toBe('33.749');
    expect(contenedor.querySelector('form')).not.toBeNull();
  });

  it('avisa de que lo ya reservado no cambia', async () => {
    await montar();

    expect(contenedor.textContent).toContain('Anything already booked does not change');
  });
});
