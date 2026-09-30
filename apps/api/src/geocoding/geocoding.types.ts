import type { GeocodeQuery, GeocodeResult, GeocodingProviderName } from '@freshness/types';

/**
 * CONTRATO DE CUALQUIER GEOCODIFICADOR
 * ------------------------------------
 * Gracias a esta interfaz, el resto del sistema no sabe (ni le importa) si
 * las coordenadas vienen de una simulacion local o del Censo de Estados
 * Unidos. Cambiar de servicio es cambiar una variable de entorno.
 *
 * ========================================================================
 * DEVUELVE `null`, NO LANZA. ESTA ES LA DIFERENCIA CON LA DISTANCIA.
 * ========================================================================
 * El proveedor de distancia LANZA cuando falla, y hace bien: un presupuesto
 * sin distancia es un presupuesto mal calculado, y mas vale no darlo.
 *
 * Aqui es al reves. Una direccion sin coordenadas NO rompe nada:
 *
 *   - la reserva se crea igual,
 *   - el presupuesto se calcula igual, porque usa el motor de distancia,
 *   - y el fichaje funciona igual, solo que sin registrar la distancia.
 *
 * Si esto lanzara, un servicio externo caido bloquearia reservas. Por eso
 * «no se encontro» y «el servicio no responde» acaban los dos en `null`:
 * quien llama no tiene nada distinto que hacer en un caso o en el otro.
 */
export interface GeocodingProvider {
  readonly name: GeocodingProviderName;

  /**
   * Las coordenadas de esa direccion, o `null` si no se pudieron resolver.
   *
   * `null` cubre las tres cosas que pasan de verdad: la direccion no existe,
   * el servicio no contesta, o contesta algo que no se entiende.
   */
  locate(query: GeocodeQuery): Promise<GeocodeResult | null>;
}

/** Token de inyeccion de dependencias para el proveedor activo. */
export const GEOCODING_PROVIDER = Symbol('GEOCODING_PROVIDER');
