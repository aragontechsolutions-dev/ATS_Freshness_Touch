import { describe, expect, it } from 'vitest';
import { GEORGIA_OUTLINE, farthestGeorgiaMiles } from './georgia-outline';

/**
 * EL CONTORNO DEL ESTADO
 * ----------------------
 * Son 476 pares de numeros que nadie va a revisar a ojo, y un error en
 * ellos no rompe nada: dibuja un estado raro. Lo que se comprueba aqui es
 * que el poligono ES Georgia, y se hace con la pregunta que el mapa existe
 * para contestar —«¿venis a mi ciudad?»— en sitios donde la respuesta se
 * sabe de antemano.
 */

/**
 * Punto dentro de poligono por el metodo del rayo.
 *
 * Se cuenta cuantas veces un rayo horizontal hacia el este cruza el borde:
 * impar es dentro, par es fuera. Va aqui y no en el codigo de produccion
 * porque el mapa no necesita preguntarselo: dibuja el poligono y ya.
 */
function dentro(lat: number, lon: number): boolean {
  let cruces = false;
  for (let i = 0, j = GEORGIA_OUTLINE.length - 1; i < GEORGIA_OUTLINE.length; j = i++) {
    const [latI, lonI] = GEORGIA_OUTLINE[i] as readonly [number, number];
    const [latJ, lonJ] = GEORGIA_OUTLINE[j] as readonly [number, number];

    if (latI > lat !== latJ > lat && lon < ((lonJ - lonI) * (lat - latI)) / (latJ - latI) + lonI) {
      cruces = !cruces;
    }
  }
  return cruces;
}

describe('el poligono es Georgia', () => {
  it('las ciudades de Georgia caen dentro', () => {
    const dentroDelEstado: [string, number, number][] = [
      ['Atlanta', 33.749, -84.388],
      ['Savannah', 32.0809, -81.0912],
      ['Augusta', 33.4735, -82.0105],
      ['Columbus', 32.4608, -84.9877],
      ['Macon', 32.8407, -83.6324],
      ['Valdosta', 30.8327, -83.2785],
      ['Dalton', 34.7698, -84.9702],
    ];

    for (const [nombre, lat, lon] of dentroDelEstado) {
      expect(dentro(lat, lon), nombre).toBe(true);
    }
  });

  it('las ciudades de los estados vecinos caen fuera', () => {
    /*
     * ES LA PRUEBA QUE JUSTIFICA TODO EL ARCHIVO. El circulo de 325 millas
     * que habia antes metia a las cinco dentro del area de servicio, y a
     * ninguna de ellas se va: el motor las marca `outOfState`.
     */
    const fueraDelEstado: [string, number, number][] = [
      ['Chattanooga (Tennessee)', 35.0456, -85.3097],
      ['Greenville (Carolina del Sur)', 34.8526, -82.394],
      ['Birmingham (Alabama)', 33.5186, -86.8104],
      ['Jacksonville (Florida)', 30.3322, -81.6557],
      ['Asheville (Carolina del Norte)', 35.5951, -82.5515],
    ];

    for (const [nombre, lat, lon] of fueraDelEstado) {
      expect(dentro(lat, lon), nombre).toBe(false);
    }
  });
});

describe('la forma del anillo', () => {
  it('no repite el primer punto al final: se cierra al dibujarse', () => {
    const primero = GEORGIA_OUTLINE[0];
    const ultimo = GEORGIA_OUTLINE[GEORGIA_OUTLINE.length - 1];

    expect(primero).not.toEqual(ultimo);
  });

  it('cabe dentro de los limites reales del estado', () => {
    /*
     * Georgia va de 30,3 a 35,0 de latitud y de -85,7 a -80,7 de longitud.
     * Un punto fuera de esa caja significa casi siempre latitud y longitud
     * intercambiadas, que es el fallo clasico al pasar de GeoJSON a
     * Leaflet y deja el estado en medio del oceano Indico.
     */
    for (const [lat, lon] of GEORGIA_OUTLINE) {
      expect(lat).toBeGreaterThan(30.3);
      expect(lat).toBeLessThan(35.1);
      expect(lon).toBeGreaterThan(-85.7);
      expect(lon).toBeLessThan(-80.7);
    }
  });

  it('tiene suficientes puntos para parecer Georgia y no un triangulo', () => {
    expect(GEORGIA_OUTLINE.length).toBeGreaterThan(300);
    // Y no tantos como para pesar: el mapa se descarga en moviles.
    expect(GEORGIA_OUTLINE.length).toBeLessThan(900);
  });
});

describe('hasta donde llega el estado desde la base', () => {
  /** La base de operaciones de partida: Atlanta, 30303. */
  const ATLANTA = { lat: 33.749, lon: -84.388 };

  it('el punto mas lejano de Georgia esta a unas 275 millas de Atlanta', () => {
    /*
     * Es la esquina sureste, hacia St. Marys. El numero importa porque es
     * el que decide la forma del anillo exterior: la zona configurada a
     * 325 millas lo supera, asi que cubre el estado entero y se dibuja
     * como el contorno.
     */
    const millas = farthestGeorgiaMiles(ATLANTA.lat, ATLANTA.lon);

    expect(millas).toBeGreaterThan(270);
    expect(millas).toBeLessThan(280);
  });

  it('las zonas cercanas NO cubren el estado, asi que siguen siendo circulos', () => {
    // 35 y 60 millas se quedan dentro de Georgia por todos lados: dibujarlas
    // como circulos dice la verdad y ademas es lo que el cliente entiende.
    const lejos = farthestGeorgiaMiles(ATLANTA.lat, ATLANTA.lon);

    expect(35).toBeLessThan(lejos);
    expect(60).toBeLessThan(lejos);
    expect(325).toBeGreaterThan(lejos);
  });

  it('desde otra base da otra respuesta: no es una constante escondida', () => {
    /*
     * Desde Savannah, en la costa, el punto mas lejano es la esquina
     * noroeste y sale bastante menos. Si esto devolviera siempre lo mismo,
     * mover la base dejaria el mapa mintiendo sin que nadie lo notara.
     */
    const desdeAtlanta = farthestGeorgiaMiles(ATLANTA.lat, ATLANTA.lon);
    const desdeSavannah = farthestGeorgiaMiles(32.0809, -81.0912);

    expect(Math.round(desdeSavannah)).not.toBe(Math.round(desdeAtlanta));
    expect(desdeSavannah).toBeGreaterThan(0);
  });
});
