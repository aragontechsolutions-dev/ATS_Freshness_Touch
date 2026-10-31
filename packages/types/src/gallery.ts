import { z } from 'zod';

/**
 * LA GALERIA DE ANTES Y DESPUES
 * =============================
 * Los videos que la empresa publica en la portada. Las fotos llegan en su
 * propia etapa, cuando exista donde guardarlas.
 *
 * SE GUARDA EL IDENTIFICADOR, NUNCA UNA URL
 * -----------------------------------------
 * Un video de YouTube se identifica con once caracteres. Esto guarda esos
 * once y la web construye la direccion a partir de ellos.
 *
 * La alternativa —guardar la URL que la dueña pegue— convertiria el panel en
 * una via para incrustar en la portada un marco de cualquier sitio de
 * internet. La politica de seguridad de contenido (CSP) del sitio solo
 * permite un origen para los marcos de video; si el origen saliera del dato
 * guardado, la CSP dejaria de ser un muro y pasaria a ser una sugerencia.
 *
 * Con el identificador el origen lo decide EL CODIGO, y lo decide aqui, en
 * un solo sitio, que es lo que permite que una prueba ate ese origen con el
 * que la CSP permite de verdad.
 *
 * NO SE PUBLICA LA CASA DE NADIE SIN PERMISO
 * ------------------------------------------
 * El «antes» es la imagen de la casa sucia de una persona concreta. El
 * consentimiento firmado, lo que nunca puede entrar en el encuadre y el
 * procedimiento de retirada estan en `docs/38-fotos-y-videos-antes-y-despues.md`.
 * Esto es solo el contrato de datos; no sustituye a ese papel.
 */

// ---------------------------------------------------------------------------
// El identificador y el origen
// ---------------------------------------------------------------------------

/**
 * Once caracteres de letras, digitos, guion y guion bajo.
 *
 * Es el formato de un identificador de YouTube, y vale ademas como filtro de
 * seguridad: con este conjunto no cabe ni una barra, ni dos puntos, ni un
 * punto, asi que lo guardado no puede convertirse en otra direccion al
 * meterlo en la URL del marco.
 */
export const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export const YouTubeVideoIdSchema = z
  .string()
  .trim()
  .regex(
    YOUTUBE_VIDEO_ID_PATTERN,
    'El identificador de YouTube son 11 caracteres: letras, digitos, guion o guion bajo',
  );

/**
 * El unico origen desde el que el sitio carga un marco de video.
 *
 * `youtube-nocookie.com` en vez de `youtube.com` porque retiene las cookies
 * hasta que alguien reproduce. OJO: retiene las COOKIES, no todo. Las pruebas
 * independientes encuentran que el marco escribe un identificador en el
 * almacenamiento del navegador y manda la IP del visitante a Google EN CUANTO
 * CARGA, antes de que nadie pulse play.
 *
 * Por eso el sitio no carga el marco hasta que el visitante lo pide: la
 * fachada de `VideoFacade` existe por esto, y no por estetica. Mientras nadie
 * pulse, la pagina sigue sin pedir nada a ningun tercero.
 */
export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com';

/**
 * La direccion del marco, ya con los parametros que queremos.
 *
 * - `autoplay=1`: el visitante ya pulso una vez; pedirle que pulse otra vez
 *   dentro del marco seria cobrarle dos clics por el mismo deseo.
 * - `rel=0`: limita los videos sugeridos al canal de la empresa. NO los
 *   quita: YouTube cambio eso en 2018 y ya no se puede desactivar del todo.
 * - `modestbranding=1`: quita el logotipo grande de YouTube de la barra.
 * - `playsinline=1`: en iPhone se reproduce dentro de la pagina en vez de
 *   abrirse a pantalla completa, que sacaria al visitante de la portada.
 */
const PARAMETROS_DEL_MARCO = 'autoplay=1&rel=0&modestbranding=1&playsinline=1';

export function youTubeEmbedUrl(videoId: string): string {
  return `${YOUTUBE_EMBED_ORIGIN}/embed/${videoId}?${PARAMETROS_DEL_MARCO}`;
}

/** Donde se ve el video en YouTube, para el enlace al canal. */
export function youTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// ---------------------------------------------------------------------------
// El titulo
// ---------------------------------------------------------------------------

/**
 * Un titulo corto: cabe en una linea debajo de la miniatura.
 *
 * Mas largo no es mas informativo, es una tarjeta descuadrada. Y el tope
 * tambien impide que un pegado accidental entre en la base.
 */
export const GALLERY_TITLE_MAX = 80;

