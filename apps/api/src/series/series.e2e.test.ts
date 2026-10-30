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
import { SeriesSweepService } from './series-sweep.service';

/**
 * LAS CLIENTAS DE SIEMPRE
 * -----------------------
 * Lo que se prueba es lo unico que puede salir mal de verdad: que la serie
 * cree las citas que toca, que NO cree dos veces la misma, que pare cuando
 * se le dice, y que cuando la franja esta llena avise en vez de doblar un
 * equipo por su cuenta.
 */

const PUERTO = 55496;
const MIGRACIONES = join(import.meta.dirname, '../../prisma/migrations');
const RESERVAS = '/api/v1/admin/bookings';
const SERIES = '/api/v1/admin/series';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;
let provider: LocalAuthProvider;

const ADA = '11111111-1111-4111-8111-111111111111';
const ADA_AUTH = 'auth-ada';
const CLEO = '44444444-4444-4444-8444-444444444444';
const CLEO_AUTH = 'auth-cleo';

const comoAda = (): Promise<string> => provider.issue(ADA_AUTH, 'ada@example.com', 3600);
const comoCleo = (): Promise<string> => provider.issue(CLEO_AUTH, 'cleo@example.com', 3600);

const ZONA = 'America/New_York';

/** Un martes a las nueve, dentro de poco pero no hoy. */
function proximoMartes(): DateTime {
  let dia = DateTime.now().setZone(ZONA).plus({ days: 3 }).startOf('day');
  while (dia.weekday !== 2) dia = dia.plus({ days: 1 });
  return dia.set({ hour: 9 });
}

async function reservaDe(correo: string, inicio: DateTime): Promise<string> {
  const respuesta = await request(app.getHttpServer())
    .post(RESERVAS)
    .set('authorization', `Bearer ${await comoAda()}`)
    .send({
      booking: {
        service: 'STANDARD',
        frequency: 'BIWEEKLY',
        bedrooms: 3,
        bathrooms: 2,
        squareFeet: 1600,
        startsAt: inicio.toUTC().toISO(),
        contact: {
          firstName: 'Ana',
          lastName: 'Perez',
          email: correo,
          phone: '+1 404 555 0101',
        },
        address: { line1: '55 Oak Ridge Rd', city: 'Dallas', postalCode: '30132' },
      },
      overrides: { source: 'PHONE' },
    });

  expect(respuesta.status).toBe(201);
  return respuesta.body.bookingId as string;
}

async function serieDe(bookingId: string, cuerpo: Record<string, unknown> = {}) {
  return request(app.getHttpServer())
    .post(`${RESERVAS}/${bookingId}/series`)
    .set('authorization', `Bearer ${await comoAda()}`)
    .send({ frequency: 'BIWEEKLY', ...cuerpo });
}

const barrido = (): SeriesSweepService => app.get(SeriesSweepService);

