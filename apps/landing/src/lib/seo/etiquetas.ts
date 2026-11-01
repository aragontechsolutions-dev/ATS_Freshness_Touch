import type { Locale } from '@freshness/types';
import type { Pantalla } from '../rutas';
import { IDIOMAS, paginaDe, rutaDe } from './paginas';
import { urlAbsoluta } from './sitio';

/**
 * EL TITULO, LA DESCRIPCION Y EL CANONICAL DE CADA PANTALLA
 * =========================================================
 * Hasta ahora las cuatro pantallas del sitio compartian las MISMAS etiquetas,
 * las que hay escritas en `index.html`:
 *
 *     «Freshness Touch · Cleaning Services in Georgia»
 *
 * Eso significa que en los resultados de busqueda las condiciones de servicio
 * y la politica de privacidad se anuncian como si fueran la portada de una
 * empresa de limpieza. Un buscador que ve tres direcciones distintas con el
 * mismo titulo y la misma descripcion tiene un nombre para eso, y no es
 * halagueno: contenido duplicado.
 *
 * ==========================================================================
 * DEVUELVE DATOS, NO TOCA EL DOCUMENTO
 * ==========================================================================
 * Aqui no hay un solo `document.`. Es una funcion pura que devuelve lo que
 * hay que poner, y quien lo pone es `aplicar.ts`. Dos motivos:
 *
 *   1. Las pruebas de este sitio corren en Node SIN DOM a proposito (ver
 *      `vitest.config.mts`). Una funcion que escribe en `document` no se
 *      podria probar aqui sin arrastrar `jsdom` al proyecto entero.
 *   2. Lo que se puede equivocar es el CONTENIDO —un canonical hacia la
 *      pagina equivocada, un `noindex` que falta— no la llamada a
 *      `setAttribute`.
 */

/** Nombre de la propiedad de Open Graph o del nombre de un `<meta>`. */
export interface EtiquetasSeo {
  title: string;
  description: string;
  /**
   * La direccion canonica, o `null` cuando la pantalla NO SE INDEXA.
   *
   * `null` y no la propia direccion: un `canonical` en una pagina con
   * `noindex` manda dos mensajes contrarios —«esta es la version buena» y «no
   * la listes»— y lo que hacen los buscadores con eso no esta definido.
   */
  canonical: string | null;
  /** El valor de `<meta name="robots">`, o `null` para el comportamiento normal. */
  robots: string | null;
  ogType: 'website' | 'article';
  /**
   * Las versiones en otros idiomas de ESTA pagina, para `hreflang`.
   *
   * ======================================================================
   * VACIO EN LAS PANTALLAS QUE NO SE INDEXAN, Y A PROPOSITO
   * ======================================================================
   * El 404 no tiene version en otro idioma: tiene un 404 en cada idioma, que
   * no es lo mismo. Declararlos como alternativas le estaria diciendo a
   * Google que son dos traducciones de la misma pagina, cuando lo que son es
   * dos direcciones que no existen.
   */
  alternativas: readonly Alternativa[];
}

/** Una version de la misma pagina en otro idioma. */
export interface Alternativa {
  /** `en`, `es` o `x-default`. */
  hreflang: string;
  href: string;
}

/**
 * El idioma en el formato que pide Open Graph: `en_US`, `es_ES`.
 *
 * Open Graph pide region y no solo idioma. `es_US` seria mas exacto para una
 * clientela latina en Georgia, pero no es uno de los valores que Facebook
 * reconoce, y un valor que no reconoce se ignora entero.
 */
export const OG_LOCALE: Record<Locale, string> = {
  en: 'en_US',
  es: 'es_ES',
};

/** La imagen que se ve al compartir el enlace. */
export const OG_IMAGE_PATH = '/brand/og-default.jpg';
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/**
 * Lo que le toca a cada pantalla.
 *
 * `t` se recibe en vez de llamar a i18next aqui dentro para que la funcion
 * siga siendo pura y se pueda probar con un diccionario de mentira, que es lo
 * que hace el resto de este proyecto (ver `textoDeFichaje` en el panel).
 */
export function etiquetasDePagina(
  pantalla: Pantalla,
  locale: Locale,
  sitio: string,
  t: (clave: string) => string,
): EtiquetasSeo {
  const pagina = paginaDe(pantalla);

  /*
   * LAS PANTALLAS QUE NO SE INDEXAN: el 404 y retirar fotos.
   *
   * ======================================================================
   * EL 404 DE UN SITIO ESTATICO CONTESTA 200, Y ESO NO SE PUEDE ARREGLAR AQUI
   * ======================================================================
   * `vercel.json` reescribe TODO hacia `index.html` —hizo falta para que
   * `/terms` y `/privacy` funcionaran, ver `rutas.ts`— asi que una direccion
   * mal escrita recibe un 200 con la pantalla de «no encontrada» dentro. Para
   * un buscador eso es un «soft 404»: una pagina que dice que existe y no
   * tiene contenido.
   *
   * El `noindex` es lo UNICO que impide que esas direcciones se indexen, y
   * por eso lleva tambien `follow`: los enlaces de la pantalla llevan a la
   * portada, y seguirlos es lo que se quiere.
   */
  if (!pagina) {
    return {
      title: t(`seo.${pantalla === 'retirarFotos' ? 'removal' : 'notFound'}.title`),
      description: t(`seo.${pantalla === 'retirarFotos' ? 'removal' : 'notFound'}.description`),
      canonical: null,
      robots: 'noindex, follow',
      ogType: 'website',
      alternativas: [],
    };
  }

  return {
    title: t(`seo.${pagina.claveSeo}.title`),
    description: t(`seo.${pagina.claveSeo}.description`),
    /*
     * EL CANONICO ES EL DE ESTE IDIOMA, no el del ingles.
     *
     * Es la mitad del sentido de toda la etapa: si `/es` declarase como
     * canonico `/`, le estaria diciendo a Google «la version buena es la
     * inglesa, no indexes esta» — y el contenido en espanol seguiria sin
     * existir, que es el problema que se venia a arreglar. Cada idioma es su
     * propia pagina canonica, y lo que los relaciona es `hreflang`.
     */
    canonical: urlAbsoluta(sitio, rutaDe(pagina, locale)),
    robots: null,
    /*
     * Las legales son `article` y la portada `website`. No cambia como se ven
     * al compartir: cambia que un documento con fecha y version no se anuncie
     * como si fuera el sitio entero.
     */
    ogType: pagina.pantalla === 'sitio' ? 'website' : 'article',
    alternativas: [
      ...IDIOMAS.map((otro) => ({
        hreflang: otro,
        href: urlAbsoluta(sitio, rutaDe(pagina, otro)),
      })),
      /* Para quien no es ni ingles ni espanol: la version inglesa. */
      { hreflang: 'x-default', href: urlAbsoluta(sitio, rutaDe(pagina, 'en')) },
    ],
  };
}
