import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * CADA ENTRADA DEL MENU LLEVA A UNA SECCION QUE EXISTE
 * ====================================================
 * El menu de la cabecera son enlaces a fragmentos: `#why-us`, `#faq`. El
 * destino es el `id` de una seccion, y las dos mitades viven en archivos
 * distintos.
 *
 * ========================================================================
 * LO QUE PASA CUANDO NO CASAN, Y POR QUE NO SE VE
 * ========================================================================
 * Un enlace a un `id` que no existe NO DA ERROR. El navegador no va a
 * ninguna parte: la pagina se queda exactamente donde estaba. Quien lo pulsa
 * no piensa «este enlace esta roto», piensa que no ha pulsado bien, y lo
 * pulsa otra vez.
 *
 * Pasa de dos maneras, y ninguna se nota al revisar un cambio: una errata al
 * anadir una entrada al menu, y renombrar el `id` de una seccion sin acordarse
 * del enlace que apuntaba a ella.
 *
 * Esta prueba lo convierte en un fallo de la integracion continua. Nacio al
 * anadir «Nuestra historia», pero vigila las siete entradas.
 */

const RAIZ = join(import.meta.dirname, '..');

const CABECERA = readFileSync(join(RAIZ, 'components/Header.tsx'), 'utf8');

/** Los fragmentos a los que apunta el menu. */
const DESTINOS = (() => {
  const bloque = /const NAV_ITEMS = \[([\s\S]*?)\] as const;/.exec(CABECERA)?.[1] ?? '';
  return [...bloque.matchAll(/href: '#([a-z0-9-]+)'/g)].map((encontrado) => encontrado[1] ?? '');
})();

/** Los `id` que de verdad se pintan, en cualquier `.tsx` del sitio. */
const IDENTIFICADORES = (() => {
  const archivos = (directorio: string): string[] =>
    readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
      const ruta = join(directorio, entrada.name);
      if (entrada.isDirectory()) return archivos(ruta);
      return entrada.isFile() && entrada.name.endsWith('.tsx') ? [ruta] : [];
    });

  const encontrados = new Set<string>();
  for (const ruta of archivos(RAIZ)) {
    for (const encontrado of readFileSync(ruta, 'utf8').matchAll(/id="([a-z0-9-]+)"/g)) {
      encontrados.add(encontrado[1] ?? '');
    }
  }
  return encontrados;
})();

describe('el menu de la cabecera', () => {
  it('tiene entradas, y la prueba las encontro', () => {
    // Sin esto, un cambio de formato en `Header.tsx` dejaria la lista vacia y
    // la comprobacion de abajo pasaria sin mirar nada.
    expect(DESTINOS.length).toBeGreaterThanOrEqual(6);
  });

  it('NINGUNA ENTRADA APUNTA A UNA SECCION QUE NO EXISTE', () => {
    const huerfanos = DESTINOS.filter((destino) => !IDENTIFICADORES.has(destino));

    expect(huerfanos, `enlaces del menu sin seccion: ${huerfanos.join(', ')}`).toEqual([]);
  });

  it('y no hay dos entradas al mismo sitio', () => {
    expect(new Set(DESTINOS).size).toBe(DESTINOS.length);
  });
});