async function citasDeLaSerie(seriesId: string): Promise<Date[]> {
  const filas = await db.query<{ scheduledStart: Date }>(
    `SELECT "scheduledStart" FROM bookings WHERE "seriesId" = '${seriesId}' AND status <> 'CANCELLED' ORDER BY "scheduledStart"`,
  );
  return filas.rows.map((fila) => fila.scheduledStart);
}

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
      ('${CLEO}', '${CLEO_AUTH}', 'Cleo', 'Limpia', 'cleo@example.com', 'CLEANER', true, now());
  `);

  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-de-las-series';
  process.env.RATE_LIMIT_MAX = '400';
  process.env.QUOTE_RATE_LIMIT_MAX = '200';
  process.env.REMINDER_SWEEP_MINUTES = '0';
  process.env.REMOVAL_SWEEP_MINUTES = '0';
  process.env.HOLD_SWEEP_MINUTES = '0';
  process.env.GEOCODING_SWEEP_MINUTES = '0';
  /* El barrido de series, APAGADO: cada prueba lo llama a mano. */
  process.env.SERIES_SWEEP_MINUTES = '0';
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
  await db.exec(`
    DELETE FROM staff_notification_reads;
    DELETE FROM staff_notifications;
    DELETE FROM audit_logs;
    DELETE FROM payments;
    DELETE FROM bookings;
    DELETE FROM recurring_series;
    DELETE FROM quotes;
    DELETE FROM addresses;
    DELETE FROM customers;
  `);
});

describe('convertir una reserva en serie', () => {
  it('la cita que la origina pasa a ser la primera de la serie', async () => {
    const bookingId = await reservaDe('ana.serie1@example.com', proximoMartes());
    const respuesta = await serieDe(bookingId);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.status).toBe('ACTIVE');
    expect(respuesta.body.dayOfWeek).toBe(2);
    expect(respuesta.body.startTime).toBe('09:00');

    const filas = await db.query<{ seriesId: string }>(
      `SELECT "seriesId" FROM bookings WHERE id = '${bookingId}'`,
    );
    expect(filas.rows[0]?.seriesId).toBe(respuesta.body.id);
  });

  /*
   * DOS SERIES DESDE LA MISMA CITA duplicarian a la clienta en la agenda cada
   * semana, y el fallo no se veria hasta que aparecieran dos equipos el mismo
   * dia.
   */
  it('una reserva no puede estar en dos series', async () => {
    const bookingId = await reservaDe('ana.serie2@example.com', proximoMartes());
    await serieDe(bookingId);

    const segunda = await serieDe(bookingId);
    expect(segunda.status).toBe(409);
    expect(segunda.body.code).toBe('SERIES_CONFLICT');
  });

  it('limpieza no ve las series', async () => {
    const respuesta = await request(app.getHttpServer())
      .get(SERIES)
      .set('authorization', `Bearer ${await comoCleo()}`);

    expect(respuesta.status).toBe(403);
  });
});

describe('el barrido crea las citas', () => {
  it('rellena el horizonte y deja las quincenas donde tocan', async () => {
    const martes = proximoMartes();
    const bookingId = await reservaDe('ana.serie3@example.com', martes);
    const seriesId = (await serieDe(bookingId)).body.id as string;

    await barrido().pasada();

    const citas = await citasDeLaSerie(seriesId);

    /* Seis semanas de horizonte y quincenal: la original y dos mas. */
    expect(citas.length).toBeGreaterThanOrEqual(3);

    for (const cita of citas) {
      expect(DateTime.fromJSDate(cita).setZone(ZONA).weekday).toBe(2);
      expect(DateTime.fromJSDate(cita).setZone(ZONA).toFormat('HH:mm')).toBe('09:00');
    }
  });

  /*
   * LA SEGUNDA PASADA NO PUEDE DUPLICAR NADA. El barrido corre cada hora: si
   * creara otra vez lo que ya existe, en un dia habria veinticuatro citas de
   * cada martes.
   */
  it('una segunda pasada no crea nada nuevo', async () => {
    const bookingId = await reservaDe('ana.serie4@example.com', proximoMartes());
    const seriesId = (await serieDe(bookingId)).body.id as string;

    await barrido().pasada();
    const primera = await citasDeLaSerie(seriesId);

    await barrido().pasada();
    const segunda = await citasDeLaSerie(seriesId);

    expect(segunda.length).toBe(primera.length);
  });

  it('las citas generadas nacen confirmadas, sin pago y colgando de la serie', async () => {
    const bookingId = await reservaDe('ana.serie5@example.com', proximoMartes());
    const seriesId = (await serieDe(bookingId)).body.id as string;

    await barrido().pasada();

    const filas = await db.query<{ status: string; depositCents: number; pagos: bigint }>(
      `SELECT b.status, b."depositCents", (SELECT count(*) FROM payments p WHERE p."bookingId" = b.id) AS pagos
       FROM bookings b WHERE b."seriesId" = '${seriesId}' AND b.id <> '${bookingId}'`,
    );

    expect(filas.rows.length).toBeGreaterThan(0);
    for (const fila of filas.rows) {
      expect(fila.status).toBe('CONFIRMED');
      expect(fila.depositCents).toBe(0);
      expect(Number(fila.pagos)).toBe(0);
    }
  });

  it('el precio pactado de la serie manda en cada cita generada', async () => {
    const bookingId = await reservaDe('ana.serie6@example.com', proximoMartes());
    const seriesId = (await serieDe(bookingId, { priceOverrideCents: 12_345 })).body.id as string;

    await barrido().pasada();

    const filas = await db.query<{ totalCents: number }>(
      `SELECT "totalCents" FROM bookings WHERE "seriesId" = '${seriesId}' AND id <> '${bookingId}'`,
    );

    expect(filas.rows.length).toBeGreaterThan(0);
    for (const fila of filas.rows) expect(fila.totalCents).toBe(12_345);
  });

  it('la fecha de fin corta la serie', async () => {
    const martes = proximoMartes();
    const bookingId = await reservaDe('ana.serie7@example.com', martes);
    const seriesId = (
      await serieDe(bookingId, { endDate: martes.plus({ days: 1 }).toFormat('yyyy-MM-dd') })
    ).body.id as string;

    await barrido().pasada();

    /* Solo la original: la siguiente quincena cae despues del fin. */
    expect(await citasDeLaSerie(seriesId)).toHaveLength(1);
  });

  it('una serie pausada no genera nada', async () => {
    const bookingId = await reservaDe('ana.serie8@example.com', proximoMartes());
    const seriesId = (await serieDe(bookingId)).body.id as string;

    await request(app.getHttpServer())
      .patch(`${SERIES}/${seriesId}`)
      .set('authorization', `Bearer ${await comoAda()}`)
      .send({ status: 'PAUSED' });

    await barrido().pasada();

    /* Sigue solo la original, que es de antes de pausar. */
    expect(await citasDeLaSerie(seriesId)).toHaveLength(1);
  });

  /*
   * PAUSAR NO CANCELA LO YA CREADO. La clienta se va dos semanas; las citas
   * que ya tienen equipo asignado las mira una persona, no un barrido.
   */
  it('pausar no toca las citas que ya existian', async () => {
    const bookingId = await reservaDe('ana.serie9@example.com', proximoMartes());
    const seriesId = (await serieDe(bookingId)).body.id as string;

    await barrido().pasada();
    const antes = await citasDeLaSerie(seriesId);

    await request(app.getHttpServer())
      .patch(`${SERIES}/${seriesId}`)
      .set('authorization', `Bearer ${await comoAda()}`)
      .send({ status: 'PAUSED' });

    expect(await citasDeLaSerie(seriesId)).toHaveLength(antes.length);
  });

  it('una serie terminada no se revive', async () => {
    const bookingId = await reservaDe('ana.serie10@example.com', proximoMartes());
    const seriesId = (await serieDe(bookingId)).body.id as string;

    const token = await comoAda();
    await request(app.getHttpServer())
      .patch(`${SERIES}/${seriesId}`)
      .set('authorization', `Bearer ${token}`)
      .send({ status: 'ENDED' });

    const revivir = await request(app.getHttpServer())
      .patch(`${SERIES}/${seriesId}`)
      .set('authorization', `Bearer ${token}`)
      .send({ status: 'ACTIVE' });

    expect(revivir.status).toBe(409);
  });
});

describe('mover una cita de la serie', () => {
  /*
   * ESTA ES LA PRUEBA QUE JUSTIFICA LA COLUMNA `seriesOccurrenceDate`, y el
   * fallo que evita no se habria visto hasta tener a una clienta con dos
   * citas la misma semana.
   *
   * El barrido decide que falta comparando el calendario de la serie con las
   * citas que ya existen. Mientras nadie mueve nada, «el dia que le tocaba» y
   * «el dia en que se hace» son el mismo y la comparacion funciona con
   * cualquiera de los dos. Desde que una cita se puede mover (etapa 3.32)
   * dejan de serlo: si se compara el dia en que se hace, mover la del martes
   * al jueves deja el martes sin cubrir, y a la hora siguiente el barrido
   * crea otra cita en el hueco que se acababa de dejar libre.
   */
  it('NO HACE QUE EL BARRIDO CREE OTRA EN SU SITIO', async () => {
    const martes = proximoMartes();
    const bookingId = await reservaDe('ana.mover1@example.com', martes);
    const seriesId = (await serieDe(bookingId)).body.id as string;

    await barrido().pasada();
    const antes = await citasDeLaSerie(seriesId);

    /* Del martes al jueves de la misma semana, a la misma hora. */
    const jueves = martes.plus({ days: 2 });
    const movida = await request(app.getHttpServer())
      .patch(`${RESERVAS}/${bookingId}/schedule`)
      .set('authorization', `Bearer ${await comoAda()}`)
      .send({ startsAt: jueves.toUTC().toISO(), reason: 'La clienta pidio el jueves' });

    expect(movida.status).toBe(200);

    await barrido().pasada();
    const despues = await citasDeLaSerie(seriesId);

    /* El mismo numero de citas: ni una mas. */
    expect(despues.length).toBe(antes.length);

    /* Y la que se movio esta el jueves, no el martes. */
    const jueveses = despues.filter(
      (cita) => DateTime.fromJSDate(cita).setZone(ZONA).weekday === 4,
    );
    expect(jueveses).toHaveLength(1);
  });

  it('la ocurrencia que ocupa no cambia al moverla', async () => {
    /*
     * Es lo que hace cierto lo anterior: la cita sigue siendo «la del martes
     * 3» aunque se haga el jueves 5. Si esta columna se moviera con la cita,
     * la prueba de arriba volveria a fallar sola.
     */
    const martes = proximoMartes();
    const bookingId = await reservaDe('ana.mover2@example.com', martes);
    await serieDe(bookingId);

    const ocurrenciaAntes = await db.query<{ seriesOccurrenceDate: Date | null }>(
      `SELECT "seriesOccurrenceDate" FROM bookings WHERE id = '${bookingId}'`,
    );

    await request(app.getHttpServer())
      .patch(`${RESERVAS}/${bookingId}/schedule`)
      .set('authorization', `Bearer ${await comoAda()}`)
      .send({ startsAt: martes.plus({ days: 2 }).toUTC().toISO(), reason: 'Lo pidio la clienta' });

    const ocurrenciaDespues = await db.query<{ seriesOccurrenceDate: Date | null }>(
      `SELECT "seriesOccurrenceDate" FROM bookings WHERE id = '${bookingId}'`,
    );

    expect(ocurrenciaAntes.rows[0]?.seriesOccurrenceDate).not.toBeNull();
    expect(ocurrenciaDespues.rows[0]?.seriesOccurrenceDate).toEqual(
      ocurrenciaAntes.rows[0]?.seriesOccurrenceDate,
    );
  });
});

describe('cuando la franja esta llena', () => {
  /*
   * NO DOBLA EL EQUIPO POR SU CUENTA. Un barrido que decide doblar turnos es
   * un barrido que un lunes por la manana sorprende a alguien con dos
   * trabajos a la vez.
   */
  it('no crea la cita y avisa a coordinacion, una sola vez', async () => {
    const martes = proximoMartes();
    const seriesId = (await serieDe(await reservaDe('ana.llena@example.com', martes))).body
      .id as string;

    /* Dos equipos: se llenan las dos siguientes quincenas a esa misma hora. */
    const siguiente = martes.plus({ days: 14 });
    await reservaDe('bea.llena@example.com', siguiente);
    await reservaDe('cris.llena@example.com', siguiente);

    await barrido().pasada();

    const creadas = await citasDeLaSerie(seriesId);
    expect(
      creadas.some(
        (cita) =>
          DateTime.fromJSDate(cita).setZone(ZONA).toFormat('yyyy-MM-dd') ===
          siguiente.toFormat('yyyy-MM-dd'),
      ),
    ).toBe(false);

    const avisos = await db.query<{ kind: string; audience: string }>(
      `SELECT kind, audience FROM staff_notifications WHERE kind = 'series.slot_taken'`,
    );
    expect(avisos.rows).toHaveLength(1);
    expect(avisos.rows[0]?.audience).toBe('DISPATCHER');

    /* La segunda pasada no repite el aviso: la bandeja no es un despertador. */
    await barrido().pasada();

    const repetidos = await db.query<{ kind: string }>(
      `SELECT kind FROM staff_notifications WHERE kind = 'series.slot_taken'`,
    );
    expect(repetidos.rows).toHaveLength(1);
  });
});
