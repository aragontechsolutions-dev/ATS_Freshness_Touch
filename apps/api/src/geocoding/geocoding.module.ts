import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { Env } from '../common/config/env';
import { GeocodingService } from './geocoding.service';
import { GeocodingSweepService } from './geocoding-sweep.service';
import { GEOCODING_PROVIDER, type GeocodingProvider } from './geocoding.types';
import { CensusGeocodingProvider } from './providers/census-geocoding.provider';
import { MockGeocodingProvider } from './providers/mock-geocoding.provider';

/**
 * Selecciona el geocodificador segun GEOCODING_PROVIDER.
 * Es el unico punto del sistema que conoce las dos implementaciones.
 *
 * No hay clave de API que inyectar: el del Censo no la necesita, que es
 * buena parte de por que se eligio.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: GEOCODING_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): GeocodingProvider => {
        if (config.get('GEOCODING_PROVIDER', { infer: true }) === 'census') {
          return new CensusGeocodingProvider({
            timeoutMs: config.get('GEOCODING_TIMEOUT_MS', { infer: true }),
          });
        }
        return new MockGeocodingProvider();
      },
    },
    GeocodingService,
    GeocodingSweepService,
  ],
  exports: [GeocodingService],
})
export class GeocodingModule {}
