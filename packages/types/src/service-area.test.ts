import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SERVICE_AREA,
  MAX_ZONE_MILES,
  ServiceAreaSettingsSchema,
  canRemoveZone,
  instantQuoteRadiusMiles,
  serviceRadiusMiles,
  zoneToAddAfter,
  type ServiceAreaZone,
} from './service-area';

/**
 * ANADIR Y QUITAR ZONAS SIN ROMPER EL CONJUNTO
 * --------------------------------------------
 * El area tiene cuatro reglas que se comprueban juntas —codigos en orden,
 * limites crecientes, el precio automatico que no vuelve y la primera zona
 * que siempre lo da— y el panel las puede romper de muchas maneras.
 *
 * LA PRUEBA QUE IMPORTA NO ES QUE EL CALCULO SALGA: es que lo que proponen
 * estas dos funciones SIEMPRE pase el esquema. Un boton que crea un area
 * invalida y la rechaza al guardar es peor que un boton que no esta.
 */

function area(...zones: ServiceAreaZone[]): ServiceAreaZone[] {
  return zones;
}

const A35: ServiceAreaZone = { code: 'A', maxMiles: 35, instantQuote: true };
const C325: ServiceAreaZone = { code: 'C', maxMiles: 325, instantQuote: false };

describe('zoneToAddAfter', () => {
  it('entre A y C propone la B, a mitad de camino', () => {
    const nueva = zoneToAddAfter(area(A35, C325), 0);

    expect(nueva).toEqual({ code: 'B', maxMiles: 180, instantQuote: false });
  });

  it('al final propone el siguiente codigo y unas millas mas', () => {
    const nueva = zoneToAddAfter(area(A35, C325), 1);

    expect(nueva).toEqual({ code: 'D', maxMiles: 375, instantQuote: false });
  });

  it('hereda el precio automatico de la zona siguiente, nunca de la anterior', () => {
    /*
     * Copiar el de la anterior crearia un area invalida en el acto cuando
     * la siguiente ya no lo da: el precio automatico no vuelve una vez
     * apagado.
     */
    const conPrecio = area(A35, { code: 'D', maxMiles: 200, instantQuote: true });
    const sinPrecio = area(A35, { code: 'D', maxMiles: 200, instantQuote: false });

    expect(zoneToAddAfter(conPrecio, 0)).toEqual({
      code: 'B',
      maxMiles: 117,
      instantQuote: true,
    });
    expect(zoneToAddAfter(sinPrecio, 0)?.instantQuote).toBe(false);
  });

  it('no propone nada si no queda codigo libre en medio', () => {
    const seguidas = area(A35, { code: 'B', maxMiles: 60, instantQuote: true });

    expect(zoneToAddAfter(seguidas, 0)).toBeNull();
  });

  it('no propone nada si no cabe un limite entre los dos', () => {
    const pegadas = area(A35, { code: 'C', maxMiles: 36, instantQuote: false });

    expect(zoneToAddAfter(pegadas, 0)).toBeNull();
  });

  it('no propone nada mas alla del tope duro', () => {
    const alTope = area(A35, { code: 'C', maxMiles: MAX_ZONE_MILES, instantQuote: false });

    expect(zoneToAddAfter(alTope, 1)).toBeNull();
  });

  it('no propone nada despues de la ultima letra', () => {
    const hastaLaE = area(
      A35,
      { code: 'B', maxMiles: 60, instantQuote: true },
      { code: 'C', maxMiles: 120, instantQuote: false },
      { code: 'D', maxMiles: 200, instantQuote: false },
      { code: 'E', maxMiles: 325, instantQuote: false },
    );

    expect(zoneToAddAfter(hastaLaE, 4)).toBeNull();
    expect(ServiceAreaSettingsSchema.safeParse({ zones: hastaLaE }).success).toBe(true);
  });

  it('un indice que no existe no propone nada', () => {
    expect(zoneToAddAfter(area(A35, C325), 7)).toBeNull();
    expect(zoneToAddAfter([], 0)).toBeNull();
  });

  /**
   * LA PRUEBA DE VERDAD: anadir donde se pueda, en cualquier sitio, nunca
   * produce un area que el esquema rechace.
   */
  it('lo que propone siempre pasa el esquema, se anada donde se anada', () => {
    const partida = [...DEFAULT_SERVICE_AREA.zones];

    for (let i = 0; i < partida.length; i += 1) {
      const nueva = zoneToAddAfter(partida, i);
      if (nueva === null) continue;

      const resultado = [...partida.slice(0, i + 1), nueva, ...partida.slice(i + 1)];
      const validado = ServiceAreaSettingsSchema.safeParse({ zones: resultado });

      expect(validado.success).toBe(true);
    }
  });

  /**
   * ANADIENDO AL FINAL NO SE LLEGA A CINCO ZONAS, Y ESTA BIEN ASI.
   *
   * Desde A y C solo se puede crecer con D y E: la B queda en medio, y su
   * codigo NO se reutiliza para la cuarta zona —esta escrito en reservas
   * antiguas que significan «hasta 60 millas, con precio automatico»—. Para
   * recuperar una banda intermedia hay que anadirla entre las dos, que es
   * justo el boton que la pantalla pone en cada fila.
   */
  it('anadiendo al final se crece hasta donde dan los codigos que quedan', () => {
    let zonas = [...DEFAULT_SERVICE_AREA.zones];

    for (let intento = 0; intento < 10; intento += 1) {
      const nueva = zoneToAddAfter(zonas, zonas.length - 1);
      if (nueva === null) break;
      zonas = [...zonas, nueva];
    }

    expect(zonas.map((zona) => zona.code)).toEqual(['A', 'C', 'D', 'E']);
    expect(ServiceAreaSettingsSchema.safeParse({ zones: zonas }).success).toBe(true);

    // Y la B solo se recupera por el medio.
    const conB = zoneToAddAfter(zonas, 0);
    expect(conB?.code).toBe('B');
  });
});

