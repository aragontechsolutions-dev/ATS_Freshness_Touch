import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * TIENE QUE HABER UN ENLACE DE VERDAD HACIA EL OTRO IDIOMA
 * ========================================================
 * Esta prueba existe por un fallo que **lo encontró Google**, no yo. En la
 * ficha de `/es` en Search Console:
 *
 *     Página de referencia: No se ha detectado ninguna
 *
 * Y era literalmente cierto. El selector de idioma era un `<button>` que
 * cambiaba la dirección con `pushState`, así que **no había un solo enlace en
 * toda la web apuntando a `/es`**.
 *
 * ==========================================================================
 * POR QUE NO SE VE, Y POR QUE IMPORTA
 * ==========================================================================
 * Para una persona el botón funcionaba perfectamente: se pulsa y el sitio
 * cambia de idioma. El fallo solo existe para quien no ejecuta JavaScript o
 * para quien lee el marcado buscando enlaces — es decir, para los
 * rastreadores. No da error, no sale en ningún registro, y la pantalla se ve
 * bien.
 *
 * No dejaba la versión en español invisible —el `sitemap.xml` y el `hreflang`
 * la anuncian igual— pero una página a la que no enlaza nada desde dentro se
 * rastrea tarde y se posiciona peor.
 *
 * Y había un coste que no era de buscadores: un botón no se puede abrir en
 * una pestaña nueva, ni copiar con el botón derecho, ni abrir con el botón
 * central. Tres gestos que cualquiera espera de algo que lleva a otra página.
 *
 * ==========================================================================
 * QUE SE VIGILA, Y QUE NO
 * ==========================================================================
 * Se lee el fuente. Las pruebas de este sitio corren en Node sin DOM a
 * propósito, y lo que puede volver a romperse es una decisión de marcado
 * —`<a href>` frente a `<button>`— que se ve perfectamente en el texto. Lo
 * que NO se puede comprobar así es que el enlace lleve al sitio correcto;
 * de eso se encarga `rutas.test.ts`, que prueba `rutaPara` directamente.
 */

const FUENTE = readFileSync(join(import.meta.dirname, 'LanguageSwitcher.tsx'), 'utf8');

/** El fuente sin comentarios: este archivo DOCUMENTA el fallo que vigila. */
const CODIGO = FUENTE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('el selector de idioma', () => {
  it('ES UN ENLACE, no un botón', () => {
    expect(CODIGO).toContain('<a');
    expect(CODIGO).not.toContain('<button');
  });

  it('su destino sale de `rutaPara`, no de una cadena escrita a mano', () => {
    /*
     * Con `href="/es"` escrito a mano, el selector llevaría a la portada
     * española desde CUALQUIER pantalla: quien esté leyendo las condiciones
     * en inglés y pulse, perdería la página en la que estaba.
     */
    expect(CODIGO).toContain('rutaPara(');
    expect(CODIGO).toMatch(/href=\{destino\}/);
  });

  it('declara el idioma del DESTINO con `hrefLang`', () => {
    // `lang` es el idioma del texto del enlace; `hrefLang`, el de la página a
    // la que lleva. Sin el segundo, un lector de pantalla no puede avisar de
    // que el destino está en otro idioma.
    expect(CODIGO).toContain('hrefLang=');
  });

  it('NO SE ROBA la pulsación con Ctrl, Cmd, Shift, Alt ni el botón central', () => {
    /*
     * Quien pide expresamente «abre esto en otra pestaña» quiere eso. Un
     * `preventDefault` incondicional convierte el enlace recién puesto en el
     * mismo botón de antes para esos gestos.
     */
    for (const tecla of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey']) {
      expect(CODIGO).toContain(tecla);
    }
    expect(CODIGO).toContain('evento.button !== 0');
  });

  it('la pulsación normal SÍ se intercepta: no debe recargar', () => {
    /*
     * Es la otra mitad. Recargar perdería lo que alguien lleve escrito en el
     * formulario de reserva, que es por lo que `cambiarIdioma` usa
     * `pushState` (ver `i18n.ts`).
     */
    expect(CODIGO).toContain('preventDefault()');
    expect(CODIGO).toContain('cambiarIdioma(');
  });
});
