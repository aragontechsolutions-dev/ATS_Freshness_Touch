import { Injectable, Logger } from '@nestjs/common';
import type { GeocodeQuery, GeocodeResult } from '@freshness/types';
import type { GeocodingProvider } from '../geocoding.types';

/**
 * GEOCODIFICADOR SIMULADO
 * -----------------------
 * El de desarrollo y el de las pruebas. No sale a internet.
 *
 * DEVUELVE UN PUNTO ESTABLE POR DIRECCION, no uno al azar. Dos llamadas con
 * la misma direccion dan exactamente las mismas coordenadas, porque salen de
 * una huella del propio texto. Si fuese aleatorio, cada ejecucion de las
 * pruebas mediria una distancia distinta y no se podria afirmar nada.
 *
 * Y CAE SIEMPRE DENTRO DE GEORGIA, a proposito: si cayera fuera, la guardia
 * del contrato rechazaria todos los resultados y en desarrollo pareceria que
 * el geocodificador no funciona nunca.
 *
 * QUE NO HACE: no sabe si una direccion existe. Cualquier texto le vale y
 * siempre devuelve un punto. Es util para probar el camino feliz, no para
 * comprobar que una direccion es real — eso solo lo dice el servicio de
 * verdad.
 */

/*
 * Un rectangulo que cabe ENTERO dentro de Georgia.
 *
 * NO esta estimado a ojo: se calculo buscando la caja mas grande que no se
 * sale del contorno real del estado, el mismo que usa la guardia del
 * contrato, y se comprobo con una rejilla de 61x61 puntos sin un solo punto
 * fuera.
 *
 * El primer intento SI iba a ojo y se salia: a la altura de la latitud 34,6
 * la longitud -82,2 ya es Carolina del Sur, porque la frontera este de
 * Georgia se desvia con el rio. El estado no es un rectangulo, y suponerlo
 * hacia que la guardia rechazara resultados del simulado.
 */
const LAT_MIN = 32.05;
const LAT_MAX = 33.75;
const LON_MIN = -84.75;
const LON_MAX = -82.25;

/** Direcciones conocidas, para que las pruebas puedan hablar de sitios reales. */
const CONOCIDAS: Record<string, { latitude: number; longitude: number }> = {
  '30303': { latitude: 33.749, longitude: -84.388 }, // Centro de Atlanta
  '31401': { latitude: 32.0809, longitude: -81.0912 }, // Savannah
  '30901': { latitude: 33.4735, longitude: -82.0105 }, // Augusta
};

@Injectable()
export class MockGeocodingProvider implements GeocodingProvider {
  readonly name = 'mock' as const;
  private readonly logger = new Logger(MockGeocodingProvider.name);

  locate(query: GeocodeQuery): Promise<GeocodeResult | null> {
    const conocida = CONOCIDAS[query.postalCode];
    const punto = conocida ?? derivarPunto(`${query.line1}|${query.city}|${query.postalCode}`);

    this.logger.log(
      `Geocodificacion simulada de ${query.postalCode}: ` +
        `${punto.latitude.toFixed(4)}, ${punto.longitude.toFixed(4)}`,
    );

    return Promise.resolve({
      ...punto,
      /*
       * `ROOFTOP` a proposito: es el simulado, y conviene que el camino de
       * la precision fina tambien se ejercite en desarrollo. El del Censo,
       * que es el que se usa de verdad, devuelve siempre `INTERPOLATED`.
       */
      precision: 'ROOFTOP',
      matchedAddress: `${query.line1}, ${query.city}, ${query.state}, ${query.postalCode}`,
      provider: this.name,
    });
  }
}

/**
 * Un punto estable dentro de Georgia a partir de un texto.
 *
 * Es una huella sencilla, no un hash criptografico: aqui solo hace falta que
 * el mismo texto de siempre el mismo punto y que direcciones distintas caigan
 * en sitios distintos.
 */
function derivarPunto(texto: string): { latitude: number; longitude: number } {
  let huella = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    huella ^= texto.charCodeAt(i);
    huella = Math.imul(huella, 16777619);
  }

  // Dos fracciones independientes entre 0 y 1, de las dos mitades del entero.
  const fraccionLat = ((huella >>> 16) & 0xffff) / 0xffff;
  const fraccionLon = (huella & 0xffff) / 0xffff;

  return {
    latitude: Number((LAT_MIN + fraccionLat * (LAT_MAX - LAT_MIN)).toFixed(6)),
    longitude: Number((LON_MIN + fraccionLon * (LON_MAX - LON_MIN)).toFixed(6)),
  };
}
