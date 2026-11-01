import { describe, expect, it } from 'vitest';
import { en, es } from '@freshness/i18n';
import { etiquetasDePagina } from './etiquetas';
import { PAGINAS_INDEXABLES } from './paginas';
import type { Pantalla } from '../rutas';

/**
 * CADA PANTALLA TIENE SU TITULO, SU DESCRIPCION Y SU CANONICAL
 * ===========================================================
 * Antes las cuatro compartian las etiquetas escritas en `index.html`, asi que
 * en Google las condiciones de servicio y la politica de privacidad se
 * anunciaban como la portada de una empresa de limpieza. Tres direcciones con
 * el mismo titulo y la misma descripcion tienen un nombre para un buscador:
 * contenido duplicado.
 */

const SITIO = 'https://ejemplo.test';

/**
 * Un `t` de mentira que devuelve la clave.
 *
 * Asi se comprueba QUE CLAVE se pide, que es lo que de verdad decide el
 * texto, sin atar la prueba a una frase concreta que puede reescribirse.
 */
const claves = (clave: string): string => clave;

describe('las paginas que se indexan', () => {
  it('cada una pide su propio titulo y su propia descripcion', () => {
    const titulos = PAGINAS_INDEXABLES.map(
      (pagina) => etiquetasDePagina(pagina.pantalla, 'en', SITIO, claves).title,
    );

    expect(titulos).toEqual(['seo.home.title', 'seo.terms.title', 'seo.privacy.title']);
    // Y son distintos entre si, que es el fallo original.
    expect(new Set(titulos).size).toBe(titulos.length);
  });

  it('EL CANONICAL ES EL DEL IDIOMA QUE SE ESTA LEYENDO', () => {
    /*
     * EL FALLO QUE ESTA PRUEBA IMPIDE, y es el que haria inutil la etapa
     * entera: si `/es` declarase como canonico `/`, le estaria diciendo a
     * Google «la version buena es la inglesa, no indexes esta», y el
     * contenido en espanol seguiria sin existir.
     */
    expect(etiquetasDePagina('sitio', 'en', SITIO, claves).canonical).toBe('https://ejemplo.test/');
    expect(etiquetasDePagina('sitio', 'es', SITIO, claves).canonical).toBe(
      'https://ejemplo.test/es',
    );
    expect(etiquetasDePagina('terms', 'es', SITIO, claves).canonical).toBe(
      'https://ejemplo.test/es/terms',
    );
  });

  it('no llevan `robots`: indexar es el comportamiento normal', () => {
    for (const pagina of PAGINAS_INDEXABLES) {
      expect(etiquetasDePagina(pagina.pantalla, 'en', SITIO, claves).robots).toBeNull();
    }
  });

  it('declaran las dos versiones de idioma y `x-default`', () => {
    const { alternativas } = etiquetasDePagina('terms', 'es', SITIO, claves);

    expect(alternativas).toEqual([
      { hreflang: 'en', href: 'https://ejemplo.test/terms' },
      { hreflang: 'es', href: 'https://ejemplo.test/es/terms' },
      { hreflang: 'x-default', href: 'https://ejemplo.test/terms' },
    ]);
  });

  it('las alternativas son LAS MISMAS se lea en el idioma que se lea', () => {
    // Es lo que exige la especificacion de `hreflang`: el grupo tiene que ser
    // reciproco, o Google lo descarta entero.
    expect(etiquetasDePagina('terms', 'en', SITIO, claves).alternativas).toEqual(
      etiquetasDePagina('terms', 'es', SITIO, claves).alternativas,
    );
  });

  it('la portada es `website` y las legales `article`', () => {
    expect(etiquetasDePagina('sitio', 'en', SITIO, claves).ogType).toBe('website');
    expect(etiquetasDePagina('terms', 'en', SITIO, claves).ogType).toBe('article');
    expect(etiquetasDePagina('privacy', 'en', SITIO, claves).ogType).toBe('article');
  });
});

