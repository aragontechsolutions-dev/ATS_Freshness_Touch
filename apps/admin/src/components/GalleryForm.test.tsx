import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminGallery, Gallery } from '@freshness/types';
import '../i18n';

/**
 * LA PANTALLA DE LA GALERIA DE ANTES Y DESPUES
 * --------------------------------------------
 * Aqui no se configura un ajuste: se publica el interior de la casa de un
 * cliente. Se comprueba lo que no se ve leyendo el componente:
 *
 *   1. QUE SE PUEDA PEGAR LA DIRECCION DE YOUTUBE, en sus cuatro formas, y
 *      que lo que salga hacia la API sean solo los once caracteres. Si la
 *      pantalla exigiera el identificador suelto, acabaria pegandose la
 *      direccion, el campo se pondria rojo y la conclusion seria «esto no
 *      funciona». Y si se guardara la direccion, el panel seria una via para
 *      incrustar en la portada un marco de cualquier sitio.
 *   2. QUE RETIRAR UN VIDEO SALGA HACIA LA API COMO UNA AUSENCIA. Es la
 *      operacion que de verdad importa: un cliente revoca su permiso y hay
 *      que quitarlo ya.
 *   3. QUE UN TITULO VACIO SE GUARDE COMO `null`, no como cadena vacia.
 *   4. QUE UN IDENTIFICADOR INVALIDO NO SALGA HACIA LA API.
 *   5. QUE EL AVISO DEL PERMISO ESTE SIEMPRE, incluso con la galeria vacia.
 */

const fetchGallery = vi.fn<() => Promise<AdminGallery>>();
const saveGallery = vi.fn<(g: Gallery) => Promise<AdminGallery>>();

vi.mock('../lib/api', () => ({
  fetchGallery: () => fetchGallery(),
  saveGallery: (g: Gallery) => saveGallery(g),
  ApiClientError: class ApiClientError extends Error {},
}));

