import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BusinessSettingsSchema, DEFAULT_BUSINESS_SETTINGS } from '@freshness/types';

/**
 * GUARDAR AJUSTES NO PUEDE BORRAR UN CAMPO QUE EL FORMULARIO NO ENSENA
 * ===================================================================
 * Esta prueba existe por un fallo que estuve a punto de dejar escrito, y que
 * es invisible en pantalla.
 *
 * ==========================================================================
 * EL MECANISMO, QUE ES LO INTERESANTE
 * ==========================================================================
 * `Settings.tsx` no manda el objeto que leyo del servidor: **lo construye de
 * cero** a partir de sus campos, y lo valida con `BusinessSettingsSchema`
 * antes de enviarlo. Eso esta bien —el error sale junto al campo que lo
 * causa— y tiene una consecuencia que no se ve:
 *
 *   Un campo del contrato que el formulario NO incluya en ese objeto no
 *   viaja vacio: viaja AUSENTE. Y como casi todos los campos tienen
 *   `.default(...)` para no invalidar la fila guardada, Zod lo rellena con
 *   su valor por defecto y el servidor lo guarda encima del que habia.
 *
 * Es decir: anadir un campo al contrato y olvidarse de este formulario
 * convierte «guardar el telefono» en «guardar el telefono Y RESETEAR el
 * campo nuevo». Nadie ve nada: el guardado dice que fue bien.
 *
 * Paso de verdad al anadir `cities`, `facebookUrl` e `instagramUrl`: la
 * primera version tocaba el estado y la pantalla, y dejaba el objeto de
 * envio sin ellos. Cualquier guardado desde Ajustes habria devuelto las
 * ciudades a las de partida y borrado las redes.
 *
 * ==========================================================================
 * POR QUE SE LEE EL FUENTE
 * ==========================================================================
 * Lo que falla no es el comportamiento de un componente, es una OMISION. No
 * hay nada que pulsar para que se note: hay que mirar si el nombre del campo
 * aparece en el objeto que se construye. Montar la pantalla y guardar
 * tampoco lo detectaria sin comparar campo a campo contra el contrato, que
 * es justo lo que esto hace, pero sin montar nada.
 */

const FUENTE = readFileSync(join(import.meta.dirname, 'Settings.tsx'), 'utf8');

/**
 * El objeto que el formulario construye para enviar.
 *
 * Se recorta del fuente en vez de buscar cada nombre suelto en todo el
 * archivo: los nombres de los campos aparecen tambien en el estado, en los
 * `setX` de la carga y en las etiquetas, asi que buscar a lo bruto daria por
 * bueno un campo que se lee y no se envia — que es exactamente el fallo.
 */
const ENVIO = (/const candidato: unknown = \{([\s\S]*?)\n {4}\};/.exec(FUENTE)?.[1] ?? '')
  /*
   * SIN COMENTARIOS. Los comentarios de dentro explican por que cada campo
   * se normaliza como se normaliza, y nombran campos. Buscando sobre el
   * texto crudo, un campo EXPLICADO en un comentario y NO ENVIADO daria la
   * prueba por buena — justo el fallo que esto vigila.
   */
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('el formulario de ajustes', () => {
  it('la prueba encuentra el objeto que se envia', () => {
    // Si alguien renombra la variable, esto avisa en vez de pasar en vacio.
    expect(ENVIO.length).toBeGreaterThan(50);
  });

  it('ENVIA TODOS LOS CAMPOS DEL CONTRATO, sin excepcion', () => {
    const delContrato = Object.keys(DEFAULT_BUSINESS_SETTINGS);
    /*
     * `campo:` o `campo,`: las dos formas valen. `hours` se manda con la
     * forma abreviada de JavaScript (`hours,`), y exigir los dos puntos
     * daria un fallo por algo que si se envia.
     */
    const ausentes = delContrato.filter((campo) => !new RegExp(`\\b${campo}\\s*[:,]`).test(ENVIO));

    expect(ausentes).toEqual([]);
  });

  it('y el contrato no ha encogido sin que nadie se entere', () => {
    /*
     * La prueba de arriba recorre las claves del contrato. Si el contrato se
     * quedara vacio por un error de importacion, pasaria sin comprobar nada.
     */
    const campos = Object.keys(DEFAULT_BUSINESS_SETTINGS);
    expect(campos.length).toBeGreaterThanOrEqual(9);
    expect(campos).toContain('cities');
    expect(campos).toContain('facebookUrl');
    expect(campos).toContain('instagramUrl');
  });

  it('lo que el formulario envia cumple el contrato', () => {
    /*
     * Una comprobacion de cordura sobre el esquema, no sobre el fuente: que
     * un objeto con todos los campos a su valor de partida sea valido. Si
     * algun dia un valor por defecto deja de cumplir su propia validacion,
     * el formulario no podria guardar NADA y el mensaje saldria junto a un
     * campo que nadie ha tocado.
     */
    expect(BusinessSettingsSchema.safeParse(DEFAULT_BUSINESS_SETTINGS).success).toBe(true);
  });
});
