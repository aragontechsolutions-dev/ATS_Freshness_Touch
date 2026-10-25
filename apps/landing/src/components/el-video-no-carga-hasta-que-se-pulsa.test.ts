import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { YOUTUBE_EMBED_ORIGIN, youTubeEmbedUrl } from '@freshness/types';

/**
 * EL VIDEO NO PIDE NADA A GOOGLE HASTA QUE EL VISITANTE PULSA
 * ==========================================================
 * Dos cosas tienen que seguir siendo verdad, y ninguna se ve mirando la
 * pagina:
 *
 *   1. QUE EL MARCO QUEPA EN LA CSP. El origen lo decide el codigo, en
 *      `@freshness/types`; la cabecera vive en `vercel.json`. Son dos
 *      archivos distintos, y el dia que alguien cambie uno el video deja de
 *      verse —o peor, se ve en desarrollo y no en produccion, que es donde
 *      no hay cabecera—. Es el mismo fallo que ya paso con las teselas del
 *      mapa.
 *
 *   2. QUE NO SE PIDA NADA ANTES DEL CLIC. El sitio no pone ni una cookie, y
 *      eso esta escrito como punto fuerte en el dossier legal. Un marco de
 *      YouTube cargado de entrada se lo lleva por delante: «nocookie»
 *      retiene las cookies, pero las pruebas independientes encuentran que
 *      escribe un identificador en el navegador y manda la IP al cargar,
 *      antes de que nadie pulse play. La miniatura de YouTube
 *      (`i.ytimg.com`) seria exactamente la misma peticion por otra puerta,
 *      asi que tampoco se usa.
 *
 * Si alguien «mejora» la tarjeta poniendo la miniatura de YouTube, o carga el
 * marco de entrada para que se vea mas bonito, esto se pone rojo.
 */

const RAIZ_WEB = join(import.meta.dirname, '../..');
const RAIZ_FUENTE = join(import.meta.dirname, '..');

const FACHADA = readFileSync(join(RAIZ_FUENTE, 'components/VideoFacade.tsx'), 'utf8');
const SECCION = readFileSync(join(RAIZ_FUENTE, 'sections/Gallery.tsx'), 'utf8');

/**
 * El codigo sin sus comentarios.
 *
 * Hace falta porque lo que esta prueba prohibe son DOMINIOS USADOS, y los
 * comentarios de la fachada explican precisamente por que no se usa la
 * miniatura de YouTube — nombrandola. Buscando sobre el archivo entero, la
 * propia explicacion hacia fallar la prueba, que es la peor clase de prueba:
 * la que obliga a borrar el comentario que dice por que existe.
 */
function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

const FACHADA_CODIGO = sinComentarios(FACHADA);

/** La directiva pedida de la CSP que sirve Vercel de verdad. */
function directivaCsp(nombre: string): string[] {
  const vercel: unknown = JSON.parse(readFileSync(join(RAIZ_WEB, 'vercel.json'), 'utf8'));
  const grupos = (vercel as { headers?: { headers?: { key: string; value: string }[] }[] }).headers;

  const csp = (grupos ?? [])
    .flatMap((grupo) => grupo.headers ?? [])
    .find((h) => h.key.toLowerCase() === 'content-security-policy')?.value;

  if (!csp) throw new Error('vercel.json no tiene cabecera Content-Security-Policy');

  const directiva = csp
    .split(';')
    .map((trozo) => trozo.trim())
    .find((trozo) => trozo.startsWith(`${nombre} `));

  if (!directiva) throw new Error(`la CSP no tiene directiva ${nombre}`);
  return directiva.split(/\s+/).slice(1);
}

describe('el marco del video cabe en la CSP', () => {
  it('el origen que usa el codigo esta permitido en frame-src', () => {
    expect(directivaCsp('frame-src')).toContain(YOUTUBE_EMBED_ORIGIN);
  });

  it('y la URL construida apunta a ese mismo origen', () => {
    // Lo que la CSP permite es un origen; lo que el navegador compara es el
    // de la URL. Si `youTubeEmbedUrl` cambiara de dominio, la CSP lo
    // bloquearia en produccion y nadie lo veria en desarrollo.
    expect(new URL(youTubeEmbedUrl('dQw4w9WgXcQ')).origin).toBe(YOUTUBE_EMBED_ORIGIN);
  });

  it('frame-ancestors sigue en none: nadie nos incrusta a nosotros', () => {
    // Ampliar `frame-src` es dejar entrar; esto es lo contrario, y no se
    // toca al hacerlo.
    expect(directivaCsp('frame-ancestors')).toEqual(["'none'"]);
  });
});

