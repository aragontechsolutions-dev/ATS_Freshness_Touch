import { describe, expect, it } from 'vitest';
import {
  GeocodeQuerySchema,
  GeocodeResultSchema,
  isPlausibleGeorgiaMatch,
  isUsableGeocodeResult,
  type GeocodeResult,
} from './geocoding';
import { haversineMeters, haversineMiles } from './geo-distance';

const ATLANTA: GeocodeResult = {
  latitude: 33.749,
  longitude: -84.388,
  precision: 'ROOFTOP',
  matchedAddress: '123 MAIN ST, ATLANTA, GA, 30303',
  provider: 'census',
};

describe('lo que se le pide a un geocodificador', () => {
  it('acepta una direccion completa', () => {
    expect(
      GeocodeQuerySchema.safeParse({
        line1: '123 Main St',
        city: 'Atlanta',
        state: 'ga',
        postalCode: '30303',
      }).success,
    ).toBe(true);
  });

  it('normaliza el estado a mayusculas', () => {
    const parsed = GeocodeQuerySchema.parse({
      line1: '123 Main St',
      city: 'Atlanta',
      state: 'ga',
      postalCode: '30303',
    });
    expect(parsed.state).toBe('GA');
  });

  it('rechaza un codigo postal que no sean cinco digitos', () => {
    for (const malo of ['3030', '303031', 'ABCDE', '30303-1234']) {
      expect(
        GeocodeQuerySchema.safeParse({
          line1: '123 Main St',
          city: 'Atlanta',
          state: 'GA',
          postalCode: malo,
        }).success,
        malo,
      ).toBe(false);
    }
  });

  it('rechaza una calle vacia: sin calle no hay nada que buscar', () => {
    expect(
      GeocodeQuerySchema.safeParse({
        line1: '   ',
        city: 'Atlanta',
        state: 'GA',
        postalCode: '30303',
      }).success,
    ).toBe(false);
  });

  it('no admite campos de mas, como el apartamento', () => {
    /*
     * `line2` se deja fuera a proposito: «Apto 3B» no mueve el edificio y
     * algunos servicios fallan la coincidencia entera si se lo mandas.
     */
    expect(
      GeocodeQuerySchema.safeParse({
        line1: '123 Main St',
        line2: 'Apt 3B',
        city: 'Atlanta',
        state: 'GA',
        postalCode: '30303',
      }).success,
    ).toBe(false);
  });
});

describe('lo que devuelve', () => {
  it('acepta un resultado completo', () => {
    expect(GeocodeResultSchema.safeParse(ATLANTA).success).toBe(true);
  });

  it('rechaza coordenadas imposibles', () => {
    expect(GeocodeResultSchema.safeParse({ ...ATLANTA, latitude: 91 }).success).toBe(false);
    expect(GeocodeResultSchema.safeParse({ ...ATLANTA, longitude: -181 }).success).toBe(false);
  });

  it('rechaza una precision inventada', () => {
    expect(GeocodeResultSchema.safeParse({ ...ATLANTA, precision: 'CASI' }).success).toBe(false);
  });
});