describe('las pantallas que NO se indexan', () => {
  const SIN_INDEXAR: Pantalla[] = ['noEncontrada', 'retirarFotos'];

  it('llevan `noindex, follow`', () => {
    for (const pantalla of SIN_INDEXAR) {
      expect(etiquetasDePagina(pantalla, 'en', SITIO, claves).robots).toBe('noindex, follow');
    }
  });

  it('`follow` Y NO `nofollow`, a proposito', () => {
    // Los enlaces de esas pantallas llevan a la portada y a las legales:
    // seguirlos es lo que se quiere. `nofollow` cortaria el rastreo justo
    // donde interesa que siga.
    expect(etiquetasDePagina('noEncontrada', 'en', SITIO, claves).robots).toContain('follow');
    expect(etiquetasDePagina('noEncontrada', 'en', SITIO, claves).robots).not.toContain('nofollow');
  });

  it('NO LLEVAN CANONICAL', () => {
    /*
     * Un `canonical` en una pagina con `noindex` manda dos mensajes
     * contrarios —«esta es la version buena» y «no la listes»— y lo que hacen
     * los buscadores con eso no esta definido.
     */
    for (const pantalla of SIN_INDEXAR) {
      expect(etiquetasDePagina(pantalla, 'en', SITIO, claves).canonical).toBeNull();
    }
  });

  it('NO DECLARAN ALTERNATIVAS DE IDIOMA', () => {
    /*
     * EL FALLO QUE ESTA PRUEBA IMPIDE. El 404 no tiene «version en espanol»:
     * tiene un 404 en cada idioma, que no es lo mismo. Declararlos como
     * alternativas le diria a Google que son dos traducciones de la misma
     * pagina, cuando son dos direcciones que no existen.
     */
    for (const pantalla of SIN_INDEXAR) {
      expect(etiquetasDePagina(pantalla, 'en', SITIO, claves).alternativas).toEqual([]);
    }
  });

  it('tienen texto propio en los dos idiomas', () => {
    // La pestana del navegador lo ensena igual, y «Cleaning Services in
    // Georgia» en una pantalla de tramite desconcierta.
    for (const idioma of [en, es]) {
      expect(idioma.seo.notFound.title.length).toBeGreaterThan(0);
      expect(idioma.seo.removal.title.length).toBeGreaterThan(0);
    }
  });
});

describe('los limites del medio', () => {
  /*
   * Google corta el titulo sobre los 60 caracteres y la descripcion sobre los
   * 155, y lo que se pierde es siempre el final. No es una regla de estilo:
   * es que la frase se publica recortada.
   *
   * Los topes van con holgura sobre el limite real porque el corte depende de
   * la anchura en pixeles, no de la cuenta de letras. Lo que esto impide es
   * lo otro: que alguien pegue un parrafo en un titulo.
   */
  const TITULO_MAX = 70;
  const DESCRIPCION_MAX = 165;

  it('ningun titulo se pasa de largo, en ninguno de los dos idiomas', () => {
    for (const idioma of [en, es]) {
      for (const [nombre, bloque] of Object.entries(idioma.seo)) {
        expect(bloque.title.length, `${nombre}: «${bloque.title}»`).toBeLessThanOrEqual(TITULO_MAX);
      }
    }
  });

  it('ninguna descripcion se pasa de larga', () => {
    for (const idioma of [en, es]) {
      for (const [nombre, bloque] of Object.entries(idioma.seo)) {
        expect(bloque.description.length, `${nombre}: «${bloque.description}»`).toBeLessThanOrEqual(
          DESCRIPCION_MAX,
        );
      }
    }
  });

  it('todos los titulos acaban con la marca', () => {
    // El titulo empieza por lo que se vende y acaba con la marca: quien busca
    // «limpieza de casas» todavia no sabe que existimos.
    for (const idioma of [en, es]) {
      for (const bloque of Object.values(idioma.seo)) {
        expect(bloque.title).toContain('Freshness Touch');
      }
    }
  });
});
