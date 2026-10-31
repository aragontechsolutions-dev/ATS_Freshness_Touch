import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en, es } from '@freshness/i18n';

/**
 * LA CABECERA TIENE QUE CABER EN UNA SOLA LINEA
 * =============================================
 * Esta prueba existe por un fallo que llego a produccion y que nadie vio
 * venir: al anadir «Historia» al menu, la cabecera en ESPANOL dejo de caber
 * y el logotipo se partio en dos lineas montandose sobre si mismo. No se
 * leia como una cabecera apretada; se leia como una web rota, y es lo
 * primero que ve quien entra.
 *
 * ========================================================================
 * POR QUE NO SE VIO
 * ========================================================================
 * Tres cosas a la vez, y ninguna se nota desde el codigo:
 *
 *   1. SOLO EN ESPANOL. En ingles sobraban 79 px; en espanol faltaban 22.
 *   2. SOLO CON TELEFONO CONFIGURADO. El numero de WhatsApp ocupa 156 px y
 *      en desarrollo no esta puesto, asi que en local se veia bien.
 *   3. EN TODOS LOS ANCHOS DE ESCRITORIO, no en uno raro. El contenedor topa
 *      en 1152 px, asi que 1280, 1366 y 1920 dan exactamente el mismo sitio.
 *
 * ========================================================================
 * LO QUE MIDE ESTO, Y LO QUE NO
 * ========================================================================
 * No mide pixeles: para eso haria falta un navegador, y las pruebas de este
 * sitio corren en Node a proposito. Lo que hace es vigilar las dos cosas que
 * hicieron que dejara de caber —cuanto texto hay y cuantas entradas— contra
 * un presupuesto CALIBRADO con una medicion de verdad.
 *
 * La medicion, hecha con un navegador a 1366 px y con el telefono puesto:
 *
 *   contenedor util ......... 1088 px
 *   logotipo + idioma + tema .. 478 px
 *   sitio para el menu ........ 610 px
 *   menu en espanol (hoy) ..... 575 px  -> 34 px de holgura
 *   menu en ingles (hoy) ...... 531 px  -> 79 px de holgura
 *
 * Si esta prueba falla, NO se sube el numero sin mas: se vuelve a medir con
 * un navegador. El numero de aqui vale lo que valga la medicion que lo puso.
 */

const CABECERA = readFileSync(join(import.meta.dirname, 'Header.tsx'), 'utf8');

/** Las claves del menu, leidas del componente y no de una lista paralela. */
const CLAVES = (() => {
  const bloque = /const NAV_ITEMS = \[([\s\S]*?)\] as const;/.exec(CABECERA)?.[1] ?? '';
  return [...bloque.matchAll(/key: 'nav\.([A-Za-z]+)'/g)].map((hallado) => hallado[1] ?? '');
})();

/**
 * Cuantas entradas caben.
 *
 * VA APARTE DE LOS CARACTERES PORQUE CADA ENTRADA CUESTA SU HUECO: 24 px de
 * separacion, haya una letra o quince. Con 34 px de holgura, una entrada mas
 * no cabe aunque su texto sea cortisimo.
 */
const ENTRADAS_MAX = 7;

/**
 * Cuantas letras caben sumando todas las etiquetas, por idioma.
 *
 * Salen de la holgura medida dividida por lo que ocupa una letra en cada
 * idioma (las mayusculas y los acentos no miden igual):
 *
 *   espanol: 60 letras -> 575 px, 7,2 px/letra, 34 px de holgura -> +4
 *   ingles:  51 letras -> 531 px, 7,6 px/letra, 79 px de holgura -> +10
 */
const LETRAS_MAX = { es: 64, en: 61 } as const;

function letras(diccionario: typeof en | typeof es): number {
  return CLAVES.reduce((total, clave) => {
    const etiqueta = (diccionario.nav as Record<string, string>)[clave] ?? '';
    return total + etiqueta.length;
  }, 0);
}

describe('la cabecera cabe en una linea', () => {
  it('la prueba encontro el menu', () => {
    // Sin esto, un cambio de formato en `Header.tsx` dejaria la lista vacia
    // y las comprobaciones de abajo pasarian sin mirar nada.
    expect(CLAVES.length).toBeGreaterThanOrEqual(6);
  });

  it('cada clave del menu tiene su texto en los dos idiomas', () => {
    for (const clave of CLAVES) {
      expect((en.nav as Record<string, string>)[clave], `falta en.nav.${clave}`).toBeTruthy();
      expect((es.nav as Record<string, string>)[clave], `falta es.nav.${clave}`).toBeTruthy();
    }
  });

  it(`no hay mas de ${String(ENTRADAS_MAX)} entradas`, () => {
    /*
     * Una entrada mas no es «un poco mas de texto»: son 24 px de separacion
     * ademas de su etiqueta, y solo hay 34 px de holgura. Si de verdad hace
     * falta una octava, hay que quitar otra cosa de la fila —el telefono, por
     * ejemplo— y volver a medir.
     */
    expect(CLAVES.length).toBeLessThanOrEqual(ENTRADAS_MAX);
  });

  it('EL MENU EN ESPANOL NO SE PASA DE LARGO', () => {
    /*
     * El idioma que rompio la cabecera. El espanol es mas largo que el
     * ingles en casi todas las etiquetas, asi que es el que manda: si cabe
     * en espanol, cabe.
     */
    expect(letras(es)).toBeLessThanOrEqual(LETRAS_MAX.es);
  });

  it('ni el de ingles', () => {
    expect(letras(en)).toBeLessThanOrEqual(LETRAS_MAX.en);
  });

  it('y el logotipo NO CEDE sitio', () => {
    /*
     * La otra mitad del arreglo, y la que importa de verdad: aunque algun
     * dia vuelva a no caber, lo que no puede pasar es que se deforme la
     * marca. Antes el enlace del logotipo era `min-w-0 shrink`.
     */
    expect(CABECERA).toContain('className="shrink-0"');
    expect(CABECERA).not.toContain('className="min-w-0 shrink"');
  });
});
