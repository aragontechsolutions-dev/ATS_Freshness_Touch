import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { WebhookSignatureError } from '../payments.types';
import { MockPaymentProvider } from './mock-payment.provider';

const SECRETO = 'secreto-de-prueba';
const provider = new MockPaymentProvider(SECRETO, 7);

const PETICION = {
  bookingId: '11111111-1111-4111-8111-111111111111',
  bookingReference: 'FT-2026-0001',
  amountCents: 4200,
  customer: { email: 'ana@example.com', name: 'Ana Perez' },
  idempotencyKey: 'clave',
};

describe('retencion del deposito', () => {
  it('nace esperando a que el navegador confirme la tarjeta', async () => {
    const pago = await provider.createDepositHold(PETICION);

    expect(pago.status).toBe('REQUIRES_CONFIRMATION');
    expect(pago.amountAuthorizedCents).toBe(4200);
    // Todavia no hay nada cobrado: es una retencion, no un cargo.
    expect(pago.amountCapturedCents).toBe(0);
    expect(pago.clientSecret).toMatch(/^pi_mock_[0-9a-f]+_secret_[0-9a-f]+$/);
  });

  it('cada retencion tiene su propio identificador', async () => {
    const [uno, dos] = await Promise.all([
      provider.createDepositHold(PETICION),
      provider.createDepositHold(PETICION),
    ]);
    expect(uno.providerPaymentIntentId).not.toBe(dos.providerPaymentIntentId);
  });

  it('la autorizacion caduca dentro del plazo configurado', async () => {
    const pago = await provider.createDepositHold(PETICION);
    const dias = (pago.expiresAt!.getTime() - Date.now()) / 86_400_000;

    // Siete dias es el plazo de las redes de tarjetas.
    expect(dias).toBeGreaterThan(6.9);
    expect(dias).toBeLessThanOrEqual(7);
  });

  it('capturar deja el importe cobrado', async () => {
    const pago = await provider.capture('pi_mock_abc', 4200);
    expect(pago.status).toBe('SUCCEEDED');
    expect(pago.amountCapturedCents).toBe(4200);
  });

  it('cancelar libera la retencion sin cobrar nada', async () => {
    const pago = await provider.cancel('pi_mock_abc', 'abandoned');
    expect(pago.status).toBe('CANCELED');
    expect(pago.amountCapturedCents).toBe(0);
  });
});

describe('firma del webhook', () => {
  const cuerpo = Buffer.from(
    JSON.stringify({
      id: 'evt_1',
      type: 'payment_intent.amount_capturable_updated',
      data: { object: { id: 'pi_mock_abc', status: 'REQUIRES_CAPTURE', amount: 4200 } },
    }),
  );

  it('acepta un evento firmado con la clave compartida', () => {
    const evento = provider.parseWebhook(cuerpo, provider.sign(cuerpo));

    expect(evento.id).toBe('evt_1');
    expect(evento.payment?.providerPaymentIntentId).toBe('pi_mock_abc');
    expect(evento.payment?.status).toBe('REQUIRES_CAPTURE');
  });

  it('rechaza un evento sin firma', () => {
    // Sin esta comprobacion, cualquiera podria avisar de que un deposito
    // quedo retenido y confirmar reservas que nadie ha pagado.
    expect(() => provider.parseWebhook(cuerpo, undefined)).toThrow(WebhookSignatureError);
  });

  it('rechaza un evento firmado con otra clave', () => {
    const falsa = createHmac('sha256', 'clave-equivocada').update(cuerpo).digest('hex');
    expect(() => provider.parseWebhook(cuerpo, falsa)).toThrow(WebhookSignatureError);
  });

  it('rechaza un evento manipulado despues de firmarlo', () => {
    const firma = provider.sign(cuerpo);
    const alterado = Buffer.from(cuerpo.toString('utf8').replace('4200', '1'));

    expect(() => provider.parseWebhook(alterado, firma)).toThrow(WebhookSignatureError);
  });

  it('rechaza una firma de longitud distinta sin romperse', () => {
    // timingSafeEqual lanza si los buffers no miden lo mismo: hay que
    // comprobarlo antes o el endpoint devolveria un 500 en vez de un 401.
    expect(() => provider.parseWebhook(cuerpo, 'corta')).toThrow(WebhookSignatureError);
  });

  it('un evento que no habla de un pago se acepta pero no lleva movimiento', () => {
    const otro = Buffer.from(JSON.stringify({ id: 'evt_2', type: 'ping', data: {} }));
    const evento = provider.parseWebhook(otro, provider.sign(otro));

    expect(evento.payment).toBeNull();
  });
});

