import { describe, expect, it } from 'vitest';
import { DEFAULT_SERVICE_AREA } from '@freshness/types';
import { defaultPricingConfig, type ZoneRule } from './config';

/**
 * LAS DOS COPIAS DEL AREA DE SERVICIO TIENEN QUE DECIR LO MISMO
 * ------------------------------------------------------------
 * El area de servicio se edita desde el panel y vive en la base. Pero hay
 * dos sitios en el codigo que describen el area DE PARTIDA:
 *
 *   - `DEFAULT_SERVICE_AREA` (@freshness/types), lo que se guarda la
 *     primera vez y lo que el panel muestra mientras no se haya tocado.
 *   - `defaultPricingConfig.zones` (este paquete), el valor de partida del
 *     motor y el ultimo recurso si la base no responde.
 *
 * POR QUE ESTA PRUEBA EXISTE. Estuvieron descuadrados: el motor declaraba
 * A (35), B (60) y C (325) mientras el area guardada tenia solo A y C. Como
 * en produccion el campo se sobrescribe siempre —ver `zoneRules()`—, nada
 * fallaba: simplemente, leer el codigo llevaba a una conclusion falsa sobre
 * lo que cobra el negocio, y una sesion entera de diagnostico se fue en
 * creer que a 47 millas habia precio automatico.
 *
 * Que no falle nada es justo el problema. Esta prueba lo convierte en un
 * fallo visible: cambiar uno de los dos sin el otro la rompe.
 */
describe('el area de partida, en sus dos copias', () => {
  /**
   * La misma traduccion que hace `ServiceAreaService.zoneRules()`: las zonas
   * configuradas son todas atendidas, y `OUT_OF_RANGE` se anade al final
   * porque no es una zona, es lo que hay mas alla de la ultima.
   */
  const esperadas: ZoneRule[] = [
    ...DEFAULT_SERVICE_AREA.zones.map((zona): ZoneRule => ({
      code: zona.code,
      maxMiles: zona.maxMiles,
      serviceable: true,
      instantQuote: zona.instantQuote,
    })),
    { code: 'OUT_OF_RANGE', maxMiles: null, serviceable: false, instantQuote: false },
  ];

  it('el motor arranca con las mismas zonas que el area de partida', () => {
    expect(defaultPricingConfig.zones).toEqual(esperadas);
  });

  it('la ultima zona es la que no tiene limite, y no se atiende', () => {
    const ultima = defaultPricingConfig.zones.at(-1);

    expect(ultima?.code).toBe('OUT_OF_RANGE');
    expect(ultima?.maxMiles).toBeNull();
    expect(ultima?.serviceable).toBe(false);
  });

  /**
   * EL RADIO SIN RECARGO Y LA ZONA A SON DOS MANDOS DISTINTOS, y en la
   * configuracion de partida valen lo mismo a proposito: la frontera que el
   * cliente nota es «me cobras el viaje o no», asi que arrancar con las dos
   * descuadradas seria prometer o cobrar algo que nadie ha decidido.
   *
   * El panel SI puede separarlas —subir la zona A a 60 dejando el radio
   * libre en 35 cobra las 25 millas de exceso—, y por eso el mapa del sitio
   * dibuja los dos circulos desde la etapa 3.15. Lo que esta prueba fija es
   * el punto de partida, no un impedimento.
   */
  it('el radio sin recargo arranca igual que la zona mas cercana', () => {
    expect(defaultPricingConfig.travel.freeRadiusMiles).toBe(
      DEFAULT_SERVICE_AREA.zones[0]?.maxMiles,
    );
  });
});
