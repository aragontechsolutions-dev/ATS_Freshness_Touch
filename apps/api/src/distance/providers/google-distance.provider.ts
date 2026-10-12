import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { API_ERROR_CODES } from '@freshness/types';
import { z } from 'zod';
import type { DistanceProvider, DistanceQuery, DistanceResult } from '../distance.types';

const METERS_PER_MILE = 1609.344;

/** Respuesta esperada de Routes API (solo los campos que pedimos en el FieldMask). */
const RouteMatrixElementSchema = z.object({
  originIndex: z.number().optional(),
  destinationIndex: z.number().optional(),
  distanceMeters: z.number().optional(),
  duration: z.string().optional(),
  condition: z.string().optional(),
});

const RouteMatrixResponseSchema = z.array(RouteMatrixElementSchema);

export interface GoogleDistanceOptions {
  apiKey: string;
  timeoutMs: number;
}

/**
 * PROVEEDOR REAL DE DISTANCIA (Google Routes API - Compute Route Matrix).
 *
 * Se usa Routes API y no el antiguo Distance Matrix porque este ultimo esta
 * marcado como "Legacy" por Google; el precio es el mismo (5 USD por cada
 * 1.000 elementos, con 10.000 elementos gratuitos al mes) y cada cotizacion
 * consume 1 solo elemento (1 origen x 1 destino).
 *
 * SEGURIDAD: la clave de API vive SOLO en el servidor. Nunca se envia al
 * navegador, porque una clave de Maps expuesta en el front puede ser usada
 * por terceros y facturada a la empresa.
 *
 * VERIFICADO CONTRA LA API REAL el 12 de octubre de 2026: ruta de Powder
 * Springs a Monroe (GA), 80 millas y 92 minutos, respuesta 200. Lo que esa
 * prueba ejercito fue el DESTINO como texto; el origen pasa a ser un punto
 * desde la etapa 3.14 y eso hay que volver a comprobarlo tras desplegar
 * (ver docs/32-el-mapa-y-la-factura.md).
 */
@Injectable()
export class GoogleDistanceProvider implements DistanceProvider {
  readonly name = 'google' as const;
  private readonly logger = new Logger(GoogleDistanceProvider.name);
  private static readonly ENDPOINT =
    'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';

  constructor(private readonly options: GoogleDistanceOptions) {}

  async resolve(query: DistanceQuery): Promise<DistanceResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const response = await fetch(GoogleDistanceProvider.ENDPOINT, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.options.apiKey,
          'X-Goog-FieldMask': 'originIndex,destinationIndex,distanceMeters,duration,condition',
        },
        body: JSON.stringify({
          /*
           * EL ORIGEN ES UN PUNTO, EL DESTINO ES TEXTO (etapa 3.14).
           *
           * No es una incoherencia: de la sede se tiene un marcador puesto a
           * mano sobre el mapa, y del cliente solo su direccion escrita.
           *
           * Mandar «30127, GA, USA» como origen tenia dos problemas. Hacia
           * salir la ruta del centroide del codigo postal, que puede caer a
           * un par de millas de la puerta; y sobre todo convertia el codigo
           * postal en una segunda fuente de verdad que podia discrepar del
           * punto que el mapa dibuja, sin que lo delatara ningun error.
           */
          origins: [
            {
              waypoint: {
                location: {
                  latLng: {
                    latitude: query.origin.latitude,
                    longitude: query.origin.longitude,
                  },
                },
              },
            },
          ],
          destinations: [{ waypoint: { address: formatDestination(query) } }],
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_UNAWARE',
        }),
      });

      if (!response.ok) {
        // No se registra el cuerpo completo: puede incluir la peticion con datos del cliente.
        this.logger.error(`Routes API respondio ${response.status}`);
        throw distanceUnavailable();
      }

      const parsed = RouteMatrixResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        this.logger.error('Respuesta de Routes API con formato inesperado');
        throw distanceUnavailable();
      }

      const element = parsed.data[0];
      if (!element || element.distanceMeters === undefined) {
        this.logger.warn('Routes API no encontro ruta para el destino solicitado');
        throw distanceUnavailable();
      }

      return {
        miles: Number((element.distanceMeters / METERS_PER_MILE).toFixed(1)),
        durationMinutes: parseDurationMinutes(element.duration),
        provider: this.name,
        estimated: false,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error(
        `Fallo al consultar Routes API: ${error instanceof Error ? error.name : 'desconocido'}`,
      );
      throw distanceUnavailable();
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Direccion del DESTINO en el formato que espera la API: ZIP, estado y pais.
 *
 * El origen ya no pasa por aqui: desde la etapa 3.14 viaja como coordenadas.
 */
function formatAddress(postalCode: string, state: string): string {
  return `${postalCode}, ${state}, USA`;
}

/**
 * Destino con el mayor detalle disponible. Al reservar se conoce la calle, y
 * entonces la ruta se calcula hasta el portal en vez de hasta el centro del
 * codigo postal.
 */
function formatDestination(query: DistanceQuery): string {
  const base = formatAddress(query.destinationPostalCode, query.state);
  const detalle = [query.destinationLine1, query.destinationCity].filter(Boolean).join(', ');
  return detalle ? `${detalle}, ${base}` : base;
}

/** Convierte la duracion de Google ("1234s") a minutos enteros. */
function parseDurationMinutes(duration: string | undefined): number | null {
  if (!duration) return null;
  const seconds = Number.parseInt(duration.replace('s', ''), 10);
  return Number.isFinite(seconds) ? Math.round(seconds / 60) : null;
}

function distanceUnavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: API_ERROR_CODES.DISTANCE_UNAVAILABLE,
    messageKey: 'calculator.errorGeneric',
  });
}
