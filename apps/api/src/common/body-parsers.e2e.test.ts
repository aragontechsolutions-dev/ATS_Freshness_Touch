import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module';
import { applyBodyParsers } from './body-parsers';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';

/**
 * LIMITES DE TAMANO DEL CUERPO (APLICACION REAL)
 * ----------------------------------------------
 * Existen por un fallo detectado al probar la API compilada: un cuerpo por
 * encima del limite devolvia un 500 "error interno" en vez de un 413. El error
 * lo lanza el lector de Express y no es una excepcion de Nest, asi que el
 * filtro lo dejaba caer al caso general.
 *
 * Importa por dos motivos: al cliente se le decia que el fallo era del
 * servidor cuando era suyo, y un proveedor de pago que recibe un 500
 * reintentaria para siempre un evento que nunca vamos a aceptar.
 */
describe('lectura del cuerpo de las peticiones', () => {
  let app: NestExpressApplication;

  /** Cotizacion valida, con relleno opcional para superar el limite. */
  const cuerpoDe = (bytes: number): string =>
    JSON.stringify({
      service: 'STANDARD',
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 1200,
      destination: { postalCode: '30303' },
      // El esquema es estricto: un campo desconocido invalidaria la peticion,
      // asi que solo se anade cuando de verdad hace falta abultar el cuerpo.
      ...(bytes > 0 ? { relleno: 'x'.repeat(bytes) } : {}),
    });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.CORS_ORIGINS = 'http://localhost:5173';
    process.env.QUOTE_RATE_LIMIT_MAX = '100';
    process.env.RATE_LIMIT_MAX = '200';
    delete process.env.DATABASE_URL;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
    applyBodyParsers(app, 'api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('una cotizacion normal pasa sin problemas', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/quotes/estimate')
      .set('content-type', 'application/json')
      .send(cuerpoDe(0))
      .expect(200);
  });

  it('un cuerpo por encima del limite devuelve 413, no 500', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/api/v1/quotes/estimate')
      .set('content-type', 'application/json')
      .send(cuerpoDe(30_000));

    expect(respuesta.status).toBe(413);
    expect(respuesta.body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('un JSON roto devuelve 400, no 500', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/api/v1/quotes/estimate')
      .set('content-type', 'application/json')
      .send('{roto');

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.code).toBe('VALIDATION_ERROR');
  });

  it('el webhook admite eventos mas grandes que el limite general', async () => {
    // Un evento de pago trae el objeto completo del proveedor y no cabe
    // siempre en los 16 KB del cotizador. Se rechaza por firma invalida
    // (401), no por tamano: prueba que el cuerpo si se leyo entero.
    const evento = JSON.stringify({
      id: 'evt_grande',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_mock_x', status: 'SUCCEEDED', relleno: 'x'.repeat(40_000) } },
    });

    const respuesta = await request(app.getHttpServer())
      .post('/api/v1/payments/webhook')
      .set('content-type', 'application/json')
      .set('x-mock-signature', '0'.repeat(64))
      .send(evento);

    expect(respuesta.status).toBe(401);
  });

  it('el webhook tambien tiene un techo propio', async () => {
    const enorme = JSON.stringify({
      id: 'evt_enorme',
      type: 'payment_intent.succeeded',
      data: { object: { relleno: 'x'.repeat(100_000) } },
    });

    const respuesta = await request(app.getHttpServer())
      .post('/api/v1/payments/webhook')
      .set('content-type', 'application/json')
      .set('x-mock-signature', '0'.repeat(64))
      .send(enorme);

    expect(respuesta.status).toBe(413);
  });
});
