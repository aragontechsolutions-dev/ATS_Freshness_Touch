import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { Env } from '../common/config/env';
import { SettingsModule } from '../settings/settings.module';
import { NotificationSettingsService } from './notification-settings.service';
import { NotificationsService } from './notifications.service';
import { ReminderSweepService } from './reminder-sweep.service';
import {
  EMAIL_PROVIDER,
  TELEGRAM_PROVIDER,
  type EmailProvider,
  type TelegramProvider,
} from './notifications.types';
import { LogEmailProvider } from './providers/log-email.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';
import { TelegramBotProvider } from './providers/telegram.provider';
import { NoopTelegramProvider } from './providers/noop-telegram.provider';

/**
 * Elige los canales segun el entorno. Es el unico punto del sistema que
 * conoce las implementaciones reales.
 *
 * GLOBAL a proposito: los avisos se disparan desde sitios muy distintos (el
 * webhook del proveedor de pago, las acciones del panel) y obligar a cada
 * modulo a importar este seria una invitacion a que alguien resuelva la
 * dependencia "por su cuenta" y se salte el registro de envios.
 */
@Global()
@Module({
  imports: [ConfigModule, SettingsModule],
  providers: [
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): EmailProvider => {
        const logger = new Logger('NotificationsModule');

        if (config.get('EMAIL_PROVIDER', { infer: true }) === 'resend') {
          const from = config.get('EMAIL_FROM', { infer: true }) as string;
          return new ResendEmailProvider({
            // La validacion de entorno garantiza que ambas existen en este caso.
            apiKey: config.get('RESEND_API_KEY', { infer: true }) as string,
            from,
            replyTo: config.get('EMAIL_REPLY_TO', { infer: true }) ?? null,
            timeoutMs: config.get('EMAIL_TIMEOUT_MS', { infer: true }),
          });
        }

        if (config.get('NODE_ENV', { infer: true }) === 'production') {
          // Aviso imposible de pasar por alto: con el simulador activo, los
          // clientes NO reciben su confirmacion y nadie se entera hasta que
          // uno llama preguntando si su reserva existe.
          logger.error(
            'EMAIL_PROVIDER=log en produccion: los correos se SIMULAN y el cliente no ' +
              'recibe nada. Configura EMAIL_PROVIDER=resend.',
          );
        }

        return new LogEmailProvider();
      },
    },
    {
      provide: TELEGRAM_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): TelegramProvider => {
        const token = config.get('TELEGRAM_BOT_TOKEN', { infer: true });

        /*
         * Sin token no hay bot. NO es un error de configuracion: Telegram es
         * un aviso interno opcional, y el sistema tiene que arrancar igual.
         * Se usa un canal que no envia nada y lo dice, para que el intento
         * quede anotado como fallido con un motivo comprensible en vez de
         * desaparecer en silencio.
         */
        return token === undefined
          ? new NoopTelegramProvider()
          : new TelegramBotProvider(
              token,
              config.get('TELEGRAM_TIMEOUT_MS', { infer: true }),
              config.get('TELEGRAM_API_BASE', { infer: true }),
            );
      },
    },
    NotificationSettingsService,
    NotificationsService,
    ReminderSweepService,
  ],
  /*
   * EMAIL_PROVIDER se exporta porque la invitacion al panel manda su propio
   * correo desde el modulo de administracion (ver `staff-admin.service.ts`).
   *
   * No pasa por `NotificationsService` a proposito: aquel NUNCA lanza y se
   * traga los fallos, porque un aviso que no sale no puede tumbar una reserva
   * ya pagada. La invitacion es lo contrario: si el correo no sale, quien
   * creia estar dando acceso TIENE que enterarse.
   */
  exports: [
    NotificationsService,
    NotificationSettingsService,
    ReminderSweepService,
    EMAIL_PROVIDER,
  ],
})
export class NotificationsModule {}
