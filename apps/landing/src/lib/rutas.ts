import { LEGAL_PATHS, REMOVAL_LINK_PATH, type Locale } from '@freshness/types';
import { defaultLocale } from '@freshness/i18n';

/**
 * QUE PANTALLA Y QUE IDIOMA LE TOCAN A CADA DIRECCION
 * ===================================================
 * Una funcion pura y no un `if` dentro del componente, por un motivo que
 * costo una tarde: **las rutas nuevas no funcionaban en produccion**.
 *
 * `/terms` y `/privacy` existian en el codigo y respondian 404 en el sitio
 * real, porque `vercel.json` solo reescribia `/retirar-fotos` hacia
 * `index.html`. Vercel busca un archivo llamado `terms`, no lo encuentra y
 * contesta su propio 404: el JavaScript no llega a ejecutarse nunca.
 *
 * En local no se ve, porque el servidor de Vite sirve `index.html` para todo.
 * Esa es exactamente la clase de fallo que una prueba de interfaz tampoco
 * habria pillado: no estaba en la aplicacion, estaba delante de ella.
 *
 * Ahora `vercel.json` reescribe TODO hacia `index.html` y es esta funcion la
 * que decide, incluido el 404. Una lista, un sitio, y una prueba que la
 * recorre.
 *
 * ==========================================================================
 * Y DESDE EL SEO, TAMBIEN DECIDE EL IDIOMA
 * ==========================================================================
 * El idioma vivia SOLO en `localStorage` y en `navigator.language`. Eso
 * significa que habia UNA direccion sirviendo dos idiomas segun quien
 * entrara, y para un buscador eso tiene una consecuencia concreta y mala:
 * **el contenido en espanol no existia**. No estaba mal posicionado: no habia
 * ninguna direccion que indexar con el, asi que no podia aparecer en ninguna
 * busqueda en espanol. En Georgia, con una clientela latina, eso es perder la
 * mitad del mercado al que la web ya habla.
 *
 * Ahora el idioma esta en la direccion, y lo decide ESTA funcion:
 *
 *   /            -> portada en ingles
 *   /es          -> portada en espanol
 *   /terms       -> condiciones en ingles
 *   /es/terms    -> condiciones en espanol
 *
 * EL INGLES NO LLEVA PREFIJO, y es deliberado: `/terms` ya esta en correos
 * enviados, en el pie de la web y posiblemente en algun enlace de fuera.
 * Mover el ingles a `/en/terms` habria roto todo eso para no ganar nada.
 */
export type Pantalla = 'sitio' | 'retirarFotos' | 'terms' | 'privacy' | 'noEncontrada';

/**
 * El prefijo de cada idioma en la direccion.
 *
 * El idioma por omision va sin prefijo. Ver arriba.
 */
export const PREFIJO_DE_IDIOMA: Record<Locale, string> = {
  en: '',
  es: '/es',
};

/** Las direcciones que no son la portada. El resto es 404. */
const PANTALLAS: Record<string, Pantalla> = {
  [REMOVAL_LINK_PATH]: 'retirarFotos',
  [LEGAL_PATHS.terms]: 'terms',
  [LEGAL_PATHS.privacy]: 'privacy',
};

export interface Destino {
  pantalla: Pantalla;
  /**
   * El idioma que pide la direccion, o `null` si la direccion no lo dice.
   *
   * ======================================================================
   * `null` NO ES «INGLES», Y LA DIFERENCIA IMPORTA
   * ======================================================================
   * `/retirar-fotos` no lleva prefijo de idioma y no va a llevarlo: su enlace
   * esta dentro de correos ya enviados, y cambiar la direccion los romperia.
   * Para esa pantalla sigue mandando lo de siempre —lo guardado, luego el
   * navegador—, que es lo correcto: es una pantalla de tramite, no se indexa,
   * y quien llega a ella quiere leerla en SU idioma, no en el del enlace.
   *
   * Si `null` fuera «ingles», una clienta hispanohablante que pulsa el enlace
   * de retirada en un correo que recibio en espanol se encontraria la
   * pantalla en ingles.
   */
  locale: Locale | null;
}

/**
 * Separa el prefijo de idioma de la direccion, si lo lleva.
 *
 * Devuelve el resto SIN el prefijo, para que la tabla de pantallas siga
 * siendo una sola y no haya que repetir cada ruta por idioma.
 */
