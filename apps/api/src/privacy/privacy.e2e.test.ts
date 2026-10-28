import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module';
import { AUTH_PROVIDER } from '../auth/auth.types';
import type { LocalAuthProvider } from '../auth/providers/local-auth.provider';

/**
 * LOS DERECHOS DE PRIVACIDAD
 * --------------------------
 * Lo que se prueba es lo que la politica promete y lo que puede salir mal al
 * cumplirlo: que la copia no lleve de mas, que el borrado se lleve lo que
 * identifica y deje la contabilidad en pie, y que no se pueda borrar a la
 * persona equivocada.
 */

const PUERTO = 55498;
const MIGRACIONES = join(import.meta.dirname, '../../prisma/migrations');
const RUTA = '/api/v1/admin/privacy';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;
let provider: LocalAuthProvider;

const ADA = '11111111-1111-4111-8111-111111111111';
const ADA_AUTH = 'auth-ada';
const DIEGO = '33333333-3333-4333-8333-333333333333';
const DIEGO_AUTH = 'auth-diego';

const CLIENTE = '99999999-9999-4999-8999-999999999999';
const DIRECCION = '88888888-8888-4888-8888-888888888888';
const RESERVA = '77777777-7777-4777-8777-777777777777';
const CORREO = 'ana.privacidad@example.com';

const comoAda = (): Promise<string> => provider.issue(ADA_AUTH, 'ada@example.com', 3600);
const comoDiego = (): Promise<string> => provider.issue(DIEGO_AUTH, 'diego@example.com', 3600);

