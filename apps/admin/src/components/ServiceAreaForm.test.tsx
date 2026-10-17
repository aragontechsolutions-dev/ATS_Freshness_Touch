import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ServiceAreaSettingsSchema,
  type AdminCompanyLocation,
  type AdminServiceArea,
  type ServiceAreaSettings,
} from '@freshness/types';
import '../i18n';

/**
 * LA PANTALLA DEL AREA DE SERVICIO: ANADIR Y QUITAR ZONAS
 * -------------------------------------------------------
 * Es la configuracion que mas dinero mueve, y desde la etapa 3.20 se pueden
 * crear y borrar zonas enteras. Lo que se comprueba aqui es lo que no se ve
 * leyendo el componente:
 *
 *   1. QUE NUNCA SE PUEDA CONSTRUIR UN AREA INVALIDA. Los botones que
 *      llevarian a una se apagan antes de que nadie los pulse, y lo que se
 *      manda al servidor pasa el mismo esquema que el usara.
 *   2. QUE LA ZONA NUEVA ENTRE EN MEDIO. El area tiene A y C: una banda
 *      intermedia solo puede nacer entre las dos, y un boton al pie de la
 *      lista no serviria.
 *   3. QUE UN NUMERO A MEDIO TECLEAR NO HAGA NADA RARO. Mientras el campo
 *      no es un numero no se sabe sobre que area se esta operando.
 */

const fetchServiceArea = vi.fn<() => Promise<AdminServiceArea>>();
const saveServiceArea = vi.fn<(s: ServiceAreaSettings) => Promise<AdminServiceArea>>();
const fetchCompanyLocation = vi.fn<() => Promise<AdminCompanyLocation>>();

vi.mock('../lib/api', () => ({
  fetchServiceArea: () => fetchServiceArea(),
  saveServiceArea: (s: ServiceAreaSettings) => saveServiceArea(s),
  fetchCompanyLocation: () => fetchCompanyLocation(),
  ApiClientError: class ApiClientError extends Error {},
}));

vi.mock('./ToastProvider', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

/* Leaflet necesita un navegador de verdad: el mapa se dobla. */
vi.mock('./ServiceAreaMap', () => ({ default: () => null }));

const { ServiceAreaForm } = await import('./ServiceAreaForm');

const AREA_DE_PARTIDA: AdminServiceArea = {
  settings: {
    zones: [
      { code: 'A', maxMiles: 35, instantQuote: true },
      { code: 'C', maxMiles: 325, instantQuote: false },
    ],
  },
  updatedAt: '2026-10-01T12:00:00.000Z',
  updatedBy: 'Ada Jefa',
};

const UBICACION: AdminCompanyLocation = {
  settings: {
    latitude: 33.8803,
    longitude: -84.6731,
    city: 'Powder Springs',
    state: 'GA',
    postalCode: '30127',
  },
  updatedAt: null,
  updatedBy: null,
};

let contenedor: HTMLDivElement;
let root: Root;

async function montar(): Promise<void> {
  await act(async () => {
    root.render(<ServiceAreaForm locale="es" onSessionLost={() => {}} />);
  });
}

function boton(texto: string): HTMLButtonElement {
  const encontrado = [...contenedor.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === texto,
  );
  if (!encontrado) throw new Error(`No encontre el boton "${texto}"`);
  return encontrado;
}

function millas(zona: string): HTMLInputElement {
  const input = contenedor.querySelector<HTMLInputElement>(`#zona-${zona}-millas`);
  if (!input) throw new Error(`No encontre las millas de la zona ${zona}`);
  return input;
}

function zonasEnPantalla(): string[] {
  return [...contenedor.querySelectorAll<HTMLInputElement>('input[type="number"]')].map(
    (input) => input.id,
  );
}

async function pulsar(texto: string): Promise<void> {
  await act(async () => {
    boton(texto).click();
  });
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

beforeEach(() => {
  vi.clearAllMocks();
  fetchServiceArea.mockResolvedValue(AREA_DE_PARTIDA);
  saveServiceArea.mockResolvedValue(AREA_DE_PARTIDA);
  fetchCompanyLocation.mockResolvedValue(UBICACION);
  contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  root = createRoot(contenedor);
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
});

describe('el area de servicio: anadir y quitar zonas', () => {
  it('pinta las dos zonas guardadas', async () => {
    await montar();

    expect(zonasEnPantalla()).toEqual(['zona-A-millas', 'zona-C-millas']);
    expect(millas('A').value).toBe('35');
    expect(millas('C').value).toBe('325');
  });

  it('la zona mas cercana no se puede quitar, la lejana si', async () => {
    /*
     * Quitar la A dejaria la C de primera, y la C no da precio automatico:
     * el sitio pediria los datos para no dar ninguna cifra a nadie.
     */
    await montar();

    expect(boton('Remove zone A').disabled).toBe(true);
    expect(boton('Remove zone C').disabled).toBe(false);
  });

  it('anade la banda intermedia entre las dos, a mitad de camino', async () => {
    await montar();
    await pulsar('Add a zone after A');

    expect(zonasEnPantalla()).toEqual(['zona-A-millas', 'zona-B-millas', 'zona-C-millas']);
    expect(millas('B').value).toBe('180');
  });

  it('lo que se guarda despues de anadir pasa el esquema del servidor', async () => {
    await montar();
    await pulsar('Add a zone after A');
    escribir(millas('B'), '60');
    await guardar();

    expect(saveServiceArea).toHaveBeenCalledTimes(1);
    const enviado = saveServiceArea.mock.calls[0]?.[0];
    expect(enviado).toEqual({
      zones: [
        { code: 'A', maxMiles: 35, instantQuote: true },
        { code: 'B', maxMiles: 60, instantQuote: false },
        { code: 'C', maxMiles: 325, instantQuote: false },
      ],
    });
    expect(ServiceAreaSettingsSchema.safeParse(enviado).success).toBe(true);
  });

  it('una vez puesta la B ya no cabe nada entre A y B', async () => {
    // No queda letra entre las dos: el codigo de una zona no se reaprovecha.
    await montar();
    await pulsar('Add a zone after A');

    expect(boton('Add a zone after A').disabled).toBe(true);
    expect(boton('Add a zone after B').disabled).toBe(true);
    expect(boton('Add a zone after C').disabled).toBe(false);
  });

  it('quitar la zona lejana deja solo la cercana, y se guarda asi', async () => {
    await montar();
    await pulsar('Remove zone C');

    expect(zonasEnPantalla()).toEqual(['zona-A-millas']);

    await guardar();
    expect(saveServiceArea).toHaveBeenCalledWith({
      zones: [{ code: 'A', maxMiles: 35, instantQuote: true }],
    });
  });

  it('con un campo a medio teclear no se anade ni se quita nada', async () => {
    /*
     * El campo vacio no es cero: es «todavia no hay area que mirar». Ni
     * anadir ni quitar pueden decidir nada sobre ella.
     */
    await montar();
    escribir(millas('C'), '');

    expect(boton('Add a zone after A').disabled).toBe(true);
    expect(boton('Remove zone C').disabled).toBe(true);
  });
});
