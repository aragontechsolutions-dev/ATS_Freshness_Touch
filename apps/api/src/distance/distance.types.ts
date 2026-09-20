import type { DistanceProviderName } from '@freshness/types';

/** Consulta de distancia entre la base de operaciones y el destino. */
export interface DistanceQuery {
  originPostalCode: string;
  destinationPostalCode: string;
  /** Codigo de estado de dos letras (p.ej. GA). */
  state: string;
}

export interface DistanceResult {
  miles: number;
  durationMinutes: number | null;
  provider: DistanceProviderName;
  /** true cuando el valor es una estimacion y no un ruteo real. */
  estimated: boolean;
}

/**
 * Contrato de cualquier proveedor de distancia.
 *
 * Gracias a esta interfaz el resto del sistema no sabe (ni le importa) si la
 * distancia viene de una simulacion local o de Google. Cambiar de proveedor
 * es cambiar una variable de entorno, no reescribir la logica de negocio.
 */
export interface DistanceProvider {
  readonly name: DistanceProviderName;
  resolve(query: DistanceQuery): Promise<DistanceResult>;
}

/** Token de inyeccion de dependencias para el proveedor activo. */
export const DISTANCE_PROVIDER = Symbol('DISTANCE_PROVIDER');
