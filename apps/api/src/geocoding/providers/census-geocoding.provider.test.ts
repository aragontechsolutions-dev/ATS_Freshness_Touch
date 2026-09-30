import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isPlausibleGeorgiaMatch, type GeocodeQuery } from '@freshness/types';
import { CensusGeocodingProvider } from './census-geocoding.provider';
import { MockGeocodingProvider } from './mock-geocoding.provider';

/**
 * LOS DOS GEOCODIFICADORES
 * ------------------------
 * El del Censo no se puede ejecutar contra el servicio real desde el entorno
 * de desarrollo (no hay salida a `geocoding.geo.census.gov`), asi que se
 * prueba con RESPUESTAS REALES CAPTURADAS de su documentacion. Eso cubre lo
 * que de verdad se puede equivocar en un adaptador —leer mal un campo— y no
 * cubre que el servicio siga respondiendo igual manana, que no lo puede
 * cubrir ninguna prueba local.
 */

const ATLANTA: GeocodeQuery = {
  line1: '123 Peachtree St NE',
  city: 'Atlanta',
  state: 'GA',
  postalCode: '30303',
};

/**
 * Una respuesta del Censo con la forma real.
 *
 * Fijate en `coordinates`: `x` es -84.39 (longitud) e `y` es 33.75
 * (latitud). Ese es el orden que hay que respetar.
 */
const RESPUESTA_REAL = {
  result: {
    input: { address: { address: '123 Peachtree St NE, Atlanta, GA 30303' } },
    addressMatches: [
      {
        matchedAddress: '123 PEACHTREE ST NE, ATLANTA, GA, 30303',
        coordinates: { x: -84.38798, y: 33.75294 },
        tigerLine: { tigerLineId: '17343689', side: 'L' },
        addressComponents: {
          fromAddress: '101',
          toAddress: '199',
          streetName: 'PEACHTREE',
          city: 'ATLANTA',
          state: 'GA',
          zip: '30303',
        },
      },
    ],
  },
};

function responderCon(cuerpo: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        ok,
        status,
        json: () => Promise.resolve(cuerpo),
      } as Response),
    ),
  );
}

let proveedor: CensusGeocodingProvider;