function partirIdioma(ruta: string): { locale: Locale | null; resto: string } {
  for (const [locale, prefijo] of Object.entries(PREFIJO_DE_IDIOMA) as [Locale, string][]) {
    if (prefijo === '') continue;

    /*
     * `=== prefijo` cubre `/es` a secas (la portada en espanol) y
     * `startsWith(prefijo + '/')` el resto. Comprobar solo `startsWith(prefijo)`
     * seria un fallo: `/espanol-algo` empieza por `/es` y no es espanol.
     */
    if (ruta === prefijo) return { locale, resto: '' };
    if (ruta.startsWith(`${prefijo}/`)) return { locale, resto: ruta.slice(prefijo.length) };
  }

  return { locale: null, resto: ruta };
}

/** La pantalla y el idioma de una direccion. */
export function destinoPara(pathname: string): Destino {
  /*
   * LA BARRA DEL FINAL NO CUENTA: `/terms` y `/terms/` son la misma pagina, y
   * un enlace pegado en un correo lleva la barra la mitad de las veces.
   */
  const ruta = pathname.replace(/\/+$/, '');
  const { locale, resto } = partirIdioma(ruta);

  if (resto === '') return { pantalla: 'sitio', locale };

  const pantalla = PANTALLAS[resto];

  /*
   * `/es/retirar-fotos` NO EXISTE, y no es un descuido: esa pantalla vive
   * fuera del prefijo porque su direccion esta en correos ya enviados. Si se
   * aceptara aqui habria dos direcciones para la misma pantalla de tramite, y
   * la de dentro del prefijo no estaria en ningun correo.
   */
  if (pantalla === undefined || (locale !== null && pantalla === 'retirarFotos')) {
    return { pantalla: 'noEncontrada', locale };
  }

  return { pantalla, locale };
}

/**
 * Solo la pantalla.
 *
 * Se conserva porque es lo que casi todo el codigo necesita y leerlo asi es
 * mas claro que `destinoPara(x).pantalla` en cada sitio.
 */
export function pantallaPara(pathname: string): Pantalla {
  return destinoPara(pathname).pantalla;
}

/**
 * Si esa pantalla tiene una direccion propia por idioma.
 *
 * Solo hay una que no: `/retirar-fotos`. Su direccion esta dentro de correos
 * ya enviados, asi que no puede llevar prefijo ni tener una segunda version.
 */
export function tieneDireccionPorIdioma(pantalla: Pantalla): boolean {
  return pantalla !== 'retirarFotos';
}

/**
 * EL IDIOMA QUE LA DIRECCION PIDE DE VERDAD.
 *
 * ==========================================================================
 * NO ES LO MISMO QUE `destinoPara(...).locale`, Y LA DIFERENCIA ERA UN FALLO
 * ==========================================================================
 * `destinoPara` devuelve `null` cuando la direccion no lleva prefijo, porque
 * lo que contesta es «¿que dice el prefijo?». Y eso hizo que la flecha de
 * atras se quedara a medias: al volver de `/es` a `/`, la direccion no lleva
 * prefijo, el sincronizador leia `null`, decidia «la direccion no dice nada»
 * y dejaba el texto en espanol. LA BARRA DECIA `/` Y LA PAGINA ESTABA EN
 * ESPANOL — y si en ese momento alguien comparte el enlace, el otro abre algo
 * distinto de lo que se estaba viendo.
 *
 * La realidad es que `/` SI dice su idioma: dice ingles, porque el idioma por
 * omision es el que no lleva prefijo. Lo unico de verdad indeciso es la
 * pantalla que no tiene direccion por idioma.
 *
 * Esta funcion contesta la pregunta util: «¿en que idioma hay que pintar
 * esto?». `null` solo para `/retirar-fotos`, donde manda la persona.
 */
export function idiomaDeLaUrl(pathname: string): Locale | null {
  const destino = destinoPara(pathname);

  if (destino.locale !== null) return destino.locale;

  return tieneDireccionPorIdioma(destino.pantalla) ? defaultLocale : null;
}

/**
 * La direccion de una pantalla en un idioma.
 *
 * Es la inversa de `destinoPara`, y existe para que el selector de idioma y
 * las etiquetas `hreflang` no construyan direcciones a mano. Una ruta
 * concatenada en tres sitios distintos es una ruta que acaba siendo distinta
 * en uno de los tres.
 */
export function rutaPara(pantalla: Pantalla, locale: Locale): string {
  const prefijo = PREFIJO_DE_IDIOMA[locale];

  if (pantalla === 'sitio') return prefijo === '' ? '/' : prefijo;

  /*
   * Las pantallas sin direccion propia (el 404) y la de retirada caen a la
   * portada del idioma pedido. Para el 404 es lo unico sensato: no tiene
   * direccion canonica. Para la retirada, su direccion es fija y sin prefijo.
   */
  if (pantalla === 'retirarFotos') return REMOVAL_LINK_PATH;
  if (pantalla === 'noEncontrada') return prefijo === '' ? '/' : prefijo;

  return `${prefijo}${LEGAL_PATHS[pantalla]}`;
}
