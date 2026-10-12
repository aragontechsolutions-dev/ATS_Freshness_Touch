import { describe, expect, it } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { CompanyLocation } from '@freshness/types';
import type { Env } from '../common/config/env';
import { DistanceService } from './distance.service';
import type { CompanyLocationService } from '../settings/company-location.service';
import type { DistanceProvider, DistanceQuery, DistanceResult } from './distance.types';

/**
 * DE DONDE SE MIDE
 * ----------------
 * El origen de la distancia dejo de ser una variable de entorno leida al
 * arrancar y paso a ser la ubicacion que administracion guarda desde el
 * panel. El fallo que esto evita no se ve en ninguna pantalla: si el
 * servicio siguiera midiendo desde el sitio viejo, el mapa se recentraria
 * y las zonas cambiarian mientras las millas facturadas siguen siendo las
 * de antes. Todo funcionando, todo cobrando mal.
 *
 * ========================================================================
 * Y DESDE LA ETAPA 3.14, EL ORIGEN ES EL PUNTO MARCADO
 * ========================================================================
 * Antes se mandaba el CODIGO POSTAL de la sede, y la latitud y la longitud
 * solo dibujaban el mapa. Dos fuentes para el mismo dato, sin nada que las
 * obligara a coincidir: arrastrar el marcador y olvidar el campo del codigo
 * postal dejaba el mapa diciendo una cosa y la factura calculando otra.
 *
 * El proveedor simulado no sirve para comprobar nada de esto —es una tabla
 * de millas desde Atlanta por prefijo del DESTINO, asi que ignora el
 * origen—, de ahi que aqui se use uno falso que delata lo que recibe.
 */

const AJUSTES: Partial<Record<keyof Env, unknown>> = {
  DISTANCE_CACHE_TTL_SECONDS: 300,
  DISTANCE_CACHE_MAX_ENTRIES: 100,
};

const configuracion = {
  get: (key: keyof Env) => AJUSTES[key],
} as unknown as ConfigService<Env, true>;

/** Devuelve la latitud recibida como «millas», para poder afirmar sobre ella. */
function proveedorQueDelata(): DistanceProvider & { consultas: DistanceQuery[] } {
  const consultas: DistanceQuery[] = [];

  return {
    name: 'mock' as const,
    consultas,
    async resolve(query: DistanceQuery): Promise<DistanceResult> {
      consultas.push(query);
      return {
        miles: query.origin.latitude,
        durationMinutes: 10,
        provider: 'mock',
        estimated: true,
      };
    },
  };
}

/** La sede en un punto, con un codigo postal que NO le corresponde. */
function sedeEn(latitude: number, longitude: number, postalCode = '30303'): CompanyLocation {
  return { latitude, longitude, city: 'Atlanta', state: 'GA', postalCode } as CompanyLocation;
}

function ubicacionFija(location: CompanyLocation): CompanyLocationService {
  return { get: () => Promise.resolve(location) } as unknown as CompanyLocationService;
}

describe('el origen de la distancia', () => {
  it('sale de la ubicacion guardada, no del entorno', async () => {
    const provider = proveedorQueDelata();
    const service = new DistanceService(
      provider,
      configuracion,
      ubicacionFija(sedeEn(32.08, -81.09)),
    );

    const resultado = await service.resolve('30303', 'GA');

    expect(provider.consultas[0]?.origin).toEqual({ latitude: 32.08, longitude: -81.09 });
    expect(resultado.miles).toBe(32.08);
  });

  it('se pregunta en cada llamada: mudarse surte efecto sin reiniciar', async () => {
    /*
     * ESTE ES EL FALLO QUE SE EVITA. Antes el origen se leia una vez en el
     * constructor, asi que mover la sede desde el panel no cambiaba nada
     * hasta el siguiente despliegue.
     */
    const provider = proveedorQueDelata();
    const location = sedeEn(33.749, -84.388);
    const service = new DistanceService(provider, configuracion, ubicacionFija(location));

    await service.resolve('31401', 'GA');

    location.latitude = 32.08;
    const despues = await service.resolve('31401', 'GA');

    expect(despues.miles).toBe(32.08);
  });

  it('el origen entra en la clave de la cache', async () => {
    /*
     * Sin el, lo cacheado desde la sede anterior se seguiria sirviendo
     * durante horas y cobraria traslados que ya no corresponden.
     */
    const provider = proveedorQueDelata();
    const location = sedeEn(33.749, -84.388);
    const service = new DistanceService(provider, configuracion, ubicacionFija(location));

    await service.resolve('31401', 'GA');
    const repetida = await service.resolve('31401', 'GA');
    expect(repetida.cached).toBe(true);

    location.latitude = 32.08;
    const trasMudarse = await service.resolve('31401', 'GA');

    expect(trasMudarse.cached).toBe(false);
    expect(provider.consultas).toHaveLength(2);
  });
});

