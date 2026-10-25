import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GALLERY,
  GALLERY_PHOTOS_MAX,
  GALLERY_PHOTO_MAX_BYTES,
  GALLERY_PHOTO_TYPES,
  GALLERY_TITLE_MAX,
  GALLERY_VIDEOS_MAX,
  GallerySchema,
  YOUTUBE_EMBED_ORIGIN,
  PublicGallerySchema,
  galleryPhotoTitle,
  galleryVideoTitle,
  hasGalleryContent,
  youTubeEmbedUrl,
  type GalleryVideo,
} from './gallery';

/** Once caracteres validos, para no repetirlos en cada prueba. */
const ID = 'dQw4w9WgXcQ';

function video(extra: Partial<GalleryVideo> = {}): unknown {
  return { videoId: ID, title: { en: 'Kitchen', es: 'Cocina' }, ...extra };
}

describe('el identificador del video', () => {
  it('acepta los once caracteres del formato de YouTube', () => {
    expect(GallerySchema.safeParse({ videos: [video()] }).success).toBe(true);
  });

  it.each([
    ['vacio', ''],
    ['de diez', 'dQw4w9WgXc'],
    ['de doce', 'dQw4w9WgXcQQ'],
  ])('rechaza uno %s', (_caso, videoId) => {
    expect(GallerySchema.safeParse({ videos: [video({ videoId })] }).success).toBe(false);
  });

  /*
   * ESTAS SON LAS QUE IMPORTAN DE VERDAD.
   *
   * El identificador se mete dentro de la URL del marco. Si por ahi cupiera
   * una barra, dos puntos o un punto, quien tuviera acceso al panel podria
   * sacar el marco del origen que permite la CSP y cargar en la portada un
   * video —o una pagina— de cualquier sitio. Con once caracteres del conjunto
   * permitido no se puede escribir otra direccion.
   */
  it.each([
    ['una URL entera', 'https://evil.example/x'],
    ['una barra', 'dQw4w9WgX/Q'],
    ['dos puntos', 'dQw4w9WgX:Q'],
    ['un punto', 'dQw4w9WgX.Q'],
    ['un salto a otra ruta', '../../evil11'],
    ['un espacio', 'dQw4w9Wg cQ'],
  ])('rechaza %s', (_caso, videoId) => {
    expect(GallerySchema.safeParse({ videos: [video({ videoId })] }).success).toBe(false);
  });

  it('y lo que se acepta cabe tal cual en la URL del marco', () => {
    // Si algun dia se ampliara el conjunto de caracteres, esto lo delata:
    // la URL construida tiene que seguir apuntando a nuestro origen.
    const url = youTubeEmbedUrl(ID);
    expect(url.startsWith(`${YOUTUBE_EMBED_ORIGIN}/embed/${ID}?`)).toBe(true);
    expect(new URL(url).origin).toBe(YOUTUBE_EMBED_ORIGIN);
  });
});

describe('la direccion del marco', () => {
  it('es la que no pone cookies hasta que se reproduce', () => {
    expect(YOUTUBE_EMBED_ORIGIN).toBe('https://www.youtube-nocookie.com');
  });

  it('arranca sola, porque el visitante ya pulso una vez', () => {
    expect(youTubeEmbedUrl(ID)).toContain('autoplay=1');
  });

  it('limita los sugeridos al canal de la empresa', () => {
    // No los quita: YouTube dejo de permitirlo en 2018. Solo los acota.
    expect(youTubeEmbedUrl(ID)).toContain('rel=0');
  });

  it('en iPhone se reproduce dentro de la pagina', () => {
    // Sin esto, el video se abre a pantalla completa y el visitante sale de
    // la portada, que es donde esta el boton de reservar.
    expect(youTubeEmbedUrl(ID)).toContain('playsinline=1');
  });
});

