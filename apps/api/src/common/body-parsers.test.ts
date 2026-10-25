import { describe, expect, it } from 'vitest';
import { esRutaDePruebaDePermiso } from './body-parsers';

/**
 * EL FILTRO DE RUTAS DEL LECTOR DE CUERPOS
 * ----------------------------------------
 * La prueba de un permiso llega como bytes crudos, pero sus rutas vecinas
 * —anotar un permiso, corregirlo— son JSON corriente. Un filtro demasiado
 * ancho se traga esas dos y las deja sin cuerpo; uno demasiado estrecho deja
 * la subida sin bytes.
 *
 * NINGUNO DE LOS DOS FALLOS SE VE LEYENDO EL CODIGO, y los dos aparecen
 * lejos del sitio donde esta el error: en un 400 raro al guardar un permiso,
 * o en un 415 al subir un archivo que si valia. Por eso se prueba aparte, sin
 * levantar el servidor.
 */
describe('que rutas leen bytes crudos', () => {
  const PREFIJO = 'api/v1';
  const ID = '11111111-1111-4111-8111-111111111111';

  it('la ruta de la prueba de un permiso, si', () => {
    expect(
      esRutaDePruebaDePermiso(`/${PREFIJO}/admin/media-consents/${ID}/evidence`, PREFIJO),
    ).toBe(true);
  });

  /* La barra final la ponen algunos clientes y no cambia la ruta. */
  it('y con barra final tambien', () => {
    expect(
      esRutaDePruebaDePermiso(`/${PREFIJO}/admin/media-consents/${ID}/evidence/`, PREFIJO),
    ).toBe(true);
  });

  /*
   * ESTAS SON LAS QUE IMPORTAN. Si alguna diera `true`, anotar o corregir un
   * permiso dejaria de funcionar, y el error no mencionaria los cuerpos.
   */
  it.each([
    ['la lista y el alta', `/${PREFIJO}/admin/media-consents`],
    ['la correccion de una ficha', `/${PREFIJO}/admin/media-consents/${ID}`],
    ['la retirada', `/${PREFIJO}/admin/media-consents/${ID}/revoke`],
    ['la restitucion', `/${PREFIJO}/admin/media-consents/${ID}/restore`],
  ])('%s sigue siendo JSON', (_caso, ruta) => {
    expect(esRutaDePruebaDePermiso(ruta, PREFIJO)).toBe(false);
  });

  /*
   * Y NADA DE FUERA. Un lector de bytes aplicado a una ruta que no es suya
   * acepta cuerpos de diez megas donde se esperaban dieciseis kilobytes.
   */
  it.each([
    ['sin el prefijo de la API', `/admin/media-consents/${ID}/evidence`],
    ['colgando de otra cosa', `/${PREFIJO}/otra/admin/media-consents/${ID}/evidence`],
    ['con algo detras', `/${PREFIJO}/admin/media-consents/${ID}/evidence/extra`],
    ['sin identificador', `/${PREFIJO}/admin/media-consents/evidence`],
    ['otra pantalla del panel', `/${PREFIJO}/admin/gallery`],
  ])('%s no lee bytes crudos', (_caso, ruta) => {
    expect(esRutaDePruebaDePermiso(ruta, PREFIJO)).toBe(false);
  });
});
