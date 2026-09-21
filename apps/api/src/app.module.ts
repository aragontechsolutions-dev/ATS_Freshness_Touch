import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv, type Env } from './common/config/env';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { THROTTLER_NAMES } from './common/throttling';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { DatabaseModule } from './database/database.module';
import { DistanceModule } from './distance/distance.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { QuotesModule } from './quotes/quotes.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),

    /**
     * Dos limitadores por IP:
     *  - "global": protege toda la API de un uso abusivo.
     *  - "quotes": mas estricto, porque cada cotizacion puede consumir cuota
     *    de pago del proveedor de distancia. Los endpoints que no lo necesitan
     *    lo desactivan con @SkipThrottle({ quotes: true }).
     */
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        {
          name: THROTTLER_NAMES[0],
          ttl: config.get('RATE_LIMIT_TTL_SECONDS', { infer: true }) * 1000,
          limit: config.get('RATE_LIMIT_MAX', { infer: true }),
        },
        {
          name: THROTTLER_NAMES[1],
          ttl: config.get('RATE_LIMIT_TTL_SECONDS', { infer: true }) * 1000,
          limit: config.get('QUOTE_RATE_LIMIT_MAX', { infer: true }),
        },
      ],
    }),

    DatabaseModule,
    AuthModule,
    AuditModule,
    HealthModule,
    DistanceModule,
    SettingsModule,
    NotificationsModule,
    QuotesModule,
    SchedulingModule,
    PaymentsModule,
    BookingsModule,
    AdminModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*path');
  }
}
