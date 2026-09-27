import { beforeEach, describe, expect, it } from 'vitest';
import { createSafeStorage } from './supabase';

/**
 * EL ALMACEN DEL PANEL, Y POR QUE NO ES UNO SOLO
 * ----------------------------------------------
 * Esta prueba existe por un incidente concreto: una persona del personal no
 * pudo entrar durante dias porque «he olvidado mi contrasena» fallaba
 * siempre.
 *
 * La causa era este reparto. La libreria de Supabase usa UN SOLO almacen
 * para dos cosas que necesitan vidas distintas:
 *
 *   - LA SESION debe morir al cerrar la pestana. En un ordenador compartido
 *     de oficina, si no, la siguiente persona entra con la sesion anterior.
 *   - EL VERIFICADOR de un enlace pedido por correo NO PUEDE morir con la
 *     pestana: el correo se abre en otra, y alli el verificador ya no esta.
 *
 * Lo que se comprueba es exactamente ese reparto, porque es invisible
 * mirando el codigo de las pantallas y porque volver a romperlo no daria
 * ningun error: simplemente, nadie podria recuperar su contrasena.
 */
describe('reparto entre sesion y verificador', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('la sesion vive en sessionStorage y no sobrevive a la pestana', () => {
    const almacen = createSafeStorage();

    almacen?.setItem('sb-proyecto-auth-token', 'sesion');

    expect(window.sessionStorage.getItem('sb-proyecto-auth-token')).toBe('sesion');
    // Lo que importa: NO queda nada en el almacen que sobrevive al navegador.
    expect(window.localStorage.getItem('sb-proyecto-auth-token')).toBeNull();
  });

  it('el verificador vive en localStorage, para que exista en la pestana nueva', () => {
    const almacen = createSafeStorage();

    almacen?.setItem('sb-proyecto-auth-token-code-verifier', 'verificador');

    expect(window.localStorage.getItem('sb-proyecto-auth-token-code-verifier')).toBe('verificador');
    expect(window.sessionStorage.getItem('sb-proyecto-auth-token-code-verifier')).toBeNull();
  });

  it('tambien las claves por flujo, que son las que usa la libreria hoy', () => {
    const almacen = createSafeStorage();
    const clave = 'sb-proyecto-auth-token-flow-abc123-code-verifier';

    almacen?.setItem(clave, 'verificador');

    expect(window.localStorage.getItem(clave)).toBe('verificador');
  });

  it('lo lee de donde lo guardo', () => {
    const almacen = createSafeStorage();

    almacen?.setItem('sb-proyecto-auth-token', 'sesion');
    almacen?.setItem('sb-proyecto-auth-token-code-verifier', 'verificador');

    expect(almacen?.getItem('sb-proyecto-auth-token')).toBe('sesion');
    expect(almacen?.getItem('sb-proyecto-auth-token-code-verifier')).toBe('verificador');
  });

  it('lo borra de donde lo guardo', () => {
    const almacen = createSafeStorage();

    almacen?.setItem('sb-proyecto-auth-token-code-verifier', 'verificador');
    almacen?.removeItem('sb-proyecto-auth-token-code-verifier');

    expect(window.localStorage.getItem('sb-proyecto-auth-token-code-verifier')).toBeNull();
  });
});
