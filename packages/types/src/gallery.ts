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
});
export type GalleryVideo = z.infer<typeof GalleryVideoSchema>;

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
export const DEFAULT_GALLERY: Gallery = { videos: [] };

/**
 * La galeria mas quien la cambio, para la pantalla de administracion.
 *
 * El dato publico no lleva autoria a proposito: quien puso un video es
 * informacion interna. Aqui si, porque es la pregunta que llega tarde — «quien
 * publico la casa de este cliente» — cuando alguien reclama.
 */
export const AdminGallerySchema = z.strictObject({
  gallery: GallerySchema,
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
});
export type AdminGallery = z.infer<typeof AdminGallerySchema>;

/** Si hay algo que ensenar. */
export function hasGalleryContent(gallery: Gallery): boolean {
  return gallery.videos.length > 0;
}

/**
 * El titulo en el idioma que se esta leyendo, con el otro como respaldo.
 *
 * Devuelve `null` si no hay ninguno, y entonces la tarjeta se pinta sin
 * titulo. El respaldo cruzado es a proposito: un titulo escrito solo en
 * ingles es mas util que ningun titulo, incluso leyendo en espanol.
 */
export function galleryVideoTitle(video: GalleryVideo, locale: 'en' | 'es'): string | null {
  const otro = locale === 'en' ? 'es' : 'en';
  return video.title[locale] ?? video.title[otro] ?? null;
}
