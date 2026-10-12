import { ServiceUnavailableException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleDistanceProvider } from './google-distance.provider';
import type { DistanceQuery } from '../distance.types';

/**
 * LA FORMA EXACTA DE LA PETICION A GOOGLE
 * =======================================
 * Esta prueba existe por una razon concreta y poco habitual: **el cuerpo de
 * esta peticion no se puede probar contra la API real desde el repositorio.**
 * No hay clave en el entorno de desarrollo y no debe haberla.
 *
 * La version con el origen como texto («30127, GA, USA») si se verifico
 * contra la API de verdad —Powder Springs a Monroe, 80 millas, 200 OK—. La
 * etapa 3.14 cambia el origen a un punto, y un cuerpo mal formado no da un
 * resultado raro: da un 400, que el proveedor convierte en 503, y el
 * cotizador —la pagina que genera los ingresos— deja de dar precios.
 *
 * Por eso aqui se afirma sobre el JSON literal. No prueba que Google lo
 * acepte; prueba que lo que se manda es lo que se quiso mandar, y que nadie
 * lo cambia sin enterarse.
 *
 * ========================================================================
 * Y LA REGLA QUE NO PUEDE ROMPERSE NUNCA
 * ========================================================================
 * LA CLAVE VA EN LA CABECERA Y EN NINGUN OTRO SITIO. En la URL acabaria en
 * los registros de acceso de todos los saltos intermedios; en el cuerpo,
 * en cualquier traza que registre la peticion. Hay una prueba para cada
 * mitad.
 */

const CONSULTA: DistanceQuery = {
  origin: { latitude: 33.8803, longitude: -84.6731 },
  destinationPostalCode: '30655',
  state: 'GA',
};

const RESPUESTA_OK = [
  { originIndex: 0, destinationIndex: 0, distanceMeters: 128748, duration: '5520s' },
];

let proveedor: GoogleDistanceProvider;
let fetchFalso: ReturnType<typeof vi.fn>;

/** Lo que se le mando a Google en la ultima llamada, ya deserializado. */
function cuerpoEnviado(): Record<string, unknown> {
  const [, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

function responde(cuerpo: unknown, ok = true, status = 200): void {
  fetchFalso.mockResolvedValue({ ok, status, json: () => Promise.resolve(cuerpo) });
}

beforeEach(() => {
  fetchFalso = vi.fn();
  vi.stubGlobal('fetch', fetchFalso);
  proveedor = new GoogleDistanceProvider({ apiKey: 'clave-de-prueba', timeoutMs: 5000 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/* -------------------------------------------------------------------------- */

describe('el origen viaja como punto (etapa 3.14)', () => {
  it('manda latitud y longitud, con la forma que espera Routes API', async () => {
    responde(RESPUESTA_OK);

    await proveedor.resolve(CONSULTA);

    expect(cuerpoEnviado().origins).toEqual([
      { waypoint: { location: { latLng: { latitude: 33.8803, longitude: -84.6731 } } } },
    ]);
  });

  it('NO manda el codigo postal de la sede por ningun lado', async () => {
    /*
     * La segunda fuente de verdad que esta etapa elimina. Si el codigo
     * postal volviera a viajar, aunque fuera «por si acaso», alguien lo
     * usaria y el descuadre entre el mapa y la factura volveria.
     */
    responde(RESPUESTA_OK);

    await proveedor.resolve(CONSULTA);

    expect(JSON.stringify(cuerpoEnviado().origins)).not.toContain('30127');
    expect(JSON.stringify(cuerpoEnviado().origins)).not.toContain('address');
  });
});

describe('el destino sigue viajando como texto', () => {
  it('con solo el codigo postal cuando es una cotizacion publica', async () => {
    responde(RESPUESTA_OK);

    await proveedor.resolve(CONSULTA);

    expect(cuerpoEnviado().destinations).toEqual([{ waypoint: { address: '30655, GA, USA' } }]);
  });

  it('hasta el portal cuando se conoce la calle, que es al reservar', async () => {
    responde(RESPUESTA_OK);

    await proveedor.resolve({
      ...CONSULTA,
      destinationLine1: '123 East Church St',
      destinationCity: 'Monroe',
    });

    expect(cuerpoEnviado().destinations).toEqual([
      { waypoint: { address: '123 East Church St, Monroe, 30655, GA, USA' } },
    ]);
  });

  it('sin trafico: es lo que mantiene la consulta en la tarifa mas barata', async () => {
    responde(RESPUESTA_OK);

    await proveedor.resolve(CONSULTA);

    expect(cuerpoEnviado().routingPreference).toBe('TRAFFIC_UNAWARE');
    expect(cuerpoEnviado().travelMode).toBe('DRIVE');
  });
});

describe('la clave de API', () => {
  it('va en la cabecera', async () => {
    responde(RESPUESTA_OK);

    await proveedor.resolve(CONSULTA);

    const [, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-Goog-Api-Key']).toBe('clave-de-prueba');
  });

  it('y NUNCA en la URL ni en el cuerpo', async () => {
    responde(RESPUESTA_OK);

    await proveedor.resolve(CONSULTA);

    const [url, init] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain('clave-de-prueba');
    expect(String(init.body)).not.toContain('clave-de-prueba');
  });
});

describe('lo que devuelve', () => {
  it('convierte metros a millas y segundos a minutos', async () => {
    responde(RESPUESTA_OK);

    const resultado = await proveedor.resolve(CONSULTA);

    expect(resultado.miles).toBe(80);
    expect(resultado.durationMinutes).toBe(92);
    expect(resultado.provider).toBe('google');
    // Es un ruteo real, no una estimacion: de eso depende que el cotizador
    // pueda dar un precio en firme.
    expect(resultado.estimated).toBe(false);
  });

  it('sin duracion no se rompe: la distancia es lo que cobra', async () => {
    responde([{ distanceMeters: 128748 }]);

    expect((await proveedor.resolve(CONSULTA)).durationMinutes).toBeNull();
  });
});

describe('cuando algo falla, 503 y no un precio inventado', () => {
  /*
   * A diferencia del geocodificador, este LANZA. Un presupuesto sin
   * distancia es un presupuesto mal calculado, y mas vale no darlo que
   * darlo mal: el traslado puede ser sesenta dolares.
   */
  it('si Google responde con error', async () => {
    responde({}, false, 403);

    await expect(proveedor.resolve(CONSULTA)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('si no encuentra ruta', async () => {
    responde([{ condition: 'ROUTE_NOT_FOUND' }]);

    await expect(proveedor.resolve(CONSULTA)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('si la respuesta no tiene la forma esperada', async () => {
    responde({ elementos: [] });

    await expect(proveedor.resolve(CONSULTA)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('si la red se cae', async () => {
    fetchFalso.mockRejectedValue(new Error('ECONNRESET'));

    await expect(proveedor.resolve(CONSULTA)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
