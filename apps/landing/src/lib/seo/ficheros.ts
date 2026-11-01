import {
  IDIOMAS,
  PAGINAS_INDEXABLES,
  RUTAS_PRIVADAS,
  rutaDe,
  type PaginaIndexable,
} from './paginas';
import { normalizarSitio, urlAbsoluta } from './sitio';
import type { Locale } from '@freshness/types';

/**
 * `robots.txt` Y `sitemap.xml`, GENERADOS EN EL BUILD
 * ===================================================
 * Dos ficheros de texto. Podrian estar escritos a mano en `public/`, y esa
 * fue la primera idea: son veinte lineas que no cambian casi nunca.
 *
 * ==========================================================================
 * POR QUE NO ESTAN EN `public/` ESCRITOS A MANO
 * ==========================================================================
 * Porque los dos llevan el dominio dentro, y el dominio no esta en el codigo:
 * llega por `VITE_SITE_URL` (ver `sitio.ts`). Un `sitemap.xml` escrito a mano
 * con el dominio dentro es la misma trampa que tenia el telefono en
 * `config/company.ts` antes de la Etapa 2.3 —un valor inventado esperando a
 * que alguien se acuerde— con el agravante de que aqui nadie lo mira nunca:
 * el dia que el dominio cambie, el `sitemap.xml` seguira apuntando al viejo y
 * no habra ningun sintoma visible.
 *
 * Y porque la lista de paginas ya existe en `paginas.ts`. Escrita dos veces,
 * se desincroniza en el primer cambio.
 *
 * ==========================================================================
 * SON FUNCIONES PURAS, Y EL ENCHUFE DE VITE ES CUATRO LINEAS
 * ==========================================================================
 * Todo lo que se puede equivocar —una barra doble, una fecha mal formada, una
 * ruta privada que se cuela en el sitemap— esta aqui y se prueba sin
 * compilar nada. Ver `vite-seo.ts` para el enchufe.
 */

/**
 * El contenido de `robots.txt`.
 *
 * ========================================================================
 * `Disallow` Y `noindex` NO SON LO MISMO, Y HACEN FALTA LOS DOS
 * ========================================================================
 *   - `Disallow` dice «no lo pidas». Evita el trafico, pero una direccion
 *     bloqueada todavia puede aparecer en los resultados si alguien la
 *     enlaza, porque el buscador nunca llego a leer el `noindex` de dentro.
 *   - `noindex` dice «no lo listes», y para leerlo hay que entrar.
 *
 * Aqui la pantalla de retirar fotos lleva las dos: `Disallow` para que no se
 * pida a lo tonto, y `noindex` en la propia pantalla para el caso de que
 * alguien la enlace. Ver `etiquetas.ts`.
 *
 * NO SE OCULTA NINGUN SECRETO AL LISTARLA AQUI. `robots.txt` es publico por
 * definicion, y el testigo de retirada viaja en el fragmento de la direccion,
 * que nunca sale del navegador. Lo que se evita es ruido, no una fuga.
 */
export function robotsTxt(sitio: string): string {
  const base = normalizarSitio(sitio);
  const prohibidas = RUTAS_PRIVADAS.map((ruta) => `Disallow: ${ruta}`).join('\n');

  return `# ${base}
#
# Generado en el build por vite-seo.ts. No se edita a mano: el dominio sale de
# VITE_SITE_URL y la lista de rutas privadas de lib/seo/paginas.ts.

User-agent: *
Allow: /
${prohibidas}

Sitemap: ${urlAbsoluta(base, '/sitemap.xml')}
`;
}

/**
 * La fecha en el formato que pide el `sitemap.xml`: solo el dia.
 *
 * Sin hora a proposito. La hora exacta de un despliegue no le dice nada a
 * nadie, y cambiarla en cada build hace que el fichero entero se vea
 * modificado todos los dias: un buscador que ve `lastmod` nuevo y contenido
 * idéntico aprende a desconfiar de ese dato.
 */
export function soloElDia(momento: Date): string {
  return momento.toISOString().slice(0, 10);
}

function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Las alternativas de idioma de una pagina, en el formato del sitemap.
 *
 * ========================================================================
 * CADA VERSION SE LISTA A SI MISMA, Y NO ES REDUNDANTE
 * ========================================================================
 * La especificacion de `hreflang` lo exige: el conjunto de alternativas tiene
 * que ser el MISMO en las dos versiones, incluida la propia. Si `/terms`
 * declarase solo a `/es/terms` y al contrario, cada una estaria diciendo «mi
 * alternativa es aquella» sin que ninguna confirme la relacion, y Google
 * descarta los grupos que no se confirman mutuamente.
 *
 * `x-default` apunta al INGLES, y es la respuesta a «y para quien no es ni
 * ingles ni espanol». No es «el idioma principal»: es la version que se
 * sirve cuando ninguna encaja.
 */
function alternativas(sitio: string, pagina: PaginaIndexable): string[] {
  const enlaces = IDIOMAS.map(
    (locale) =>
      `    <xhtml:link rel="alternate" hreflang="${locale}" ` +
      `href="${escaparXml(urlAbsoluta(sitio, rutaDe(pagina, locale)))}"/>`,
  );

  return [
    ...enlaces,
    `    <xhtml:link rel="alternate" hreflang="x-default" ` +
      `href="${escaparXml(urlAbsoluta(sitio, rutaDe(pagina, 'en')))}"/>`,
  ];
}

function entrada(sitio: string, pagina: PaginaIndexable, locale: Locale, dia: string): string {
  return [
    '  <url>',
    `    <loc>${escaparXml(urlAbsoluta(sitio, rutaDe(pagina, locale)))}</loc>`,
    ...alternativas(sitio, pagina),
    `    <lastmod>${dia}</lastmod>`,
    `    <changefreq>${pagina.frecuencia}</changefreq>`,
    `    <priority>${pagina.prioridad.toFixed(1)}</priority>`,
    '  </url>',
  ].join('\n');
}

/**
 * El contenido de `sitemap.xml`.
 *
 * La fecha se recibe, no se lee del reloj: asi la prueba no depende del dia
 * en que se ejecute, que es la forma mas tonta de tener una prueba que falla
 * sola a medianoche.
 */
export function sitemapXml(sitio: string, momento: Date): string {
  const dia = soloElDia(momento);

  /*
   * UNA ENTRADA POR PAGINA Y POR IDIOMA. Seis, no tres.
   *
   * Es lo que hace que `/es` exista para un buscador. Listando solo la
   * version inglesa y confiando en el `hreflang` de dentro, la espanola solo
   * se descubriria si alguien la enlaza desde fuera, que es justo lo que no
   * pasa con un sitio nuevo.
   */
  const urls = PAGINAS_INDEXABLES.flatMap((pagina) =>
    IDIOMAS.map((locale) => entrada(sitio, pagina, locale, dia)),
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}
