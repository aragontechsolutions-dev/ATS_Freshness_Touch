import { Test, type TestingModule } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module';

/**
 * TESTS SOBRE LA APLICACION REAL
 * ------------------------------
 * Levanta la aplicacion completa y le hace peticiones HTTP de verdad.
 *
 * Existen por un fallo concreto que llego a produccion: la sonda de salud
 * quedaba sujeta al limitador de 10 peticiones por minuto, y como Render la
 * consulta cada 5 segundos, empezaba a recibir 429 y daba el servicio por
 * caido. Los tests unitarios no podian detectarlo porque el problema estaba
 * en como interactuan el guardia, los decoradores y las rutas.
 */
describe('sondas de salud (aplicacion real)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Entorno minimo; sin base de datos, que es el caso mas restrictivo.
    process.env.NODE_ENV = 'test';
    process.env.CORS_ORIGINS = 'http://localhost:5173';
    delete process.env.DATABASE_URL;

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('responde a la sonda de vida', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body.status).toBe('ok');
  });

  it('NUNCA limita la sonda de vida, por muchas veces que se consulte', async () => {
    // Render consulta cada 5 segundos: 12 veces por minuto, por encima del
    // limite estricto de 10. Treinta llamadas cubren el caso con margen.
    const codes: number[] = [];
    for (let i = 0; i < 30; i += 1) {
      const response = await request(app.getHttpServer()).get('/health');
      codes.push(response.status);
    }

    expect(codes.filter((code) => code !== 200)).toEqual([]);
  });

  it('NUNCA limita la sonda de disponibilidad', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 15; i += 1) {
      const response = await request(app.getHttpServer()).get('/health/ready');
      codes.push(response.status);
    }

    expect(codes.filter((code) => code !== 200)).toEqual([]);
  });

  it('informa de que no hay base de datos configurada', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(response.body).toEqual({ status: 'degraded', database: 'not_configured' });
  });

  it('las sondas quedan fuera del prefijo de version', async () => {
    await request(app.getHttpServer()).get('/api/v1/health').expect(404);
  });
});

describe('limites de peticiones (aplicacion real)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.CORS_ORIGINS = 'http://localhost:5173';
    process.env.QUOTE_RATE_LIMIT_MAX = '10';

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('el cotizador SI se sigue limitando: la proteccion no se perdio al eximir la salud', async () => {
    const body = {
      service: 'STANDARD',
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1800,
      destination: { postalCode: '30303' },
    };

    const codes: number[] = [];
    for (let i = 0; i < 12; i += 1) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/quotes/estimate')
        .send(body);
      codes.push(response.status);
    }

    expect(codes.filter((code) => code === 200).length).toBe(10);
    expect(codes.filter((code) => code === 429).length).toBe(2);
  });
});
