import { describe, expect, it } from 'vitest';
import { pantallaPara } from './rutas';

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
