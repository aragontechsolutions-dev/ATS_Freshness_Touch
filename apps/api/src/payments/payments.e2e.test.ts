import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DateTime } from 'luxon';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module';
import { applyBodyParsers } from '../common/body-parsers';
import { PAYMENT_PROVIDER } from './payments.types';
import type { MockPaymentProvider } from './providers/mock-payment.provider';

/**
 * FLUJO COMPLETO DE PAGO CONTRA UNA BASE DE DATOS REAL
 * ----------------------------------------------------
 * Reserva -> retencion del deposito -> aviso del proveedor -> reserva
 * confirmada, con un PostgreSQL de verdad (compilado a WebAssembly) y
 * peticiones HTTP reales.
 *
 * Lo que de verdad se comprueba aqui es la SEGURIDAD del webhook, que es el
 * punto mas delicado de todo el sistema: es un endpoint publico y sin sesion
 * que puede confirmar reservas. Si su firma no se verificase bien, cualquiera
 * podria reservar sin pagar.
 */

const PORT = 55434;
const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');
const SECRETO = 'secreto-de-webhook-para-pruebas';
const RUTA = '/api/v1/payments/webhook';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: NestExpressApplication;
let provider: MockPaymentProvider;

function proximoDiaLaborable(offsetDias = 3): string {
  let day = DateTime.now().setZone('America/New_York').plus({ days: offsetDias }).startOf('day');
  while (day.weekday === 7) {
    day = day.plus({ days: 1 });
  }
  return day.toFormat('yyyy-MM-dd');
}

const TRABAJO = {
  service: 'STANDARD' as const,
  bedrooms: 2,
  bathrooms: 1,
  squareFeet: 1200,
  addOns: [],
};

const DIRECCION = {
  line1: '500 Peachtree St NE',
  city: 'Atlanta',
  state: 'GA',
  postalCode: '30308',
};

/** Reserva una franja libre del dia indicado y devuelve la respuesta. */
async function reservar(email: string, dia: string): Promise<request.Response> {
  const disponibilidad = await request(app.getHttpServer())
    .get('/api/v1/availability')
    .query({ date: dia, ...TRABAJO, addOns: [] })
    .expect(200);

  const franja = disponibilidad.body.slots.find(
    (slot: { available: boolean }) => slot.available,
  ).startsAt;

  return request(app.getHttpServer())
    .post('/api/v1/bookings')
    .send({
      ...TRABAJO,
      startsAt: franja,
      address: DIRECCION,
      contact: {
        firstName: 'Ana',
        lastName: 'Perez',
        email,
        phone: '+1 404 555 0199',
        locale: 'en',
      },
    })
    .expect(201);
}

/** Construye un evento del proveedor y lo envia con una firma valida. */
function enviarEvento(evento: Record<string, unknown>, firma?: string): request.Test {
  const cuerpo = JSON.stringify(evento);
  return request(app.getHttpServer())
    .post(RUTA)
    .set('content-type', 'application/json')
    .set('x-mock-signature', firma ?? provider.sign(cuerpo))
    .send(cuerpo);
}

function eventoDePago(
  id: string,
  type: string,
  paymentIntentId: string,
  status: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    type,
    data: { object: { id: paymentIntentId, status, amount: 3000, ...extra } },
  };
}

