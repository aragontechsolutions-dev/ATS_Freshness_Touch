import type { DistanceProviderName } from '@freshness/types';

/**
 * EL PUNTO DESDE EL QUE SE MIDE.
 *
 * ========================================================================
 * POR QUE SON COORDENADAS Y NO EL CODIGO POSTAL (etapa 3.14)
 * ========================================================================
 * Hasta esta etapa al proveedor se le mandaba el CODIGO POSTAL de la sede, y
 * la latitud y la longitud guardadas en el panel solo servian para dibujar
 * el mapa. Eran dos fuentes para el mismo dato, y nada las obligaba a
 * coincidir: se podia arrastrar el marcador a la sede nueva, olvidar el
 * campo del codigo postal, y entonces el mapa dibujaba un sitio mientras la
 * factura se calculaba desde otro. Sin un error en ninguna pantalla.
 *
 * Se arregla quitando la segunda fuente, no avisando de que discrepan: el
 * punto marcado manda, y el codigo postal pasa a ser lo que siempre fue de
 * verdad, un dato de la ficha.
 *
 * Ademas mide mejor. «30127, GA, USA» hace que la ruta salga del centroide
 * del codigo postal, que puede estar a un par de millas de la puerta; el
 * marcador esta donde esta la empresa.
 */
export interface DistanceOrigin {
  latitude: number;
  longitude: number;
}

/** Consulta de distancia entre la base de operaciones y el destino. */
export interface DistanceQuery {
  origin: DistanceOrigin;
  destinationPostalCode: string;
  /** Codigo de estado de dos letras (p.ej. GA). */
  state: string;
  /**
   * Calle y ciudad del destino, si se conocen. Solo las hay al reservar: el
   * cotizador publico pide unicamente el codigo postal. Cuando estan, el
   * proveedor real calcula la ruta hasta el portal en vez de hasta el centro
   * del codigo postal, y el deposito se ajusta a la distancia de verdad.
   *
   * EL DESTINO SIGUE SIENDO TEXTO, y no es una incoherencia con el origen:
   * del cliente solo se tiene su direccion escrita, mientras que de la sede
   * se tiene un punto marcado a mano sobre el mapa.
   */
  destinationLine1?: string;
  destinationCity?: string;
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
