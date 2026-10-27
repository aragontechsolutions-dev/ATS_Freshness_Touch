import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DateTime } from 'luxon';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module';
import { AUTH_PROVIDER } from '../auth/auth.types';
import type { LocalAuthProvider } from '../auth/providers/local-auth.provider';

/**
 * LA RESERVA QUE SE METE A MANO
 * -----------------------------
 * Lo que se prueba aqui es lo que distingue esta reserva de la del sitio
 * publico: que nace confirmada y sin retencion, que ocupa la franja de
 * verdad, que avisa antes de doblar un equipo, que el precio pactado es solo
 * de administracion y que todo deja rastro.
 */

const PUERTO = 55495;
const MIGRACIONES = join(import.meta.dirname, '../../prisma/migrations');
const RUTA = '/api/v1/admin/bookings';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;
let provider: LocalAuthProvider;

const ADA = '11111111-1111-4111-8111-111111111111';
const ADA_AUTH = 'auth-ada';
const DIEGO = '33333333-3333-4333-8333-333333333333';
const DIEGO_AUTH = 'auth-diego';

const comoAda = (): Promise<string> => provider.issue(ADA_AUTH, 'ada@example.com', 3600);
const comoDiego = (): Promise<string> => provider.issue(DIEGO_AUTH, 'diego@example.com', 3600);

/**
 * Un martes dentro del horario y bien lejos de hoy.
 *
 * Lejos a proposito: asi la antelacion minima no entra en juego y lo que
 * falle, falla por lo que la prueba mira y no por el reloj.
 */
function proximoMartes(hora: string): string {
  let dia = DateTime.now().setZone('America/New_York').plus({ days: 10 }).startOf('day');
  while (dia.weekday !== 2) dia = dia.plus({ days: 1 });
  return (
    dia
      .set({ hour: Number(hora.slice(0, 2)), minute: 0 })
      .toUTC()
      .toISO() ?? ''
  );
}

function peticion(cambios: Record<string, unknown> = {}, saltos: Record<string, unknown> = {}) {
  return {
    booking: {
      service: 'STANDARD',
      frequency: 'BIWEEKLY',
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1600,
      startsAt: proximoMartes('09'),
      contact: {
        firstName: 'Ana',
        lastName: 'Perez',
        email: 'ana.deSiempre@example.com',
        phone: '+1 404 555 0101',
      },
      address: { line1: '55 Oak Ridge Rd', city: 'Dallas', postalCode: '30132' },
      ...cambios,
    },
    overrides: { source: 'PHONE', ...saltos },
  };
}

const crear = (token: string, cuerpo: unknown) =>
  request(app.getHttpServer()).post(RUTA).set('authorization', `Bearer ${token}`).send(cuerpo);

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
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-de-la-reserva-manual';
  process.env.RATE_LIMIT_MAX = '200';
  process.env.QUOTE_RATE_LIMIT_MAX = '100';
  process.env.REMINDER_SWEEP_MINUTES = '0';
  process.env.REMOVAL_SWEEP_MINUTES = '0';
  process.env.HOLD_SWEEP_MINUTES = '0';
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

afterEach(async () => {
  /*
   * Se borra TODO lo que cuelga de una reserva, en orden de dependencia. Sin
   * esto, el indice unico parcial de (cliente, hora) haria fallar la segunda
   * prueba que reserve a la misma hora, y el fallo parecería del codigo.
   */
  await db.exec(`
    DELETE FROM staff_notification_reads;
    DELETE FROM staff_notifications;
    DELETE FROM audit_logs;
    DELETE FROM payments;
    DELETE FROM bookings;
    DELETE FROM quotes;
    DELETE FROM addresses;
    DELETE FROM customers;
  `);
});

describe('nace distinta de la del sitio publico', () => {
  it('queda confirmada y sin retencion que pagar', async () => {
    const respuesta = await crear(await comoAda(), peticion());

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.status).toBe('CONFIRMED');
    expect(respuesta.body.nextStep).toBe('NONE');
    expect(respuesta.body.payment).toBeNull();
    expect(respuesta.body.holdExpiresAt).toBeNull();
  });

  /*
   * EL DEPOSITO A CERO NO ES UN DETALLE: si quedara en 35, la factura diria
   * que la clienta ya adelanto un dinero que nadie le retuvo, y el dia del
   * servicio se le cobraria de menos.
   */
  it('el deposito es cero y queda por cobrar el total entero', async () => {
    const { body } = await crear(await comoAda(), peticion());

    expect(body.deposit.amountCents).toBe(0);
    expect(body.balanceDueAtServiceCents).toBe(body.totals.totalCents);
  });

  it('la cotizacion de origen dice por donde entro', async () => {
    await crear(await comoAda(), peticion());

    const filas = await db.query<{ source: string }>('SELECT source FROM quotes');
    expect(filas.rows[0]?.source).toBe('PHONE');
  });
});

