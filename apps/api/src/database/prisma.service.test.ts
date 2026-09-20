import { describe, expect, it } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import type { Env } from '../common/config/env';
import { PrismaService } from './prisma.service';

/** ConfigService minimo con las variables que lee el servicio. */
function configWith(databaseUrl?: string): ConfigService<Env, true> {
  return {
    get: (key: keyof Env) => (key === 'DATABASE_URL' ? databaseUrl : undefined),
  } as unknown as ConfigService<Env, true>;
}

describe('PrismaService sin base de datos configurada', () => {
  it('no se considera configurado', () => {
    const service = new PrismaService(configWith(undefined));
    expect(service.configured).toBe(false);
  });

  it('arranca sin lanzar excepcion: el cotizador debe seguir funcionando', async () => {
    const service = new PrismaService(configWith(undefined));
    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(service.isConnected).toBe(false);
  });

  it('devuelve 503 al pedir el cliente, no un error interno', () => {
    const service = new PrismaService(configWith(undefined));
    expect(() => service.db).toThrow(ServiceUnavailableException);
  });

  it('la sonda informa que no hay base de datos', async () => {
    const service = new PrismaService(configWith(undefined));
    await expect(service.ping()).resolves.toBe(false);
  });

  it('apagar el servicio sin conexion no falla', async () => {
    const service = new PrismaService(configWith(undefined));
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});

describe('PrismaService con una base de datos inalcanzable', () => {
  // Puerto cerrado: la conexion se rechaza al instante.
  const UNREACHABLE = 'postgresql://usuario:clave@127.0.0.1:59999/freshness';

  it('se considera configurado pero no conectado', async () => {
    const service = new PrismaService(configWith(UNREACHABLE));
    expect(service.configured).toBe(true);

    // Arrancar NO debe lanzar: una base de datos caida no puede tumbar la API.
    await expect(service.onModuleInit()).resolves.toBeUndefined();
    expect(service.isConnected).toBe(false);
  }, 20_000);

  it('la sonda devuelve falso en vez de propagar el error', async () => {
    const service = new PrismaService(configWith(UNREACHABLE));
    await service.onModuleInit();
    await expect(service.ping()).resolves.toBe(false);
  }, 20_000);
});