describe('devoluciones (etapa 3.21)', () => {
  const PETICION_DEVOLUCION = {
    providerPaymentIntentId: 'pi_mock_abc',
    bookingReference: 'FT-2026-0001',
    amountCents: 2000,
    idempotencyKey: 'clave',
  };

  it('devuelve el importe pedido, con identificador propio', async () => {
    const devolucion = await provider.refund(PETICION_DEVOLUCION);

    expect(devolucion.amountCents).toBe(2000);
    expect(devolucion.status).toBe('SUCCEEDED');
    /*
     * `re_` y no `pi_`: una devolucion es un movimiento distinto del cobro.
     * El simulador imita el formato del proveedor real para que el codigo
     * que los consume no descubra diferencias al cambiar de proveedor.
     */
    expect(devolucion.providerRefundId).toMatch(/^re_mock_[0-9a-f]{24}$/);
  });

  it('cada devolucion tiene su propio identificador', async () => {
    const [uno, dos] = await Promise.all([
      provider.refund(PETICION_DEVOLUCION),
      provider.refund(PETICION_DEVOLUCION),
    ]);

    expect(uno.providerRefundId).not.toBe(dos.providerRefundId);
  });

  it('NO LLEVA LA CUENTA de lo que ya se devolvio, y es a proposito', async () => {
    /*
     * El simulador no guarda estado: la fuente de verdad de cuanto se cobro
     * y cuanto se devolvio es la tabla `payments`. Si el limite lo pusiera
     * este objeto, se perderia al reiniciar la API y no existiria con dos
     * instancias desplegadas, que es justo cuando hace falta.
     */
    const grande = await provider.refund({ ...PETICION_DEVOLUCION, amountCents: 999_999 });

    expect(grande.amountCents).toBe(999_999);
  });
});

describe('avisos de devolucion (etapa 3.22)', () => {
  function firmado(evento: Record<string, unknown>) {
    const cuerpo = Buffer.from(JSON.stringify(evento));
    return provider.parseWebhook(cuerpo, provider.sign(cuerpo));
  }

  const DEVOLUCION = {
    id: 'evt_1',
    type: 'refund.failed',
    data: {
      object: {
        object: 'refund',
        id: 're_mock_1',
        payment_intent: 'pi_mock_1',
        amount: 2000,
        status: 'failed',
        failure_reason: 'expired_or_canceled_card',
      },
    },
  };

  it('traduce la devolucion y dice a que cobro pertenece', () => {
    const evento = firmado(DEVOLUCION);

    expect(evento.refund).toEqual({
      providerPaymentIntentId: 'pi_mock_1',
      providerRefundId: 're_mock_1',
      amountCents: 2000,
      status: 'FAILED',
      failureReason: 'expired_or_canceled_card',
    });
  });

  /**
   * LA PRUEBA QUE EVITA EL FALLO CARO. El estado `failed` de una DEVOLUCION
   * no es el `FAILED` de un pago. Sin la marca `object: 'refund'`, el
   * traductor lo tomaria por un deposito rechazado y el webhook cancelaria
   * una reserva que esta pagada.
   */
  it('un aviso de devolucion NO se traduce como un pago', () => {
    const evento = firmado(DEVOLUCION);

    expect(evento.payment).toBeNull();
  });

  it('un aviso de pago sigue sin traer devolucion', () => {
    const evento = firmado({
      id: 'evt_2',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_mock_2', status: 'SUCCEEDED', amount: 3500 } },
    });

    expect(evento.refund).toBeNull();
    expect(evento.payment?.providerPaymentIntentId).toBe('pi_mock_2');
  });

  it('una devolucion sin cobro al que pertenecer se ignora', () => {
    // Sin `payment_intent` no hay fila nuestra que tocar, y adivinarla seria
    // peor que ignorar el aviso.
    const evento = firmado({
      id: 'evt_3',
      type: 'refund.failed',
      data: { object: { object: 'refund', id: 're_mock_3', amount: 100, status: 'failed' } },
    });

    expect(evento.refund).toBeNull();
  });

  it('una devolucion que va bien se traduce igual, con su estado', () => {
    const evento = firmado({
      id: 'evt_4',
      type: 'refund.updated',
      data: {
        object: {
          object: 'refund',
          id: 're_mock_4',
          payment_intent: 'pi_mock_4',
          amount: 500,
          status: 'succeeded',
        },
      },
    });

    expect(evento.refund?.status).toBe('SUCCEEDED');
    expect(evento.refund?.failureReason).toBeNull();
  });
});