/** Ni saltos de linea ni caracteres invisibles, igual que los textos del sitio. */
const SIN_CONTROLES = /^[^\p{Cc}\p{Cf}]*$/u;

function tituloEditable() {
  return z
    .string()
    .trim()
    .min(1, 'El titulo no puede quedarse vacio: para dejarlo sin poner, usa null')
    .max(GALLERY_TITLE_MAX, `El titulo no puede pasar de ${GALLERY_TITLE_MAX} caracteres`)
    .regex(SIN_CONTROLES, 'El titulo no admite saltos de linea ni caracteres invisibles')
    .nullable();
}

/**
 * El titulo en los dos idiomas, los dos siempre presentes como campo.
 *
 * Mismo motivo que en los textos del sitio: si un idioma pudiera faltar del
 * objeto, «sin poner» y «me olvide de mandarlo» serian indistinguibles, y
 * guardar solo el ingles borraria el espanol sin querer.
 */
export const GalleryTitleSchema = z.strictObject({
  en: tituloEditable(),
  es: tituloEditable(),
});
export type GalleryTitle = z.infer<typeof GalleryTitleSchema>;

export const TITULO_SIN_PONER: GalleryTitle = { en: null, es: null };

/**
 * LA MINIATURA DE UN VIDEO, EN NUESTRA PROPIA CARPETA.
 *
 * Carpeta aparte de las fotos y no una mas de la galeria, porque no es
 * contenido: es la portada de otra cosa. Si vivieran juntas, retirar una foto
 * de la galeria podria llevarse por delante la portada de un video —y al
 * contrario—, y nadie entenderia por que al quitar una foto un video se quedo
 * en gris.
 *
 * ========================================================================
 * POR QUE NUESTRA, Y NO LA DE YOUTUBE
 * ========================================================================
 * YouTube sirve la miniatura de cualquier video en `i.ytimg.com`. Usarla
 * seria gratis y automatica, y seria exactamente la peticion a Google que la
 * fachada de clic existe para evitar — y encima en cuanto la seccion entra en
 * pantalla, sin que nadie pulse nada.
 *
 * Con una imagen nuestra, la pagina sigue sin pedirle nada a ningun tercero
 * hasta que el visitante decide ver el video.
 */
export const GALLERY_POSTER_PATH_PATTERN = /^posters\/[0-9a-f]{32}\.(jpg|png|webp)$/;

export const GalleryPosterPathSchema = z
  .string()
  .trim()
  .regex(
    GALLERY_POSTER_PATH_PATTERN,
    'La ruta de la miniatura la pone el servidor al subirla; no se escribe a mano',
  );

/** Las dos carpetas del almacen, y lo que distingue a una de otra. */
export const GALLERY_IMAGE_KINDS = ['photo', 'poster'] as const;
export const GalleryImageKindSchema = z.enum(GALLERY_IMAGE_KINDS);
export type GalleryImageKind = z.infer<typeof GalleryImageKindSchema>;

export function galleryImageFolder(kind: GalleryImageKind): 'photos' | 'posters' {
  return kind === 'photo' ? 'photos' : 'posters';
}

// ---------------------------------------------------------------------------
// El conjunto
// ---------------------------------------------------------------------------

/**
 * Un video, con su titulo opcional.
 *
 * El titulo es opcional porque un video puede explicarse solo. Lo que no es
 * opcional es el identificador: sin el no hay video.
 */
export const GalleryVideoSchema = z.strictObject({
  videoId: YouTubeVideoIdSchema,
  title: GalleryTitleSchema.default(TITULO_SIN_PONER),
  /**
   * La portada que se ve antes de pulsar, si se ha subido una.
   *
   * `null` por defecto Y CON VALOR POR DEFECTO, que es lo que permite que las
   * filas guardadas antes de que esto existiera se sigan leyendo. Sin el
   * `.default`, el dia del despliegue los videos ya publicados habrian
   * desaparecido de la portada y nadie lo habria relacionado con el cambio.
   *
   * Sin miniatura la tarjeta se pinta con los colores de la marca, que
   * funciona y no pide nada a nadie.
   */
  poster: GalleryPosterPathSchema.nullable().default(null),

  /** Cuando se anadio. Ver la nota de `GalleryPhotoSchema`. */
  addedAt: z.iso.datetime().nullable().default(null),
});
export type GalleryVideo = z.infer<typeof GalleryVideoSchema>;

// ---------------------------------------------------------------------------
// Las fotos
// ---------------------------------------------------------------------------

