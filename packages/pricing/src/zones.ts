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
  /*
   * La red de seguridad: una configuracion sin zona final dejaria esta
   * funcion sin nada que devolver. Cae en «fuera de area», que es la unica
   * respuesta segura: ante la duda no se promete un servicio ni un precio.
   */
  const fallback = config.zones.find((zone) => zone.maxMiles === null);
  return (
    fallback ?? {
      code: 'OUT_OF_RANGE',
      maxMiles: null,
      serviceable: false,
      instantQuote: false,
    }
  );
}

export function zoneCodeFor(miles: number, config: PricingConfig): ServiceZone {
  return resolveZone(miles, config).code;
}
