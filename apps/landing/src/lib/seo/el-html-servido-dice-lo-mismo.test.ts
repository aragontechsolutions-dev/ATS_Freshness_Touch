import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en } from '@freshness/i18n';
import { SITIO_POR_OMISION } from './sitio';

/**
 * EL HTML SERVIDO Y LOS TEXTOS TRADUCIDOS TIENEN QUE DECIR LO MISMO
 * ================================================================
 * Hay DOS fuentes para el titulo y la descripcion de la portada, y las dos
 * son necesarias:
 *
 *   1. `index.html`, escrito a mano. Es lo UNICO que ve un rastreador que no
 *      ejecuta JavaScript, y el de WhatsApp y el de Facebook no lo ejecutan.
 *      En una empresa de limpieza, compartir el enlace por WhatsApp es como
 *      llega buena parte de la clientela.
 *   2. `packages/i18n` (bloque `seo.home`), que es de donde sale el mismo
 *      texto cuando el navegador ya ha arrancado y al cambiar de idioma.
 *
 * Dos fuentes para el mismo dato se desincronizan. No «podrian»: lo hacen, y
 * aqui el sintoma es invisible desde dentro de la aplicacion —todo se ve
 * perfecto en el navegador— porque el que se queda viejo es el que solo leen
 * las maquinas. Esto es lo que lo convierte en un fallo de CI.
 *
 * ==========================================================================
 * TAMBIEN VIGILA EL DOMINIO
 * ==========================================================================
 * Open Graph exige direcciones ABSOLUTAS: una ruta relativa en `og:image` se
 * ignora entera, asi que el dominio esta escrito dentro de `index.html` y no
 * puede salir de `VITE_SITE_URL`. Si el dominio cambia y alguien se acuerda
 * solo de la variable, las vistas previas seguirian apuntando al dominio
 * viejo y nadie lo notaria hasta compartir un enlace.
 */

const HTML = readFileSync(join(import.meta.dirname, '../../../index.html'), 'utf8');

/** El `content` de un `<meta>` por su `name` o su `property`. */
function contenido(clave: string): string {
  const patron = new RegExp(
    `<meta[^>]*(?:name|property)="${clave}"[^>]*content="([^"]*)"|` +
      `<meta[^>]*content="([^"]*)"[^>]*(?:name|property)="${clave}"`,
    's',
  );
  const encontrado = patron.exec(HTML);
  const valor = encontrado?.[1] ?? encontrado?.[2];

  if (valor === undefined) throw new Error(`no hay <meta> para "${clave}" en index.html`);
  return desescapar(valor);
}

/**
 * Deshace el escapado de HTML.
 *
 * Hace falta porque el titulo lleva un `&`: en `index.html` tiene que ir como
 * `&amp;` o el documento no es HTML valido, y en el paquete de idioma va
 * como `&`. Comparar en crudo fallaria por un motivo que no tiene nada que
 * ver con lo que se esta comprobando.
 */
function desescapar(texto: string): string {
  return texto
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

describe('index.html y el paquete de idioma', () => {
  it('EL TITULO ES EL MISMO en los dos sitios', () => {
    const enElHtml = /<title>([^<]*)<\/title>/.exec(HTML)?.[1];
    expect(enElHtml).toBeDefined();
    expect(desescapar(enElHtml as string)).toBe(en.seo.home.title);
  });

  it('LA DESCRIPCION ES LA MISMA en los dos sitios', () => {
    expect(contenido('description')).toBe(en.seo.home.description);
  });

  it('las etiquetas de compartir repiten el mismo titulo y la misma descripcion', () => {
    /*
     * No es redundante con las dos de arriba: `og:title` es una etiqueta
     * DISTINTA, y es la que de verdad se lee al compartir. Un cambio de
     * copia que toque el `<title>` y se olvide del `og:title` da una vista
     * previa que no coincide con la pagina.
     */
    for (const clave of ['og:title', 'twitter:title']) {
      expect(contenido(clave)).toBe(en.seo.home.title);
    }
    for (const clave of ['og:description', 'twitter:description']) {
      expect(contenido(clave)).toBe(en.seo.home.description);
    }
  });
});

describe('el dominio escrito en index.html', () => {
  it('ES EL MISMO que el valor por omision del codigo', () => {
    expect(/<link rel="canonical" href="([^"]*)"/.exec(HTML)?.[1]).toBe(`${SITIO_POR_OMISION}/`);
    expect(contenido('og:url')).toBe(`${SITIO_POR_OMISION}/`);
  });

  it('LA IMAGEN DE COMPARTIR ES ABSOLUTA y del mismo dominio', () => {
    /*
     * EL FALLO QUE ESTA PRUEBA IMPIDE. Una ruta relativa en `og:image` —`/
     * brand/og-default.jpg`— no da una imagen pequena: no da NINGUNA. El
     * rastreador la descarta y la vista previa sale sin foto, que es
     * exactamente el estado que esto venia a arreglar.
     */
    for (const clave of ['og:image', 'twitter:image']) {
      expect(contenido(clave)).toBe(`${SITIO_POR_OMISION}/brand/og-default.jpg`);
    }
  });

  it('declara el tamano de la imagen', () => {
    /*
     * Facebook y WhatsApp deciden si pintan la tarjeta grande o la pequena
     * ANTES de descargar la imagen. Sin el tamano declarado, la primera vez
     * que se comparte un enlace sale la tarjeta pequena, y queda en su cache.
     */
    expect(contenido('og:image:width')).toBe('1200');
    expect(contenido('og:image:height')).toBe('630');
  });
});