beforeAll(async () => {
  db = await PGlite.create();
  socket = new PGLiteSocketServer({ db, port: PORT, host: '127.0.0.1' });
  await socket.start();

  for (const migracion of readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, migracion.name, 'migration.sql'), 'utf8'));
  }

  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`;
  process.env.PAYMENT_PROVIDER = 'mock';
  process.env.PAYMENT_MOCK_WEBHOOK_SECRET = SECRETO;
  process.env.QUOTE_RATE_LIMIT_MAX = '200';
  process.env.RATE_LIMIT_MAX = '400';

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
  applyBodyParsers(app, 'api/v1');
  await app.init();

  provider = app.get<MockPaymentProvider>(PAYMENT_PROVIDER);
}, 120_000);

afterAll(async () => {
  await app?.close();
  await socket?.stop();
  await db?.close();
});

describe('retencion del deposito al reservar', () => {
  let paymentIntentId: string;
  let bookingId: string;

  it('la reserva devuelve una sesion de pago y queda pendiente', async () => {
    const respuesta = await reservar('deposito@example.com', proximoDiaLaborable());
    bookingId = respuesta.body.bookingId;

    expect(respuesta.body.status).toBe('PENDING_PAYMENT');
    expect(respuesta.body.nextStep).toBe('PAYMENT');
    expect(respuesta.body.payment).not.toBeNull();
    expect(respuesta.body.payment.provider).toBe('mock');
    expect(respuesta.body.payment.status).toBe('REQUIRES_CONFIRMATION');
    expect(respuesta.body.payment.amountCents).toBe(respuesta.body.deposit.amountCents);
    expect(respuesta.body.payment.currency).toBe('USD');
    // El navegador recibe una credencial de un solo uso, no una clave.
    expect(respuesta.body.payment.clientSecret).toBeTruthy();
  });

  it('el importe del deposito NO lo decide el navegador', async () => {
    const fila = await db.query<{ amountAuthorizedCents: number; provider: string }>(
      `SELECT "amountAuthorizedCents", provider FROM payments WHERE "bookingId" = $1`,
      [bookingId],
    );

    // Lo que se retiene es lo que calculo el motor de precios en el servidor.
    expect(fila.rows).toHaveLength(1);
    expect(fila.rows[0]?.amountAuthorizedCents).toBeGreaterThanOrEqual(3000);
    expect(fila.rows[0]?.provider).toBe('mock');
  });

  it('guarda el movimiento como retencion, no como cobro', async () => {
    const fila = await db.query<{
      kind: string;
      status: string;
      amountCapturedCents: number;
      providerPaymentIntentId: string;
    }>(
      `SELECT kind, status, "amountCapturedCents", "providerPaymentIntentId"
       FROM payments WHERE "bookingId" = $1`,
      [bookingId],
    );

    expect(fila.rows[0]?.kind).toBe('DEPOSIT_HOLD');
    expect(fila.rows[0]?.status).toBe('REQUIRES_CONFIRMATION');
    expect(fila.rows[0]?.amountCapturedCents).toBe(0);
    paymentIntentId = fila.rows[0]!.providerPaymentIntentId;
  });

  it('el aviso de deposito autorizado confirma la reserva', async () => {
    await enviarEvento(
      eventoDePago(
        'evt_autorizado',
        'payment_intent.amount_capturable_updated',
        paymentIntentId,
        'REQUIRES_CAPTURE',
        {
          card_brand: 'visa',
          card_last4: '4242',
        },
      ),
    ).expect(200);

    const reserva = await db.query<{ status: string }>(
      `SELECT status FROM bookings WHERE id = $1`,
      [bookingId],
    );
    expect(reserva.rows[0]?.status).toBe('CONFIRMED');

    const pago = await db.query<{
      status: string;
      cardBrand: string;
      cardLast4: string;
      authorizedAt: Date | null;
    }>(
      `SELECT status, "cardBrand", "cardLast4", "authorizedAt" FROM payments WHERE "bookingId" = $1`,
      [bookingId],
    );
    expect(pago.rows[0]?.status).toBe('REQUIRES_CAPTURE');
    expect(pago.rows[0]?.cardBrand).toBe('visa');
    expect(pago.rows[0]?.cardLast4).toBe('4242');
    expect(pago.rows[0]?.authorizedAt).not.toBeNull();
  });

  it('el mismo aviso repetido no vuelve a procesarse', async () => {
    /*
     * El proveedor reenvia el evento si no recibe un 2xx a tiempo. Sin
     * idempotencia, un reintento podria duplicar movimientos de dinero.
     *
     * Para demostrar que el reenvio se IGNORA de verdad (y no que simplemente
     * vuelve a escribir lo mismo), se ensucia la fila a proposito: si el
     * evento se reprocesara, la dejaria otra vez en REQUIRES_CAPTURE.
     */
    await db.exec(`UPDATE payments SET status = 'PROCESSING' WHERE "bookingId" = '${bookingId}'`);

    await enviarEvento(
      eventoDePago(
        'evt_autorizado',
        'payment_intent.amount_capturable_updated',
        paymentIntentId,
        'REQUIRES_CAPTURE',
      ),
    ).expect(200);

    const pago = await db.query<{ status: string }>(
      `SELECT status FROM payments WHERE "bookingId" = $1`,
      [bookingId],
    );
    expect(pago.rows[0]?.status).toBe('PROCESSING');

    const eventos = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM webhook_events WHERE id = 'evt_autorizado'`,
    );
    expect(eventos.rows[0]?.n).toBe(1);

    // Y se deja como estaba para las comprobaciones siguientes.
    await db.exec(
      `UPDATE payments SET status = 'REQUIRES_CAPTURE' WHERE "bookingId" = '${bookingId}'`,
    );
  });

  it('el evento queda archivado y marcado como procesado', async () => {
    const fila = await db.query<{ provider: string; processedAt: Date | null; type: string }>(
      `SELECT provider, "processedAt", type FROM webhook_events WHERE id = 'evt_autorizado'`,
    );
    expect(fila.rows[0]?.provider).toBe('mock');
    expect(fila.rows[0]?.type).toBe('payment_intent.amount_capturable_updated');
    expect(fila.rows[0]?.processedAt).not.toBeNull();
  });
});

