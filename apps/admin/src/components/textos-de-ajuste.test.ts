import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resources } from '@freshness/i18n';
import { FIELD_ADJUSTMENT_STATES } from '@freshness/types';

/**
 * TODAS LAS CLAVES DE TEXTO DE LOS AJUSTES EXISTEN DE VERDAD
 * ==========================================================
 * ESTA PRUEBA EXISTE POR UN FALLO REAL, Y ES EL SEGUNDO DE LA MISMA FAMILIA.
 *
 * En la Etapa 3.3 salio «admin.clockIns.no_house» literalmente en pantalla.
 * En esta, el bloque de textos del ajuste quedo en `admin.myJobs.adjustment`
 * y el componente pedia `admin.adjustment`: la pantalla entera del
 * responsable se pinto con las claves en crudo —«admin.adjustment.open» en
 * el boton— delante de quien iba a usarla.
 *
 * LAS DOS VECES, TODO LO DEMAS ESTABA EN VERDE: los tipos, el lint y mil
 * pruebas. Una clave de i18n que no existe NO ES UN ERROR DE TYPESCRIPT, es
 * una cadena, y `t()` devuelve la clave cuando no la encuentra.
 *
 * ========================================================================
 * POR ESO ESTA PRUEBA LEE EL CODIGO FUENTE
 * ========================================================================
 * No comprueba una lista de claves escrita a mano —esa lista se queda vieja
 * igual que el componente—: SACA DEL COMPONENTE todas las claves que de
 * verdad pide y comprueba que cada una existe en los dos idiomas. Una clave
 * nueva mal escrita se cae aqui sin tener que abrir un navegador.
 */

const COMPONENTES = ['FieldAdjustmentForm.tsx', 'FieldAdjustmentsSection.tsx'];

/** Las claves que un componente pide con `t('...')`. */
function clavesDe(archivo: string): string[] {
  const fuente = readFileSync(join(import.meta.dirname, archivo), 'utf8');

  /*
   * Solo las literales: `t('admin.x.y')`. Las construidas con plantilla
   * —`t(\`...state.${estado}\`)`— se comprueban aparte, recorriendo el
   * enumerado, porque su valor no esta en el texto del archivo.
   */
  return [...fuente.matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)].map((m) => m[1] ?? '');
}

function textoEn(idioma: 'en' | 'es', ruta: string): unknown {
  return ruta
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
      resources[idioma].translation,
    );
}

describe('las pantallas de ajuste de campo', () => {
  it('NO PIDEN NI UNA CLAVE QUE NO EXISTA, en los dos idiomas', () => {
    for (const archivo of COMPONENTES) {
      const claves = clavesDe(archivo);

      // Si el fichero deja de tener claves, es que algo se rompio al leerlo.
      expect(claves.length, `${archivo} no parece tener textos`).toBeGreaterThan(5);

      for (const clave of claves) {
        for (const idioma of ['en', 'es'] as const) {
          expect(textoEn(idioma, clave), `${archivo}: falta ${clave} en ${idioma}`).toBeTypeOf(
            'string',
          );
        }
      }
    }
  });

  it('y cada estado de una propuesta tiene texto en las dos pantallas', () => {
    /*
     * Estas se construyen con plantilla a partir del enumerado, asi que no
     * aparecen escritas en el archivo. Se recorren aqui: anadir un estado al
     * contrato sin darle texto se cae en esta linea.
     */
    for (const estado of FIELD_ADJUSTMENT_STATES) {
      for (const idioma of ['en', 'es'] as const) {
        expect(
          textoEn(idioma, `admin.myJobs.adjustment.state.${estado}`),
          `falta el estado ${estado} en la pantalla del equipo (${idioma})`,
        ).toBeTypeOf('string');

        expect(
          textoEn(idioma, `admin.adjustments.state.${estado}`),
          `falta el estado ${estado} en el panel (${idioma})`,
        ).toBeTypeOf('string');
      }
    }
  });

  it('el aviso de que se envio tambien existe', () => {
    for (const clave of [
      'admin.toast.adjustmentSent',
      'admin.toast.adjustmentApplied',
      'admin.toast.adjustmentRejected',
    ]) {
      for (const idioma of ['en', 'es'] as const) {
        expect(textoEn(idioma, clave), `falta ${clave} en ${idioma}`).toBeTypeOf('string');
      }
    }
  });
});