/**
 * SE GUARDA LA RUTA DENTRO DEL ALMACEN, NUNCA UNA DIRECCION COMPLETA.
 *
 * Mismo motivo que con los videos: si lo guardado fuera una direccion, quien
 * entrara al panel podria hacer que la portada cargara una imagen —o un
 * rastreador de un solo pixel— desde cualquier sitio de internet. La politica
 * de seguridad de contenido del sitio permite un origen para las imagenes, y
 * si el origen saliera del dato guardado dejaria de ser un muro.
 *
 * El nombre lo pone el SERVIDOR al subir, no quien sube: treinta y dos
 * caracteres hexadecimales y la extension. Con eso no cabe ni una barra de
 * mas, ni un `..`, ni un nombre con el apellido del cliente dentro.
 */
export const GALLERY_PHOTO_PATH_PATTERN = /^photos\/[0-9a-f]{32}\.(jpg|png|webp)$/;

export const GalleryPhotoPathSchema = z
  .string()
  .trim()
  .regex(
    GALLERY_PHOTO_PATH_PATTERN,
    'La ruta de la foto la pone el servidor al subirla; no se escribe a mano',
  );

export const GalleryPhotoSchema = z.strictObject({
  path: GalleryPhotoPathSchema,
  title: GalleryTitleSchema.default(TITULO_SIN_PONER),

  /**
   * CUANDO SE ANADIO LA PIEZA, para poder avisar de lo que lleva demasiado
   * tiempo guardado sin permiso que lo ampare.
   *
   * LO PONE EL SERVIDOR al guardar, no quien sube: es una fecha con la que
   * se decide si molestar a alguien, y un dato que decide eso no puede venir
   * del navegador. Al reguardar la galeria se conserva la que ya tenia, asi
   * que corregir un titulo no reinicia el reloj.
   *
   * NULO = «ya estaba antes de que esto existiera», y cuenta como VIEJA. Es
   * lo contrario de lo que parece prudente, y es lo correcto: las piezas que
   * hay hoy sin permiso son exactamente las que hay que mirar, y tratarlas
   * como recien llegadas dejaria el aviso mudo justo para ellas.
   *
   * CON `.default(null)` por la razon de siempre en este archivo: sin el, el
   * dia del despliegue las filas guardadas dejarian de cumplir el contrato y
   * la galeria desapareceria de la portada.
   */
  addedAt: z.iso.datetime().nullable().default(null),
});
export type GalleryPhoto = z.infer<typeof GalleryPhotoSchema>;

/**
 * Cuantas fotos caben.
 *
 * Mas que los videos porque una foto pesa menos y se mira mas rapido, pero
 * con tope igualmente: una portada con cien fotos no vende mas, tarda mas en
 * cargar.
 */
export const GALLERY_PHOTOS_MAX = 24;

/**
 * Cuantos dias se deja una pieza guardada sin permiso antes de avisar.
 *
 * NO ES CERO A PROPOSITO. El orden natural de trabajo es subir la foto y
 * despues anotar el permiso, a veces al dia siguiente, cuando el cliente
 * contesta. Avisar el mismo dia convertiria el aviso en parte del
 * procedimiento normal, y lo que suena siempre se deja de leer.
 *
 * Tres dias es lo que tarda en dejar de ser «lo estoy haciendo» y pasar a
 * ser «se me olvido».
 */
export const GALLERY_UNCOVERED_GRACE_DAYS = 3;

/**
 * Lo que mas puede pesar una foto: 5 MB.
 *
 * Una foto de movil son 3 o 4 MB. Mas que eso es un video disfrazado o un
 * error, y el mismo numero esta configurado en el bucket de Supabase, asi que
 * subir algo mayor fallaria de todas formas — pero fallaria DESPUES de
 * haberlo subido entero, y el aviso llegaria tarde y sin explicacion.
 *
 * Vive aqui para que el panel pueda avisar ANTES de empezar a subir y el
 * servidor pueda rechazarlo igualmente. Que el panel avise no es confiar en
 * el: es no hacer esperar a nadie dos minutos para un «no».
 */
export const GALLERY_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Lo unico que se acepta subir. Se comprueba por los bytes, no por el nombre. */
export const GALLERY_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Cuantos videos caben en la seccion.
 *
 * No es una limitacion tecnica: es que una portada con treinta videos no
 * vende mas, pesa mas. Doce son tres filas de cuatro en un ordenador.
 */
export const GALLERY_VIDEOS_MAX = 12;

