import { afterEach, describe, expect, it, vi } from 'vitest';
import { ubicacionParaFichar } from './geolocalizacion';

/**
 * PEDIR LA UBICACION AL FICHAR
 * ----------------------------
 * Lo que se prueba, por orden de importancia:
 *
 *   1. Que NUNCA lance. Es lo que garantiza que el fichaje no se bloquee: si
 *      esto pudiera lanzar, la pantalla tendria que decidir que hacer con un
 *      error que no tiene a quien avisar.
 *   2. Que distinga «lo denegue» de «no pude». Uno lo decide la persona y el
 *      otro es un fallo tecnico, y confundirlos señala a alguien por el GPS
 *      de su movil.
 *   3. Que NO copie el objeto de coordenadas entero. Trae altitud, rumbo y
 *      velocidad, y nada de eso tiene que salir del telefono.
 */

/** Error de la API de geolocalizacion, con las constantes que trae. */
function errorDeGeolocalizacion(code: number): GeolocationPositionError {
  return {
    code,
    message: '',
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError;
}

/**
 * Sustituye la API del navegador.
 *
 * `comportamiento` recibe los dos callbacks y decide que pasa: responder bien,
 * fallar, o no hacer absolutamente nada —que es el caso de los moviles en los
 * que el tiempo de espera propio no dispara nunca—.
 */
function conNavegador(
  comportamiento: (
    exito: PositionCallback,
    fallo: PositionErrorCallback,
    opciones?: PositionOptions,
  ) => void,
): void {
  vi.stubGlobal('navigator', {
    geolocation: { getCurrentPosition: comportamiento },
  });
}

/** Una posicion como la que da el navegador de verdad: con campos de mas. */
function posicionCompleta(): GeolocationPosition {
  return {
    timestamp: Date.now(),
    coords: {
      latitude: 33.749,
      longitude: -84.388,
      accuracy: 14.328,
      // LOS QUE NO DEBEN SALIR DEL TELEFONO.
      altitude: 320.5,
      altitudeAccuracy: 8,
      heading: 91.2,
      speed: 1.4,
      toJSON: () => ({}),
    },
    toJSON: () => ({}),
  } as unknown as GeolocationPosition;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('cuando el GPS responde', () => {
  it('devuelve la ubicacion con su margen de error', async () => {
    conNavegador((exito) => exito(posicionCompleta()));

    const resultado = await ubicacionParaFichar();

    expect(resultado).toEqual({
      location: { latitude: 33.749, longitude: -84.388, accuracyMeters: 14.328 },
    });
  });

  it('NO MANDA LA ALTITUD, EL RUMBO NI LA VELOCIDAD', async () => {
    /*
     * La API del navegador los da, y copiar `coords` entero los mandaria al
     * servidor sin que nadie lo decidiera. El contrato de la API los
     * rechazaria, pero el sitio donde no deben salir es este.
     */
    conNavegador((exito) => exito(posicionCompleta()));

    const resultado = await ubicacionParaFichar();
    const claves = Object.keys('location' in resultado ? resultado.location : {});

    expect(claves.sort()).toEqual(['accuracyMeters', 'latitude', 'longitude']);
  });

  it('enciende el GPS de verdad en vez de estimar por red', async () => {
    /*
     * Una estimacion por wifi en una zona residencial se equivoca en cientos
     * de metros, que es justo el margen en el que hay que decidir si alguien
     * esta en la casa.
     */
    let opcionesRecibidas: PositionOptions | undefined;
    conNavegador((exito, _fallo, opciones) => {
      opcionesRecibidas = opciones;
      exito(posicionCompleta());
    });

    await ubicacionParaFichar();

    expect(opcionesRecibidas?.enableHighAccuracy).toBe(true);
    expect(opcionesRecibidas?.timeout).toBeGreaterThan(0);
  });
});

describe('cuando no hay ubicacion, NUNCA LANZA', () => {
  it('distingue el permiso denegado de un fallo tecnico', async () => {
    conNavegador((_exito, fallo) => fallo(errorDeGeolocalizacion(1)));
    await expect(ubicacionParaFichar()).resolves.toEqual({ locationState: 'DENIED' });

    conNavegador((_exito, fallo) => fallo(errorDeGeolocalizacion(2)));
    await expect(ubicacionParaFichar()).resolves.toEqual({ locationState: 'UNAVAILABLE' });

    conNavegador((_exito, fallo) => fallo(errorDeGeolocalizacion(3)));
    await expect(ubicacionParaFichar()).resolves.toEqual({ locationState: 'UNAVAILABLE' });
  });

  it('sin API de geolocalizacion tampoco lanza', async () => {
    // Un navegador muy viejo o —lo mas probable— la pagina servida sin HTTPS.
    vi.stubGlobal('navigator', {});
    await expect(ubicacionParaFichar()).resolves.toEqual({ locationState: 'UNAVAILABLE' });
  });

  it('si el navegador no contesta NUNCA, el tiempo de espera propio responde', async () => {
    /*
     * EL CASO QUE JUSTIFICA EL TEMPORIZADOR PROPIO. Hay navegadores moviles
     * en los que `timeout` no dispara si el permiso esta concedido y el GPS
     * no responde: sin esto, la promesa se queda colgada y el boton girando
     * para siempre en la puerta de una casa.
     */
    vi.useFakeTimers();
    conNavegador(() => {
      /* silencio absoluto, como el movil que no contesta */
    });

    const promesa = ubicacionParaFichar();
    await vi.advanceTimersByTimeAsync(12_000);

    await expect(promesa).resolves.toEqual({ locationState: 'UNAVAILABLE' });
  });
});

describe('una sola respuesta, pase lo que pase', () => {
  it('si el navegador contesta DESPUES del tiempo de espera, no cambia nada', async () => {
    /*
     * LA CARRERA. Hay dos fuentes de respuesta —el navegador y el
     * temporizador propio—, y si la segunda pudiera sobreescribir a la
     * primera el fichaje se mandaria con un dato que ya se habia descartado.
     * Es justo el tipo de fallo que no rompe nada y produce el dato
     * equivocado.
     */
    vi.useFakeTimers();
    let exitoGuardado: PositionCallback | undefined;
    conNavegador((exito) => {
      exitoGuardado = exito;
    });

    const promesa = ubicacionParaFichar();
    await vi.advanceTimersByTimeAsync(12_000);

    // El GPS aparece tarde, cuando ya se respondio «no pude».
    exitoGuardado?.(posicionCompleta());

    await expect(promesa).resolves.toEqual({ locationState: 'UNAVAILABLE' });
  });

  it('y al contrario: contestado el GPS, el temporizador no lo pisa', async () => {
    vi.useFakeTimers();
    conNavegador((exito) => exito(posicionCompleta()));

    const promesa = ubicacionParaFichar();
    await vi.advanceTimersByTimeAsync(30_000);

    await expect(promesa).resolves.toEqual({
      location: { latitude: 33.749, longitude: -84.388, accuracyMeters: 14.328 },
    });
  });
});
