import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import type { Env } from '../common/config/env';
import { AdminGuard } from './admin.guard';
import { AuthService } from './auth.service';
import { AUTH_PROVIDER, type AuthProvider } from './auth.types';
import { LocalAuthProvider } from './providers/local-auth.provider';
import { SupabaseAuthProvider } from './providers/supabase-auth.provider';

/**
 * Selecciona el proveedor de identidad segun AUTH_PROVIDER y registra la
 * guarda del panel como guarda GLOBAL.
 *
 * Global, no por controlador: asi una ruta nueva bajo /admin nace protegida
 * aunque quien la escriba no sepa que existe esta guarda.
 *
 * El modulo es @Global porque el proveedor y el servicio los necesita
 * cualquier modulo que exponga endpoints de administracion.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: AUTH_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): AuthProvider => {
        if (config.get('AUTH_PROVIDER', { infer: true }) === 'supabase') {
          return new SupabaseAuthProvider({
            // La validacion de entorno garantiza que existe en este caso.
            projectUrl: config.get('SUPABASE_URL', { infer: true }) as string,
            ...(config.get('SUPABASE_JWT_SECRET', { infer: true })
              ? { legacyJwtSecret: config.get('SUPABASE_JWT_SECRET', { infer: true }) as string }
              : {}),
            timeoutMs: config.get('AUTH_TIMEOUT_MS', { infer: true }),
          });
        }

        return new LocalAuthProvider(config.get('AUTH_LOCAL_SECRET', { infer: true }));
      },
    },
    AuthService,
    { provide: APP_GUARD, useClass: AdminGuard },
  ],
  exports: [AuthService, AUTH_PROVIDER],
})
export class AuthModule {}