vi.mock('./ToastProvider', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

/*
 * Las pruebas corren con los textos en INGLES: es el idioma por defecto de
 * i18n, porque `es.ts` se declara como `typeof en`.
 */
const { GalleryForm, identificadorDeYouTube } = await import('./GalleryForm');

const UNO = 'dQw4w9WgXcQ';
const DOS = 'aBcDeFgHiJk';

const VACIA: AdminGallery = { gallery: { videos: [] }, updatedAt: null, updatedBy: null };

const CON_DOS: AdminGallery = {
  gallery: {
    videos: [
      { videoId: UNO, title: { en: 'Kitchen', es: 'Cocina' } },
      { videoId: DOS, title: { en: null, es: null } },
    ],
  },
  updatedAt: '2026-10-20T12:00:00.000Z',
  updatedBy: 'Ada Jefa',
};

let contenedor: HTMLDivElement;
let root: Root;

async function montar(): Promise<void> {
  await act(async () => {
    root.render(<GalleryForm locale="es" onSessionLost={() => {}} />);
  });
}

/** El campo del enlace de la fila n. El id lo pone el componente. */
function campoEnlace(indice: number): HTMLInputElement {
  const elemento = contenedor.querySelector<HTMLInputElement>(`#galeria-video-${String(indice)}`);
  if (!elemento) throw new Error(`No encontre el campo de la fila ${String(indice)}`);
  return elemento;
}

function escribir(elemento: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(elemento, valor);
  elemento.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Pulsa el primer boton cuyo texto coincida. */
async function pulsar(texto: string): Promise<void> {
  const boton = [...contenedor.querySelectorAll('button')].find((b) =>
    b.textContent?.includes(texto),
  );
  if (!boton) throw new Error(`No encontre el boton «${texto}»`);
  await act(async () => {
    boton.click();
  });
}

async function guardar(): Promise<void> {
  const form = contenedor.querySelector('form');
  await act(async () => {
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchGallery.mockResolvedValue(VACIA);
  saveGallery.mockImplementation((gallery) =>
    Promise.resolve({ gallery, updatedAt: '2026-10-20T13:00:00.000Z', updatedBy: 'Ada Jefa' }),
  );

  contenedor = document.createElement('div');
  document.body.append(contenedor);
  root = createRoot(contenedor);
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
});

/* ======================================================================== */

describe('sacar el identificador de lo que se pegue', () => {
  /*
   * Hay cuatro formas de copiar la direccion de un video segun de donde se
   * copie: la barra del navegador, el boton de compartir, el de incrustar y
   * la direccion corta del movil. Todas tienen que valer.
   */
  it.each([
    ['la barra del navegador', `https://www.youtube.com/watch?v=${UNO}`],
    ['con mas parametros detras', `https://www.youtube.com/watch?v=${UNO}&t=42s`],
    ['la direccion corta de compartir', `https://youtu.be/${UNO}`],
    ['la de incrustar', `https://www.youtube.com/embed/${UNO}`],
    ['un short', `https://www.youtube.com/shorts/${UNO}`],
    ['un directo', `https://www.youtube.com/live/${UNO}`],
    ['el identificador suelto', UNO],
  ])('reconoce %s', (_caso, pegado) => {
    expect(identificadorDeYouTube(pegado)).toBe(UNO);
  });

  it('lo que no reconoce lo devuelve tal cual, para que el campo lo ensene', () => {
    // Tragarselo en silencio dejaria el campo vacio sin decir por que.
    expect(identificadorDeYouTube('https://vimeo.com/123')).toBe('https://vimeo.com/123');
  });
});

describe('lo que se ve al abrir', () => {
  it('con la galeria vacia dice que la seccion no se ve en la web', async () => {
    await montar();

    // Vacio no es un fallo: es que la seccion no se pinta.
    expect(contenedor.textContent).toContain('hidden on the website');
  });

  it('el aviso del permiso esta incluso con la galeria vacia', async () => {
    await montar();

    // Es una advertencia permanente, no una casilla de «he leido»: esas se
    // marcan sin leer, y esta pantalla se abre muchas veces.
    expect(contenedor.textContent).toContain('without its written release');
  });

  it('ensena los videos guardados con sus titulos', async () => {
    fetchGallery.mockResolvedValue(CON_DOS);
    await montar();

    expect(campoEnlace(0).value).toBe(UNO);
    expect(campoEnlace(1).value).toBe(DOS);
    expect(contenedor.textContent).toContain('Ada Jefa');
  });
});

describe('publicar un video', () => {
  it('se pega la direccion y hacia la API va solo el identificador', async () => {
    await montar();
    await pulsar('Add a video');

    escribir(campoEnlace(0), `https://www.youtube.com/watch?v=${UNO}&t=10s`);
    await guardar();

    expect(saveGallery).toHaveBeenCalledWith({
      videos: [{ videoId: UNO, title: { en: null, es: null } }],
    });
  });

  it('un titulo vacio se guarda como null, no como cadena vacia', async () => {
    await montar();
    await pulsar('Add a video');

    escribir(campoEnlace(0), UNO);
    await guardar();

    const enviado = saveGallery.mock.calls[0]?.[0];
    expect(enviado?.videos[0]?.title).toEqual({ en: null, es: null });
  });

  it('un identificador invalido no sale hacia la API', async () => {
    await montar();
    await pulsar('Add a video');

    escribir(campoEnlace(0), 'https://vimeo.com/123');
    await guardar();

    expect(saveGallery).not.toHaveBeenCalled();
    expect(contenedor.textContent).toContain('not a YouTube link');
  });

  it('el mismo video dos veces se avisa y no sale hacia la API', async () => {
    fetchGallery.mockResolvedValue(CON_DOS);
    await montar();
    await pulsar('Add a video');

    escribir(campoEnlace(2), UNO);
    await guardar();

    expect(saveGallery).not.toHaveBeenCalled();
    expect(contenedor.textContent).toContain('already in the gallery');
  });
});

describe('retirar un video', () => {
  /*
   * LA OPERACION QUE DE VERDAD IMPORTA. Un cliente revoca su permiso y hay
   * que quitarlo ya. Sale como una ausencia: se manda el conjunto sin el, asi
   * que no hay ninguna peticion de borrado que se pueda perder por el camino
   * dejando publicada la casa de alguien que pidio que la quitaran.
   */
  it('quita la fila y manda el conjunto sin ella', async () => {
    fetchGallery.mockResolvedValue(CON_DOS);
    await montar();

    await pulsar('Remove');
    await guardar();

    expect(saveGallery).toHaveBeenCalledWith({
      videos: [{ videoId: DOS, title: { en: null, es: null } }],
    });
  });

  it('vaciarla del todo tambien se puede guardar', async () => {
    fetchGallery.mockResolvedValue(CON_DOS);
    await montar();

    await pulsar('Remove');
    await pulsar('Remove');
    await guardar();

    expect(saveGallery).toHaveBeenCalledWith({ videos: [] });
  });
});

describe('sin cambios no hay nada que guardar', () => {
  it('el boton de guardar esta desactivado al abrir', async () => {
    fetchGallery.mockResolvedValue(CON_DOS);
    await montar();

    const boton = [...contenedor.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Save gallery'),
    );
    expect(boton?.disabled).toBe(true);
  });
});