beforeAll(async () => {
  db = await PGlite.create();
  socket = new PGLiteSocketServer({ db, port: PUERTO, host: '127.0.0.1', maxConnections: 10 });
  await socket.start();

  for (const migracion of readdirSync(MIGRACIONES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await db.exec(readFileSync(join(MIGRACIONES, migracion.name, 'migration.sql'), 'utf8'));
  }

  await db.exec(`
    INSERT INTO staff (id, "authUserId", "firstName", "lastName", email, role, "isActive", "updatedAt")
    VALUES
      ('${ADA}', '${ADA_AUTH}', 'Ada', 'Jefa', 'ada@example.com', 'ADMIN', true, now()),
      ('${DIEGO}', '${DIEGO_AUTH}', 'Diego', 'Coordina', 'diego@example.com', 'DISPATCHER', true, now());
  `);

  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-de-privacidad';
  process.env.RATE_LIMIT_MAX = '400';
  process.env.REMINDER_SWEEP_MINUTES = '0';
  process.env.REMOVAL_SWEEP_MINUTES = '0';
  process.env.HOLD_SWEEP_MINUTES = '0';
  process.env.SERIES_SWEEP_MINUTES = '0';
  process.env.GEOCODING_SWEEP_MINUTES = '0';
  process.env.AUDIT_PURGE_HOURS = '0';
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PUERTO}/postgres`;

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
  await app.init();

  provider = app.get<LocalAuthProvider>(AUTH_PROVIDER);
}, 120_000);

afterAll(async () => {
  await app?.close();
  await socket?.stop();
  await db?.close();
});

/** Una clienta con todo lo que puede colgar de ella. */
beforeEach(async () => {
  await db.exec(`
    INSERT INTO customers (id, email, "firstName", "lastName", phone, locale, "marketingOptIn", "updatedAt")
    VALUES ('${CLIENTE}', '${CORREO}', 'Ana', 'Perez', '+14045550101', 'es', true, now());

    INSERT INTO addresses (id, "customerId", line1, line2, city, state, "postalCode",
                           "accessNotes", latitude, longitude, "geocodeMatchedAddress",
                           "isPrimary", "updatedAt")
    VALUES ('${DIRECCION}', '${CLIENTE}', '55 Oak Ridge Rd', 'Apt 2', 'Dallas', 'GA', '30132',
            'Codigo del porton 4477', 33.9, -84.8, '55 Oak Ridge Road', true, now());

    INSERT INTO bookings (id, reference, "customerId", "addressId", status, service, frequency,
                          bedrooms, bathrooms, "squareFeet", "scheduledStart", "scheduledEnd",
                          "distanceMiles", zone, lines, "serviceCents", "addOnsCents",
                          "surchargesCents", "discountCents", "taxCents", "totalCents",
                          "depositCents", "balanceDueCents", "pricingVersion", "customerNotes",
                          "doorPinLatitude", "doorPinLongitude", "updatedAt")
    VALUES ('${RESERVA}', 'FT-2026-9001', '${CLIENTE}', '${DIRECCION}', 'COMPLETED', 'STANDARD',
            'ONE_TIME', 3, 2, 1600, now(), now(), 20, 'A', '[]', 18500, 0, 0, 0, 0, 18500,
            3500, 15000, 'v1', 'El perro muerde', 33.91, -84.81, now());

    INSERT INTO payments (id, "bookingId", kind, status, provider, "providerPaymentIntentId",
                          "cardBrand", "cardLast4", "amountAuthorizedCents", "updatedAt")
    VALUES (gen_random_uuid(), '${RESERVA}', 'DEPOSIT_HOLD', 'SUCCEEDED', 'mock', 'pi_privacidad',
            'visa', '4242', 3500, now());

    INSERT INTO notifications (id, "bookingId", event, channel, audience, status, target)
    VALUES (gen_random_uuid(), '${RESERVA}', 'BOOKING_CONFIRMED', 'EMAIL', 'CUSTOMER', 'SENT',
            '${CORREO}');

    INSERT INTO media_consents (id, reference, "customerName", "customerEmail", "propertyAddress",
                                "serviceDate", "signedAt", "coversInterior", "coversExterior",
                                "allowsBefore", channels, "removalDays", "videoIds", "photoPaths",
                                notes, "updatedAt")
    VALUES (gen_random_uuid(), 'MC-9001', 'Ana Perez', '${CORREO}', '55 Oak Ridge Rd',
            current_date, current_date, true, false, true, ARRAY['WEBSITE'], 5,
            ARRAY['vid1'], ARRAY['foto1.jpg'], 'Pidio que no salga el jardin', now());
  `);
});

afterEach(async () => {
  await db.exec(`
    DELETE FROM audit_logs;
    DELETE FROM media_consents;
    DELETE FROM notifications;
    DELETE FROM payments;
    DELETE FROM bookings;
    DELETE FROM quotes;
    DELETE FROM addresses;
    DELETE FROM customers;
  `);
});

describe('quien puede entrar', () => {
  /*
   * SOLO ADMINISTRACION. Es la restriccion mas facil de justificar del panel:
   * aqui se descarga el expediente completo de una persona y se borra.
   */
  it('coordinacion no busca, no exporta y no borra', async () => {
    const token = await comoDiego();
    const cabecera = `Bearer ${token}`;

    const busqueda = await request(app.getHttpServer())
      .get(`${RUTA}/customers?email=${CORREO}`)
      .set('authorization', cabecera);
    const copia = await request(app.getHttpServer())
      .get(`${RUTA}/customers/${CLIENTE}/export`)
      .set('authorization', cabecera);
    const borrado = await request(app.getHttpServer())
      .post(`${RUTA}/customers/${CLIENTE}/erase`)
      .set('authorization', cabecera)
      .send({ confirmEmail: CORREO, reason: 'no deberia poder' });

    expect(busqueda.status).toBe(403);
    expect(copia.status).toBe(403);
    expect(borrado.status).toBe(403);
  });

  it('sin sesion tampoco', async () => {
    const respuesta = await request(app.getHttpServer()).get(`${RUTA}/customers?email=${CORREO}`);
    expect(respuesta.status).toBe(401);
  });
});

describe('buscar', () => {
  it('encuentra por el correo exacto', async () => {
    const respuesta = await request(app.getHttpServer())
      .get(`${RUTA}/customers?email=${CORREO}`)
      .set('authorization', `Bearer ${await comoAda()}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.customers).toHaveLength(1);
    expect(respuesta.body.customers[0].bookingCount).toBe(1);
    expect(respuesta.body.customers[0].anonymized).toBe(false);
  });

  /*
   * NADA DE BUSQUEDA PARCIAL. Con ella, escribir «@example» sacaria media
   * cartera de clientes en la pantalla que exporta y borra.
   */
  it('un trozo del correo no saca a nadie', async () => {
    const respuesta = await request(app.getHttpServer())
      .get(`${RUTA}/customers?email=@example.com`)
      .set('authorization', `Bearer ${await comoAda()}`);

    expect(respuesta.body.customers).toHaveLength(0);
  });
});

