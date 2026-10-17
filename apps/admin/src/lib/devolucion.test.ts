import { describe, expect, it } from 'vitest';
import { centavosADevolver } from './devolucion';

describe('centavosADevolver', () => {
  it('vacio significa todo lo que quede', () => {
    expect(centavosADevolver('', 3500)).toBe(3500);
    expect(centavosADevolver('   ', 3500)).toBe(3500);
  });

  it('convierte dolares a centavos', () => {
    expect(centavosADevolver('20', 3500)).toBe(2000);
    expect(centavosADevolver('12.50', 3500)).toBe(1250);
    expect(centavosADevolver('0.99', 3500)).toBe(99);
  });

  it('no deja pasar mas de lo que queda', () => {
    expect(centavosADevolver('36', 3500)).toBeNull();
    expect(centavosADevolver('35.01', 3500)).toBeNull();
    // El limite exacto si vale.
    expect(centavosADevolver('35', 3500)).toBe(3500);
  });

  it('el cero y los negativos no son importes', () => {
    expect(centavosADevolver('0', 3500)).toBeNull();
    expect(centavosADevolver('0.00', 3500)).toBeNull();
    expect(centavosADevolver('-10', 3500)).toBeNull();
  });

  /**
   * LA PRUEBA QUE JUSTIFICA NO USAR `parseFloat` A SECAS. Con el, «12abc»
   * vale 12 y «1,5» vale 1: el segundo cobraria un dolar donde se queria
   * devolver uno cincuenta, y nadie lo notaria hasta que el cliente llamara.
   */
  it('lo que no es un numero no se interpreta a medias', () => {
    expect(centavosADevolver('12abc', 3500)).toBeNull();
    expect(centavosADevolver('1,5', 3500)).toBeNull();
    expect(centavosADevolver('abc', 3500)).toBeNull();
    expect(centavosADevolver('1e2', 3500)).toBeNull();
    expect(centavosADevolver('.5', 3500)).toBeNull();
  });

  it('con mas de dos decimales tampoco: no existe medio centavo', () => {
    expect(centavosADevolver('10.005', 3500)).toBeNull();
  });

  it('si no queda nada por devolver, no hay importe posible', () => {
    expect(centavosADevolver('', 0)).toBeNull();
    expect(centavosADevolver('10', 0)).toBeNull();
  });
});
