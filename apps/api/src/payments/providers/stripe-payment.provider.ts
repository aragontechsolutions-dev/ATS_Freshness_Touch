import Stripe from 'stripe';
import type { PaymentProviderName, PaymentStatus } from '@freshness/types';
import {
  PaymentProviderError,
  WebhookSignatureError,
  type DepositHoldRequest,
  type PaymentProvider,
  type ProviderPayment,
  type ProviderWebhookEvent,
} from '../payments.types';

export interface StripeProviderOptions {
  secretKey: string;
  webhookSecret: string;
  timeoutMs: number;
  /** Dias que dura la autorizacion antes de caducar (7 en tarjetas de credito). */
  authorizationDays: number;
  /**
   * Texto que ve el cliente en el extracto bancario junto al nombre de la
   * empresa. Si no lo reconoce, reclama al banco y eso cuesta dinero y
   * reputacion.
   */
  statementDescriptorSuffix: string;
}

/**
 * PROVEEDOR REAL: STRIPE
 * ----------------------
 * Crea una autorizacion con captura manual (`capture_method: 'manual'`): los
 * fondos quedan RETENIDOS en la tarjeta del cliente, no cobrados. Se capturan
 * si el cliente cancela fuera de plazo o no esta en casa, y se liberan cuando
 * el servicio se presta con normalidad.
 *
 * Solo se admite tarjeta. Otros metodos de pago que Stripe podria ofrecer
 * (transferencias, pagos diferidos) no soportan retencion y captura posterior,
 * que es justo lo que este deposito necesita.
 *
 * Los datos de la tarjeta NUNCA pasan por este servidor: el navegador los
 * envia directamente a Stripe usando el `client_secret`.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name: PaymentProviderName = 'stripe';
  readonly webhookSignatureHeader = 'stripe-signature';

  private readonly stripe: Stripe;

  constructor(private readonly options: StripeProviderOptions) {
    this.stripe = new Stripe(options.secretKey, {
      // No se fija `apiVersion` a mano: la libreria usa la version con la que
      // se generaron sus propios tipos, asi que codigo y tipos no pueden
      // desincronizarse al actualizar.
      timeout: options.timeoutMs,
      // Reintentos solo de peticiones que Stripe considera seguras de
      // repetir; combinado con la clave de idempotencia, nunca duplican cargos.
      maxNetworkRetries: 2,
      telemetry: false,
    });
  }

  async createDepositHold(request: DepositHoldRequest): Promise<ProviderPayment> {
    try {
      const intent = await this.stripe.paymentIntents.create(
        {
          amount: request.amountCents,
          currency: 'usd',
          // Retener, no cobrar.
          capture_method: 'manual',
          payment_method_types: ['card'],
          description: `Deposito de traslado - reserva ${request.bookingReference}`,
          receipt_email: request.customer.email,
          statement_descriptor_suffix: this.options.statementDescriptorSuffix,
          // Permite reconciliar desde el panel de Stripe sin consultar nuestra
          // base de datos. No se envia ningun dato sensible del domicilio.
          metadata: {
            bookingId: request.bookingId,
            bookingReference: request.bookingReference,
          },
        },
        { idempotencyKey: request.idempotencyKey },
      );

      return this.translate(intent);
    } catch (error) {
      throw toProviderError(error, 'No se pudo crear la retencion del deposito');
    }
  }

  async capture(providerPaymentIntentId: string, amountCents: number): Promise<ProviderPayment> {
    try {
      const intent = await this.stripe.paymentIntents.capture(providerPaymentIntentId, {
        amount_to_capture: amountCents,
        expand: ['latest_charge'],
      });
      return this.translate(intent);
    } catch (error) {
      throw toProviderError(error, 'No se pudo capturar el deposito');
    }
  }

  async cancel(providerPaymentIntentId: string, reason: string): Promise<ProviderPayment> {
    try {
      const intent = await this.stripe.paymentIntents.cancel(providerPaymentIntentId, {
        cancellation_reason: isCancellationReason(reason) ? reason : 'abandoned',
      });
      return this.translate(intent);
    } catch (error) {
      throw toProviderError(error, 'No se pudo liberar la retencion');
    }
  }

  parseWebhook(rawBody: Buffer, signature: string | undefined): ProviderWebhookEvent {
    if (!signature) {
      throw new WebhookSignatureError('Falta la cabecera stripe-signature');
    }

    let event: Stripe.Event;
    try {
      // Verifica la firma Y la marca de tiempo: un evento capturado por un
      // tercero no se puede reenviar pasada la ventana de tolerancia.
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.options.webhookSecret);
    } catch (error) {
      throw new WebhookSignatureError(
        error instanceof Error ? error.message : 'Firma de Stripe invalida',
      );
    }

    const object = event.data.object as { object?: string };
    const payment =
      object.object === 'payment_intent'
        ? this.translate(event.data.object as Stripe.PaymentIntent)
        : null;

    return { id: event.id, type: event.type, payment, payload: event };
  }

  /** Traduce un PaymentIntent de Stripe al modelo interno. */
  private translate(intent: Stripe.PaymentIntent): ProviderPayment {
    const card = extractCard(intent);

    return {
      providerPaymentIntentId: intent.id,
      status: mapStatus(intent.status),
      clientSecret: intent.client_secret,
      amountAuthorizedCents: intent.amount,
      amountCapturedCents: intent.amount_received,
      providerCustomerId: typeof intent.customer === 'string' ? intent.customer : null,
      cardBrand: card?.brand ?? null,
      cardLast4: card?.last4 ?? null,
      // Stripe no publica la fecha de caducidad de la autorizacion: la regla
      // de las redes de tarjetas son 7 dias desde que se creo.
      expiresAt: new Date((intent.created + this.options.authorizationDays * 86_400) * 1000),
      lastError: intent.last_payment_error
        ? {
            code: intent.last_payment_error.code ?? null,
            message: intent.last_payment_error.message ?? 'Error del proveedor',
          }
        : null,
    };
  }
}