/**
 * La galeria entera.
 *
 * ========================================================================
 * TODO CAMPO LLEVA `.default()`, Y ESO NO ES ADORNO
 * ========================================================================
 * El objeto es estricto: rechaza las claves que no conoce. Eso es
 * deliberado, para que una clave mal escrita no se quede guardada sin salir
 * nunca en la web.
 *
 * El precio de ser estricto es que AÑADIR UN CAMPO SIN VALOR POR DEFECTO
 * invalida de golpe todas las filas ya guardadas: la fila existente no tiene
 * el campo nuevo, el contrato la rechaza entera, y la galeria aparece vacia
 * sin que nadie haya borrado nada. Ya ocurrio con las tarifas y costo una
 * etapa entera arreglarlo (ver `docs/26-tabla-de-precios.md`).
 *
 * Con `.default()` en cada campo, la fila vieja se lee, se completa con el
 * valor de partida y sigue funcionando.
 */
export const GallerySchema = z.strictObject({
  videos: z
    .array(GalleryVideoSchema)
    .max(GALLERY_VIDEOS_MAX, `No caben mas de ${GALLERY_VIDEOS_MAX} videos`)
    .refine(
      (videos) => new Set(videos.map((v) => v.videoId)).size === videos.length,
      'Hay un video repetido',
    )
    .default([]),
  photos: z
    .array(GalleryPhotoSchema)
    .max(GALLERY_PHOTOS_MAX, `No caben mas de ${GALLERY_PHOTOS_MAX} fotos`)
    .refine(
      (photos) => new Set(photos.map((p) => p.path)).size === photos.length,
      'Hay una foto repetida',
    )
    .default([]),
});
export type Gallery = z.infer<typeof GallerySchema>;

/**
 * La galeria vacia: lo que se sirve mientras nadie haya configurado nada, y
 * tambien si la fila no se puede leer.
 *
 * LA SECCION NO SE PINTA SI ESTA VACIA, y eso es lo que queremos: la seccion
 * se puede desplegar antes de que exista un solo permiso firmado, porque
 * hasta que haya contenido no se ve.
 */
export const DEFAULT_GALLERY: Gallery = { videos: [], photos: [] };

/**
 * La galeria mas quien la cambio, para la pantalla de administracion.
 *
 * El dato publico no lleva autoria a proposito: quien puso un video es
 * informacion interna. Aqui si, porque es la pregunta que llega tarde — «quien
 * publico la casa de este cliente» — cuando alguien reclama.
 */
