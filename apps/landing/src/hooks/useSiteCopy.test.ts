import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ============================================================================
 * EL TEXTO DEL PANEL SE PINTA COMO TEXTO, NUNCA COMO HTML
 * ============================================================================
 * Las promesas y las preguntas frecuentes las escribe alguien en el panel y
 * las lee CUALQUIER visitante. React escapa el contenido que va entre llaves,
 * asi que un `<script>` guardado desde el panel sale impreso en la pagina en
 * vez de ejecutarse.
 *
 * Esa defensa se pierde con una sola linea: la prop de React que inyecta HTML
 * en crudo. El dia que alguien quiera poner una promesa en negrita, esa es la
 * forma obvia y equivocada de conseguirlo, y a partir de ahi una cuenta de
 * administracion comprometida puede inyectar lo que quiera en la portada.
 *
 * Por eso la prueba no comprueba que React escape —eso es cosa de React—,
 * sino que NADIE haya abierto esa puerta en el sitio publico. Es una prueba
 * sobre el codigo fuente a proposito: es el unico sitio donde la regla se
 * puede comprobar entera, sin montar un navegador.
 *
 * Si algun dia hace falta formato de verdad, la respuesta correcta es un
 * campo con formato acotado que el sitio convierta a elementos, no abrir el
 * HTML.
 * ============================================================================
 */

const RAIZ = join(import.meta.dirname, '..');

/**
 * Busca el USO de la prop, no la palabra.
 *
 * La diferencia importa: este mismo archivo, y el comentario del hook, la
 * nombran para explicar por que no se usa. Un buscador ingenuo cazaria esas
 * menciones y la unica salida seria dejar de explicar la regla, que es
 * exactamente lo contrario de lo que conviene.
 *
 * Un uso de verdad siempre lleva `=` (prop de JSX) o `:` (dentro de un
 * objeto de propiedades). Una mencion en prosa, nunca.
 */
const USO_DE_HTML_EN_CRUDO = /dangerouslySetInnerHTML\s*[=:]/;

function fuentesDelSitio(): string[] {
  return globSync('**/*.{ts,tsx}', { cwd: RAIZ })
    .filter((ruta) => !ruta.endsWith('.test.ts') && !ruta.endsWith('.test.tsx'))
    .map((ruta) => join(RAIZ, ruta));
}

describe('el sitio publico no inyecta HTML en ninguna parte', () => {
  it('ningun archivo inyecta HTML en crudo', () => {
    const culpables = fuentesDelSitio()
      .filter((ruta) => USO_DE_HTML_EN_CRUDO.test(readFileSync(ruta, 'utf8')))
      .map((ruta) => ruta.slice(RAIZ.length + 1));

    expect(
      culpables,
      'El texto que se edita desde el panel se pinta en estas paginas: ' +
        'inyectar HTML aqui convierte una cuenta comprometida en una web comprometida',
    ).toEqual([]);
  });

  it('el buscador distingue el uso de la mencion', () => {
    // Sin esto, un patron mal escrito dejaria pasar todo sin que se notara.
    expect(USO_DE_HTML_EN_CRUDO.test('<p dangerouslySetInnerHTML={{ __html: x }} />')).toBe(true);
    expect(USO_DE_HTML_EN_CRUDO.test('const props = { dangerouslySetInnerHTML: algo };')).toBe(
      true,
    );
    expect(USO_DE_HTML_EN_CRUDO.test('// nunca con dangerouslySetInnerHTML')).toBe(false);
  });

  it('mira archivos de verdad, no una lista vacia', () => {
    // Si el patron de rutas fallara, la primera prueba pasaria sin mirar nada.
    const fuentes = fuentesDelSitio();
    expect(fuentes.length).toBeGreaterThan(20);
    expect(fuentes.some((ruta) => ruta.endsWith('sections/WhyUs.tsx'))).toBe(true);
    expect(fuentes.some((ruta) => ruta.endsWith('sections/Faq.tsx'))).toBe(true);
  });
});
