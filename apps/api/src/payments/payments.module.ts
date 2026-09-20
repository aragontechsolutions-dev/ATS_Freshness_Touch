import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { Env } from '../common/config/env';
import { MockPaymentsController } from './mock-payments.controller';
import { PaymentsService } from './payments.service';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payments.types';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { StripePaymentProvider } from './providers/stripe-payment.provider';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

/**
 * Selecciona el proveedor de pago segun PAYMENT_PROVIDER.
 * Es el unico punto del sistema que conoce ambas implementaciones.
 */
@Module({
  imports: [ConfigModule],
  controllers: [WebhooksController, MockPaymentsController],
  providers: [
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): PaymentProvider => {
        const logger = new Logger('PaymentsModule');
        const authorizationDays = config.get('PAYMENT_AUTHORIZATION_DAYS', { infer: true });

        if (config.get('PAYMENT_PROVIDER', { infer: true }) === 'stripe') {
          return new StripePaymentProvider({
            // La validacion de entorno garantiza que ambas existen en este caso.
            secretKey: config.get('STRIPE_SECRET_KEY', { infer: true }) as string,
            webhookSecret: config.get('STRIPE_WEBHOOK_SECRET', { infer: true }) as string,
            timeoutMs: config.get('STRIPE_TIMEOUT_MS', { infer: true }),
            authorizationDays,
            statementDescriptorSuffix: config.get('PAYMENT_STATEMENT_DESCRIPTOR', { infer: true }),
          });
        }

        if (config.get('NODE_ENV', { infer: true }) === 'production') {
          // Un aviso imposible de pasar por alto en los registros: con el
          // simulador activo las reservas se confirman sin retener un centavo.
          logger.error(
            'PAYMENT_PROVIDER=mock en produccion: los depositos se SIMULAN y no se ' +
              'retiene dinero real. Configura PAYMENT_PROVIDER=stripe.',
          );
        }

        return new MockPaymentProvider(
          config.get('PAYMENT_MOCK_WEBHOOK_SECRET', { infer: true }),
          authorizationDays,
        );
      },
    },
    PaymentsService,
    WebhooksService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