describe('la guardia del estado', () => {
  /*
   * ESTA ES LA PRUEBA QUE IMPORTA DE TODO EL ARCHIVO.
   *
   * Los geocodificadores no devuelven un error cuando no encuentran la
   * direccion: devuelven lo mas parecido. Hay una «Main Street» en cada
   * pueblo de Estados Unidos, y una coincidencia equivocada llega con
   * coordenadas perfectamente validas. Sin esta guardia, la casa quedaria
   * guardada en otro estado y TODOS los fichajes de ese cliente dirian
   * «a 800 kilometros». El fichaje no fallaria: mentiria.
   */

  it('acepta puntos dentro de Georgia', () => {
    for (const [nombre, lat, lon] of [
      ['Atlanta', 33.749, -84.388],
      ['Savannah', 32.0809, -81.0912],
      ['Columbus', 32.4609, -84.9877],
      ['Augusta', 33.4735, -82.0105],
    ] as const) {
      expect(isPlausibleGeorgiaMatch({ latitude: lat, longitude: lon }), nombre).toBe(true);
    }
  });

  it('rechaza la Main Street de otro estado', () => {
    for (const [nombre, lat, lon] of [
      ['Columbus, Ohio', 39.9612, -82.9988],
      ['Birmingham, Alabama', 33.5186, -86.8104],
      ['Charleston, Carolina del Sur', 32.7765, -79.9311],
      ['Chattanooga, Tennessee', 35.0456, -85.3097],
      ['Jacksonville, Florida', 30.3322, -81.6557],
    ] as const) {
      expect(isPlausibleGeorgiaMatch({ latitude: lat, longitude: lon }), nombre).toBe(false);
    }
  });

  it('Columbus de Georgia y Columbus de Ohio se distinguen', () => {
    /*
     * El caso concreto que hace falta esta guardia: dos ciudades con el
     * mismo nombre, una dentro del area de servicio y otra a 900 km.
     */
    expect(isPlausibleGeorgiaMatch({ latitude: 32.4609, longitude: -84.9877 })).toBe(true);
    expect(isPlausibleGeorgiaMatch({ latitude: 39.9612, longitude: -82.9988 })).toBe(false);
  });

  it('un resultado de Georgia fuera del estado no se guarda', () => {
    const enOhio: GeocodeResult = { ...ATLANTA, latitude: 39.9612, longitude: -82.9988 };
    expect(isUsableGeocodeResult(enOhio, 'GA')).toBe(false);
    expect(isUsableGeocodeResult(ATLANTA, 'GA')).toBe(true);
  });

  it('las dos precisiones valen: lo que se rechaza es el estado equivocado', () => {
    // Un punto interpolado sobre el tramo de calle es peor que el portal,
    // pero sigue distinguiendo «llego» de «esta en su casa a 30 km».
    expect(isUsableGeocodeResult({ ...ATLANTA, precision: 'INTERPOLATED' }, 'GA')).toBe(true);
  });

  it('para otro estado se acepta lo que diga el servicio', () => {
    // El contorno que hay en el contrato es el de Georgia y solo ese. El dia
    // que la empresa opere en otro estado, habra que traer su contorno.
    const enAlabama: GeocodeResult = { ...ATLANTA, latitude: 33.5186, longitude: -86.8104 };
    expect(isUsableGeocodeResult(enAlabama, 'AL')).toBe(true);
  });
});

describe('la distancia compartida', () => {
  /*
   * Estaba duplicada en dos archivos y ahora vive en uno. Estas pruebas la
   * fijan de una vez, que es lo que faltaba: ninguna de las dos copias tenia
   * prueba propia.
   */

  it('dos puntos iguales estan a cero', () => {
    expect(haversineMiles(33.749, -84.388, 33.749, -84.388)).toBe(0);
    expect(haversineMeters(33.749, -84.388, 33.749, -84.388)).toBe(0);
  });

  it('Atlanta a Savannah son unas 215 millas', () => {
    // Distancia en linea recta, no por carretera. La real ronda las 215.
    const millas = haversineMiles(33.749, -84.388, 32.0809, -81.0912);
    expect(millas).toBeGreaterThan(200);
    expect(millas).toBeLessThan(230);
  });

  it('los metros son las millas por 1609,344', () => {
    const millas = haversineMiles(33.749, -84.388, 33.755, -84.39);
    const metros = haversineMeters(33.749, -84.388, 33.755, -84.39);
    expect(metros).toBeCloseTo(millas * 1609.344, 6);
  });

  it('mide bien distancias cortas, que es para lo que la usa el fichaje', () => {
    /*
     * Un grado de latitud son unos 111.320 metros en cualquier sitio. Medio
     * milesimo de grado son unos 55,7 metros: el orden de magnitud de «llego
     * a la puerta de la casa».
     */
    const metros = haversineMeters(33.749, -84.388, 33.7495, -84.388);
    expect(metros).toBeGreaterThan(50);
    expect(metros).toBeLessThan(60);
  });

  it('es simetrica', () => {
    const ida = haversineMeters(33.749, -84.388, 32.0809, -81.0912);
    const vuelta = haversineMeters(32.0809, -81.0912, 33.749, -84.388);
    expect(ida).toBeCloseTo(vuelta, 6);
  });
});
