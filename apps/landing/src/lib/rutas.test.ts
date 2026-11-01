import { describe, expect, it } from 'vitest';
import { destinoPara, idiomaDeLaUrl, pantallaPara, rutaPara } from './rutas';

/**
 * LAS RUTAS DEL SITIO
 * -------------------
 * Esta prueba existe por un fallo que llego a produccion: `/terms` y
 * `/privacy` devolvian el 404 de Vercel porque `vercel.json` solo reescribia
 * `/retirar-fotos`. No se veia en local —Vite sirve `index.html` para todo— y
 * ninguna prueba de interfaz lo habria pillado, porque el fallo no estaba en
 * la aplicacion sino delante de ella.
 *
 * Lo que esto vigila es la mitad que si depende del codigo: que cada
 * direccion lleve a su pantalla y que lo desconocido acabe en el 404 nuestro
 * y no en la portada.
 *
 * Y desde el SEO, tambien el idioma: `/` es ingles y `/es` espanol, siempre.
 * Antes el idioma vivia solo en `localStorage`, asi que habia UNA direccion
 * sirviendo dos idiomas y el contenido en espanol no existia para un
 * buscador.
 */
describe('pantallaPara', () => {
  it('la raiz es el sitio', () => {
    expect(pantallaPara('/')).toBe('sitio');
    expect(pantallaPara('')).toBe('sitio');
  });

  it('cada direccion conocida lleva a su pantalla', () => {
    expect(pantallaPara('/retirar-fotos')).toBe('retirarFotos');
    expect(pantallaPara('/terms')).toBe('terms');
    expect(pantallaPara('/privacy')).toBe('privacy');
  });

  /*
   * UN ENLACE PEGADO EN UN CORREO LLEVA LA BARRA LA MITAD DE LAS VECES, y
   * `/terms/` tiene que ser la misma pagina que `/terms`.
   */
  it('la barra del final no cuenta', () => {
    expect(pantallaPara('/terms/')).toBe('terms');
    expect(pantallaPara('/privacy//')).toBe('privacy');
  });

  /*
   * LO DESCONOCIDO VA AL 404 NUESTRO, no a la portada. Ensenar la portada en
   * `/precios` seria contestar «esto existe» a algo que no existe, y quien
   * siguio un enlace roto se queda sin saber que estaba roto.
   */
  it('lo que no existe va al 404, no a la portada', () => {
    expect(pantallaPara('/precios')).toBe('noEncontrada');
    expect(pantallaPara('/terms/extra')).toBe('noEncontrada');
    expect(pantallaPara('/wp-admin')).toBe('noEncontrada');
  });
});

describe('el idioma en la direccion', () => {
  it('sin prefijo es ingles; con `/es`, espanol', () => {
    expect(destinoPara('/')).toEqual({ pantalla: 'sitio', locale: null });
    expect(destinoPara('/es')).toEqual({ pantalla: 'sitio', locale: 'es' });
    expect(destinoPara('/es/')).toEqual({ pantalla: 'sitio', locale: 'es' });
  });

  it('el prefijo vale para las paginas legales', () => {
    expect(destinoPara('/es/terms')).toEqual({ pantalla: 'terms', locale: 'es' });
    expect(destinoPara('/es/privacy')).toEqual({ pantalla: 'privacy', locale: 'es' });
  });

  it('UNA RUTA QUE EMPIEZA POR «es» NO ES ESPANOL', () => {
    /*
     * EL FALLO QUE ESTA PRUEBA IMPIDE. Comprobar el prefijo con un
     * `startsWith('/es')` a secas convertiria `/espanol`, `/estimate` o
     * `/escaleras` en espanol, y `/estimate` —una palabra que cualquiera
     * escribiria buscando un presupuesto— acabaria sirviendo la portada en
     * espanol en vez del 404.
     */
    expect(destinoPara('/estimate').locale).toBeNull();
    expect(destinoPara('/estimate').pantalla).toBe('noEncontrada');
    expect(destinoPara('/espanol').locale).toBeNull();
  });

  it('`/retirar-fotos` NO TIENE version por idioma', () => {
    /*
     * Su direccion esta dentro de correos ya enviados: no puede llevar
     * prefijo. Y aceptar `/es/retirar-fotos` crearia una segunda direccion
     * para la misma pantalla de tramite que no esta en ningun correo.
     */
    expect(destinoPara('/retirar-fotos')).toEqual({ pantalla: 'retirarFotos', locale: null });
    expect(destinoPara('/es/retirar-fotos').pantalla).toBe('noEncontrada');
  });
});

describe('idiomaDeLaUrl', () => {
  /*
   * ESTA FUNCION EXISTE POR UN FALLO QUE SE VIO EN UN NAVEGADOR DE VERDAD.
   *
   * El sincronizador de la flecha de atras usaba `destinoPara(...).locale`,
   * que para `/` devuelve `null` —no lleva prefijo—. Resultado: al volver de
   * `/es` a `/`, LA BARRA DECIA `/` Y LA PAGINA SEGUIA EN ESPANOL. Si alguien
   * comparte el enlace en ese momento, el otro abre algo distinto de lo que
   * se estaba viendo.
   */
  it('sin prefijo, en una pagina indexable, es el idioma por omision', () => {
    expect(idiomaDeLaUrl('/')).toBe('en');
    expect(idiomaDeLaUrl('/terms')).toBe('en');
  });

  it('con prefijo es el del prefijo', () => {
    expect(idiomaDeLaUrl('/es')).toBe('es');
    expect(idiomaDeLaUrl('/es/privacy')).toBe('es');
  });

  it('SOLO `/retirar-fotos` queda indeciso', () => {
    // Ahi manda lo que eligio la persona: es la pantalla a la que llega desde
    // un correo, y no se indexa.
    expect(idiomaDeLaUrl('/retirar-fotos')).toBeNull();
  });
});

describe('rutaPara', () => {
  it('es la inversa de destinoPara', () => {
    for (const ruta of ['/', '/es', '/terms', '/es/terms', '/privacy', '/es/privacy']) {
      const destino = destinoPara(ruta);
      const locale = destino.locale ?? 'en';
      expect(rutaPara(destino.pantalla, locale)).toBe(ruta === '/es/' ? '/es' : ruta);
    }
  });

  it('el ingles no lleva prefijo', () => {
    expect(rutaPara('sitio', 'en')).toBe('/');
    expect(rutaPara('terms', 'en')).toBe('/terms');
  });

  it('el espanol lo lleva', () => {
    expect(rutaPara('sitio', 'es')).toBe('/es');
    expect(rutaPara('privacy', 'es')).toBe('/es/privacy');
  });

  it('la pantalla de retirada tiene una sola direccion en los dos idiomas', () => {
    expect(rutaPara('retirarFotos', 'en')).toBe('/retirar-fotos');
    expect(rutaPara('retirarFotos', 'es')).toBe('/retirar-fotos');
  });
});
