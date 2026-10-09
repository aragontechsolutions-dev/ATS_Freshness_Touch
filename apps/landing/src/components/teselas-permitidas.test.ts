import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * LAS TESELAS QUE PIDE EL CODIGO TIENEN QUE CABER EN LA CSP
 * =========================================================
 * Esta prueba compara dos archivos que nadie compara nunca: los mapas de
 * `src/components` y la cabecera `Content-Security-Policy` de `vercel.json`.
 *
 * ========================================================================
 * ESTE FALLO LLEGO A PRODUCCION
 * ========================================================================
 * El mapa del pin de la puerta se escribio con la URL de teselas clasica de
 * Leaflet, `https://{s}.tile.openstreetmap.org/...`, que la libreria expande
 * a `a.`, `b.` y `c.`. La CSP permite EXACTAMENTE `tile.openstreetmap.org`,
 * host literal y sin comodin, asi que el navegador bloqueo todas las
 * teselas y el mapa salio en gris con un cuadro vacio.
 *
 * Lo que lo hace peligroso es que NO SE VE VENIR:
 *
 *   - Los tipos no lo ven: es una cadena.
 *   - El lint no lo ve: es una cadena.
 *   - Las pruebas no lo veian: ninguna miraba la CSP.
 *   - EL NAVEGADOR EN LOCAL NO LO VE, porque en desarrollo no hay
 *     cabeceras. Solo aparece una vez desplegado.
 *
 * Y el mapa que ya existia —`ServiceAreaMap`— tenia la URL correcta. El
 * fallo fue escribir un segundo mapa sin copiar la del primero.
 *
 * Por eso la prueba no comprueba «que la URL sea esta»: comprueba que
 * CUALQUIER url de teselas del codigo este permitida por la CSP de verdad.
 * Asi sirve igual el dia que se cambie de proveedor de mapas o se añada un
 * tercer mapa.
 */

const COMPONENTES = new URL('.', import.meta.url).pathname;
const VERCEL_JSON = join(COMPONENTES, '../../vercel.json');

/** Los origenes que `img-src` permite, tal y como estan escritos. */
function origenesDeImagenPermitidos(): string[] {
  const config: unknown = JSON.parse(readFileSync(VERCEL_JSON, 'utf8'));

  const cabeceras = (config as { headers?: { headers?: { key: string; value: string }[] }[] })
    .headers;
  const csp = cabeceras
    ?.flatMap((entrada) => entrada.headers ?? [])
    .find((h) => h.key.toLowerCase() === 'content-security-policy')?.value;

  if (!csp) throw new Error('vercel.json no tiene cabecera Content-Security-Policy');

  const directiva = csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith('img-src'));

  if (!directiva) throw new Error('la CSP no tiene directiva img-src');

  return directiva.split(/\s+/).slice(1);
}

/** Todas las URL de teselas que pide el codigo, con su archivo. */
function teselasQuePideElCodigo(): { archivo: string; url: string }[] {
  const encontradas: { archivo: string; url: string }[] = [];

  for (const nombre of readdirSync(COMPONENTES)) {
    if (!nombre.endsWith('.tsx')) continue;
    const fuente = readFileSync(join(COMPONENTES, nombre), 'utf8');

    /*
     * Solo codigo: la cabecera de este archivo habla de URL incorrectas.
     *
     * Y SOLO LOS COMENTARIOS DE LINEA QUE EMPIEZAN LA LINEA. Quitar todo lo
     * que va detras de `//` se comia el `https://` de las propias URL que
     * hay que mirar, y la prueba leia basura. Paso de verdad al escribirla.
     */
    const sinComentarios = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    for (const coincidencia of sinComentarios.matchAll(/L\.tileLayer\(\s*'([^']+)'/g)) {
      encontradas.push({ archivo: nombre, url: coincidencia[1] ?? '' });
    }
  }

  return encontradas;
}

/** Si la CSP deja cargar esa URL. `{s}` cuenta como un subdominio real. */
function laPermiteLaCsp(url: string, permitidos: string[]): boolean {
  /*
   * `{s}` se sustituye por el subdominio que toque, asi que para decidir hay
   * que mirar el host YA EXPANDIDO. Se usa 'a', que es el primero que pide
   * Leaflet por defecto.
   */
  const host = new URL(url.replace('{s}', 'a')).host;

  return permitidos.some((permitido) => {
    if (permitido === "'self'" || permitido === 'data:') return false;

    const limpio = permitido.replace(/^https?:\/\//, '');
    if (limpio.startsWith('*.')) return host.endsWith(limpio.slice(1));
    return host === limpio;
  });
}

describe('los mapas y la CSP del sitio', () => {
  it('hay mapas que comprobar', () => {
    // Sin esto, borrar los mapas dejaria la prueba en verde sin mirar nada.
    expect(teselasQuePideElCodigo().length).toBeGreaterThan(0);
  });

  it('TODAS LAS TESELAS QUE PIDE EL CODIGO ESTAN PERMITIDAS', () => {
    const permitidos = origenesDeImagenPermitidos();

    const bloqueadas = teselasQuePideElCodigo().filter(
      ({ url }) => !laPermiteLaCsp(url, permitidos),
    );

    expect(
      bloqueadas,
      `Estas teselas las bloquearia el navegador EN PRODUCCION (en local no, ahi no hay ` +
        `cabeceras). La CSP de vercel.json permite: ${permitidos.join(' ')}`,
    ).toEqual([]);
  });

  it('y los mapas piden todos las mismas, para no volver a divergir', () => {
    /*
     * El fallo original fue escribir un segundo mapa sin copiar la URL del
     * primero. Mientras sean todas iguales, arreglar una arregla todas.
     */
    const distintas = new Set(teselasQuePideElCodigo().map(({ url }) => url));

    expect([...distintas]).toHaveLength(1);
  });
});
