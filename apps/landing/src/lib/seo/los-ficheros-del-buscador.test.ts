import { describe, expect, it } from 'vitest';
import { robotsTxt, sitemapXml, soloElDia } from './ficheros';
import { IDIOMAS, PAGINAS_INDEXABLES, RUTAS_PRIVADAS, rutaDe } from './paginas';
import { SITIO_POR_OMISION, normalizarSitio, urlAbsoluta } from './sitio';

/**
 * `robots.txt`, `sitemap.xml` Y LA DIRECCION DEL SITIO
 * ===================================================
 * Tres ficheros de texto que nadie mira nunca y de los que depende si el
 * sitio se indexa. Esa combinacion —importante e invisible— es exactamente la
 * que necesita pruebas: un `sitemap.xml` con el dominio equivocado no produce
 * ningun sintoma. La web funciona igual, se ve igual, y simplemente no
 * aparece en Google.
 */

const SITIO = 'https://ejemplo.test';
const UN_DIA = new Date('2026-11-01T17:45:12.000Z');

describe('normalizarSitio', () => {
  it('quita la barra final y los espacios', () => {
    expect(normalizarSitio('  https://ejemplo.test/  ')).toBe('https://ejemplo.test');
    expect(normalizarSitio('https://ejemplo.test///')).toBe('https://ejemplo.test');
  });

  it('CAE EN PRODUCCION cuando la variable no sirve, en vez de lanzar', () => {
    /*
     * EL FALLO QUE ESTA PRUEBA IMPIDE. Esto corre al arrancar la pagina que
     * genera los ingresos. Una variable de entorno mal escrita no puede dejar
     * la web en blanco, y un `canonical` hacia produccion es ademas lo que se
     * quiere en una vista previa de Vercel.
     */
    expect(normalizarSitio(undefined)).toBe(SITIO_POR_OMISION);
    expect(normalizarSitio('')).toBe(SITIO_POR_OMISION);
    expect(normalizarSitio('no es una url')).toBe(SITIO_POR_OMISION);
  });

  it('EXIGE HTTPS', () => {
    /*
     * Un `canonical` con `http://` no es equivalente a la pagina: anuncia
     * otra direccion. Y una ruta relativa en `og:image` se ignora entera.
     */
    expect(normalizarSitio('http://ejemplo.test')).toBe(SITIO_POR_OMISION);
    expect(normalizarSitio('/')).toBe(SITIO_POR_OMISION);
  });
});

describe('urlAbsoluta', () => {
  it('la portada lleva barra final y las demas no', () => {
    expect(urlAbsoluta(SITIO, '/')).toBe('https://ejemplo.test/');
    expect(urlAbsoluta(SITIO, '/terms')).toBe('https://ejemplo.test/terms');
    expect(urlAbsoluta(SITIO, '/terms/')).toBe('https://ejemplo.test/terms');
  });

  it('nunca produce barras dobles', () => {
    expect(urlAbsoluta('https://ejemplo.test/', '/sitemap.xml')).toBe(
      'https://ejemplo.test/sitemap.xml',
    );
  });
});

describe('robots.txt', () => {
  const texto = robotsTxt(SITIO);

  it('permite el sitio y senala el sitemap con direccion absoluta', () => {
    expect(texto).toContain('User-agent: *');
    expect(texto).toContain('Allow: /');
    expect(texto).toContain('Sitemap: https://ejemplo.test/sitemap.xml');
  });

  it('pide que no se rastree la pantalla de retirar fotos', () => {
    expect(texto).toContain('Disallow: /retirar-fotos');
  });

  it('LISTA TODAS LAS RUTAS PRIVADAS, no solo la primera', () => {
    // Hoy hay una. El dia que haya dos, un `join` mal escrito dejaria la
    // segunda fuera sin que nada lo dijera.
    for (const ruta of RUTAS_PRIVADAS) {
      expect(texto).toContain(`Disallow: ${ruta}`);
    }
  });
});

describe('sitemap.xml', () => {
  const xml = sitemapXml(SITIO, UN_DIA);

  it('lleva solo el dia, sin hora', () => {
    expect(soloElDia(UN_DIA)).toBe('2026-11-01');
    expect(xml).toContain('<lastmod>2026-11-01</lastmod>');
    expect(xml).not.toContain('17:45');
  });

  it('UNA ENTRADA POR PAGINA Y POR IDIOMA', () => {
    /*
     * Seis, no tres. Es lo que hace que `/es` exista para un buscador:
     * listando solo la version inglesa, la espanola solo se descubriria si
     * alguien la enlaza desde fuera, que es justo lo que no pasa con un sitio
     * nuevo.
     */
    const cuantas = (xml.match(/<loc>/g) ?? []).length;
    expect(cuantas).toBe(PAGINAS_INDEXABLES.length * IDIOMAS.length);

    for (const pagina of PAGINAS_INDEXABLES) {
      for (const locale of IDIOMAS) {
        expect(xml).toContain(`<loc>${urlAbsoluta(SITIO, rutaDe(pagina, locale))}</loc>`);
      }
    }
  });

  it('LAS ALTERNATIVAS SON RECIPROCAS, incluida la propia', () => {
    /*
     * EL FALLO QUE ESTA PRUEBA IMPIDE. La especificacion de `hreflang` exige
     * que el conjunto de alternativas sea el mismo en todas las versiones,
     * incluida la que se declara a si misma. Si `/terms` declarase solo a
     * `/es/terms` y al contrario, ninguna confirmaria la relacion y Google
     * descarta los grupos que no se confirman mutuamente: el trabajo entero
     * de esta etapa no serviria de nada, y no habria ningun sintoma visible.
     */
    const bloques = xml.split('<url>').slice(1);
    expect(bloques).toHaveLength(PAGINAS_INDEXABLES.length * IDIOMAS.length);

    for (const bloque of bloques) {
      for (const locale of IDIOMAS) {
        expect(bloque).toContain(`hreflang="${locale}"`);
      }
      expect(bloque).toContain('hreflang="x-default"');
    }
  });

  it('`x-default` apunta al ingles', () => {
    // Es la version que se sirve a quien no busca en ninguno de los dos
    // idiomas. No es «el principal»: es el respaldo.
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="x-default" href="https://ejemplo.test/"/>',
    );
  });

  it('declara el espacio de nombres de xhtml', () => {
    // Sin el, los `<xhtml:link>` son XML invalido y el sitemap entero se
    // rechaza: se perderian tambien las URLs que si estaban bien.
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  });

  it('NO INCLUYE NINGUNA RUTA PRIVADA', () => {
    /*
     * EL FALLO QUE ESTA PRUEBA IMPIDE. `paginas.ts` dice explicitamente que
     * se indexa, en vez de deducirlo de `rutas.ts`, justo para que una
     * pantalla nueva no entre sola en el sitemap. Esto lo comprueba.
     */
    for (const ruta of RUTAS_PRIVADAS) {
      expect(xml).not.toContain(ruta);
    }
    expect(xml).not.toContain('noEncontrada');
  });

  it('las prioridades salen con un decimal', () => {
    // `1` en vez de `1.0` es valido, pero mezclar los dos formatos en el
    // mismo fichero es la clase de detalle que hace dudar de un validador.
    expect(xml).toContain('<priority>1.0</priority>');
    expect(xml).toContain('<priority>0.3</priority>');
  });
});
