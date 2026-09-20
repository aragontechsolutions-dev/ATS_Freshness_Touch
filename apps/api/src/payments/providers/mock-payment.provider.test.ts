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