describe('el titulo', () => {
  it('es opcional: un video puede explicarse solo', () => {
    const parsed = GallerySchema.safeParse({ videos: [{ videoId: ID }] });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.videos[0]?.title).toEqual({ en: null, es: null });
  });

  it('rechaza uno vacio: para dejarlo sin poner se usa null', () => {
    expect(
      GallerySchema.safeParse({ videos: [video({ title: { en: '', es: null } })] }).success,
    ).toBe(false);
  });

  it('rechaza saltos de linea y caracteres invisibles', () => {
    for (const malo of ['Dos\nlineas', 'Con​cero']) {
      expect(
        GallerySchema.safeParse({ videos: [video({ title: { en: malo, es: null } })] }).success,
      ).toBe(false);
    }
  });

  it(`no pasa de ${GALLERY_TITLE_MAX} caracteres`, () => {
    const largo = 'a'.repeat(GALLERY_TITLE_MAX + 1);
    expect(
      GallerySchema.safeParse({ videos: [video({ title: { en: largo, es: null } })] }).success,
    ).toBe(false);
  });

  it('se lee en el idioma en curso', () => {
    const v = { videoId: ID, title: { en: 'Kitchen', es: 'Cocina' } };
    expect(galleryVideoTitle(v, 'en')).toBe('Kitchen');
    expect(galleryVideoTitle(v, 'es')).toBe('Cocina');
  });

  it('y si falta ese idioma se usa el otro, que es mejor que nada', () => {
    const v = { videoId: ID, title: { en: 'Kitchen', es: null } };
    expect(galleryVideoTitle(v, 'es')).toBe('Kitchen');
  });

  it('sin ninguno devuelve null y la tarjeta se pinta sin titulo', () => {
    expect(galleryVideoTitle({ videoId: ID, title: { en: null, es: null } }, 'en')).toBeNull();
  });
});

describe('el conjunto', () => {
  it('la galeria vacia es valida: es lo que se sirve sin configurar nada', () => {
    expect(GallerySchema.safeParse(DEFAULT_GALLERY).success).toBe(true);
    expect(hasGalleryContent(DEFAULT_GALLERY)).toBe(false);
  });

  it('rechaza claves que no conoce, para que una mal escrita no se guarde', () => {
    expect(GallerySchema.safeParse({ videos: [], fotos: [] }).success).toBe(false);
  });

  /*
   * LA TRAMPA DEL OBJETO ESTRICTO.
   *
   * Siendo estricto, anadir un campo sin valor por defecto invalidaria de
   * golpe todas las filas ya guardadas: la fila vieja no lo trae, el contrato
   * la rechaza entera y la galeria sale vacia sin que nadie haya borrado
   * nada. Ya paso con las tarifas. Esta prueba comprueba que una fila sin el
   * campo se sigue leyendo.
   */
  it('una fila guardada sin el campo se lee igual, con el valor de partida', () => {
    const parsed = GallerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.videos).toEqual([]);
  });

  it(`no caben mas de ${GALLERY_VIDEOS_MAX} videos`, () => {
    const muchos = Array.from({ length: GALLERY_VIDEOS_MAX + 1 }, (_, i) => ({
      // Identificadores distintos: lo que se comprueba es el tope, no el duplicado.
      videoId: `aaaaaaaaa${String(i).padStart(2, '0')}`,
      title: { en: null, es: null },
    }));
    expect(GallerySchema.safeParse({ videos: muchos }).success).toBe(false);
  });

  it('rechaza el mismo video dos veces', () => {
    expect(GallerySchema.safeParse({ videos: [video(), video()] }).success).toBe(false);
  });

  it('con un video, hay algo que ensenar', () => {
    const parsed = GallerySchema.parse({ videos: [video()] });
    expect(hasGalleryContent(parsed)).toBe(true);
  });
});

/* ------------------------------------------------------------------------ */
/*  Las fotos                                                                */
/* ------------------------------------------------------------------------ */

/** Una ruta con el formato que pone el servidor: 32 hexadecimales. */
const RUTA = 'photos/0123456789abcdef0123456789abcdef.jpg';

function foto(path = RUTA): unknown {
  return { path, title: { en: null, es: null } };
}

