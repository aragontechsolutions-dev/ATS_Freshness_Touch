import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminGallery, Gallery, GalleryPhotoUpload } from '@freshness/types';
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
const uploadGalleryImage =
  vi.fn<(f: File, kind: 'photo' | 'poster') => Promise<GalleryPhotoUpload>>();

vi.mock('../lib/api', () => ({
  fetchGallery: () => fetchGallery(),
  saveGallery: (g: Gallery) => saveGallery(g),
  uploadGalleryImage: (f: File, kind: 'photo' | 'poster') => uploadGalleryImage(f, kind),
  ApiClientError: class ApiClientError extends Error {
    constructor(readonly statusCode: number) {
      super('fallo');
    }
  },
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

const FOTO = 'photos/0123456789abcdef0123456789abcdef.jpg';
const FOTO_URL = `https://ejemplo.supabase.co/storage/v1/object/public/gallery/${FOTO}`;
const MINI = 'posters/fedcba9876543210fedcba9876543210.jpg';
const MINI_URL = `https://ejemplo.supabase.co/storage/v1/object/public/gallery/${MINI}`;

const VACIA: AdminGallery = {
  gallery: { videos: [], photos: [] },
  imageUrls: {},
  uncovered: { videoIds: [], photoPaths: [] },
  updatedAt: null,
  updatedBy: null,
};

const CON_DOS: AdminGallery = {
  gallery: {
    videos: [
      { videoId: UNO, title: { en: 'Kitchen', es: 'Cocina' }, poster: null, addedAt: null },
      { videoId: DOS, title: { en: null, es: null }, poster: null, addedAt: null },
    ],
    photos: [],
  },
  imageUrls: {},
  uncovered: { videoIds: [], photoPaths: [] },
  updatedAt: '2026-10-20T12:00:00.000Z',
  updatedBy: 'Ada Jefa',
};

/** Con una foto ya publicada, para las pruebas de las fotos. */
const CON_FOTO: AdminGallery = {
  gallery: {
    videos: [{ videoId: UNO, title: { en: null, es: null }, poster: null, addedAt: null }],
    photos: [{ path: FOTO, title: { en: 'Kitchen', es: 'Cocina' }, addedAt: null }],
  },
  imageUrls: { [FOTO]: FOTO_URL },
  uncovered: { videoIds: [], photoPaths: [] },
  updatedAt: '2026-10-20T12:00:00.000Z',
  updatedBy: 'Ada Jefa',
};

/** Dos fotos y un video, ninguno amparado: el caso de la clienta de siempre. */
const OTRA_FOTO = 'photos/89abcdef0123456789abcdef01234567.jpg';

const SIN_PERMISO: AdminGallery = {
  gallery: {
    videos: [{ videoId: UNO, title: { en: null, es: null }, poster: null, addedAt: null }],
    photos: [
      { path: FOTO, title: { en: null, es: null }, addedAt: null },
      { path: OTRA_FOTO, title: { en: null, es: null }, addedAt: null },
    ],
  },
  imageUrls: { [FOTO]: FOTO_URL },
  uncovered: { videoIds: [UNO], photoPaths: [FOTO, OTRA_FOTO] },
  updatedAt: null,
  updatedBy: null,
};

/** Con un video que ya tiene su miniatura propia. */
const CON_MINIATURA: AdminGallery = {
  gallery: {
    videos: [{ videoId: UNO, title: { en: null, es: null }, poster: MINI, addedAt: null }],
    photos: [],
  },
  imageUrls: { [MINI]: MINI_URL },
  uncovered: { videoIds: [], photoPaths: [] },
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
    Promise.resolve({
      gallery,
      imageUrls: Object.fromEntries([
        ...gallery.photos.map((p) => [p.path, FOTO_URL] as const),
        ...gallery.videos.flatMap((v) =>
          v.poster === null ? [] : [[v.poster, MINI_URL] as const],
        ),
      ]),
      uncovered: { videoIds: [], photoPaths: [] },
      updatedAt: '2026-10-20T13:00:00.000Z',
      updatedBy: 'Ada Jefa',
    }),
  );
  uploadGalleryImage.mockImplementation((_archivo, kind) =>
    Promise.resolve(
      kind === 'poster' ? { path: MINI, url: MINI_URL } : { path: FOTO, url: FOTO_URL },
    ),
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
      videos: [{ videoId: UNO, title: { en: null, es: null }, poster: null, addedAt: null }],
      photos: [],
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
      videos: [{ videoId: DOS, title: { en: null, es: null }, poster: null, addedAt: null }],
      photos: [],
    });
  });

  it('vaciarla del todo tambien se puede guardar', async () => {
    fetchGallery.mockResolvedValue(CON_DOS);
    await montar();

    await pulsar('Remove');
    await pulsar('Remove');
    await guardar();

    expect(saveGallery).toHaveBeenCalledWith({ videos: [], photos: [] });
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

describe('las fotos', () => {
  /** El campo de archivo de la seccion de fotos. */
  function campoArchivo(): HTMLInputElement {
    // Por su nombre accesible: ahora hay un campo por video ademas del de las
    // fotos, y «el primero» dejaria de significar lo mismo al anadir videos.
    const elemento = contenedor.querySelector<HTMLInputElement>(
      'input[type="file"][aria-label="Add a photo"]',
    );
    if (!elemento) throw new Error('No encontre el campo de archivo de las fotos');
    return elemento;
  }

  async function elegir(archivo: File): Promise<void> {
    const campo = campoArchivo();
    Object.defineProperty(campo, 'files', { value: [archivo], configurable: true });
    await act(async () => {
      campo.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function imagen(bytes = 1000): File {
    const archivo = new File(['x'], 'cocina.jpg', { type: 'image/jpeg' });
    Object.defineProperty(archivo, 'size', { value: bytes, configurable: true });
    return archivo;
  }

  it('ensena la vista previa de las fotos ya publicadas', async () => {
    fetchGallery.mockResolvedValue(CON_FOTO);
    await montar();

    const img = contenedor.querySelector<HTMLImageElement>('img');
    expect(img?.getAttribute('src')).toBe(FOTO_URL);
  });

  it('solo acepta los tres tipos de imagen', async () => {
    // Un SVG es un documento que puede llevar JavaScript dentro. El servidor
    // lo rechaza mirando los bytes; esto solo evita el viaje.
    await montar();

    const aceptados = campoArchivo().getAttribute('accept') ?? '';
    expect(aceptados).toBe('image/jpeg,image/png,image/webp');
    expect(aceptados).not.toContain('svg');
  });

  it('subir una foto la anade a la lista con su vista previa', async () => {
    await montar();
    await elegir(imagen());

    expect(uploadGalleryImage).toHaveBeenCalledWith(expect.anything(), 'photo');

    expect(uploadGalleryImage).toHaveBeenCalledTimes(1);
    expect(contenedor.querySelector('img')?.getAttribute('src')).toBe(FOTO_URL);
  });

  it('subir no publica: hay que guardar despues', async () => {
    // Deja elegir el titulo antes de que la casa de nadie salga en la portada.
    await montar();
    await elegir(imagen());

    expect(saveGallery).not.toHaveBeenCalled();
  });

  it('y al guardar va la ruta, nunca la direccion', async () => {
    await montar();
    await elegir(imagen());
    await guardar();

    expect(saveGallery).toHaveBeenCalledWith({
      videos: [],
      photos: [{ path: FOTO, title: { en: null, es: null }, addedAt: null }],
    });
  });

  /*
   * EL AVISO DE TAMANO VA ANTES DE EMPEZAR A SUBIR.
   *
   * No es confiar en el navegador —el servidor lo rechaza igual—: es no hacer
   * esperar a nadie dos minutos para un «no».
   */
  it('una foto demasiado grande no se llega a subir', async () => {
    await montar();
    await elegir(imagen(6 * 1024 * 1024));

    expect(uploadGalleryImage).not.toHaveBeenCalled();
    expect(contenedor.textContent).toContain('too large');
  });

  /*
   * ESTA ES LA PRUEBA QUE EVITA UNA PERDIDA DE DATOS.
   *
   * La pantalla tiene dos listas y un solo boton de guardar, y se manda la
   * galeria ENTERA: lo que no viene, se borra. Si las fotos no viajaran,
   * tocar un video retiraria todas las fotos —y las borraria del almacen—
   * sin que nadie lo hubiera pedido.
   */
  it('guardar un cambio de los videos NO borra las fotos', async () => {
    fetchGallery.mockResolvedValue(CON_FOTO);
    await montar();

    await pulsar('Add a video');
    escribir(campoEnlace(1), DOS);
    await guardar();

    const enviado = saveGallery.mock.calls[0]?.[0];
    expect(enviado?.photos).toEqual([
      { path: FOTO, title: { en: 'Kitchen', es: 'Cocina' }, addedAt: null },
    ]);
  });

  it('y retirar una foto NO borra los videos', async () => {
    fetchGallery.mockResolvedValue(CON_FOTO);
    await montar();

    // El segundo «Remove» es el de la foto: el primero es el del video.
    const botones = [...contenedor.querySelectorAll('button')].filter((b) =>
      b.textContent?.includes('Remove'),
    );
    await act(async () => {
      botones[1]?.click();
    });
    await guardar();

    const enviado = saveGallery.mock.calls[0]?.[0];
    expect(enviado?.photos).toEqual([]);
    expect(enviado?.videos).toHaveLength(1);
  });
});

describe('la miniatura de un video', () => {
  /** El campo de archivo de la miniatura del primer video. */
  function campoMiniatura(): HTMLInputElement {
    const campo = contenedor.querySelector<HTMLInputElement>(
      'input[type="file"][aria-label="Thumbnail"]',
    );
    if (!campo) throw new Error('No encontre el campo de la miniatura');
    return campo;
  }

  async function elegirMiniatura(archivo: File): Promise<void> {
    const campo = campoMiniatura();
    Object.defineProperty(campo, 'files', { value: [archivo], configurable: true });
    await act(async () => {
      campo.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function imagen(bytes = 1000): File {
    const archivo = new File(['x'], 'portada.jpg', { type: 'image/jpeg' });
    Object.defineProperty(archivo, 'size', { value: bytes, configurable: true });
    return archivo;
  }

  it('un video sin miniatura ofrece subir una', async () => {
    fetchGallery.mockResolvedValue(CON_DOS);
    await montar();

    expect(campoMiniatura()).toBeDefined();
  });

  it('subirla la guarda en la carpeta de miniaturas, no en la de fotos', async () => {
    /*
     * Carpeta aparte a proposito: si vivieran juntas, retirar una foto de la
     * galeria podria llevarse por delante la portada de un video, y nadie
     * entenderia por que al quitar una foto un video se quedo en gris.
     */
    fetchGallery.mockResolvedValue(CON_DOS);
    await montar();
    await elegirMiniatura(imagen());

    expect(uploadGalleryImage).toHaveBeenCalledWith(expect.anything(), 'poster');
  });

  it('y al guardar va la ruta de la miniatura', async () => {
    fetchGallery.mockResolvedValue(CON_DOS);
    await montar();
    await elegirMiniatura(imagen());
    await guardar();

    const enviado = saveGallery.mock.calls[0]?.[0];
    expect(enviado?.videos[0]?.poster).toBe(MINI);
  });

  it('un video con miniatura ensena la vista previa en vez del campo', async () => {
    fetchGallery.mockResolvedValue(CON_MINIATURA);
    await montar();

    const img = contenedor.querySelector<HTMLImageElement>('img');
    expect(img?.getAttribute('src')).toBe(MINI_URL);
  });

  it('quitarla deja el video sin portada y se puede guardar', async () => {
    fetchGallery.mockResolvedValue(CON_MINIATURA);
    await montar();

    await pulsar('Remove thumbnail');
    await guardar();

    const enviado = saveGallery.mock.calls[0]?.[0];
    expect(enviado?.videos[0]?.poster).toBeNull();
  });

  it('una miniatura demasiado grande no se llega a subir', async () => {
    fetchGallery.mockResolvedValue(CON_DOS);
    await montar();
    await elegirMiniatura(imagen(6 * 1024 * 1024));

    expect(uploadGalleryImage).not.toHaveBeenCalled();
  });

  /*
   * La miniatura es un cambio como cualquier otro: hasta que no se guarda, el
   * video publicado sigue como estaba. Por eso tampoco se borra aqui la
   * anterior — si no se guardara, el video quedaria apuntando a un archivo
   * que ya no existe.
   */
  it('subirla no publica nada por si sola', async () => {
    fetchGallery.mockResolvedValue(CON_DOS);
    await montar();
    await elegirMiniatura(imagen());

    expect(saveGallery).not.toHaveBeenCalled();
  });
});

describe('lo que esta guardado pero no se publica', () => {
  /*
   * ========================================================================
   * SIN ESTO EL MODO ESTRICTO SERIA UNA TRAMPA
   * ========================================================================
   * La galeria publica funciona con lista blanca: sin un permiso firmado y
   * en pie, una pieza no sale. Esta bien — publicar la casa de alguien sin
   * su permiso es lo que todo el modulo evita— pero sin avisar aqui, lo que
   * pasa es que se sube una foto, se guarda, se ve en esta pantalla y no
   * aparece en la web, y no hay forma de saber por que.
   */
  const SIN_PERMISO: AdminGallery = {
    gallery: {
      videos: [{ videoId: UNO, title: { en: null, es: null }, poster: null, addedAt: null }],
      photos: [{ path: FOTO, title: { en: null, es: null }, addedAt: null }],
    },
    imageUrls: { [FOTO]: FOTO_URL },
    uncovered: { videoIds: [UNO], photoPaths: [FOTO] },
    updatedAt: '2026-10-25T12:00:00.000Z',
    updatedBy: 'Ada Jefa',
  };

  it('se avisa arriba, con cuantas piezas son', async () => {
    fetchGallery.mockResolvedValue(SIN_PERMISO);
    await montar();

    expect(contenedor.textContent).toContain('2 items are saved but not published');
  });

  it('y se dice que hacer', async () => {
    fetchGallery.mockResolvedValue(SIN_PERMISO);
    await montar();

    expect(contenedor.textContent).toContain('Image releases');
  });

  it('cada tarjeta afectada lo dice por su cuenta', async () => {
    // Arriba se dice cuantas; en la tarjeta, cual.
    fetchGallery.mockResolvedValue(SIN_PERMISO);
    await montar();

    const avisos = contenedor.textContent?.match(/Not on the website/g) ?? [];
    expect(avisos).toHaveLength(2);
  });

  it('sin piezas descubiertas no se avisa de nada', async () => {
    fetchGallery.mockResolvedValue(CON_FOTO);
    await montar();

    expect(contenedor.textContent).not.toContain('not published');
    expect(contenedor.textContent).not.toContain('Not on the website');
  });
});

describe('copiar las rutas para el permiso', () => {
  /*
   * EL PASO QUE FALTABA. El atajo para archivar el permiso de una clienta de
   * siempre pide las rutas de las fotos, y la ruta son treinta y dos
   * caracteres hexadecimales que hasta esta etapa SOLO estaban dentro de la
   * direccion de la imagen: habia que copiar la URL entera y recortarla a
   * mano. Un atajo cuyo ultimo paso es eso no es un atajo.
   */
  let copiado: string | null;

  beforeEach(() => {
    copiado = null;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (texto: string) => {
          copiado = texto;
          return Promise.resolve();
        },
      },
    });
  });

  it('copia la ruta de una foto, sin la direccion de alrededor', async () => {
    fetchGallery.mockResolvedValue(SIN_PERMISO);
    await montar();

    await pulsar('Copy path');

    expect(copiado).toBe(FOTO);
    /* La URL completa no vale: el contrato del permiso la rechaza. */
    expect(copiado).not.toContain('https://');
  });

  it('copia de golpe TODAS las fotos sin permiso, una por linea', async () => {
    fetchGallery.mockResolvedValue(SIN_PERMISO);
    await montar();

    await pulsar('Copy the 2 photo path(s) with no release');

    expect(copiado).toBe(`${FOTO}\n${OTRA_FOTO}`);
  });

  it('y los identificadores de los videos, aparte', async () => {
    /*
     * Aparte porque en el permiso son dos campos distintos: pegar las dos
     * listas juntas en uno de ellos no valdria.
     */
    fetchGallery.mockResolvedValue(SIN_PERMISO);
    await montar();

    await pulsar('Copy the 1 video id(s) with no release');

    expect(copiado).toBe(UNO);
  });

  it('no ofrece copiar nada cuando todo tiene permiso', async () => {
    fetchGallery.mockResolvedValue(CON_FOTO);
    await montar();

    expect(contenedor.textContent).not.toContain('with no release');
  });

  it('SI EL NAVEGADOR NO DEJA COPIAR, ENSENA EL TEXTO', async () => {
    /*
     * Lo peor que puede hacer un boton de copiar es fallar en silencio: la
     * persona cree que tiene la ruta, pega, y sale lo que tuviera de antes.
     * Pasa de verdad —contexto no seguro, permiso denegado, moviles— asi que
     * aqui se comprueba que quedarse sin portapapeles no deja a nadie
     * atascado.
     */
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });

    fetchGallery.mockResolvedValue(SIN_PERMISO);
    await montar();

    await pulsar('Copy path');

    expect(contenedor.textContent).toContain('did not allow copying');
    const area = contenedor.querySelector('textarea');
    expect(area?.value).toBe(FOTO);
  });
});