/* -------------------------------------------------------------------------- */

describe('una sola fuente para el origen (etapa 3.14)', () => {
  it('AL PROVEEDOR LE LLEGA EL PUNTO, NUNCA EL CODIGO POSTAL DE LA SEDE', async () => {
    /*
     * La prueba que sostiene la etapa.
     *
     * La sede esta marcada en Savannah y el campo del codigo postal se
     * quedo en el de Atlanta, que es exactamente el descuadre que podia
     * pasar sin que lo delatara ningun error: el mapa dibujaba Savannah y
     * la factura se calculaba desde Atlanta, a 250 millas.
     *
     * Ahora lo que viaja es el punto, asi que el campo olvidado no puede
     * cobrar de mas. Y se comprueba que NO va de pasajero: un codigo postal
     * en la consulta volveria a ser una segunda fuente de verdad, y alguien
     * acabaria usandola.
     */
    const provider = proveedorQueDelata();
    const service = new DistanceService(
      provider,
      configuracion,
      ubicacionFija(sedeEn(32.08, -81.09, '30303')),
    );

    await service.resolve('31401', 'GA');

    const consulta = provider.consultas[0];
    expect(consulta?.origin).toEqual({ latitude: 32.08, longitude: -81.09 });
    expect(JSON.stringify(consulta)).not.toContain('30303');
  });

  it('mover el marcador DENTRO del mismo codigo postal invalida la cache', async () => {
    /*
     * El caso que la clave anterior no cubria. Con el codigo postal en la
     * clave, arrastrar el marcador unas millas sin cambiar de codigo postal
     * cambiaba la medida pero no la clave: se seguia sirviendo la distancia
     * de la sede anterior hasta veinticuatro horas despues.
     */
    const provider = proveedorQueDelata();
    const location = sedeEn(33.88, -84.67, '30127');
    const service = new DistanceService(provider, configuracion, ubicacionFija(location));

    await service.resolve('30655', 'GA');

    // Mismo codigo postal, punto distinto.
    location.latitude = 33.91;
    const trasMover = await service.resolve('30655', 'GA');

    expect(trasMover.cached).toBe(false);
    expect(trasMover.miles).toBe(33.91);
  });
});

describe('lo que no cambia', () => {
  it('sigue cacheando por destino y detalle', async () => {
    const provider = proveedorQueDelata();
    const service = new DistanceService(
      provider,
      configuracion,
      ubicacionFija(sedeEn(33.749, -84.388)),
    );

    await service.resolve('31401', 'GA');
    await service.resolve('31401', 'GA', { line1: '1 Bull St' });

    // La distancia hasta un portal concreto no es la misma que hasta el
    // centro del codigo postal: mezclarlas daria depositos incorrectos.
    expect(provider.consultas).toHaveLength(2);
  });

  it('no consulta dos veces lo mismo', async () => {
    const provider = proveedorQueDelata();
    const service = new DistanceService(
      provider,
      configuracion,
      ubicacionFija(sedeEn(33.749, -84.388)),
    );

    await service.resolve('31401', 'GA');
    await service.resolve('31401', 'GA');

    expect(provider.consultas).toHaveLength(1);
  });
});