describe('la ruta de una foto', () => {
  it.each([
    ['jpg', 'photos/0123456789abcdef0123456789abcdef.jpg'],
    ['png', 'photos/0123456789abcdef0123456789abcdef.png'],
    ['webp', 'photos/0123456789abcdef0123456789abcdef.webp'],
  ])('acepta la que pone el servidor, en %s', (_caso, path) => {
    expect(GallerySchema.safeParse({ photos: [foto(path)] }).success).toBe(true);
  });

  /*
   * ESTAS SON LAS QUE IMPORTAN.
   *
   * Si en la fila cupiera una direccion completa, quien entrara al panel
   * podria hacer que la portada cargara una imagen —o un rastreador de un
   * solo pixel— desde cualquier sitio de internet. Y si cupiera un nombre
   * libre, se acabarian subiendo archivos llamados «casa-de-los-martinez.jpg»,
   * que es publicar el apellido del cliente en una direccion que cualquiera
   * puede leer.
   */
  it.each([
    ['una direccion completa', 'https://evil.example/pixel.gif'],
    ['un salto de ruta', 'photos/../../secreto.jpg'],
    ['otra carpeta', 'privado/0123456789abcdef0123456789abcdef.jpg'],
    ['un nombre con el apellido del cliente', 'photos/casa-de-los-martinez.jpg'],
    ['sin carpeta', '0123456789abcdef0123456789abcdef.jpg'],
    ['un SVG', 'photos/0123456789abcdef0123456789abcdef.svg'],
    ['hexadecimales de menos', 'photos/0123456789abcdef.jpg'],
    ['mayusculas', 'photos/0123456789ABCDEF0123456789ABCDEF.jpg'],
    ['una barra de mas', 'photos//0123456789abcdef0123456789abcdef.jpg'],
  ])('rechaza %s', (_caso, path) => {
    expect(GallerySchema.safeParse({ photos: [foto(path)] }).success).toBe(false);
  });
});

describe('el conjunto de fotos', () => {
  it('la galeria de partida no tiene ninguna', () => {
    expect(DEFAULT_GALLERY.photos).toEqual([]);
    expect(GallerySchema.safeParse(DEFAULT_GALLERY).success).toBe(true);
  });

  it('con una foto ya hay algo que ensenar, aunque no haya videos', () => {
    const parsed = GallerySchema.parse({ photos: [foto()] });
    expect(hasGalleryContent(parsed)).toBe(true);
  });

  it(`no caben mas de ${GALLERY_PHOTOS_MAX} fotos`, () => {
    const muchas = Array.from({ length: GALLERY_PHOTOS_MAX + 1 }, (_, i) => ({
      path: `photos/${String(i).padStart(32, '0')}.jpg`,
      title: { en: null, es: null },
    }));
    expect(GallerySchema.safeParse({ photos: muchas }).success).toBe(false);
  });

  it('rechaza la misma foto dos veces', () => {
    expect(GallerySchema.safeParse({ photos: [foto(), foto()] }).success).toBe(false);
  });

  /*
   * El caso que de verdad va a pasar: la fila se guardo cuando la galeria
   * solo tenia videos. Si el contrato la rechazara por no traer `photos`, los
   * videos ya publicados desaparecerian de la portada en el despliegue.
   */
  it('una fila con videos y sin el campo de fotos se sigue leyendo', () => {
    const parsed = GallerySchema.safeParse({ videos: [video()] });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.photos).toEqual([]);
  });
});

describe('los limites de la subida', () => {
  it('el tope son 5 MB, el mismo que el del bucket', () => {
    // Si los dos numeros se separaran, subir algo entre ambos fallaria DESPUES
    // de haberlo subido entero, y el aviso llegaria tarde y sin explicacion.
    expect(GALLERY_PHOTO_MAX_BYTES).toBe(5 * 1024 * 1024);
  });

  it('no se admite SVG', () => {
    // Un SVG es un documento que puede llevar JavaScript dentro, y servido
    // desde un bucket publico seria un hueco de seguridad real.
    expect(GALLERY_PHOTO_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  });
});

describe('lo que recibe la web', () => {
  it('trae direcciones, no rutas', () => {
    const parsed = PublicGallerySchema.safeParse({
      videos: [],
      photos: [{ url: 'https://ejemplo.supabase.co/x.jpg', title: { en: 'Kitchen', es: null } }],
    });
    expect(parsed.success).toBe(true);
  });

  it('una direccion que no es una direccion se rechaza', () => {
    expect(
      PublicGallerySchema.safeParse({
        videos: [],
        photos: [{ url: 'photos/abc.jpg', title: { en: null, es: null } }],
      }).success,
    ).toBe(false);
  });

  it('el titulo se lee en el idioma en curso, con el otro de respaldo', () => {
    const photo = { url: 'https://ejemplo.supabase.co/x.jpg', title: { en: 'Kitchen', es: null } };

    expect(galleryPhotoTitle(photo, 'en')).toBe('Kitchen');
    expect(galleryPhotoTitle(photo, 'es')).toBe('Kitchen');
    expect(galleryPhotoTitle({ ...photo, title: { en: null, es: null } }, 'en')).toBeNull();
  });
});
