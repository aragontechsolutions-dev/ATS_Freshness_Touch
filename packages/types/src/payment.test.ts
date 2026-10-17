import { describe, expect, it } from 'vitest';
import { AdminRefundDepositSchema } from './admin';
import { refundableCents, type RefundableAmounts } from './payment';

/**
 * LO QUE SE PUEDE DEVOLVER
 * ------------------------
 * Esta funcion decide dos cosas a la vez: si el panel ofrece el boton de
 * devolver, y si el servidor acepta la peticion. Que sea LA MISMA es el punto:
 * escrita dos veces, un dia una diria 35 y la otra 20, y el sintoma seria un
 * boton que no hace nada.
 */

function pago(overrides: Partial<RefundableAmounts> = {}): RefundableAmounts {
  return {
    status: 'SUCCEEDED',
    amountCapturedCents: 3500,
    amountRefundedCents: 0,
    ...overrides,
  };
}

describe('refundableCents', () => {
  it('de un cobro intacto se puede devolver todo', () => {
    expect(refundableCents(pago())).toBe(3500);
  });

  it('descuenta lo que ya se devolvio', () => {
    expect(refundableCents(pago({ amountRefundedCents: 2000 }))).toBe(1500);
  });

  it('de un cobro ya devuelto entero no queda nada', () => {
    expect(refundableCents(pago({ amountRefundedCents: 3500 }))).toBe(0);
  });

  /**
   * UNA RETENCION VIVA NO SE DEVUELVE, SE LIBERA. Es la confusion que esta
   * funcion existe para impedir: no ha salido dinero de ninguna cuenta, y
   * «devolverlo» le dejaria al cliente un cargo y un abono en el extracto por
   * un dinero que nunca se movio.
   */
  it('una retencion autorizada y sin cobrar no es devolvible', () => {
    expect(refundableCents(pago({ status: 'REQUIRES_CAPTURE', amountCapturedCents: 0 }))).toBe(0);
  });

  it('una retencion liberada tampoco', () => {
    expect(refundableCents(pago({ status: 'CANCELED', amountCapturedCents: 0 }))).toBe(0);
  });

  /*
   * Ni siquiera si por algun camino raro quedara un importe cobrado en una
   * fila que no esta en `SUCCEEDED`: el estado manda, porque es el unico que
   * dice que el dinero esta de verdad en la cuenta de la empresa.
   */
  it('el estado manda sobre los importes', () => {
    expect(refundableCents(pago({ status: 'PROCESSING', amountCapturedCents: 3500 }))).toBe(0);
  });

  it('nunca devuelve un numero negativo', () => {
    // Pasaria si alguien devolviera desde el panel del proveedor y nuestra
    // fila se enterara a medias. Un negativo aqui seria un boton absurdo.
    expect(refundableCents(pago({ amountRefundedCents: 9000 }))).toBe(0);
  });
});

describe('AdminRefundDepositSchema', () => {
  it('sin importe significa «todo lo que quede»', () => {
    const parsed = AdminRefundDepositSchema.safeParse({ reason: 'el equipo no llego a salir' });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.amountCents).toBeUndefined();
  });

  it('exige un motivo: una devolucion es dinero que sale de la empresa', () => {
    expect(AdminRefundDepositSchema.safeParse({ amountCents: 1000 }).success).toBe(false);
    expect(AdminRefundDepositSchema.safeParse({ amountCents: 1000, reason: 'ok' }).success).toBe(
      false,
    );
  });

  it('rechaza importes que no son dinero', () => {
    const motivo = 'devolucion acordada';

    expect(AdminRefundDepositSchema.safeParse({ amountCents: 0, reason: motivo }).success).toBe(
      false,
    );
    expect(AdminRefundDepositSchema.safeParse({ amountCents: -500, reason: motivo }).success).toBe(
      false,
    );
    expect(AdminRefundDepositSchema.safeParse({ amountCents: 10.5, reason: motivo }).success).toBe(
      false,
    );
  });

  it('rechaza campos de mas', () => {
    // Estricto a proposito: un campo que se ignora en silencio es un campo
    // que alguien cree que ha guardado.
    const parsed = AdminRefundDepositSchema.safeParse({
      reason: 'devolucion acordada',
      providerRefundId: 're_inventado',
    });

    expect(parsed.success).toBe(false);
  });
});
