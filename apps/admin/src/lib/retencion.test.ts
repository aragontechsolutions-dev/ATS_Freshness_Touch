import { describe, expect, it } from 'vitest';
import { claveDeRetencion, diasDeRetencion } from './retencion';

/**
 * LOS DIAS QUE LE QUEDAN A UNA RETENCION
 * --------------------------------------
 * Dos bordes, y los dos se escriben al reves con facilidad: el redondeo y el
 * dia del vencimiento. De lo que se diga aqui depende que alguien cobre unos
 * dolares a los que tenia derecho o los deje caducar.
 */

const AHORA = Date.parse('2026-10-27T12:00:00.000Z');

describe('cuantos dias quedan', () => {
  it('sin fecha de caducidad no se puede decir', () => {
    expect(diasDeRetencion(null, AHORA)).toBeNull();
  });

  it('una fecha que no es una fecha tampoco', () => {
    expect(diasDeRetencion('el martes', AHORA)).toBeNull();
  });

  it('siete dias justos son siete', () => {
    expect(diasDeRetencion('2026-11-03T12:00:00.000Z', AHORA)).toBe(7);
  });

  /*
   * EL REDONDEO HACIA ARRIBA. Veintitres horas son "1 dia" y no "0": decir
   * cero cuando todavia se puede cobrar empuja a no intentarlo.
   */
  it('veintitres horas es un dia, no cero', () => {
    expect(diasDeRetencion('2026-10-28T11:00:00.000Z', AHORA)).toBe(1);
  });

  it('una hora tambien es un dia', () => {
    expect(diasDeRetencion('2026-10-27T13:00:00.000Z', AHORA)).toBe(1);
  });

  it('justo al vencer son cero', () => {
    expect(diasDeRetencion('2026-10-27T12:00:00.000Z', AHORA)).toBe(0);
  });

  it('y pasada la fecha, negativo', () => {
    expect(diasDeRetencion('2026-10-25T12:00:00.000Z', AHORA)).toBe(-2);
  });
});

describe('que se le dice a quien mira', () => {
  it('con dias por delante, cuantos quedan', () => {
    expect(claveDeRetencion(3)).toBe('admin.holdStillOpen');
  });

  /*
   * EL BORDE QUE IMPORTA: cero dias es «caduca hoy», no «caducada». Si esta
   * prueba se pone en rojo porque alguien cambio el `< 0` por un `<= 0`, lo
   * que acaba de pasar es que el panel dice que no se puede cobrar algo que
   * todavia se puede cobrar.
   */
  it('el dia del vencimiento todavia se puede cobrar', () => {
    expect(claveDeRetencion(0)).toBe('admin.holdStillOpenToday');
  });

  it('pasado el plazo, caducada', () => {
    expect(claveDeRetencion(-1)).toBe('admin.holdStillOpenExpired');
  });

  /*
   * SIN FECHA SE TRATA COMO CADUCADA. Una retencion de la que no se sabe
   * cuando vence no se puede prometer que siga sirviendo, y empujar a
   * cobrarla seria empujar a un fallo del proveedor.
   */
  it('sin fecha, se trata como caducada', () => {
    expect(claveDeRetencion(null)).toBe('admin.holdStillOpenExpired');
  });
});
