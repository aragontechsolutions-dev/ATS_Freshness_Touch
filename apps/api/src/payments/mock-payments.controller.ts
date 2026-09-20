import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Post,
  UsePipes,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  API_ERROR_CODES,
  MockPaymentConfirmRequestSchema,
  type MockPaymentConfirmRequest,
  type MockPaymentConfirmResponse,
} from '@freshness/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PrismaService } from '../database/prisma.service';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payments.types';
import { WebhooksService } from './webhooks.service';

/**
 * CONFIRMACION DE TARJETA SIMULADA
 * --------------------------------
 * Con Stripe, el navegador confirma la tarjeta contra sus servidores y estos
 * nos avisan por webhook. El simulador no tiene servidores, asi que sin este
 * endpoint el formulario de reserva no se podria probar entero: la reserva se
 * quedaria siempre pendiente de pago.
 *
 * Hace exactamente lo que haria el proveedor real: construye el evento y lo
 * mete por el MISMO procesamiento que los webhooks autenticos, con su
 * idempotencia y su sincronizacion de la reserva. Asi lo que se prueba es el
 * camino de verdad y no un atajo.
 *
 * SEGURIDAD
 * - Con PAYMENT_PROVIDER=stripe la ruta responde 404, indistinguible de una
 *   ruta que no existe: no revela que el sistema tiene un modo simulado.
 * - Cuando esta activa, el unico dinero que puede mover es dinero que no
 *   existe, porque el simulador no cobra nada.
 * - Hace falta el `clientSecret` completo, que solo recibe quien acaba de
 *   crear la reserva.
 */
@Controller('payments/mock')
export class MockPaymentsController {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly webhooks: WebhooksService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { limit: 20, ttl: 60_000 }, quotes: { limit: 20, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe<MockPaymentConfirmRequest>(MockPaymentConfirmRequestSchema))
  async confirm(@Body() request: MockPaymentConfirmRequest): Promise<MockPaymentConfirmResponse> {
    if (this.provider.name !== 'mock') {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        messageKey: 'calculator.errorGeneric',
      });
    }

    // El identificador va delante del separador, igual que en Stripe.
    const [paymentIntentId] = request.clientSecret.split('_secret_');
    if (!paymentIntentId?.startsWith('pi_mock_')) {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        messageKey: 'booking.errorPaymentNotFound',
      });
    }

    const pago = await this.prisma.db.payment.findUnique({
      where: {
        provider_providerPaymentIntentId: {
          provider: 'mock',
          providerPaymentIntentId: paymentIntentId,
        },
      },
      select: { amountAuthorizedCents: true, bookingId: true },
    });

    if (!pago) {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        messageKey: 'booking.errorPaymentNotFound',
      });
    }

    const autoriza = request.outcome === 'AUTHORIZE';
    const status = autoriza ? 'REQUIRES_CAPTURE' : 'FAILED';

    await this.webhooks.handle({
      /*
       * Identificador derivado del pago y del resultado, no aleatorio: si el
       * cliente pulsa dos veces "pagar", la segunda vez es el mismo evento y
       * la idempotencia lo ignora, en vez de procesarlo otra vez.
       */
      id: `evt_mock_${paymentIntentId}_${request.outcome}`,
      type: autoriza ? 'payment_intent.amount_capturable_updated' : 'payment_intent.payment_failed',
      payment: {
        providerPaymentIntentId: paymentIntentId,
        status,
        clientSecret: null,
        amountAuthorizedCents: pago.amountAuthorizedCents,
        amountCapturedCents: 0,
        providerCustomerId: null,
        cardBrand: autoriza ? 'visa' : null,
        cardLast4: autoriza ? '4242' : null,
        expiresAt: null,
        lastError: autoriza ? null : { code: 'card_declined', message: 'Tarjeta rechazada' },
      },
      payload: { simulated: true, outcome: request.outcome },
    });

    // Se lee el estado real de la reserva en vez de deducirlo: si el evento
    // llego tarde y la reserva ya estaba cancelada, el navegador debe verlo.
    const reserva = await this.prisma.db.booking.findUnique({
      where: { id: pago.bookingId },
      select: { status: true },
    });

    return {
      status,
      bookingStatus: (reserva?.status ?? 'PENDING_PAYMENT') as
        'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED',
    };
  }
}
