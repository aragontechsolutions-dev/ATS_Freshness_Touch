import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../app.module';
import { applyBodyParsers } from '../common/body-parsers';

/*
 * EL ENTORNO SE FIJA ANTES DE IMPORTAR, NO EN beforeAll.
 *
 * `ConfigModule.forRoot()` lee y valida process.env en el momento en que se
 * importa app.module, que en un modulo ES ocurre ANTES de cualquier beforeAll.
 * Cambiar la variable despues no tiene efecto: la configuracion ya esta
 * congelada y el modulo seguiria levantando el simulador.
 *
 * `vi.hoisted` es la unica forma de ejecutar codigo por encima de los imports.
 */
vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.PAYMENT_PROVIDER = 'stripe';
  // Credenciales falsas: crear el cliente de Stripe no hace ninguna llamada
  // de red y este test no llega a usarlo.
  process.env.STRIPE_SECRET_KEY = 'sk_test_no_se_usa';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_no_se_usa';
  delete process.env.DATABASE_URL;
});

/**
 * EL ATAJO DEL SIMULADOR NO EXISTE CON UN PROVEEDOR REAL
 * ------------------------------------------------------
 * Con el simulador hay un endpoint que confirma la tarjeta sin pagar nada.
 * Es imprescindible para poder probar el formulario de reserva, y seria una
 * puerta abierta si siguiera respondiendo con Stripe activo: permitiria
 * confirmar reservas sin retener un centavo.
 *
 * Responde 404, no 403: asi es indistinguible de una ruta que no existe y no
 * revela siquiera que el sistema tiene un modo simulado.
 */
describe('con Stripe activo', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    // Se monta igual que en produccion para que el webhook reciba el cuerpo
    // original: sin eso rechazaria por un motivo distinto del que se prueba.
    app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
    app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
    applyBodyParsers(app, 'api/v1');
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it('la confirmacion simulada responde 404', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/api/v1/payments/mock/confirm')
      .send({ clientSecret: 'pi_mock_loquesea_secret_x' });

    expect(respuesta.status).toBe(404);
  });

  it('el webhook real sigue existiendo y exige firma', async () => {
    const respuesta = await request(app.getHttpServer())
      .post('/api/v1/payments/webhook')
      .send({ id: 'evt_x', type: 'payment_intent.succeeded' });

    // 401 y no 404: la ruta existe, lo que falta es la firma.
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.code).toBe('WEBHOOK_SIGNATURE_INVALID');
  });
});