/**
 * Traduccion de estados. Stripe distingue mas situaciones de las que nos
 * interesan, pero ninguna se colapsa en otra que signifique algo distinto:
 * mezclar "esperando al banco" con "esperando al cliente" haria que soporte
 * leyera mal la situacion.
 */
function mapStatus(status: Stripe.PaymentIntent.Status): PaymentStatus {
  switch (status) {
    case 'requires_payment_method':
      return 'REQUIRES_PAYMENT_METHOD';
    case 'requires_confirmation':
      return 'REQUIRES_CONFIRMATION';
    case 'requires_action':
      return 'REQUIRES_ACTION';
    case 'processing':
      return 'PROCESSING';
    case 'requires_capture':
      return 'REQUIRES_CAPTURE';
    case 'succeeded':
      return 'SUCCEEDED';
    case 'canceled':
      return 'CANCELED';
    default:
      // Estado nuevo en la API de Stripe: se marca como fallido para que
      // alguien lo revise, en vez de darlo por bueno en silencio.
      return 'FAILED';
  }
}

/** Marca y ultimos cuatro digitos, si el cargo viene expandido. */
function extractCard(intent: Stripe.PaymentIntent): { brand: string; last4: string } | null {
  const charge = intent.latest_charge;
  if (!charge || typeof charge === 'string') return null;

  const card = charge.payment_method_details?.card;
  if (!card?.brand || !card.last4) return null;

  return { brand: card.brand, last4: card.last4 };
}

const CANCELLATION_REASONS = [
  'duplicate',
  'fraudulent',
  'requested_by_customer',
  'abandoned',
] as const;

function isCancellationReason(reason: string): reason is (typeof CANCELLATION_REASONS)[number] {
  return (CANCELLATION_REASONS as readonly string[]).includes(reason);
}

/**
 * Convierte un error de Stripe en uno nuestro.
 *
 * SEGURIDAD: el mensaje de Stripe puede contener detalles de la cuenta o de la
 * peticion. Se conserva para el log del servidor, pero el filtro de
 * excepciones nunca lo envia al navegador.
 */
function toProviderError(error: unknown, contexto: string): PaymentProviderError {
  if (error instanceof Stripe.errors.StripeError) {
    return new PaymentProviderError(`${contexto}: ${error.message}`, error.code ?? error.type);
  }
  return new PaymentProviderError(
    `${contexto}: ${error instanceof Error ? error.message : 'error desconocido'}`,
  );
}
