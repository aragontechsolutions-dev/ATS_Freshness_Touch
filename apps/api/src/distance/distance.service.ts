import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../common/config/env';
import { DISTANCE_PROVIDER, type DistanceProvider, type DistanceResult } from './distance.types';
import { TtlCache } from './ttl-cache';

export type ResolvedDistance = DistanceResult & { cached: boolean };

/**
 * Resuelve la distancia entre la base de operaciones y el destino,
 * delegando en el proveedor configurado y cacheando el resultado.
 */
@Injectable()
export class DistanceService {
  private readonly logger = new Logger(DistanceService.name);
  private readonly cache: TtlCache<DistanceResult>;
  private readonly originPostalCode: string;

  constructor(
    @Inject(DISTANCE_PROVIDER) private readonly provider: DistanceProvider,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.cache = new TtlCache<DistanceResult>(
      this.config.get('DISTANCE_CACHE_TTL_SECONDS', { infer: true }) * 1000,
      this.config.get('DISTANCE_CACHE_MAX_ENTRIES', { infer: true }),
    );
    this.originPostalCode = this.config.get('COMPANY_BASE_POSTAL_CODE', { infer: true });
  }

  async resolve(
    destinationPostalCode: string,
    state: string,
    /** Calle y ciudad, si se conocen (solo al reservar). */
    detail: { line1?: string; city?: string } = {},
  ): Promise<ResolvedDistance> {
    // El detalle forma parte de la clave: la distancia hasta un portal
    // concreto no es la misma que hasta el centro del codigo postal, y
    // mezclarlas en la cache daria depositos incorrectos.
    const key = [
      this.provider.name,
      this.originPostalCode,
      state,
      destinationPostalCode,
      detail.line1 ?? '',
      detail.city ?? '',
    ].join(':');

    const cached = this.cache.get(key);
    if (cached) {
      return { ...cached, cached: true };
    }

    const result = await this.provider.resolve({
      originPostalCode: this.originPostalCode,
      destinationPostalCode,
      state,
      ...(detail.line1 ? { destinationLine1: detail.line1 } : {}),
      ...(detail.city ? { destinationCity: detail.city } : {}),
    });

    this.cache.set(key, result);
    // Se registra la zona geografica y el proveedor, nunca el codigo postal
    // concreto junto al resto de datos del presupuesto.
    this.logger.log(`Distancia resuelta por "${this.provider.name}": ${result.miles} millas`);

    return { ...result, cached: false };
  }
}