beforeEach(() => {
  proveedor = new CensusGeocodingProvider({ timeoutMs: 5000 });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('el geocodificador del Censo', () => {
  it('LEE x COMO LONGITUD E y COMO LATITUD', async () => {
    /*
     * LA PRUEBA MAS IMPORTANTE DE ESTE ARCHIVO.
     *
     * Invertirlas no da ningun error: manda cada casa de Georgia al oceano
     * Indico, frente a Somalia, con coordenadas perfectamente validas. Es
     * el tipo de fallo que se descubre cuando un fichaje dice «a 13.000
     * kilometros de la casa».
     */
    responderCon(RESPUESTA_REAL);
    const resultado = await proveedor.locate(ATLANTA);

    expect(resultado?.latitude).toBe(33.75294);
    expect(resultado?.longitude).toBe(-84.38798);
  });

  it('y el punto que devuelve cae dentro de Georgia', async () => {
    // La comprobacion de arriba, dicha de la forma en que importa.
    responderCon(RESPUESTA_REAL);
    const resultado = await proveedor.locate(ATLANTA);

    expect(resultado).not.toBeNull();
    expect(isPlausibleGeorgiaMatch(resultado!)).toBe(true);
  });

  it('declara la precision como interpolada, nunca como portal', async () => {
    /*
     * El Censo interpola sobre el tramo de calle: no sabe donde esta el
     * edificio. Decir `ROOFTOP` seria mentir sobre la calidad del dato, y
     * quien lea el fichaje sacaria conclusiones que el dato no sostiene.
     */
    responderCon(RESPUESTA_REAL);
    expect((await proveedor.locate(ATLANTA))?.precision).toBe('INTERPOLATED');
  });

  it('conserva la direccion tal y como la entendio el servicio', async () => {
    // Es la unica forma de auditar una coincidencia rara despues.
    responderCon(RESPUESTA_REAL);
    expect((await proveedor.locate(ATLANTA))?.matchedAddress).toBe(
      '123 PEACHTREE ST NE, ATLANTA, GA, 30303',
    );
  });

  it('manda la direccion en una linea, sin el apartamento', async () => {
    responderCon(RESPUESTA_REAL);
    await proveedor.locate(ATLANTA);

    const url = new URL((vi.mocked(fetch).mock.calls[0]?.[0] as URL).toString());
    expect(url.searchParams.get('address')).toBe('123 Peachtree St NE, Atlanta, GA 30303');
    expect(url.searchParams.get('benchmark')).toBe('Public_AR_Current');
    expect(url.searchParams.get('format')).toBe('json');
  });
});

describe('cuando el Censo no resuelve, devuelve null y NO lanza', () => {
  /*
   * Es la diferencia con el proveedor de distancia, que si lanza. Un
   * presupuesto sin distancia esta mal calculado; una direccion sin
   * coordenadas no rompe nada. Si esto lanzara, un servicio externo caido
   * bloquearia las reservas.
   */

  it('cuando no encuentra la direccion', async () => {
    responderCon({ result: { addressMatches: [] } });
    await expect(proveedor.locate(ATLANTA)).resolves.toBeNull();
  });

  it('cuando responde con un error HTTP', async () => {
    responderCon({}, false, 503);
    await expect(proveedor.locate(ATLANTA)).resolves.toBeNull();
  });

  it('cuando responde algo que no se entiende', async () => {
    responderCon({ vaya: 'esto no es la respuesta esperada' });
    await expect(proveedor.locate(ATLANTA)).resolves.toBeNull();
  });

  it('cuando la red falla', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('ECONNREFUSED'))),
    );
    await expect(proveedor.locate(ATLANTA)).resolves.toBeNull();
  });

  it('cuando se agota el tiempo de espera', async () => {
    const lento = new CensusGeocodingProvider({ timeoutMs: 10 });
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: unknown, init?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')));
          }),
      ),
    );
    await expect(lento.locate(ATLANTA)).resolves.toBeNull();
  });
});

describe('el geocodificador simulado', () => {
  const simulado = new MockGeocodingProvider();

  it('da el mismo punto para la misma direccion', async () => {
    /*
     * Si fuese aleatorio, cada ejecucion de las pruebas mediria una
     * distancia distinta y no se podria afirmar nada sobre un fichaje.
     */
    const a = await simulado.locate(ATLANTA);
    const b = await simulado.locate(ATLANTA);
    expect(a).toEqual(b);
  });

  it('da puntos distintos para direcciones distintas', async () => {
    const a = await simulado.locate({ ...ATLANTA, line1: '1 Calle Uno', postalCode: '30601' });
    const b = await simulado.locate({ ...ATLANTA, line1: '2 Calle Dos', postalCode: '30602' });
    expect(a?.latitude).not.toBe(b?.latitude);
  });

  it('SIEMPRE cae dentro de Georgia', async () => {
    /*
     * Si cayera fuera, la guardia del contrato rechazaria todos los
     * resultados y en desarrollo pareceria que el geocodificador no
     * funciona nunca.
     */
    for (let i = 0; i < 60; i += 1) {
      const resultado = await simulado.locate({
        ...ATLANTA,
        line1: `${i} Calle de Prueba`,
        postalCode: String(30000 + i),
      });
      expect(resultado, `direccion ${i}`).not.toBeNull();
      expect(isPlausibleGeorgiaMatch(resultado!), `direccion ${i}`).toBe(true);
    }
  });

  it('las direcciones conocidas caen donde deben', async () => {
    // Para que las pruebas puedan hablar de sitios reales.
    const atlanta = await simulado.locate(ATLANTA);
    expect(atlanta?.latitude).toBeCloseTo(33.749, 3);
    expect(atlanta?.longitude).toBeCloseTo(-84.388, 3);
  });
});
