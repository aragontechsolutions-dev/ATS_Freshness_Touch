import type { ServiceZone } from '@freshness/types';
import type { PricingConfig, ZoneRule } from './config';

/**
 * Resuelve la zona de servicio a partir de la distancia en millas.
 * Las zonas se evaluan en orden ascendente de distancia; la primera cuyo
 * limite no se supera es la que aplica. Si ninguna aplica, queda fuera de area.
 */
export function resolveZone(miles: number, config: PricingConfig): ZoneRule {
  for (const zone of config.zones) {
    if (zone.maxMiles !== null && miles <= zone.maxMiles) {
      return zone;
    }
  }
  const fallback = config.zones.find((zone) => zone.maxMiles === null);
  return fallback ?? { code: 'OUT_OF_RANGE', maxMiles: null, surchargeCents: 0, serviceable: false };
}

export function zoneCodeFor(miles: number, config: PricingConfig): ServiceZone {
  return resolveZone(miles, config).code;
}
