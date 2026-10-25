import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MediaConsent, StoredMediaConsent } from '@freshness/types';
import '../i18n';

/**
 * LA PANTALLA DE LOS PERMISOS DE IMAGEN
 * =====================================
 * Aqui no se configura nada: se archiva un papel firmado, y lo que se anote
 * decide que sale publicado y que no.
 *
 * Se comprueba lo que no se ve leyendo el componente:
 *
 *   1. QUE EL AVISO DEL MODO ESTRICTO ESTE SIEMPRE. Sin papel no se publica,
 *      y quien no lo sepa va a creer que la galeria esta rota.
 *   2. QUE NO SE PUEDA ATAR UNA PIEZA A UN PAPEL QUE NO AUTORIZA LA WEB. Es
 *      peor que no tener papel, porque parece que si lo hay.
 *   3. QUE RETIRAR PIDA CONFIRMACION, porque despublica al momento.
 *   4. QUE UN PERMISO RETIRADO SIGA EN LA LISTA. Es lo que hay que poder
 *      ensenar.
 */

const fetchMediaConsents = vi.fn<() => Promise<StoredMediaConsent[]>>();
const createMediaConsent = vi.fn<(c: MediaConsent) => Promise<StoredMediaConsent>>();
const updateMediaConsent = vi.fn<(id: string, c: MediaConsent) => Promise<StoredMediaConsent>>();
const setMediaConsentRevoked = vi.fn<(id: string, r: boolean) => Promise<StoredMediaConsent>>();

vi.mock('../lib/api', () => ({
  fetchMediaConsents: () => fetchMediaConsents(),
  createMediaConsent: (c: MediaConsent) => createMediaConsent(c),
  updateMediaConsent: (id: string, c: MediaConsent) => updateMediaConsent(id, c),
  setMediaConsentRevoked: (id: string, r: boolean) => setMediaConsentRevoked(id, r),
  ApiClientError: class ApiClientError extends Error {
    constructor(readonly statusCode: number) {
      super('fallo');
    }
  },
}));

vi.mock('./ToastProvider', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

/* Las pruebas corren con los textos en INGLES: es el idioma por defecto. */
const { MediaConsentsForm } = await import('./MediaConsentsForm');

const FOTO = 'photos/0123456789abcdef0123456789abcdef.jpg';

const PAPEL: MediaConsent = {
  reference: 'FT-2026-001',
  customerName: 'Marta Jimenez',
  propertyAddress: '742 Evergreen Terrace',
  serviceDate: '2026-10-20',
  signedAt: '2026-10-18',
  coversInterior: true,
  coversExterior: false,
  allowsBefore: true,
  channels: ['WEBSITE'],
  removalDays: 5,
  videoIds: [],
  photoPaths: [FOTO],
  notes: null,
};

function ficha(extra: Partial<StoredMediaConsent> = {}): StoredMediaConsent {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    consent: PAPEL,
    revokedAt: null,
    createdAt: '2026-10-20T12:00:00.000Z',
    updatedAt: '2026-10-20T12:00:00.000Z',
    updatedBy: 'Ada Jefa',
    ...extra,
  };
}

let contenedor: HTMLDivElement;
let root: Root;

async function montar(): Promise<void> {
  await act(async () => {
    root.render(<MediaConsentsForm locale="es" onSessionLost={() => {}} />);
  });
}

async function pulsar(texto: string): Promise<void> {
  const boton = [...contenedor.querySelectorAll('button')].find((b) =>
    b.textContent?.includes(texto),
  );
  if (!boton) throw new Error(`No encontre el boton «${texto}»`);
  await act(async () => {
    boton.click();
  });
}

/** Escribe en el campo cuya etiqueta contenga ese texto. */
function escribir(etiqueta: string, valor: string): void {
  const label = [...contenedor.querySelectorAll('label')].find((l) =>
    l.textContent?.includes(etiqueta),
  );
  const campo = label?.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
  if (!campo) throw new Error(`No encontre el campo «${etiqueta}»`);

  const prototipo =
    campo instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototipo, 'value')?.set?.call(campo, valor);
  campo.dispatchEvent(new Event('input', { bubbles: true }));
}

function marcar(etiqueta: string, marcada: boolean): void {
  const label = [...contenedor.querySelectorAll('label')].find(
    (l) => l.textContent?.trim() === etiqueta,
  );
  const casilla = label?.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (!casilla) throw new Error(`No encontre la casilla «${etiqueta}»`);
  if (casilla.checked !== marcada) casilla.click();
}

