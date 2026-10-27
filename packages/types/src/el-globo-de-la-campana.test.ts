import { describe, expect, it } from 'vitest';
import { NOTIFICATION_BADGE_MAX, notificationBadge } from './index';

/**
 * EL GLOBO DE LA CAMPANA
 * ----------------------
 * Tres lineas, y las tres con un borde: el cero, el tope y lo que hay justo
 * encima del tope. Es de esas funciones que se escriben de memoria y se
 * escriben al reves.
 */

describe('lo que pone el globo', () => {
  /*
   * CON CERO NO SE PINTA. Un globo con un cero dentro es ruido que pide
   * atencion para decir que no pasa nada.
   */
  it('con nada sin leer, cadena vacia', () => {
    expect(notificationBadge(0)).toBe('');
  });

  it('y un numero negativo tampoco pinta nada', () => {
    expect(notificationBadge(-3)).toBe('');
  });

  it('del uno al nueve, el numero', () => {
    expect(notificationBadge(1)).toBe('1');
    expect(notificationBadge(5)).toBe('5');
    expect(notificationBadge(9)).toBe('9');
  });

  /*
   * EL BORDE: nueve todavia es nueve. Si esta prueba se pone en roja porque
   * alguien cambio el `>` por un `>=`, el panel dira «+9» cuando hay nueve
   * exactas, que es un numero que cabe perfectamente.
   */
  it('nueve es nueve, no «+9»', () => {
    expect(notificationBadge(NOTIFICATION_BADGE_MAX)).toBe('9');
  });

  it('a partir de diez, «+9»', () => {
    expect(notificationBadge(10)).toBe('+9');
    expect(notificationBadge(47)).toBe('+9');
  });

  /*
   * SE PARA AHI porque el numero exacto no cambia ninguna decision: con diez
   * sin leer y con cuarenta se hace lo mismo —abrirlas—, y un «47» en un
   * globo de dieciseis pixeles no se lee, solo ensucia.
   */
  it('y con muchisimas sigue siendo «+9», no un numero ilegible', () => {
    expect(notificationBadge(1000)).toBe('+9');
  });
});
