import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DateTime } from 'luxon';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module';

/**
 * FLUJO DE RESERVA CONTRA UNA BASE DE DATOS REAL
 * ----------------------------------------------
 * Levanta un PostgreSQL de verdad (compilado a WebAssembly, expuesto por TCP),
 * le aplica las migraciones del repositorio y arranca la aplicacion completa.
 * No hace falta Docker ni ningun servidor externo, asi que tambien corre en la
 * integracion continua.
 *
 * Esto prueba lo que ningun test unitario puede: que las migraciones, el
 * cliente de base de datos, las transacciones, los indices y las rutas HTTP
 * encajan entre si.
 */

const PORT = 55433;
const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;

/** Primer dia laborable con margen suficiente sobre la antelacion minima. */
function proximoDiaLaborable(): string {
  let day = DateTime.now().setZone('America/New_York').plus({ days: 3 }).startOf('day');
  while (day.weekday === 7) {
    day = day.plus({ days: 1 });
  }
  return day.toFormat('yyyy-MM-dd');
}

const CONTACTO = {
  firstName: 'Ana',
  lastName: 'Perez',
  email: 'ana.perez@example.com',
  phone: '+1 404 555 0101',
  locale: 'es' as const,
};

const DIRECCION = {
  line1: '123 Peachtree St NE',
  city: 'Atlanta',
  state: 'GA',
  postalCode: '30303',
  accessNotes: 'Codigo del porton 4477',
};

const TRABAJO = {
  service: 'STANDARD' as const,
  bedrooms: 3,
  bathrooms: 2,
  squareFeet: 1800,
  addOns: [{ code: 'INSIDE_OVEN' as const, quantity: 1 }],
};

beforeAll(async () => {
  db = await PGlite.create();
  socket = new PGLiteSocketServer({ db, port: PORT, host: '127.0.0.1' });
  await socket.start();

  const migraciones = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const migracion of migraciones) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, migracion.name, 'migration.sql'), 'utf8'));
  }

  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`;
  process.env.QUOTE_RATE_LIMIT_MAX = '100';
  process.env.RATE_LIMIT_MAX = '200';

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
  await app.init();
}, 120_000);

afterAll(async () => {
  await app?.close();
  await socket?.stop();
  await db?.close();
});

describe('conexion con la base de datos', () => {
  it('la API se conecta pese a estar activada la seguridad a nivel de fila', async () => {
    // Confirma lo que se afirmo al activar RLS: la API usa el rol propietario
    // y no le afectan las politicas mientras no se active FORCE.
    const response = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(response.body).toEqual({ status: 'ready', database: 'connected' });
  });
});

describe('consulta de disponibilidad', () => {
  it('devuelve franjas para un dia laborable', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/availability')
      .query({ date: proximoDiaLaborable(), ...TRABAJO, addOns: [] })
      .expect(200);

    expect(response.body.businessOpen).toBe(true);
    expect(response.body.timezone).toBe('America/New_York');
    expect(response.body.durationMinutes).toBeGreaterThan(0);
    expect(response.body.slots.some((slot: { available: boolean }) => slot.available)).toBe(true);
  });

  it('el servicio comercial no se puede agendar desde la web', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/availability')
      .query({ date: proximoDiaLaborable(), ...TRABAJO, service: 'COMMERCIAL', addOns: [] })
      .expect(400);

    expect(response.body.code).toBe('BOOKING_NOT_QUOTABLE');
  });

  it('rechaza fechas fuera del horizonte de reserva', async () => {
    const lejos = DateTime.now().plus({ years: 2 }).toFormat('yyyy-MM-dd');
    await request(app.getHttpServer())
      .get('/api/v1/availability')
      .query({ date: lejos, ...TRABAJO, addOns: [] })
      .expect(400);
  });
});

describe('creacion de reserva', () => {
  let franja: string;

  it('crea la reserva y devuelve precio y deposito calculados en el servidor', async () => {
    const disponibilidad = await request(app.getHttpServer())
      .get('/api/v1/availability')
      .query({ date: proximoDiaLaborable(), ...TRABAJO, addOns: [] })
      .expect(200);

    franja = disponibilidad.body.slots.find(
      (slot: { available: boolean }) => slot.available,
    ).startsAt;

    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send({ ...TRABAJO, startsAt: franja, contact: CONTACTO, address: DIRECCION })
      .expect(201);

    expect(response.body.reference).toMatch(/^FT-\d{4}-\d{4}$/);
    expect(response.body.status).toBe('PENDING_PAYMENT');
    // 18500 del servicio + 3500 del extra
    expect(response.body.totals.totalCents).toBe(22000);
    expect(response.body.deposit.amountCents).toBeGreaterThan(0);
    expect(response.body.balanceDueAtServiceCents).toBe(
      response.body.totals.totalCents - response.body.deposit.amountCents,
    );
    // Todavia no esta confirmada: falta retener el deposito.
    expect(response.body.nextStep).toBe('PAYMENT');
    expect(response.body.holdExpiresAt).not.toBeNull();
  });

  it('guarda cliente, direccion, cotizacion y reserva enlazados', async () => {
    const cliente = await db.query<{ id: string; email: string; authUserId: string | null }>(
      `SELECT id, email, "authUserId" FROM customers WHERE email = $1`,
      [CONTACTO.email],
    );
    expect(cliente.rows).toHaveLength(1);
    // Reserva como invitado: no hay cuenta de usuario asociada.
    expect(cliente.rows[0]?.authUserId).toBeNull();

    const reserva = await db.query<{ quoteId: string; addressId: string; pricingVersion: string }>(
      `SELECT "quoteId", "addressId", "pricingVersion" FROM bookings`,
    );
    expect(reserva.rows[0]?.quoteId).toBeTruthy();
    expect(reserva.rows[0]?.addressId).toBeTruthy();
    // La version de tarifas queda congelada con la reserva.
    expect(reserva.rows[0]?.pricingVersion).toBeTruthy();
  });

  it('rechaza el doble envio del formulario del mismo cliente', async () => {
    // Doble clic, reintento del navegador o pulsar "atras" y reenviar.
    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send({ ...TRABAJO, startsAt: franja, contact: CONTACTO, address: DIRECCION });

    // Un conflicto claro, no un error interno: el doble clic es previsible.
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('DUPLICATE_BOOKING');

    const total = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM bookings`);
    expect(total.rows[0]?.n).toBe(1);
  });

  it('no acepta importes enviados por el navegador', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        ...TRABAJO,
        startsAt: franja,
        contact: { ...CONTACTO, email: 'otro@example.com' },
        address: DIRECCION,
        totalCents: 1,
      });

    // El esquema es estricto: un campo desconocido invalida la peticion.
    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza una direccion fuera del area de servicio', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        ...TRABAJO,
        startsAt: franja,
        contact: { ...CONTACTO, email: 'lejos@example.com' },
        address: { ...DIRECCION, postalCode: '31401', city: 'Savannah' },
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('OUT_OF_SERVICE_AREA');
  });

  it('rechaza una hora que no es una franja valida', async () => {
    const invalida = DateTime.fromISO(franja).plus({ minutes: 7 }).toUTC().toISO();

    const response = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        ...TRABAJO,
        startsAt: invalida,
        contact: { ...CONTACTO, email: 'otrahora@example.com' },
        address: DIRECCION,
      });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('SLOT_UNAVAILABLE');
  });
});