async function guardar(): Promise<void> {
  const form = contenedor.querySelector('form');
  await act(async () => {
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchMediaConsents.mockResolvedValue([]);
  createMediaConsent.mockResolvedValue(ficha());
  updateMediaConsent.mockResolvedValue(ficha());
  setMediaConsentRevoked.mockResolvedValue(ficha({ revokedAt: '2026-10-25T10:00:00.000Z' }));

  contenedor = document.createElement('div');
  document.body.append(contenedor);
  root = createRoot(contenedor);
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
  vi.unstubAllGlobals();
});

/* ======================================================================== */

describe('lo que se ve al abrir', () => {
  it('el aviso del modo estricto esta siempre', async () => {
    // Sin papel no se publica. Quien no lo sepa va a creer que la galeria
    // esta rota cuando suba una foto y no aparezca.
    await montar();

    expect(contenedor.textContent).toContain('Nothing is published without a release');
  });

  it('sin permisos anotados lo dice, y dice la consecuencia', async () => {
    await montar();

    expect(contenedor.textContent).toContain('nothing from the gallery appears');
  });
});

describe('anotar un permiso', () => {
  async function abrirFormulario(): Promise<void> {
    await montar();
    await pulsar('Record a release');
  }

  it('lo que se teclea llega al contrato', async () => {
    await abrirFormulario();

    escribir('Reference', 'FT-2026-007');
    escribir('Customer', 'Marta Jimenez');
    escribir('Property', '742 Evergreen Terrace');
    escribir('Service date', '2026-10-20');
    escribir('Signed on', '2026-10-18');
    escribir('Photos it covers', FOTO);
    await guardar();

    expect(createMediaConsent).toHaveBeenCalledTimes(1);
    const enviado = createMediaConsent.mock.calls[0]?.[0];
    expect(enviado?.reference).toBe('FT-2026-007');
    expect(enviado?.photoPaths).toEqual([FOTO]);
  });

  it('las piezas se teclean una por linea', async () => {
    await abrirFormulario();

    escribir('Reference', 'FT-2026-007');
    escribir('Customer', 'Marta');
    escribir('Property', 'Una calle');
    escribir('Service date', '2026-10-20');
    escribir('Signed on', '2026-10-18');
    escribir('Videos it covers', 'dQw4w9WgXcQ\naBcDeFgHiJk\n\n');
    await guardar();

    expect(createMediaConsent.mock.calls[0]?.[0].videoIds).toEqual(['dQw4w9WgXcQ', 'aBcDeFgHiJk']);
  });

  /*
   * ATAR UNA PIEZA A UN PAPEL QUE NO AUTORIZA LA WEB es peor que no tener
   * papel, porque parece que si lo hay. Se para aqui, antes de salir.
   */
  it('una pieza atada a un papel que no autoriza la web no sale hacia la API', async () => {
    await abrirFormulario();

    escribir('Reference', 'FT-2026-007');
    escribir('Customer', 'Marta');
    escribir('Property', 'Una calle');
    escribir('Service date', '2026-10-20');
    escribir('Signed on', '2026-10-18');
    escribir('Photos it covers', FOTO);
    marcar('Website', false);
    marcar('Instagram', true);
    await guardar();

    expect(createMediaConsent).not.toHaveBeenCalled();
    /*
     * El mensaje sale del contrato, no del diccionario del panel: los
     * mensajes de Zod de este proyecto estan escritos en espanol para
     * leerse tal cual, y la pantalla los pinta sin traducir.
     */
    expect(contenedor.textContent).toContain('el permiso tiene que autorizar la web');
  });

  it('un permiso que no cubre ni interior ni exterior tampoco', async () => {
    await abrirFormulario();

    escribir('Reference', 'FT-2026-007');
    escribir('Customer', 'Marta');
    escribir('Property', 'Una calle');
    escribir('Service date', '2026-10-20');
    escribir('Signed on', '2026-10-18');
    marcar('Interior', false);
    await guardar();

    expect(createMediaConsent).not.toHaveBeenCalled();
  });

  it('la casilla del «antes» existe y arranca sin marcar', async () => {
    // Es la parte sensible del permiso. Que venga marcada de serie seria
    // como darla por supuesta.
    await abrirFormulario();

    const label = [...contenedor.querySelectorAll('label')].find((l) =>
      l.textContent?.includes('"before" footage'),
    );
    const casilla = label?.querySelector<HTMLInputElement>('input[type="checkbox"]');

    expect(casilla).toBeDefined();
    expect(casilla?.checked).toBe(false);
  });
});

describe('retirar un permiso', () => {
  /*
   * DESPUBLICA AL MOMENTO. Entre pulsar y que la foto desaparezca de la web
   * no hay nada, asi que no puede ser un clic suelto.
   */
  it('pide confirmacion, y si se cancela no llama a la API', async () => {
    fetchMediaConsents.mockResolvedValue([ficha()]);
    vi.stubGlobal(
      'confirm',
      vi.fn(() => false),
    );

    await montar();
    await pulsar('Withdraw');

    expect(setMediaConsentRevoked).not.toHaveBeenCalled();
  });

  it('y si se confirma, se retira', async () => {
    fetchMediaConsents.mockResolvedValue([ficha()]);
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true),
    );

    await montar();
    await pulsar('Withdraw');

    expect(setMediaConsentRevoked).toHaveBeenCalledWith(ficha().id, true);
  });

  it('un permiso retirado sigue en la lista, marcado', async () => {
    // Es exactamente lo que hay que poder ensenar: que existio, que amparaba
    // estas piezas y cuando dejo de hacerlo.
    fetchMediaConsents.mockResolvedValue([ficha({ revokedAt: '2026-10-25T10:00:00.000Z' })]);

    await montar();

    expect(contenedor.textContent).toContain('FT-2026-001');
    expect(contenedor.textContent).toContain('Withdrawn');
  });

  it('y restituirlo no pide confirmacion: no quita nada de la web', async () => {
    fetchMediaConsents.mockResolvedValue([ficha({ revokedAt: '2026-10-25T10:00:00.000Z' })]);
    const confirmar = vi.fn(() => true);
    vi.stubGlobal('confirm', confirmar);

    await montar();
    await pulsar('Reinstate');

    expect(confirmar).not.toHaveBeenCalled();
    expect(setMediaConsentRevoked).toHaveBeenCalledWith(ficha().id, false);
  });
});