describe('canRemoveZone', () => {
  it('la unica zona no se quita', () => {
    expect(canRemoveZone(area(A35), 0)).toBe(false);
  });

  it('la ultima si', () => {
    expect(canRemoveZone(area(A35, C325), 1)).toBe(true);
  });

  it('la primera no, si la que quedaria no da precio automatico', () => {
    /*
     * Es el area de hoy: quitar la A dejaria la C de primera, y el sitio
     * pediria los datos para no dar ninguna cifra a nadie.
     */
    expect(canRemoveZone(area(A35, C325), 0)).toBe(false);
  });

  it('la primera si, cuando la siguiente tambien da precio automatico', () => {
    const conIntermedia = area(A35, { code: 'B', maxMiles: 60, instantQuote: true }, C325);

    expect(canRemoveZone(conIntermedia, 0)).toBe(true);
  });

  it('un indice que no existe no se quita', () => {
    expect(canRemoveZone(area(A35, C325), 9)).toBe(false);
  });

  it('quitar lo que se puede quitar deja siempre un area valida', () => {
    const zonas = area(A35, { code: 'B', maxMiles: 60, instantQuote: true }, C325);

    for (let i = 0; i < zonas.length; i += 1) {
      if (!canRemoveZone(zonas, i)) continue;

      const resultado = zonas.filter((_, j) => j !== i);
      expect(ServiceAreaSettingsSchema.safeParse({ zones: resultado }).success).toBe(true);
    }
  });
});

describe('los radios del area de partida', () => {
  it('se llega a 325 millas y el precio sale solo hasta 35', () => {
    expect(serviceRadiusMiles(DEFAULT_SERVICE_AREA)).toBe(325);
    expect(instantQuoteRadiusMiles(DEFAULT_SERVICE_AREA)).toBe(35);
  });
});