describe('ocupa la franja', () => {
  /*
   * ES EL MOTIVO DE TODA ESTA ETAPA. Mientras estos trabajos vivian en el
   * telefono de la duena, `findOccupied` no los veia y el cotizador publico
   * seguia ofreciendo ese martes.
   */
  it('la segunda reserva a la misma hora choca', async () => {
    const token = await comoAda();

    expect((await crear(token, peticion())).status).toBe(201);

    const segunda = await crear(
      token,
      peticion({
        contact: {
          firstName: 'Bea',
          lastName: 'Otra',
          email: 'bea.otra@example.com',
          phone: '+1 404 555 0202',
        },
      }),
    );

    /* Con dos equipos configurados, la segunda cabe y la tercera ya no. */
    expect(segunda.status).toBe(201);

    const tercera = await crear(
      token,
      peticion({
        contact: {
          firstName: 'Cris',
          lastName: 'Tercera',
          email: 'cris.tercera@example.com',
          phone: '+1 404 555 0303',
        },
      }),
    );

    expect(tercera.status).toBe(409);
    expect(tercera.body.code).toBe('SLOT_UNAVAILABLE');
  });

  it('con el aviso aceptado, se doblan los equipos', async () => {
    const token = await comoAda();
    const otra = (nombre: string) => ({
      contact: {
        firstName: nombre,
        lastName: 'Cliente',
        email: `${nombre.toLowerCase()}@example.com`,
        phone: '+1 404 555 0404',
      },
    });

    await crear(token, peticion(otra('Ana')));
    await crear(token, peticion(otra('Bea')));

    const forzada = await crear(token, {
      ...peticion(otra('Cris')),
      overrides: {
        source: 'PHONE',
        allowOverlap: true,
        reason: 'Entra Marta a echar una mano ese martes',
      },
    });

    expect(forzada.status).toBe(201);
  });
});

describe('el precio pactado', () => {
  it('manda sobre el del motor y cuadra con el desglose', async () => {
    const { body } = await crear(await comoAda(), {
      ...peticion(),
      overrides: {
        source: 'PHONE',
        priceOverrideCents: 12_345,
        reason: 'Tarifa de siempre desde 2024',
      },
    });

    expect(body.totals.totalCents).toBe(12_345);
    expect(body.balanceDueAtServiceCents).toBe(12_345);

    /*
     * LA DIFERENCIA SE VE, NO DESAPARECE: entra en el desglose como una
     * linea mas, asi que `lines` sigue sumando el total. Si no cuadrara, la
     * factura y el correo —que dan por hecho que suma— dirian cosas
     * distintas. El desglose no viaja en la respuesta, se lee de la reserva.
     */
    const filas = await db.query<{ lines: { code: string; amountCents: number }[] }>(
      'SELECT lines FROM bookings',
    );
    const lineas = filas.rows[0]?.lines ?? [];

    expect(lineas.some((linea) => linea.code === 'AGREED_PRICE')).toBe(true);
    expect(lineas.reduce((total, linea) => total + linea.amountCents, 0)).toBe(12_345);
  });

  /*
   * COORDINACION AGENDA, NO DECIDE LO QUE SE COBRA. Es la misma linea que ya
   * separa «mover una cita» de «mover dinero».
   */
  it('coordinacion no lo puede poner', async () => {
    const respuesta = await crear(await comoDiego(), {
      ...peticion(),
      overrides: { source: 'PHONE', priceOverrideCents: 1000, reason: 'lo que sea' },
    });

    expect(respuesta.status).toBe(403);
  });

  it('pero coordinacion si puede agendar al precio normal', async () => {
    expect((await crear(await comoDiego(), peticion())).status).toBe(201);
  });
});

describe('deja rastro', () => {
  it('la auditoria dice quien la metio y que se salto', async () => {
    await crear(await comoAda(), {
      ...peticion(),
      overrides: {
        source: 'PHONE',
        allowOutsideHours: true,
        reason: 'Me lo pidio por telefono para ese dia',
      },
    });

    const filas = await db.query<{
      action: string;
      surface: string;
      actorId: string;
      metadata: { outsideHours: boolean; reason: string };
    }>(`SELECT action, surface, "actorId", metadata FROM audit_logs WHERE action LIKE 'booking%'`);

    const fila = filas.rows[0];
    expect(fila?.action).toBe('booking.created_manually');
    expect(fila?.surface).toBe('PANEL');
    expect(fila?.actorId).toBe(ADA);
    expect(fila?.metadata.outsideHours).toBe(true);
    expect(fila?.metadata.reason).toBe('Me lo pidio por telefono para ese dia');
  });

  it('coordinacion la ve en su bandeja: sigue sin equipo asignado', async () => {
    await crear(await comoAda(), peticion());

    const filas = await db.query<{ kind: string; audience: string }>(
      'SELECT kind, audience FROM staff_notifications',
    );

    expect(filas.rows[0]?.kind).toBe('booking.confirmed');
    expect(filas.rows[0]?.audience).toBe('DISPATCHER');
  });
});

describe('lo que no se puede saltar', () => {
  it('sin motivo no se salta nada', async () => {
    const respuesta = await crear(await comoAda(), {
      ...peticion(),
      overrides: { source: 'PHONE', allowOutsideHours: true },
    });

    expect(respuesta.status).toBe(400);
  });

  it('sin sesion no se crea nada', async () => {
    const respuesta = await request(app.getHttpServer()).post(RUTA).send(peticion());

    expect(respuesta.status).toBe(401);
  });
});