export const AdminGallerySchema = z.strictObject({
  gallery: GallerySchema,
  /**
   * La direccion de cada imagen del almacen —fotos y miniaturas—, por su ruta,
   * SOLO PARA LA VISTA PREVIA.
   *
   * Lo que el panel guarda sigue siendo la ruta: esto es un acompanamiento,
   * no parte de lo que se escribe. Va aparte y no dentro de cada foto
   * precisamente para que no se pueda confundir con un campo editable y
   * acabe mandandose de vuelta como si lo fuera.
   *
   * La compone el servidor, igual que para la web. El panel no construye
   * ninguna direccion.
   */
  imageUrls: z.record(z.string(), z.string().url()).default({}),
  /**
   * Las piezas que ESTAN GUARDADAS PERO NO SE PUBLICAN por no tener un
   * permiso firmado y en pie.
   *
   * SIN ESTO EL MODO ESTRICTO SERIA UNA TRAMPA: se sube una foto, se guarda,
   * se ve en el panel y no aparece en la web — y no hay forma de saber por
   * que. Con esto, la pantalla lo dice en la propia tarjeta.
   */
  uncovered: z
    .object({
      videoIds: z.array(z.string()).default([]),
      photoPaths: z.array(z.string()).default([]),
    })
    .default({ videoIds: [], photoPaths: [] }),
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
export type AdminGallery = z.infer<typeof AdminGallerySchema>;

/** Si hay algo que ensenar. */
export function hasGalleryContent(gallery: Gallery | PublicGallery): boolean {
  return gallery.videos.length > 0 || gallery.photos.length > 0;
}

/**
 * El titulo en el idioma que se esta leyendo, con el otro como respaldo.
 *
 * Devuelve `null` si no hay ninguno, y entonces la tarjeta se pinta sin
 * titulo. El respaldo cruzado es a proposito: un titulo escrito solo en
 * ingles es mas util que ningun titulo, incluso leyendo en espanol.
 */
export function galleryVideoTitle(
  video: GalleryVideo | PublicGalleryVideo,
  locale: 'en' | 'es',
): string | null {
  const otro = locale === 'en' ? 'es' : 'en';
  return video.title[locale] ?? video.title[otro] ?? null;
}

// ---------------------------------------------------------------------------
// Lo que ve el sitio publico
// ---------------------------------------------------------------------------

/*
 * LO QUE SIGUE NO ES ESTRICTO, Y ESO ES DELIBERADO
 * ================================================
 * Todo lo de arriba —lo que se GUARDA y lo que el panel ESCRIBE— es
 * `strictObject`, y tiene que seguir siendolo: una clave mal escrita no puede
 * quedarse en la base sin salir nunca en la web.
 *
 * Lo de aqui abajo es lo que el navegador LEE, y ahi ser estricto es un fallo.
 * Costo un incidente descubrirlo:
 *
 *   La API empezo a devolver las fotos. Los navegadores que todavia tenian la
 *   version anterior de la web recibieron una respuesta con dos claves que su
 *   contrato no conocia —`photos` y `posterUrl`—, la descartaron ENTERA, y la
 *   seccion de antes y despues desaparecio de la portada: videos incluidos, y
 *   sin un solo error visible, porque el sitio esta programado para no
 *   romperse cuando la API no responde.
 *
 * La web y la API se despliegan por separado, asi que esa ventana existe en
 * CADA despliegue. `z.object` ignora lo que no conoce: una version vieja de la
 * web sigue funcionando con una API nueva, simplemente sin usar lo que no
 * entiende.
 */

/**
 * LA GALERIA TAL Y COMO LA RECIBE LA WEB: CON DIRECCIONES, NO CON RUTAS.
 *
 * ========================================================================
 * POR QUE DOS FORMAS DE LA MISMA COSA
 * ========================================================================
 * Guardado vive la RUTA dentro del almacen (`photos/abc….webp`), porque es lo
 * unico que el panel puede escribir sin poder apuntar a otro sitio. Pintar
 * necesita una DIRECCION completa.
 *
 * La direccion la compone EL SERVIDOR, que es el unico que sabe donde esta el
 * almacen. La alternativa —mandar la ruta y que la web le pegue delante un
 * dominio suyo— pondria ese dominio en dos sitios que tendrian que coincidir
 * para siempre, y ya sabemos como acaba eso: es exactamente el fallo de la
 * sede, donde la web anunciaba una ciudad y el cotizador media desde otra.
 *
 * La web no construye ninguna direccion: usa la que recibe. Y la politica de
 * seguridad de contenido sigue siendo el muro, porque fija el unico origen
 * desde el que el navegador cargara una imagen.
 */
export const PublicGalleryPhotoSchema = z.object({
  url: z.string().url(),
  title: GalleryTitleSchema,
});
export type PublicGalleryPhoto = z.infer<typeof PublicGalleryPhotoSchema>;

/**
 * Un video tal y como lo recibe la web: con la DIRECCION de su miniatura.
 *
 * Mismo motivo que con las fotos: guardada vive la ruta, porque es lo unico
 * que el panel puede escribir sin poder apuntar a otro sitio, y la direccion
 * la compone el servidor.
 */
export const PublicGalleryVideoSchema = z.object({
  videoId: YouTubeVideoIdSchema,
  title: GalleryTitleSchema,
  posterUrl: z.string().url().nullable(),
});
export type PublicGalleryVideo = z.infer<typeof PublicGalleryVideoSchema>;

export const PublicGallerySchema = z.object({
  videos: z.array(PublicGalleryVideoSchema).default([]),
  photos: z.array(PublicGalleryPhotoSchema).default([]),
});
export type PublicGallery = z.infer<typeof PublicGallerySchema>;

export const DEFAULT_PUBLIC_GALLERY: PublicGallery = { videos: [], photos: [] };

/** Lo que devuelve la subida de una foto: donde quedo y como se ve. */
export const GalleryPhotoUploadSchema = z.strictObject({
  path: z.union([GalleryPhotoPathSchema, GalleryPosterPathSchema]),
  url: z.string().url(),
});
export type GalleryPhotoUpload = z.infer<typeof GalleryPhotoUploadSchema>;

/**
 * El titulo de una foto en el idioma en curso, con el otro como respaldo.
 *
 * Misma regla que con los videos: un titulo escrito solo en ingles es mas
 * util que ningun titulo, incluso leyendo en espanol.
 */
export function galleryPhotoTitle(photo: PublicGalleryPhoto, locale: 'en' | 'es'): string | null {
  const otro = locale === 'en' ? 'es' : 'en';
  return photo.title[locale] ?? photo.title[otro] ?? null;
}
