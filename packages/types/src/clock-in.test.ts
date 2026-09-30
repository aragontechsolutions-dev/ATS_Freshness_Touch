import { describe, expect, it } from 'vitest';
import {
  CLOCK_IN_FAR_METERS,
  ClockInLocationSchema,
  ClockInRecordSchema,
  clockInDistanceMeters,
  isFarFromHouse,
  type ClockInRecord,
} from './clock-in';
import { MyJobProgressSchema } from './my-jobs';

/** Centro de Atlanta, la casa de referencia de estas pruebas. */
const CASA = { latitude: 33.749, longitude: -84.388 };

function fichaje(cambios: Partial<ClockInRecord> = {}): ClockInRecord {
  return {
    staffId: '11111111-1111-4111-8111-111111111111',
    staffFirstName: 'Ana',
    kind: 'ARRIVAL',
    occurredAt: '2026-10-01T12:00:00.000Z',
    locationState: 'RECORDED',
    distanceMeters: 40,
    accuracyMeters: 15,
    ...cambios,
  };
}

describe('la distancia a la casa', () => {
  it('en la puerta son unos pocos metros', () => {
    const metros = clockInDistanceMeters(
      { latitude: 33.7491, longitude: -84.3881, accuracyMeters: 10 },
      CASA,
    );

    expect(metros).not.toBeNull();
    expect(metros).toBeLessThan(30);
  });

  it('desde su propia casa a 30 kilometros se ve', () => {
    /*
     * EL CASO QUE JUSTIFICA TODA LA FUNCION. Marietta esta a unos 25 km del
     * centro de Atlanta: fichar desde alli es exactamente lo que esto tiene
     * que distinguir.
     */
    const metros = clockInDistanceMeters(
      { latitude: 33.9526, longitude: -84.5499, accuracyMeters: 20 },
      CASA,
    );

    expect(metros).toBeGreaterThan(25_000);
    expect(metros).toBeLessThan(30_000);
  });

  it('devuelve metros enteros, sin decimales que finjan exactitud', () => {
    const metros = clockInDistanceMeters(
      { latitude: 33.7523, longitude: -84.3912, accuracyMeters: 10 },
      CASA,
    );

    expect(metros).toBe(Math.round(metros ?? 0));
  });

  it('sin coordenadas de la casa devuelve null, que NO es un error', () => {
    // Es el caso `NO_HOUSE`: la geocodificacion todavia no la resolvio. El
    // fallo es nuestro, y el fichaje sigue adelante sin distancia.
    expect(
      clockInDistanceMeters(
        { latitude: 33.749, longitude: -84.388, accuracyMeters: 10 },
        {
          latitude: null,
          longitude: null,
        },
      ),
    ).toBeNull();

    // Y con una sola de las dos tampoco: media coordenada no es un punto.
    expect(
      clockInDistanceMeters(
        { latitude: 33.749, longitude: -84.388, accuracyMeters: 10 },
        {
          latitude: 33.749,
          longitude: null,
        },
      ),
    ).toBeNull();
  });
});

describe('«lejos de la casa»', () => {
  it('en la puerta, no esta lejos', () => {
    expect(isFarFromHouse(fichaje({ distanceMeters: 40, accuracyMeters: 15 }))).toBe(false);
  });

  it('a dos kilometros y medio con buen GPS, esta lejos', () => {
    expect(isFarFromHouse(fichaje({ distanceMeters: 2400, accuracyMeters: 20 }))).toBe(true);
  });

  it('UN GPS MALO NO ACUSA A NADIE', () => {
    /*
     * LA PRUEBA QUE MAS IMPORTA DE ESTE ARCHIVO.
     *
     * «A 300 metros» con un margen de ±500 es perfectamente compatible con
     * estar en la puerta de la casa: el movil mismo esta diciendo que no sabe
     * donde esta. Marcar eso seria señalar a una empleada por la calidad del
     * GPS de su telefono, y eso es precisamente lo que no puede pasar.
     */
    expect(isFarFromHouse(fichaje({ distanceMeters: 300, accuracyMeters: 500 }))).toBe(false);

    // Y con la misma distancia pero una lectura fiable, si se marca.
    expect(isFarFromHouse(fichaje({ distanceMeters: 300, accuracyMeters: 10 }))).toBe(true);
  });

  it('lo que se compara con el umbral es la distancia MINIMA posible', () => {
    const margen = 100;

    // Justo en el borde: 250 + 100 = 350 deja la minima posible en el umbral,
    // y el umbral no se pasa por igualar.
    expect(
      isFarFromHouse(
        fichaje({ distanceMeters: CLOCK_IN_FAR_METERS + margen, accuracyMeters: margen }),
      ),
    ).toBe(false);

    // Un metro mas, y si.
    expect(
      isFarFromHouse(
        fichaje({ distanceMeters: CLOCK_IN_FAR_METERS + margen + 1, accuracyMeters: margen }),
      ),
    ).toBe(true);
  });

  it('sin distancia NO esta lejos: la ausencia de dato no es una acusacion', () => {
    for (const estado of ['DENIED', 'UNAVAILABLE', 'NO_HOUSE'] as const) {
      expect(
        isFarFromHouse(
          fichaje({ locationState: estado, distanceMeters: null, accuracyMeters: null }),
        ),
      ).toBe(false);
    }
  });
});