describe('la copia de lo que tenemos', () => {
  it('lleva lo suyo: datos, direcciones, citas, pagos, avisos y permisos', async () => {
    const respuesta = await request(app.getHttpServer())
      .get(`${RUTA}/customers/${CLIENTE}/export`)
      .set('authorization', `Bearer ${await comoAda()}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.customer.email).toBe(CORREO);
    expect(respuesta.body.addresses[0].accessNotes).toBe('Codigo del porton 4477');
    expect(respuesta.body.bookings[0].reference).toBe('FT-2026-9001');
    expect(respuesta.body.payments[0].cardLast4).toBe('4242');
    expect(respuesta.body.messages[0].sentTo).toBe(CORREO);
    expect(respuesta.body.mediaConsents[0].reference).toBe('MC-9001');
  });

  /*
   * LO PELIGROSO DE UN VOLCADO NO ES QUE FALTE ALGO: ES QUE SOBRE. Un
   * `select` generoso metería los identificadores del proveedor de pago
   * dentro de un archivo que se le entrega a una persona.
   */
  it('no lleva los identificadores del proveedor de pago', async () => {
    const respuesta = await request(app.getHttpServer())
      .get(`${RUTA}/customers/${CLIENTE}/export`)
      .set('authorization', `Bearer ${await comoAda()}`);

    expect(JSON.stringify(respuesta.body)).not.toContain('pi_privacidad');
  });

  /*
   * SE AUDITA LA LECTURA, al contrario que casi todo: llevarse el expediente
   * de alguien no es consultar una pantalla.
   */
  it('queda escrito quien se la llevo', async () => {
    await request(app.getHttpServer())
      .get(`${RUTA}/customers/${CLIENTE}/export`)
      .set('authorization', `Bearer ${await comoAda()}`);

    const filas = await db.query<{ action: string; actorId: string; entityType: string }>(
      `SELECT action, "actorId", "entityType" FROM audit_logs WHERE action = 'customer.exported'`,
    );

    expect(filas.rows).toHaveLength(1);
    expect(filas.rows[0]?.actorId).toBe(ADA);
    expect(filas.rows[0]?.entityType).toBe('customer');
  });
});

describe('el borrado', () => {
  const borrar = async (cuerpo: Record<string, string>) =>
    request(app.getHttpServer())
      .post(`${RUTA}/customers/${CLIENTE}/erase`)
      .set('authorization', `Bearer ${await comoAda()}`)
      .send(cuerpo);

  /*
   * TODO EN UNA SOLA PRUEBA, y el motivo es el propio codigo que se prueba:
   * esta ruta esta limitada a cinco peticiones cada cuarto de hora, a
   * proposito, porque una cuenta de administracion comprometida recorriendo
   * la base es el peor escenario del sistema. Una prueba por asercion
   * gastaba ese presupuesto y respondia 429.
   *
   * Subir el limite para las pruebas seria dejar de probar lo que corre de
   * verdad, que es justo lo que aqui mas importa.
   */
  it('se lleva lo que identifica, deja la contabilidad y retira las fotos', async () => {
    const respuesta = await borrar({
      confirmEmail: CORREO,
      reason: 'Lo pidio por correo el 28/10',
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.mediaRevoked).toBe(1);

    /* --- Lo que se va: lo que identifica a la persona ------------------- */
    const cliente = await db.query<{ firstName: string; email: string; phone: string }>(
      `SELECT "firstName", email, phone FROM customers WHERE id = '${CLIENTE}'`,
    );
    expect(cliente.rows[0]?.firstName).toBe('Cliente');
    expect(cliente.rows[0]?.email).toContain('@invalid');
    expect(cliente.rows[0]?.phone).toBe('');

    const direccion = await db.query<{
      line1: string;
      accessNotes: string | null;
      latitude: number | null;
      city: string;
      postalCode: string;
    }>(
      `SELECT line1, "accessNotes", latitude, city, "postalCode"
       FROM addresses WHERE id = '${DIRECCION}'`,
    );
    expect(direccion.rows[0]?.line1).toBe('—');
    expect(direccion.rows[0]?.accessNotes).toBeNull();
    /* Las coordenadas se van con la calle: un punto en el mapa ES la casa. */
    expect(direccion.rows[0]?.latitude).toBeNull();

    const reserva = await db.query<{
      customerNotes: string | null;
      doorPinLatitude: number | null;
      reference: string;
      totalCents: number;
    }>(
      `SELECT "customerNotes", "doorPinLatitude", reference, "totalCents"
       FROM bookings WHERE id = '${RESERVA}'`,
    );
    expect(reserva.rows[0]?.customerNotes).toBeNull();
    expect(reserva.rows[0]?.doorPinLatitude).toBeNull();

    const aviso = await db.query<{ target: string | null }>('SELECT target FROM notifications');
    expect(aviso.rows[0]?.target).toBeNull();

    /* --- Lo que se queda: sin esto no hay contabilidad ------------------ */
    expect(reserva.rows[0]?.reference).toBe('FT-2026-9001');
    expect(reserva.rows[0]?.totalCents).toBe(18_500);
    /* Ciudad y codigo postal: sin calle no identifican, y sostienen la zona. */
    expect(direccion.rows[0]?.city).toBe('Dallas');
    expect(direccion.rows[0]?.postalCode).toBe('30132');

    const pago = await db.query<{ cardLast4: string }>('SELECT "cardLast4" FROM payments');
    expect(pago.rows[0]?.cardLast4).toBe('4242');

    /* --- Las fotos se retiran ------------------------------------------- */
    /*
     * Anonimizar sin revocar dejaria las fotos publicadas y el permiso que
     * las ampara sin nombre: se sigue ensenando su casa y ya no se puede
     * demostrar que lo autorizo. Lo peor de los dos mundos.
     */
    const permiso = await db.query<{
      revokedAt: Date | null;
      customerName: string;
      customerEmail: string | null;
      propertyAddress: string;
    }>(
      'SELECT "revokedAt", "customerName", "customerEmail", "propertyAddress" FROM media_consents',
    );
    expect(permiso.rows[0]?.revokedAt).not.toBeNull();
    expect(permiso.rows[0]?.customerName).toBe('Cliente retirado');
    expect(permiso.rows[0]?.customerEmail).toBeNull();
    expect(permiso.rows[0]?.propertyAddress).toBe('—');

    /* --- Y queda escrito quien lo hizo, sin el correo borrado ----------- */
    const auditoria = await db.query<{ actorId: string; metadata: Record<string, unknown> }>(
      `SELECT "actorId", metadata FROM audit_logs WHERE action = 'customer.anonymized'`,
    );
    expect(auditoria.rows[0]?.actorId).toBe(ADA);
    expect(auditoria.rows[0]?.metadata.reason).toBe('Lo pidio por correo el 28/10');
    /*
     * Si la auditoria guardara el correo, borrar a una persona lo dejaria
     * escrito justo en la tabla que no se borra.
     */
    expect(JSON.stringify(auditoria.rows[0]?.metadata)).not.toContain(CORREO);
  });

  /*
   * EL CORREO ESCRITO A MANO TIENE QUE COINCIDIR. Es irreversible: el error
   * que hay que evitar es borrar a la persona de la fila de al lado.
   */
  it('con el correo equivocado no se toca nada', async () => {
    const respuesta = await borrar({ confirmEmail: 'otra@example.com', reason: 'lo pidio' });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.code).toBe('PRIVACY_CONFIRM_MISMATCH');

    const filas = await db.query<{ firstName: string }>(
      `SELECT "firstName" FROM customers WHERE id = '${CLIENTE}'`,
    );
    expect(filas.rows[0]?.firstName).toBe('Ana');
  });

  it('sin motivo no se borra', async () => {
    expect((await borrar({ confirmEmail: CORREO })).status).toBe(400);
  });
});

describe('la correccion', () => {
  it('cambia lo que la persona puede pedir que se cambie', async () => {
    const respuesta = await request(app.getHttpServer())
      .patch(`${RUTA}/customers/${CLIENTE}`)
      .set('authorization', `Bearer ${await comoAda()}`)
      .send({
        firstName: 'Ana Maria',
        lastName: 'Perez',
        email: 'ana.nueva@example.com',
        phone: '+14045550199',
        marketingOptIn: false,
        reason: 'Se caso y cambio de correo',
      });

    expect(respuesta.status).toBe(200);

    const filas = await db.query<{ firstName: string; email: string }>(
      `SELECT "firstName", email FROM customers WHERE id = '${CLIENTE}'`,
    );
    expect(filas.rows[0]?.firstName).toBe('Ana Maria');
    expect(filas.rows[0]?.email).toBe('ana.nueva@example.com');
  });

  it('la auditoria dice que cambio el correo, no cual era', async () => {
    await request(app.getHttpServer())
      .patch(`${RUTA}/customers/${CLIENTE}`)
      .set('authorization', `Bearer ${await comoAda()}`)
      .send({
        firstName: 'Ana',
        lastName: 'Perez',
        email: 'ana.otra@example.com',
        phone: '+14045550101',
        marketingOptIn: true,
        reason: 'Correccion pedida por la clienta',
      });

    const filas = await db.query<{ metadata: Record<string, unknown> }>(
      `SELECT metadata FROM audit_logs WHERE action = 'customer.updated'`,
    );

    expect(filas.rows[0]?.metadata.emailChanged).toBe(true);
    expect(JSON.stringify(filas.rows[0]?.metadata)).not.toContain('ana.otra@example.com');
  });
});
