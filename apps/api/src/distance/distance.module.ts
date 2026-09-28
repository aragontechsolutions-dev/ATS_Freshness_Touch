import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { Env } from '../common/config/env';
import { DistanceService } from './distance.service';
import { DISTANCE_PROVIDER, type DistanceProvider } from './distance.types';
import { GoogleDistanceProvider } from './providers/google-distance.provider';
import { MockDistanceProvider } from './providers/mock-distance.provider';
import { SettingsModule } from '../settings/settings.module';

/**
 * Selecciona el proveedor de distancia segun DISTANCE_PROVIDER.
 * Es el unico punto del sistema que conoce ambas implementaciones.
 *
 * Importa `SettingsModule` porque el origen de la medida ya no es una
 * variable de entorno: es la ubicacion que administracion guarda desde el
 * panel.
 */
@Module({
  imports: [ConfigModule, SettingsModule],
  providers: [
    {
      provide: DISTANCE_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): DistanceProvider => {
        if (config.get('DISTANCE_PROVIDER', { infer: true }) === 'google') {
          return new GoogleDistanceProvider({
            // La validacion de entorno garantiza que la clave existe en este caso.
            apiKey: config.get('GOOGLE_MAPS_API_KEY', { infer: true }) as string,
            timeoutMs: config.get('DISTANCE_TIMEOUT_MS', { infer: true }),
          });
        }
        return new MockDistanceProvider();
      },
    },
    DistanceService,
  ],
  exports: [DistanceService],
})
export class DistanceModule {}
