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
 * El proveedor simulado no sirve para comprobarlo —es una tabla de millas
 * desde Atlanta por prefijo del DESTINO, asi que ignora el origen—, de ahi
 * que aqui se use uno falso que simplemente devuelve lo que recibe.
 */

const AJUSTES: Partial<Record<keyof Env, unknown>> = {
  DISTANCE_CACHE_TTL_SECONDS: 300,
  DISTANCE_CACHE_MAX_ENTRIES: 100,
};

const configuracion = {
  get: (key: keyof Env) => AJUSTES[key],
} as unknown as ConfigService<Env, true>;

/** Devuelve el origen recibido como «millas», para poder afirmar sobre el. */
function proveedorQueDelata(): DistanceProvider & { consultas: DistanceQuery[] } {
  const consultas: DistanceQuery[] = [];

  return {
    name: 'mock' as const,
    consultas,
    async resolve(query: DistanceQuery): Promise<DistanceResult> {
      consultas.push(query);
      return {
        miles: Number(query.originPostalCode),
        durationMinutes: 10,
        provider: 'mock',
        estimated: true,
      };
    },
  };
}

function ubicacionEn(postalCode: string): CompanyLocationService {
  const location = { postalCode } as CompanyLocation;
  return { get: () => Promise.resolve(location) } as unknown as CompanyLocationService;
}

describe('el origen de la distancia', () => {
  it('sale de la ubicacion guardada, no del entorno', async () => {
    const provider = proveedorQueDelata();
    const service = new DistanceService(provider, configuracion, ubicacionEn('31401'));

    const resultado = await service.resolve('30303', 'GA');

    expect(provider.consultas[0]?.originPostalCode).toBe('31401');
    expect(resultado.miles).toBe(31401);
  });

  it('se pregunta en cada llamada: mudarse surte efecto sin reiniciar', async () => {
    /*
     * ESTE ES EL FALLO QUE SE EVITA. Antes el origen se leia una vez en el
     * constructor, asi que mover la sede desde el panel no cambiaba nada
     * hasta el siguiente despliegue.
     */
    const provider = proveedorQueDelata();
    const location = { postalCode: '30303' } as CompanyLocation;
    const ubicacion = {
      get: () => Promise.resolve(location),
    } as unknown as CompanyLocationService;

    const service = new DistanceService(provider, configuracion, ubicacion);
    await service.resolve('31401', 'GA');

    location.postalCode = '31401';
    const despues = await service.resolve('31401', 'GA');

    expect(despues.miles).toBe(31401);
  });

  it('el origen entra en la clave de la cache', async () => {
    /*
     * Sin el, lo cacheado desde la sede anterior se seguiria sirviendo
     * durante horas y cobraria traslados que ya no corresponden.
     */
    const provider = proveedorQueDelata();
    const location = { postalCode: '30303' } as CompanyLocation;
    const ubicacion = {
      get: () => Promise.resolve(location),
    } as unknown as CompanyLocationService;

    const service = new DistanceService(provider, configuracion, ubicacion);
    await service.resolve('31401', 'GA');
    const repetida = await service.resolve('31401', 'GA');
    expect(repetida.cached).toBe(true);

    location.postalCode = '31401';
    const trasMudarse = await service.resolve('31401', 'GA');

    expect(trasMudarse.cached).toBe(false);
    expect(provider.consultas).toHaveLength(2);
  });
});

describe('lo que no cambia', () => {
  it('sigue cacheando por destino y detalle', async () => {
    const provider = proveedorQueDelata();
    const service = new DistanceService(provider, configuracion, ubicacionEn('30303'));

    await service.resolve('31401', 'GA');
    await service.resolve('31401', 'GA', { line1: '1 Bull St' });

    // La distancia hasta un portal concreto no es la misma que hasta el
    // centro del codigo postal: mezclarlas daria depositos incorrectos.
    expect(provider.consultas).toHaveLength(2);
  });

  it('no consulta dos veces lo mismo', async () => {
    const provider = proveedorQueDelata();
    const service = new DistanceService(provider, configuracion, ubicacionEn('30303'));

    await service.resolve('31401', 'GA');
    await service.resolve('31401', 'GA');

    expect(provider.consultas).toHaveLength(1);
  });
});
