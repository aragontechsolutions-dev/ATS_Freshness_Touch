import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en, es } from '@freshness/i18n';

/**
 * LAS FOTOS SALEN DE NUESTRO ALMACEN, Y LA WEB NO COMPONE NINGUNA DIRECCION
 * ========================================================================
 * Guardada vive la RUTA dentro del almacen (`photos/abc….jpg`), porque es lo
 * unico que el panel puede escribir sin poder apuntar a otro sitio. La
 * DIRECCION la compone el servidor, que es el unico que sabe donde esta el
 * almacen, y la web usa la que recibe.
 *
 * La alternativa —mandar la ruta y que la web le pegue delante un dominio
 * suyo— pondria ese dominio en dos sitios que tendrian que coincidir para
 * siempre. Ya sabemos como acaba eso: es exactamente el fallo de la sede,
 * donde la web anunciaba una ciudad y el cotizador media desde otra.
 *
 * Y la CSP sigue siendo el muro: fija el unico origen desde el que el
 * navegador cargara una imagen. Si el servidor devolviera un dia una
 * direccion de otro sitio, el navegador no la pintaria.
 */

const RAIZ_WEB = join(import.meta.dirname, '../..');
const SECCION = readFileSync(join(import.meta.dirname, 'Gallery.tsx'), 'utf8');

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

describe('el origen de las fotos', () => {
  it('la CSP permite cargar imagenes del almacen, y por https', () => {
    const permitidos = directivaCsp('img-src');
    const almacen = permitidos.filter((origen) => origen.endsWith('.supabase.co'));

    expect(almacen).toHaveLength(1);
    expect(almacen[0]?.startsWith('https://')).toBe(true);
  });

  it('y sigue permitiendo las teselas del mapa y las imagenes propias', () => {
    // Anadir un origen es facil; borrar otro sin darse cuenta, tambien.
    const permitidos = directivaCsp('img-src');

    expect(permitidos).toContain("'self'");
    expect(permitidos).toContain('https://tile.openstreetmap.org');
  });
});

describe('la web no compone direcciones', () => {
  it('pinta la direccion que recibe, tal cual', () => {
    expect(SECCION).toContain('src={photo.url}');
  });

  it('no hay ningun dominio de almacen escrito en el codigo de la seccion', () => {
    // Si apareciera aqui, habria dos sitios que tendrian que coincidir para
    // siempre: el servidor y esto. Es el fallo de la sede otra vez.
    expect(SECCION).not.toContain('supabase');
    expect(SECCION).not.toContain('storage/v1');
  });
});

describe('una foto sin texto alternativo no existe', () => {
  /*
   * Para quien usa lector de pantalla, una imagen sin `alt` no esta. Y aqui
   * las fotos son la mitad del argumento de venta: una galeria muda es una
   * galeria que no vende a esa persona.
   */
  it('siempre hay alt: el titulo, o una descripcion generica', () => {
    expect(SECCION).toContain('alt={titulo ?? t(');
  });

  it('la descripcion generica existe en los dos idiomas', () => {
    expect(en.gallery.photoAlt.length).toBeGreaterThan(10);
    expect(es.gallery.photoAlt.length).toBeGreaterThan(10);
  });
});

describe('el aviso del tercero es solo de los videos', () => {
  /*
   * Las fotos salen de nuestro propio almacen: no hay ningun tercero a quien
   * avisar. Ensenar el aviso con una galeria de solo fotos seria decirle al
   * visitante que mandamos sus datos a alguien cuando no es verdad.
   */
  it('el aviso va dentro de la condicion de que haya videos', () => {
    const condicion = SECCION.indexOf('gallery.videos.length > 0 && (');
    const aviso = SECCION.indexOf('gallery.thirdPartyNote');

    expect(condicion).toBeGreaterThan(-1);
    expect(aviso).toBeGreaterThan(condicion);
  });
});