describe('el contrato de lo que manda el movil', () => {
  it('acepta una ubicacion con su margen de error', () => {
    expect(
      ClockInLocationSchema.safeParse({
        latitude: 33.749,
        longitude: -84.388,
        accuracyMeters: 12.5,
      }).success,
    ).toBe(true);
  });

  it('RECHAZA cualquier campo de mas que mande el navegador', () => {
    /*
     * La API de geolocalizacion del navegador tambien da altitud, rumbo y
     * velocidad. Si algun dia el cliente los mandara —por descuido o por un
     * copia y pega de `coords`—, el contrato los RECHAZA en vez de dejarlos
     * pasar hacia la base de datos. Una fuga de datos de ubicacion por
     * descuido es justo lo que este diseño quiere hacer imposible.
     */
    for (const extra of ['altitude', 'heading', 'speed', 'altitudeAccuracy']) {
      expect(
        ClockInLocationSchema.safeParse({
          latitude: 33.749,
          longitude: -84.388,
          accuracyMeters: 12,
          [extra]: 1,
        }).success,
      ).toBe(false);
    }
  });

  it('rechaza coordenadas imposibles', () => {
    expect(
      ClockInLocationSchema.safeParse({ latitude: 91, longitude: -84.388, accuracyMeters: 10 })
        .success,
    ).toBe(false);
    expect(
      ClockInLocationSchema.safeParse({ latitude: 33.749, longitude: 181, accuracyMeters: 10 })
        .success,
    ).toBe(false);
  });

  it('rechaza un margen de error inservible', () => {
    // Cien kilometros de margen no es un dato, es ruido con pinta de dato.
    expect(
      ClockInLocationSchema.safeParse({
        latitude: 33.749,
        longitude: -84.388,
        accuracyMeters: 200_000,
      }).success,
    ).toBe(false);
  });
});

describe('el movil puede decir «no pude», nunca «si pude»', () => {
  it('acepta los dos motivos que el movil si conoce', () => {
    for (const estado of ['DENIED', 'UNAVAILABLE'] as const) {
      expect(
        MyJobProgressSchema.safeParse({ status: 'IN_PROGRESS', locationState: estado }).success,
      ).toBe(true);
    }
  });

  it('RECHAZA que el cliente se declare RECORDED', () => {
    /*
     * ES UNA COMPROBACION DE SEGURIDAD, NO DE FORMA. `RECORDED` significa
     * «hay una distancia calculada»; un cliente que lo declarara sin mandar
     * coordenadas estaria afirmando que se comprobo algo que nadie comprobo.
     * Lo pone el servidor, y solo despues de calcular los metros.
     */
    expect(
      MyJobProgressSchema.safeParse({ status: 'IN_PROGRESS', locationState: 'RECORDED' }).success,
    ).toBe(false);
  });

  it('RECHAZA que el cliente se declare NO_HOUSE', () => {
    // Es un hecho de NUESTRA base de datos, que el movil no puede saber.
    expect(
      MyJobProgressSchema.safeParse({ status: 'IN_PROGRESS', locationState: 'NO_HOUSE' }).success,
    ).toBe(false);
  });

  it('sin nada de ubicacion sigue siendo valido: el fichaje no se bloquea', () => {
    expect(MyJobProgressSchema.safeParse({ status: 'IN_PROGRESS' }).success).toBe(true);
    expect(MyJobProgressSchema.safeParse({ status: 'COMPLETED' }).success).toBe(true);
  });

  it('rechaza campos que no estan en el contrato', () => {
    expect(
      MyJobProgressSchema.safeParse({
        status: 'IN_PROGRESS',
        // Un intento de colar las coordenadas fuera de `location`.
        latitude: 33.749,
      }).success,
    ).toBe(false);
  });
});

describe('lo que queda registrado', () => {
  it('no tiene DONDE poner unas coordenadas', () => {
    /*
     * La decision de privacidad hecha tipo: no hay manera de guardar un
     * fichaje con la posicion de nadie, porque el tipo de lo que se guarda no
     * tiene campo para ella. Si alguien lo intenta, esto falla.
     */
    expect(
      ClockInRecordSchema.safeParse({ ...fichaje(), latitude: 33.749, longitude: -84.388 }).success,
    ).toBe(false);
  });

  it('un fichaje sin ubicacion lleva los dos numeros a null', () => {
    expect(
      ClockInRecordSchema.safeParse(
        fichaje({ locationState: 'DENIED', distanceMeters: null, accuracyMeters: null }),
      ).success,
    ).toBe(true);
  });

  it('la distancia se guarda en metros enteros', () => {
    expect(ClockInRecordSchema.safeParse(fichaje({ distanceMeters: 40.7 })).success).toBe(false);
  });
});
