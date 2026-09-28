import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../common/config/env';
import { DISTANCE_PROVIDER, type DistanceProvider, type DistanceResult } from './distance.types';
import { TtlCache } from '../common/ttl-cache';
import { CompanyLocationService } from '../settings/company-location.service';

export type ResolvedDistance = DistanceResult & { cached: boolean };

/**
 * Resuelve la distancia entre la base de operaciones y el destino,
 * delegando en el proveedor configurado y cacheando el resultado.
 *
 * EL ORIGEN SE PREGUNTA EN CADA LLAMADA, no se guarda al arrancar.
 *
 * Se leia una vez del entorno en el constructor, y desde que la ubicacion
 * se edita desde el panel eso era un fallo esperando: mover la sede
 * habria recentrado el mapa y las zonas mientras ESTE servicio seguia
 * midiendo desde el sitio viejo hasta el siguiente reinicio. El mapa
 * diciendo una cosa y la factura otra, sin un solo error por ningun sitio.
 *
 * No cuesta una consulta por peticion: la ubicacion va cacheada treinta
 * segundos en su propio servicio.
 */
@Injectable()
export class DistanceService {
  private readonly logger = new Logger(DistanceService.name);
  private readonly cache: TtlCache<DistanceResult>;

  constructor(
    @Inject(DISTANCE_PROVIDER) private readonly provider: DistanceProvider,
    private readonly config: ConfigService<Env, true>,
    private readonly ubicacion: CompanyLocationService,
  ) {
    this.cache = new TtlCache<DistanceResult>(
      this.config.get('DISTANCE_CACHE_TTL_SECONDS', { infer: true }) * 1000,
      this.config.get('DISTANCE_CACHE_MAX_ENTRIES', { infer: true }),
    );
  }

  async resolve(
    destinationPostalCode: string,
    state: string,
    /** Calle y ciudad, si se conocen (solo al reservar). */
    detail: { line1?: string; city?: string } = {},
  ): Promise<ResolvedDistance> {
    const originPostalCode = (await this.ubicacion.get()).postalCode;

    /*
     * EL ORIGEN VA EN LA CLAVE, y no es decorativo: si la empresa se muda,
     * lo cacheado se midio desde el sitio anterior. Sin el origen en la
     * clave, esas distancias viejas seguirian sirviendose durante horas y
     * cobrarian traslados que ya no corresponden.
     *
     * El detalle tambien: la distancia hasta un portal concreto no es la
     * misma que hasta el centro del codigo postal, y mezclarlas daria
     * depositos incorrectos.
     */
    const key = [
      this.provider.name,
      originPostalCode,
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
      originPostalCode,
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
