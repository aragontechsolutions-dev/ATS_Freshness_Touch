import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en, es } from '@freshness/i18n';

/**
 * LA CARTA DE LA FUNDADORA NO PUEDE PERDER UN PARRAFO
 * ===================================================
 * `About.tsx` no escribe los diez parrafos uno a uno: recorre una lista de
 * claves. Eso evita diez sitios donde olvidarse de uno, pero cambia el fallo
 * de forma: si manana se anade `p11` al texto y nadie lo mete en la lista,
 * ese parrafo NO SALE EN LA WEB y no hay ningun error en ninguna parte. La
 * carta simplemente se queda a medias.
 *
 * Es el mismo modo de fallo que el de las clases `ft-` inventadas: nada se
 * rompe, nada se queja, y nadie lo denuncia porque nadie sabe que falta.
 *
 * ========================================================================
 * Y LA SEGUNDA MITAD: QUE EL ESPANOL ESTE DE VERDAD TRADUCIDO
 * ========================================================================
 * La prueba de recursos de i18n comprueba que las CLAVES de los dos idiomas
 * coinciden. No puede comprobar que el contenido sea distinto, y el atajo
 * clasico al anadir un texto largo es copiar el ingles en `es.ts` para que
 * compile y traducirlo «luego». Ese «luego» se publica.
 */

const ABOUT = readFileSync(join(import.meta.dirname, 'About.tsx'), 'utf8');

/** Las claves `pN` que el componente de verdad pinta. */
const EN_LA_LISTA = (() => {
  const lista = /const PARRAFOS = \[([^\]]+)\]/.exec(ABOUT)?.[1] ?? '';
  return [...lista.matchAll(/'(p\d+)'/g)].map((encontrado) => encontrado[1] ?? '');
})();

/** Las claves `pN` que existen en el texto. */
const EN_EL_TEXTO = Object.keys(en.about).filter((clave) => /^p\d+$/.test(clave));

describe('la carta de la fundadora', () => {
  it('tiene parrafos, y la prueba los encontro', () => {
    // Si el formato del archivo cambiara y la expresion dejara de encontrar
    // nada, las dos comprobaciones de abajo pasarian comparando dos listas
    // vacias. Esto impide esa prueba que no prueba nada.
    expect(EN_LA_LISTA.length).toBeGreaterThanOrEqual(10);
  });

  it('PINTA TODOS los parrafos que hay escritos', () => {
    const olvidados = EN_EL_TEXTO.filter((clave) => !EN_LA_LISTA.includes(clave));

    expect(olvidados, `parrafos escritos que no se pintan: ${olvidados.join(', ')}`).toEqual([]);
  });

  it('y no pide ninguno que no exista', () => {
    /*
     * Al reves tambien importa, aunque falle mas suave: `t('about.p11')` sin
     * texto detras pinta la clave en crudo, y en la web se lee
     * «about.p11» en medio de la carta.
     */
    const inventados = EN_LA_LISTA.filter((clave) => !EN_EL_TEXTO.includes(clave));

    expect(inventados, `parrafos que se piden y no existen: ${inventados.join(', ')}`).toEqual([]);
  });

  it('va en orden: p1, p2, p3...', () => {
    // Una carta con los parrafos desordenados no se nota al leer el codigo,
    // y se nota muchisimo al leerla en la web.
    const ordenada = [...EN_LA_LISTA].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

    expect(EN_LA_LISTA).toEqual(ordenada);
  });

  it('ESTA TRADUCIDA, no copiada', () => {
    const sinTraducir = EN_EL_TEXTO.filter(
      (clave) =>
        en.about[clave as keyof typeof en.about] === es.about[clave as keyof typeof es.about],
    );

    expect(sinTraducir, `parrafos iguales en los dos idiomas: ${sinTraducir.join(', ')}`).toEqual(
      [],
    );
  });

  it('la firma es la misma en los dos idiomas, que es lo correcto', () => {
    /*
     * El nombre no se traduce. Esta prueba existe para que la de arriba no
     * tiente a nadie a «traducir» la firma y acabar con dos nombres.
     */
    expect(es.about.signature).toBe(en.about.signature);
  });

  it('el rotulo del menu es mas corto que el titulo de la seccion', () => {
    /*
     * La regla de `nav` en `en.ts`: en la cabecera las etiquetas compiten por
     * sitio con el logotipo, el telefono, el idioma y el tema, y con esta
     * entrada el menu pasa a siete. El rotulo largo va en el titulo.
     */
    expect(en.nav.about.length).toBeLessThanOrEqual(en.about.title.length);
    expect(es.nav.about.length).toBeLessThanOrEqual(es.about.title.length);
  });
});
