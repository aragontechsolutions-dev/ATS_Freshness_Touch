import { SITE_COPY_KEYS, type SiteCopyKey } from '@freshness/types';

/**
 * QUE PREGUNTAS FRECUENTES HAY, DEDUCIDO DE LA LISTA QUE YA EXISTE
 * ===============================================================
 * `SITE_COPY_KEYS` enumera los textos editables desde el panel, y entre ellos
 * estan las seis preguntas con su respuesta (`faq.q1.q`, `faq.q1.a`, ...).
 *
 * De ahi salen, en vez de escribir una septima lista. El sitio ya tiene DOS
 * —la de `SITE_COPY_KEYS` y la constante `QUESTIONS` de `Faq.tsx`— y anadir
 * una tercera para los datos estructurados garantizaba el fallo silencioso:
 * una pregunta nueva visible en la pagina y ausente del bloque JSON-LD, o al
 * contrario, que es la version mala —declarar contenido que no esta en la
 * pagina—.
 *
 * Hay una prueba que comprueba que lo que se pinta y lo que se declara son
 * las mismas preguntas: `las-preguntas-declaradas-son-las-que-se-pintan`.
 */

/** Una pregunta: la clave de su enunciado y la de su respuesta. */
export interface ClavesDePregunta {
  pregunta: SiteCopyKey;
  respuesta: SiteCopyKey;
}

/**
 * Las preguntas, en el orden en que estan declaradas.
 *
 * SE EMPAREJA POR NOMBRE Y SE EXIGE LA PAREJA COMPLETA: una clave `.q` sin su
 * `.a` se descarta en silencio en vez de producir una pregunta con respuesta
 * `undefined`, que es lo que acabaria serializado como `"text": null` y
 * dejaria el bloque entero invalido.
 */
export const CLAVES_DE_PREGUNTAS: readonly ClavesDePregunta[] = SITE_COPY_KEYS.filter(
  (clave): clave is SiteCopyKey => clave.startsWith('faq.') && clave.endsWith('.q'),
)
  .map((pregunta) => {
    const respuesta = `${pregunta.slice(0, -2)}.a` as SiteCopyKey;
    return SITE_COPY_KEYS.includes(respuesta) ? { pregunta, respuesta } : null;
  })
  .filter((par): par is ClavesDePregunta => par !== null);