describe('seguridad del webhook', () => {
  it('rechaza un evento sin firma', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(RUTA)
      .set('content-type', 'application/json')
      .send(JSON.stringify(eventoDePago('evt_sin_firma', 'x', 'pi_mock_x', 'REQUIRES_CAPTURE')));

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.code).toBe('WEBHOOK_SIGNATURE_INVALID');
  });

  it('rechaza un evento con firma inventada', async () => {
    const respuesta = await enviarEvento(
      eventoDePago('evt_falso', 'x', 'pi_mock_x', 'REQUIRES_CAPTURE'),
      'f'.repeat(64),
    );

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.code).toBe('WEBHOOK_SIGNATURE_INVALID');
  });

  it('un evento rechazado no deja rastro en la base de datos', async () => {
    const eventos = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM webhook_events WHERE id IN ('evt_sin_firma', 'evt_falso')`,
    );
    expect(eventos.rows[0]?.n).toBe(0);
  });

  it('no se puede confirmar una reserva ajena falsificando el aviso', async () => {
    // El escenario que de verdad importa: alguien conoce el identificador de
    // pago (aparece en el navegador) y quiere confirmar sin pagar.
    const pago = await db.query<{ providerPaymentIntentId: string; bookingId: string }>(
      `SELECT "providerPaymentIntentId", "bookingId" FROM payments LIMIT 1`,
    );

    const respuesta = await enviarEvento(
      eventoDePago(
        'evt_suplantado',
        'payment_intent.succeeded',
        pago.rows[0]!.providerPaymentIntentId,
        'SUCCEEDED',
      ),
      '0'.repeat(64),
    );

    expect(respuesta.status).toBe(401);
  });

  it('un aviso firmado sobre un pago desconocido se acepta sin efectos', async () => {
    // Puede pasar de verdad: la misma cuenta del proveedor usada por otro
    // sistema, o eventos de pruebas. No es un error, pero no debe tocar nada.
    await enviarEvento(
      eventoDePago('evt_ajeno', 'payment_intent.succeeded', 'pi_mock_desconocido', 'SUCCEEDED'),
    ).expect(200);

    const reservas = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM bookings WHERE status = 'CONFIRMED'`,
    );
    expect(reservas.rows[0]?.n).toBe(1);
  });
});

describe('deposito rechazado', () => {
  it('libera la franja cancelando la reserva', async () => {
    const reserva = await reservar('rechazada@example.com', proximoDiaLaborable(4));
    const paymentIntentId = reserva.body.payment.clientSecret.split('_secret_')[0];

    await enviarEvento(
      eventoDePago('evt_rechazado', 'payment_intent.payment_failed', paymentIntentId, 'FAILED'),
    ).expect(200);

    const fila = await db.query<{ status: string; cancelledBy: string | null }>(
      `SELECT status, "cancelledBy" FROM bookings WHERE id = $1`,
      [reserva.body.bookingId],
    );

    // Sin deposito no hay cita: el hueco vuelve a estar disponible.
    expect(fila.rows[0]?.status).toBe('CANCELLED');
    expect(fila.rows[0]?.cancelledBy).toBe('SYSTEM');
  });
});
