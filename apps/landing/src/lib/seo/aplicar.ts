import type { Locale } from '@freshness/types';
import type { Alternativa } from './etiquetas';
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_WIDTH,
  OG_LOCALE,
  type EtiquetasSeo,
} from './etiquetas';
import { urlAbsoluta } from './sitio';

/**
 * LA UNICA PARTE QUE ESCRIBE EN LA CABECERA DEL DOCUMENTO
 * =======================================================
 * Deliberadamente tonta. Recibe lo que hay que poner —ya decidido por
 * `etiquetas.ts`, que es puro y se prueba— y lo pone.
 *
 * ==========================================================================
 * POR QUE NO SE USA UNA LIBRERIA
 * ==========================================================================
 * `react-helmet` y compania resuelven un problema que este sitio no tiene:
 * componentes anidados que cada uno aporta su trozo de cabecera, con
 * prioridades y limpieza al desmontar. Aqui hay CUATRO pantallas, una sola
 * esta montada a la vez, y las etiquetas se deciden en un unico sitio.
 * Veinte kilobytes en la pagina que genera los ingresos por eso no sale.
 *
 * ==========================================================================
 * SE MODIFICA LO QUE YA HAY EN `index.html`, NO SE ANADE AL LADO
 * ==========================================================================
 * `index.html` trae las etiquetas de la PORTADA escritas a mano. Eso no es
 * una duplicacion: es lo que ve un rastreador que no ejecuta JavaScript —el
 * de WhatsApp y el de Facebook no lo ejecutan— y por eso tienen que estar en
 * el HTML servido.
 *
 * Esta funcion REESCRIBE esas mismas etiquetas cuando la pantalla es otra. Si
 * en vez de reescribir anadiera un segundo `<meta name="description">`, el
 * documento tendria dos y cual gana no esta definido.
 */

/** Busca un `<meta>` por su `name` o su `property`, y lo crea si no estaba. */
function meta(clave: string, esPropiedad: boolean): HTMLMetaElement {
  const atributo = esPropiedad ? 'property' : 'name';
  const existente = document.head.querySelector<HTMLMetaElement>(`meta[${atributo}="${clave}"]`);
  if (existente) return existente;

  const creada = document.createElement('meta');
  creada.setAttribute(atributo, clave);
  document.head.append(creada);
  return creada;
}

function ponerMeta(clave: string, valor: string, esPropiedad = false): void {
  meta(clave, esPropiedad).setAttribute('content', valor);
}

/** Quita un `<meta>` si existe. Hace falta para el `robots`: ver abajo. */
function quitarMeta(clave: string): void {
  document.head.querySelector(`meta[name="${clave}"]`)?.remove();
}

function ponerEnlace(rel: string, href: string | null): void {
  const existente = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);

  if (href === null) {
    existente?.remove();
    return;
  }

  const nodo = existente ?? document.createElement('link');
  nodo.setAttribute('rel', rel);
  nodo.setAttribute('href', href);
  if (!existente) document.head.append(nodo);
}

/**
 * Reescribe el juego completo de `<link rel="alternate" hreflang>`.
 *
 * ========================================================================
 * SE BORRAN TODOS Y SE VUELVEN A PONER, EN VEZ DE AJUSTARLOS
 * ========================================================================
 * Al pasar de una pagina indexable al 404, el juego nuevo esta VACIO. Si solo
 * se actualizaran los que coinciden, el 404 se quedaria con los `hreflang` de
 * la pagina anterior, declarando como traducciones suyas dos direcciones que
 * son de otra pagina. Borrar y poner es mas corto y no tiene ese estado
 * intermedio.
 */
function ponerAlternativas(alternativas: readonly Alternativa[]): void {
  for (const viejo of document.head.querySelectorAll('link[rel="alternate"][hreflang]')) {
    viejo.remove();
  }

  for (const alternativa of alternativas) {
    const nodo = document.createElement('link');
    nodo.setAttribute('rel', 'alternate');
    nodo.setAttribute('hreflang', alternativa.hreflang);
    nodo.setAttribute('href', alternativa.href);
    document.head.append(nodo);
  }
}

/**
 * Aplica las etiquetas de una pantalla.
 *
 * `urlActual` se recibe en vez de leer `window.location`: la direccion
 * canonica y la que el visitante tiene en la barra no son siempre la misma
 * —parametros de campana, barra final— y el `og:url` tiene que ser la
 * canonica, no la que trae el visitante. Cuando no hay canonica (pantallas
 * sin indexar) se cae a la de verdad, porque `og:url` vacio rompe la vista
 * previa.
 */
export function aplicarEtiquetas(
  etiquetas: EtiquetasSeo,
  locale: Locale,
  sitio: string,
  urlActual: string,
): void {
  document.title = etiquetas.title;
  document.documentElement.lang = locale;

  ponerMeta('description', etiquetas.description);
  ponerEnlace('canonical', etiquetas.canonical);
  ponerAlternativas(etiquetas.alternativas);

  /*
   * EL `robots` SE QUITA, NO SE PONE A `index`.
   *
   * `index, follow` es el comportamiento por omision: escribirlo no aporta
   * nada. Lo que importa es que al volver de una pantalla sin indexar a una
   * indexable el `noindex` DESAPAREZCA. Dejarlo puesto a `index` funcionaria
   * igual, pero deja basura en la cabecera de todas las paginas para cubrir
   * un caso que casi no ocurre.
   */
  if (etiquetas.robots === null) quitarMeta('robots');
  else ponerMeta('robots', etiquetas.robots);

  const url = etiquetas.canonical ?? urlActual;
  const imagen = urlAbsoluta(sitio, OG_IMAGE_PATH);

  ponerMeta('og:type', etiquetas.ogType, true);
  ponerMeta('og:url', url, true);
  ponerMeta('og:title', etiquetas.title, true);
  ponerMeta('og:description', etiquetas.description, true);
  ponerMeta('og:locale', OG_LOCALE[locale], true);
  ponerMeta('og:image', imagen, true);
  ponerMeta('og:image:width', String(OG_IMAGE_WIDTH), true);
  ponerMeta('og:image:height', String(OG_IMAGE_HEIGHT), true);

  /*
   * `summary_large_image` y no `summary`: con `summary` la imagen sale en un
   * cuadrado pequeno al lado del texto, y la nuestra es un rectangulo de
   * 1200x630 que quedaria recortado por los lados.
   */
  ponerMeta('twitter:card', 'summary_large_image');
  ponerMeta('twitter:title', etiquetas.title);
  ponerMeta('twitter:description', etiquetas.description);
  ponerMeta('twitter:image', imagen);
}
