/**
 * LA DIRECCION DEL SITIO, EN UN SOLO SITIO
 * ========================================
 * El dominio no se escribe en el codigo. Llega por `VITE_SITE_URL` y aqui se
 * normaliza, por el mismo motivo por el que `PUBLIC_SITE_URL` es `sync: false`
 * en `render.yaml`: el dominio estuvo en tramite durante meses y el sitio vivio
 * en una direccion de Vercel. Escribirlo en el fuente obligaba a un commit
 * para moverlo.
 *
 * ==========================================================================
 * POR QUE ESTO IMPORTA MAS QUE UN DETALLE DE CONFIGURACION
 * ==========================================================================
 * De este valor salen el `canonical`, el `sitemap.xml`, el `robots.txt` y las
 * etiquetas de compartir. Un dominio equivocado aqui no es un fallo pequeno:
 * es decirle a Google que la web buena es otra, y que esta es una copia. Se
 * arregla desplegando, pero mientras tanto el sitio se desindexa solo.
 *
 * Por eso la funcion es pura y se prueba: lo unico que no se puede probar es
 * el valor, y lo que si se puede es que una barra final o un espacio no
 * produzcan `https://ejemplo.com//sitemap.xml`.
 */

/**
 * El dominio de produccion, CON `www`.
 *
 * ========================================================================
 * EL `www` NO ES DECORATIVO, Y COSTO UNA EQUIVOCACION
 * ========================================================================
 * En Vercel, `freshnesstouchcleaning.com` figura como «Redirects to
 * www.freshnesstouchcleaning.com»: quien sirve el sitio es el `www`, y la
 * raiz solo redirige.
 *
 * La primera version de todo esto uso la raiz. Eso ponia un `canonical`
 * apuntando a una direccion que REDIRIGE, que es una senal contradictoria
 * —«la version buena es esta», y esa version contesta «no, es aquella»— y
 * dejaba un `sitemap.xml` con seis direcciones que ninguna servia contenido.
 *
 * Si algun dia se invierte la redireccion en Vercel, esto cambia aqui Y en
 * `index.html`, que lo lleva escrito a mano porque Open Graph exige
 * direcciones absolutas. Hay una prueba que falla si los dos no coinciden.
 *
 * Esta escrito aqui como VALOR POR OMISION y no como unica fuente: en un
 * despliegue de vista previa de Vercel o en local, `VITE_SITE_URL` no esta
 * puesta y lo correcto es seguir generando enlaces que apunten al sitio de
 * verdad —un `canonical` hacia produccion desde una vista previa es
 * exactamente lo que evita que Google indexe las vistas previas—.
 */
export const SITIO_POR_OMISION = 'https://www.freshnesstouchcleaning.com';

/**
 * Deja la direccion lista para pegarle rutas detras: sin barra final y sin
 * espacios.
 *
 * Devuelve el valor por omision cuando lo que llega no sirve. NO LANZA, y es
 * deliberado: esto corre al arrancar la pagina que genera los ingresos, y una
 * variable de entorno mal escrita no puede dejar la web en blanco. Lo peor
 * que puede pasar es un `canonical` hacia produccion, que es justo lo que se
 * quiere por omision.
 */
export function normalizarSitio(raw: string | undefined | null): string {
  const limpio = (raw ?? '').trim().replace(/\/+$/, '');

  /*
   * Se exige `https://` y no solo que parezca una URL. Un `canonical`
   * relativo o con `http://` no es equivalente a la pagina: anuncia otra
   * direccion, y en el mejor caso se ignora.
   */
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(limpio)) return SITIO_POR_OMISION;

  return limpio;
}

/**
 * Une el sitio con una ruta absoluta, sin barras dobles.
 *
 * LA PORTADA LLEVA BARRA FINAL Y LAS DEMAS NO, y las dos mitades de esa regla
 * tienen motivo:
 *
 *   - `https://sitio.com/` es la forma canonica de una raiz, y es la que
 *     escribe cualquier navegador al compartir la pagina. Sin la barra, el
 *     `canonical` y la direccion que la gente comparte serian dos cadenas
 *     distintas para la misma pagina.
 *   - En las demas, la barra final SOBRA y confunde: `pantallaPara` las
 *     ignora a proposito —`/terms` y `/terms/` son la misma pantalla— asi que
 *     anunciar la version con barra crearia una segunda direccion para algo
 *     que solo existe una vez.
 */
export function urlAbsoluta(sitio: string, ruta: string): string {
  const base = normalizarSitio(sitio);
  const camino = ruta.startsWith('/') ? ruta : `/${ruta}`;
  const sinBarra = camino.replace(/\/+$/, '');

  return sinBarra === '' ? `${base}/` : `${base}${sinBarra}`;
}
