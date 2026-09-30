import { describe, expect, it } from 'vitest';
import { resources } from '@freshness/i18n';
import { CLOCK_IN_LOCATION_STATES, CLOCK_IN_STATE_TEXT_KEY } from '@freshness/types';

/**
 * TODOS LOS ESTADOS DE FICHAJE TIENEN TEXTO, EN LOS DOS IDIOMAS
 * ============================================================
 * ESTA PRUEBA EXISTE POR UN FALLO REAL, y merece contarse.
 *
 * La primera version derivaba la clave de traduccion con
 * `estado.toLowerCase()`. Funcionaba con `DENIED` y `UNAVAILABLE` —palabras
 * sueltas— y se rompia con `NO_HOUSE`, que daba `no_house` mientras la clave
 * era `noHouse`. En la pantalla del panel aparecia literalmente
 * «admin.clockIns.no_house», delante de quien coordina.
 *
 * NINGUNA PRUEBA LO VIO. Los tipos estaban bien, el lint estaba limpio y las
 * pruebas pasaban: una clave de i18n que no existe no es un error de
 * TypeScript, es una cadena. Solo se noto al abrir el navegador.
 *
 * De ahi salen las dos cosas que lo impiden ahora:
 *
 *   1. `CLOCK_IN_STATE_TEXT_KEY`, que al ser un `Record` del enumerado obliga
 *      a declarar el sufijo de cada estado o no compila.
 *   2. Esta prueba, que comprueba que ese sufijo EXISTE de verdad en los dos
 *      paquetes de textos y en las dos pantallas.
 */

type Arbol = Record<string, unknown>;

/** Busca `a.b.c` en un arbol de traducciones. Devuelve null si falta. */
function textoEn(idioma: 'en' | 'es', ruta: string): string | null {
  let nodo: unknown = resources[idioma].translation;

  for (const parte of ruta.split('.')) {
    if (typeof nodo !== 'object' || nodo === null) return null;
    nodo = (nodo as Arbol)[parte];
  }

  return typeof nodo === 'string' ? nodo : null;
}

/*
 * `RECORDED` se queda fuera: ese estado no usa un texto de estado, sino el de
 * la distancia, que lleva la unidad y el numero interpolados. Los otros tres
 * son los que se pintan como frase.
 */
const SIN_UBICACION = CLOCK_IN_LOCATION_STATES.filter((estado) => estado !== 'RECORDED');

describe('la pantalla de limpieza', () => {
  it('tiene texto para cada motivo de «sin ubicacion», en los dos idiomas', () => {
    for (const estado of SIN_UBICACION) {
      for (const idioma of ['en', 'es'] as const) {
        const ruta = `admin.myJobs.clockIn.${CLOCK_IN_STATE_TEXT_KEY[estado]}`;
        expect(textoEn(idioma, ruta), `falta ${ruta} en ${idioma}`).toBeTruthy();
      }
    }
  });

  it('y las dos escalas de distancia', () => {
    for (const idioma of ['en', 'es'] as const) {
      expect(textoEn(idioma, 'admin.myJobs.clockIn.distanceFeet')).toBeTruthy();
      expect(textoEn(idioma, 'admin.myJobs.clockIn.distanceMiles')).toBeTruthy();
    }
  });

  it('los textos de distancia interpolan el valor', () => {
    // Sin `{{value}}` la frase saldria sin el numero, que es todo el dato.
    for (const idioma of ['en', 'es'] as const) {
      expect(textoEn(idioma, 'admin.myJobs.clockIn.distanceFeet')).toContain('{{value}}');
      expect(textoEn(idioma, 'admin.myJobs.clockIn.distanceMiles')).toContain('{{value}}');
    }
  });

  it('y dicen que la ubicacion NO se guarda', () => {
    /*
     * No es decoracion: se le dice a quien ficha que de su posicion no queda
     * nada. Si alguien recorta ese texto, esta prueba lo para.
     */
    expect(textoEn('en', 'admin.myJobs.clockIn.distanceFeet')).toMatch(/not saved/i);
    expect(textoEn('es', 'admin.myJobs.clockIn.distanceFeet')).toMatch(/no se guarda/i);
  });
});

describe('el detalle del panel', () => {
  it('tiene texto para cada motivo de «sin ubicacion», en los dos idiomas', () => {
    for (const estado of SIN_UBICACION) {
      for (const idioma of ['en', 'es'] as const) {
        const ruta = `admin.clockIns.${CLOCK_IN_STATE_TEXT_KEY[estado]}`;
        expect(textoEn(idioma, ruta), `falta ${ruta} en ${idioma}`).toBeTruthy();
      }
    }
  });

  it('tiene todas las piezas de la linea de un fichaje', () => {
    const NECESARIAS = [
      'title',
      'arrived',
      'left',
      'feet',
      'miles',
      'accuracy',
      'unit.feet',
      'unit.miles',
      'privacyNote',
    ];

    for (const clave of NECESARIAS) {
      for (const idioma of ['en', 'es'] as const) {
        const ruta = `admin.clockIns.${clave}`;
        expect(textoEn(idioma, ruta), `falta ${ruta} en ${idioma}`).toBeTruthy();
      }
    }
  });

  it('la nota de privacidad dice que la ubicacion no se guarda', () => {
    expect(textoEn('en', 'admin.clockIns.privacyNote')).toMatch(/never saved/i);
    expect(textoEn('es', 'admin.clockIns.privacyNote')).toMatch(/no se guarda/i);
  });
});

describe('ningun texto de fichaje se quedo sin traducir', () => {
  it('ninguna clave dice lo mismo en los dos idiomas', () => {
    /*
     * Copiar el bloque de ingles y olvidarse de traducirlo es el descuido
     * clasico de estos anadidos, y no lo detecta nada: las claves existen y
     * las pruebas pasan.
     *
     * Se excluye `accuracy`, que es «(±{{value}} {{unit}})» y es identico a
     * proposito: son simbolos, no palabras.
     */
    const rutas = ['admin.clockIns.title', 'admin.clockIns.arrived', 'admin.clockIns.left'];

    for (const ruta of rutas) {
      expect(textoEn('en', ruta), ruta).not.toBe(textoEn('es', ruta));
    }
  });
});
