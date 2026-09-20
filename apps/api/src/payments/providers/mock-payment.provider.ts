import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { PaymentProviderName, PaymentStatus } from '@freshness/types';
import { PaymentStatusSchema } from '@freshness/types';
import {
  WebhookSignatureError,
  type DepositHoldRequest,
  type PaymentProvider,
  type ProviderPayment,
  type ProviderWebhookEvent,
} from '../payments.types';

/**
 * PROVEEDOR SIMULADO
 * ------------------
 * Permite desarrollar y probar el flujo completo de pago sin dar de alta una
 * cuenta de Stripe y sin mover dinero. Es el proveedor por defecto.
 *
 * NO GUARDA ESTADO. La fuente de verdad de lo que ha pasado con cada deposito
 * es nuestra propia tabla `payments`, no este objeto: una simulacion con
 * memoria en el proceso mentiria en cuanto la API se reiniciase o se
 * desplegara en mas de una instancia.
 *
 * Imita el formato de identificadores de Stripe a proposito, para que el
 * codigo que los consume no descubra diferencias al cambiar de proveedor.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name: PaymentProviderName = 'mock';
  readonly webhookSignatureHeader = 'x-mock-signature';

  constructor(
    private readonly webhookSecret: string,
    private readonly authorizationDays: number,
  ) {}

  createDepositHold(request: DepositHoldRequest): Promise<ProviderPayment> {
    const id = `pi_mock_${randomBytes(12).toString('hex')}`;

    return Promise.resolve({
      providerPaymentIntentId: id,
      // Igual que en Stripe: la retencion nace esperando a que el navegador
      // confirme la tarjeta. Hasta entonces no hay fondos bloqueados.
      status: 'REQUIRES_CONFIRMATION',
      clientSecret: `${id}_secret_${randomBytes(16).toString('hex')}`,
      amountAuthorizedCents: request.amountCents,
      amountCapturedCents: 0,
      providerCustomerId: `cus_mock_${randomBytes(8).toString('hex')}`,
      cardBrand: null,
      cardLast4: null,
      expiresAt: new Date(Date.now() + this.authorizationDays * 86_400_000),
      lastError: null,
    });
  }

  capture(providerPaymentIntentId: string, amountCents: number): Promise<ProviderPayment> {
    return Promise.resolve({
      ...this.base(providerPaymentIntentId),
      status: 'SUCCEEDED',
      amountAuthorizedCents: amountCents,
      amountCapturedCents: amountCents,
    });
  }

  cancel(providerPaymentIntentId: string): Promise<ProviderPayment> {
    return Promise.resolve({ ...this.base(providerPaymentIntentId), status: 'CANCELED' });
  }

  /**
   * Verifica una firma HMAC-SHA256 del cuerpo crudo en hexadecimal.
   *
   * Es mas simple que el esquema de Stripe, pero ejercita exactamente lo que
   * importa: que sin la clave compartida no se puede fabricar un evento, y que
   * la comparacion no filtra informacion por el tiempo que tarda.
   */
  parseWebhook(rawBody: Buffer, signature: string | undefined): ProviderWebhookEvent {
    if (!signature) {
      throw new WebhookSignatureError('Falta la cabecera de firma');
    }

    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    const recibida = Buffer.from(signature, 'utf8');
    const esperada = Buffer.from(expected, 'utf8');

    if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) {
      throw new WebhookSignatureError('Firma invalida');
    }

    return this.translate(parseJson(rawBody));
  }

  /** Genera una firma valida. Solo la usan las pruebas y el desarrollo local. */
  sign(rawBody: Buffer | string): string {
    return createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
  }

  private base(providerPaymentIntentId: string): ProviderPayment {
    return {
      providerPaymentIntentId,
      status: 'REQUIRES_CAPTURE',
      clientSecret: null,
      amountAuthorizedCents: 0,
      amountCapturedCents: 0,
      providerCustomerId: null,
      cardBrand: null,
      cardLast4: null,
      expiresAt: null,
      lastError: null,
    };
  }

  /** Traduce el cuerpo del evento, que imita la forma de los de Stripe. */
  private translate(payload: unknown): ProviderWebhookEvent {
    const event = payload as {
      id?: unknown;
      type?: unknown;
      data?: { object?: Record<string, unknown> };
    };

    if (typeof event.id !== 'string' || typeof event.type !== 'string') {
      throw new WebhookSignatureError('El evento no tiene identificador ni tipo');
    }

    const object = event.data?.object;
    const id = object?.['id'];
    const estado = PaymentStatusSchema.safeParse(object?.['status']);

    const payment: ProviderPayment | null =
      typeof id === 'string' && estado.success
        ? {
            providerPaymentIntentId: id,
            status: estado.data satisfies PaymentStatus,
            clientSecret: null,
            amountAuthorizedCents: numberOr(object?.['amount'], 0),
            amountCapturedCents: numberOr(object?.['amount_received'], 0),
            providerCustomerId: null,
            cardBrand: stringOrNull(object?.['card_brand']),
            cardLast4: stringOrNull(object?.['card_last4']),
            expiresAt: null,
            lastError: null,
          }
        : null;

    return { id: event.id, type: event.type, payment, payload };
  }
}

function parseJson(rawBody: Buffer): unknown {
  try {
    return JSON.parse(rawBody.toString('utf8'));
  } catch {
    // La firma ya era valida, asi que un JSON roto solo puede venir de un
    // error de quien lo envia. Se rechaza igual que una firma invalida.
    throw new WebhookSignatureError('El cuerpo del evento no es JSON valido');
  }
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