describe('antes del clic no hay ninguna peticion a Google', () => {
  it('la tarjeta no usa la miniatura de YouTube', () => {
    // Seria la misma peticion a Google por otra puerta, y encima en cuanto
    // la seccion entra en pantalla, sin que nadie pulse nada.
    for (const dominio of ['ytimg', 'youtube.com/vi/']) {
      expect(FACHADA_CODIGO).not.toContain(dominio);
    }
    expect(directivaCsp('img-src')).not.toContain('https://i.ytimg.com');
  });

  it('no carga el script de la API de YouTube', () => {
    expect(FACHADA_CODIGO).not.toContain('iframe_api');
    expect(directivaCsp('script-src')).not.toContain('https://www.youtube.com');
  });

  it('el marco vive detras de un estado que arranca apagado', () => {
    // Sin el estado, el marco estaria en el primer pintado y la decision del
    // visitante no existiria.
    expect(FACHADA).toContain('useState(false)');
    expect(FACHADA).toContain('reproduciendo ?');
    expect(FACHADA).toContain('onClick={() => setReproduciendo(true)}');
  });

  it('y el marco se construye con la funcion del contrato, no a mano', () => {
    // A mano se podria colar `youtube.com` sin pasar por el origen unico.
    expect(FACHADA).toContain('src={youTubeEmbedUrl(videoId)}');
  });
});

describe('sin videos no hay seccion', () => {
  /*
   * Esto es lo que permite desplegar la seccion antes de que exista un solo
   * consentimiento firmado: lo que se publica es el interior de la casa de un
   * cliente, y hasta que ese papel exista no puede haber contenido.
   * Ver `docs/38-fotos-y-videos-antes-y-despues.md`.
   *
   * Cubre ademas el caso de que la API no responda: la galeria llega vacia y
   * la portada no ensena ni un hueco ni un aviso roto.
   */
  it('la seccion se retira entera cuando no hay nada que ensenar', () => {
    expect(SECCION).toContain('if (!hasGalleryContent(gallery)) return null;');
  });

  it('y el aviso del tercero se pinta antes del boton, no despues', () => {
    // Quien pulsa tiene que poder decidirlo sabiendolo.
    const avisoAntes = SECCION.indexOf('gallery.thirdPartyNote');
    // El uso, no el import: el import esta arriba del archivo siempre.
    const botones = SECCION.indexOf('<VideoFacade');
    expect(avisoAntes).toBeGreaterThan(-1);
    expect(avisoAntes).toBeLessThan(botones);
  });
});

describe('la miniatura es nuestra', () => {
  /*
   * La natural seria la de YouTube: gratis, automatica y siempre al dia. Y
   * seria exactamente la peticion a Google que la fachada evita, encima en
   * cuanto la seccion entra en pantalla y sin que nadie pulse nada. Asi que
   * la portada se sube a nuestro almacen.
   */
  it('la fachada pinta la direccion que recibe, no una que construya', () => {
    expect(FACHADA).toContain('src={posterUrl}');
    expect(FACHADA_CODIGO).not.toContain('supabase');
    expect(FACHADA_CODIGO).not.toContain('storage/v1');
  });

  it('sin miniatura la tarjeta sigue funcionando, con los colores de la marca', () => {
    // No es un hueco ni un error: es el estado de partida, y es lo que se ve
    // mientras la empresa no haya subido ninguna.
    expect(FACHADA).toContain('posterUrl !== null &&');
    expect(FACHADA).toContain('from-brand-700');
  });

  it('la portada es decorativa: texto alternativo vacio', () => {
    /*
     * Es la unica imagen del sitio que lo lleva vacio, y a proposito: el
     * boton que la contiene ya se anuncia con el titulo del video, asi que
     * describirla otra vez haria que un lector de pantalla leyera lo mismo
     * dos veces.
     */
    expect(FACHADA).toContain('alt=""');
  });
});
