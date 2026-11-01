import { useState, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Locale } from '@freshness/types';
import { supportedLocales } from '@freshness/i18n';
import { cambiarIdioma } from '../i18n';
import { destinoPara, rutaPara } from '../lib/rutas';
import { GlobeIcon } from './Icons';

const NOMBRE_IDIOMA: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
};

/**
 * Selector de idioma.
 *
 * Con solo dos idiomas, un control que alterna ocupa la mitad que dos y deja
 * sitio en una cabecera de movil, donde cada pixel cuenta. Muestra el idioma
 * ACTIVO junto al globo; la etiqueta accesible dice a cual cambia, que es la
 * informacion que necesita quien no ve el icono.
 *
 * ==========================================================================
 * ES UN ENLACE DE VERDAD, Y ANTES ERA UN BOTON
 * ==========================================================================
 * Lo destapo Google Search Console, en la ficha de `/es`:
 *
 *     Pagina de referencia: No se ha detectado ninguna
 *
 * Y era literalmente cierto. Con un `<button>` que cambia la direccion por
 * JavaScript, **no habia un solo enlace en toda la web apuntando a `/es`**.
 * Para una persona funcionaba perfectamente; para un rastreador, la version
 * en espanol no estaba enlazada desde ningun sitio.
 *
 * No la dejaba invisible —el `sitemap.xml` y el `hreflang` la anuncian
 * igual— pero una pagina a la que no enlaza nada desde dentro se rastrea
 * tarde y se posiciona peor. Y el coste no era solo de buscadores: un boton
 * no se puede abrir en una pestana nueva, ni copiar con el boton derecho, ni
 * abrir con el boton central del raton. Tres gestos que cualquiera espera de
 * algo que lleva a otra pagina.
 *
 * ==========================================================================
 * PERO SIGUE SIN RECARGAR
 * ==========================================================================
 * El `href` es real y el rastreador lo sigue. Una persona que lo pulsa NO
 * navega: se intercepta el evento y se cambia el idioma en el sitio, como
 * antes. El motivo es el de siempre (ver `cambiarIdioma` en `i18n.ts`):
 * alguien a mitad del formulario de reserva, con el tamano de su casa y su
 * fecha ya puestos, no puede perder lo escrito por pulsar aqui.
 *
 * SE INTERCEPTA SOLO LA PULSACION NORMAL. Con Ctrl, Cmd, Shift, Alt o el
 * boton central, se deja pasar: quien pide expresamente «abre esto en otra
 * pestana» quiere eso, y robarle el gesto para hacer algo distinto en la
 * pestana actual es peor que no tener el enlace.
 */
export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const actual = (i18n.resolvedLanguage ?? 'en') as Locale;
  const siguiente: Locale = supportedLocales.find((locale) => locale !== actual) ?? 'en';

  /*
   * LA PANTALLA SE GUARDA AL MONTAR Y NO SE LEE EN CADA PINTADO.
   *
   * Hace falta para construir el `href`, y leerla en el cuerpo del componente
   * ataria el marcado a `window.location`, que cambia sin avisar a React
   * cuando `cambiarIdioma` usa `pushState`. Guardada una vez, el enlace
   * apunta siempre a la pantalla que se esta viendo — y la pantalla no
   * cambia sin recargar, porque las cuatro direcciones del sitio son fijas.
   */
  const [pantalla] = useState(() => destinoPara(window.location.pathname).pantalla);
  const destino = rutaPara(pantalla, siguiente);

  const alPulsar = (evento: MouseEvent<HTMLAnchorElement>): void => {
    /*
     * Ctrl/Cmd para pestana nueva, Shift para ventana nueva, Alt para
     * descargar, y cualquier boton que no sea el principal. En todos esos
     * casos el navegador hace lo correcto por su cuenta.
     */
    if (evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey) return;
    if (evento.button !== 0) return;

    evento.preventDefault();
    cambiarIdioma(siguiente, pantalla);
  };

  return (
    <a
      href={destino}
      onClick={alPulsar}
      /*
       * `lang` y `hreflang` dicen cosas distintas y las dos hacen falta:
       * `lang` es el idioma del TEXTO del propio enlace («EN»), y `hreflang`
       * el de la pagina a la que lleva. Sin `hreflang`, un lector de pantalla
       * no puede avisar de que el destino esta en otro idioma.
       */
      lang={actual}
      hrefLang={siguiente}
      title={`${NOMBRE_IDIOMA[actual]} → ${NOMBRE_IDIOMA[siguiente]}`}
      aria-label={`Change language to ${NOMBRE_IDIOMA[siguiente]}`}
      className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5
                 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100
                 dark:border-night-600 dark:text-slate-200 dark:hover:bg-night-700"
    >
      <GlobeIcon className="h-4 w-4 text-brand-700 dark:text-brand-300" />
      <span className="uppercase">{actual}</span>
    </a>
  );
}
