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
 * MOVER LA CITA
 * -------------
 * Lo que se prueba es lo que distingue mover de «cancelar y crear otra», que
 * es como se hacia hasta ahora:
 *
 *   - que la fila es LA MISMA: misma referencia, mismo precio, mismos pagos;
 *   - que no se puede mover lo que ya empezo o ya termino;
 *   - que el hueco se comprueba de verdad, y que una cita NO CHOCA CONSIGO
 *     MISMA al moverse unas horas dentro del mismo dia;
 *   - que un movimiento con menos de 24 h exige explicarse, porque da
 *     derecho a cobrar el deposito;
 *   - y que coordinacion puede mover pero no cobrar.
 */

const PUERTO = 55493;
const MIGRACIONES = join(import.meta.dirname, '../../prisma/migrations');
const RUTA = '/api/v1/admin/bookings';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;
let provider: LocalAuthProvider;

const ADA = '11111111-1111-4111-8111-111111111111';
const ADA_AUTH = 'auth-ada-mover';
const DIEGO = '33333333-3333-4333-8333-333333333333';
const DIEGO_AUTH = 'auth-diego-mover';
const CLEO = '44444444-4444-4444-8444-444444444444';
const CLEO_AUTH = 'auth-cleo-mover';

const comoAda = (): Promise<string> => provider.issue(ADA_AUTH, 'ada@example.com', 3600);
const comoDiego = (): Promise<string> => provider.issue(DIEGO_AUTH, 'diego@example.com', 3600);
const comoCleo = (): Promise<string> => provider.issue(CLEO_AUTH, 'cleo@example.com', 3600);

const ZONA = 'America/New_York';

/**
 * Un martes a la hora que se pida, lejos de hoy.
 *
 * LEJOS A PROPOSITO: asi las 24 horas de la promesa no entran en juego salvo
 * cuando una prueba las busca, y lo que falle, falla por lo que mira.
 */
function martesA(hora: number, semanasDespues = 2): DateTime {
  let dia = DateTime.now().setZone(ZONA).plus({ weeks: semanasDespues }).startOf('day');
  while (dia.weekday !== 2) dia = dia.plus({ days: 1 });
  return dia.set({ hour: hora });
}

async function reservaDe(correo: string, inicio: DateTime): Promise<string> {
  const respuesta = await request(app.getHttpServer())
    .post(RUTA)
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
      overrides: { source: 'PHONE', allowOutsideHours: true, reason: 'Prueba' },
    });

  expect(respuesta.status).toBe(201);
  return respuesta.body.bookingId as string;
}

const mover = async (bookingId: string, cuerpo: Record<string, unknown>, token?: string) =>
  request(app.getHttpServer())
    .patch(`${RUTA}/${bookingId}/schedule`)
    .set('authorization', `Bearer ${token ?? (await comoAda())}`)
    .send(cuerpo);

async function filaDe(bookingId: string) {
  const filas = await db.query<{
    reference: string;
    scheduledStart: Date;
    scheduledEnd: Date;
    totalCents: number;
    status: string;
  }>(
    `SELECT reference, "scheduledStart", "scheduledEnd", "totalCents", status
       FROM bookings WHERE id = '${bookingId}'`,
  );
  return filas.rows[0];
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
      ('${DIEGO}', '${DIEGO_AUTH}', 'Diego', 'Coordina', 'diego@example.com', 'DISPATCHER', true, now()),
      ('${CLEO}', '${CLEO_AUTH}', 'Cleo', 'Limpia', 'cleo@example.com', 'CLEANER', true, now());
  `);

  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-de-mover-la-cita';
  process.env.RATE_LIMIT_MAX = '400';
  process.env.QUOTE_RATE_LIMIT_MAX = '200';
  process.env.REMINDER_SWEEP_MINUTES = '0';
  process.env.REMOVAL_SWEEP_MINUTES = '0';
  process.env.HOLD_SWEEP_MINUTES = '0';
  process.env.GEOCODING_SWEEP_MINUTES = '0';
  process.env.SERIES_SWEEP_MINUTES = '0';
  process.env.NOTIFICATION_RETRY_MINUTES = '0';
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
    DELETE FROM notifications;
    DELETE FROM booking_assignments;
    DELETE FROM payments;
    DELETE FROM bookings;
    DELETE FROM quotes;
    DELETE FROM addresses;
    DELETE FROM customers;
  `);
});

describe('es la misma cita, en otra hora', () => {
  it('cambia la hora y NO cambia nada mas', async () => {
    /*
     * LA PRUEBA QUE EXPLICA LA ETAPA. Cancelar y crear otra cambiaba la
     * referencia que el cliente tiene por escrito y rehacia el precio con
     * las tarifas de hoy. Esto no.
     */
    const bookingId = await reservaDe('ana.mover1@example.com', martesA(9));
    const antes = await filaDe(bookingId);

    const destino = martesA(9).plus({ days: 2 });
    const respuesta = await mover(bookingId, {
      startsAt: destino.toUTC().toISO(),
    });

    expect(respuesta.status).toBe(200);

    const despues = await filaDe(bookingId);

    expect(despues?.reference).toBe(antes?.reference);
    expect(despues?.totalCents).toBe(antes?.totalCents);
    expect(despues?.status).toBe(antes?.status);
    expect(despues?.scheduledStart.toISOString()).toBe(destino.toUTC().toISO());
  });

  it('la duracion se conserva: lo que se mueve es el principio', async () => {
    const bookingId = await reservaDe('ana.mover2@example.com', martesA(9));
    const antes = await filaDe(bookingId);
    const duracion = (antes?.scheduledEnd.getTime() ?? 0) - (antes?.scheduledStart.getTime() ?? 0);

    await mover(bookingId, { startsAt: martesA(14).plus({ days: 2 }).toUTC().toISO() });

    const despues = await filaDe(bookingId);
    const nueva = (despues?.scheduledEnd.getTime() ?? 0) - (despues?.scheduledStart.getTime() ?? 0);

    expect(nueva).toBe(duracion);
  });

  it('a la misma hora que ya tiene, no', async () => {
    const inicio = martesA(9);
    const bookingId = await reservaDe('ana.mover3@example.com', inicio);

    const respuesta = await mover(bookingId, { startsAt: inicio.toUTC().toISO() });

    expect(respuesta.status).toBe(400);
  });

  it('a una fecha que ya paso, tampoco', async () => {
    /*
     * Tapa el error de teclear el ano viejo. Una cita movida al pasado
     * desaparece de la agenda sin que nadie la cancele.
     */
    const bookingId = await reservaDe('ana.mover4@example.com', martesA(9));

    const respuesta = await mover(bookingId, {
      startsAt: DateTime.now().minus({ months: 1 }).toUTC().toISO(),
      reason: 'Un dedazo en el ano',
    });

    expect(respuesta.status).toBe(400);
  });
});

describe('el hueco se comprueba de verdad', () => {
  it('NO CHOCA CONSIGO MISMA al moverse unas horas el mismo dia', async () => {
    /*
     * EL DETALLE QUE NO SE VE VENIR, y el que mas cerca estuvo de colarse:
     * mover la cita de las 9:00 a las 10:00 se compara con los intervalos
     * ocupados del dia, y uno de esos intervalos es EL SUYO VIEJO, que
     * todavia esta en la base. Con los equipos justos, el movimiento se
     * rechazaba por falta de equipo. El equipo que faltaba era el suyo.
     */
    const bookingId = await reservaDe('ana.mover5@example.com', martesA(9));

    const respuesta = await mover(bookingId, {
      startsAt: martesA(10).toUTC().toISO(),
    });

    expect(respuesta.status).toBe(200);
  });

  it('el mismo cliente no puede acabar con dos citas a la misma hora', async () => {
    /*
     * Hay un indice unico parcial sobre (cliente, hora). Sin la
     * comprobacion, esto reventaba contra el indice y salia un 500 generico
     * donde lo que hay es un caso entendible.
     */
    const correo = 'ana.mover6@example.com';
    const primera = await reservaDe(correo, martesA(9));
    const segunda = martesA(13);
    await reservaDe(correo, segunda);

    const respuesta = await mover(primera, {
      startsAt: segunda.toUTC().toISO(),
      reason: 'A ver si se puede',
    });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.code).toBe('SLOT_UNAVAILABLE');
  });
});

describe('con menos de 24 horas', () => {
  /** Una cita manana por la manana: dentro de la ventana de las 24 h. */
  const manana = (): DateTime => DateTime.now().setZone(ZONA).plus({ hours: 10 });

  it('EXIGE ESCRIBIR POR QUE, porque da derecho a cobrar el deposito', async () => {
    const bookingId = await reservaDe('ana.mover7@example.com', manana());

    const respuesta = await mover(bookingId, {
      startsAt: martesA(9).toUTC().toISO(),
    });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.messageKey).toBe('admin.errorLateRescheduleNeedsReason');
  });

  it('con el motivo escrito se mueve, y queda anotado que llego tarde', async () => {
    const bookingId = await reservaDe('ana.mover8@example.com', manana());

    const respuesta = await mover(bookingId, {
      startsAt: martesA(9).toUTC().toISO(),
      reason: 'La clienta aviso esta manana',
    });

    expect(respuesta.status).toBe(200);

    const filas = await db.query<{ metadata: { late?: boolean; reason?: string } }>(
      `SELECT metadata FROM audit_logs WHERE action = 'booking.rescheduled'`,
    );

    expect(filas.rows).toHaveLength(1);
    expect(filas.rows[0]?.metadata.late).toBe(true);
    expect(filas.rows[0]?.metadata.reason).toBe('La clienta aviso esta manana');
  });

  it('PERO NO COBRA NADA: son dos decisiones', async () => {
    /*
     * La promesa del sitio da derecho a cobrar los 35 dolares, y aun asi
     * mover no toca la tarjeta de nadie. Si lo hiciera, coordinacion —que
     * puede mover— estaria cobrando sin pulsar un boton de cobro.
     */
    const bookingId = await reservaDe('ana.mover9@example.com', manana());

    await mover(bookingId, {
      startsAt: martesA(9).toUTC().toISO(),
      reason: 'La clienta aviso esta manana',
    });

    const pagos = await db.query(`SELECT id FROM payments WHERE "bookingId" = '${bookingId}'`);
    expect(pagos.rows).toHaveLength(0);
  });
});

describe('lo que no se puede mover', () => {
  it('una cita que ya esta pasando, no', async () => {
    const bookingId = await reservaDe('ana.mover10@example.com', martesA(9));
    await db.exec(`UPDATE bookings SET status = 'IN_PROGRESS' WHERE id = '${bookingId}'`);

    const respuesta = await mover(bookingId, {
      startsAt: martesA(9).plus({ days: 2 }).toUTC().toISO(),
    });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.code).toBe('INVALID_TRANSITION');
  });

  it('una terminada ni una cancelada, tampoco', async () => {
    for (const estado of ['COMPLETED', 'CANCELLED']) {
      const bookingId = await reservaDe(`ana.${estado}@example.com`, martesA(9));
      await db.exec(`UPDATE bookings SET status = '${estado}' WHERE id = '${bookingId}'`);

      const respuesta = await mover(bookingId, {
        startsAt: martesA(9).plus({ days: 2 }).toUTC().toISO(),
      });

      expect(respuesta.status, estado).toBe(409);
    }
  });
});

describe('quien puede mover', () => {
  it('coordinacion si: mover la agenda es su trabajo', async () => {
    const bookingId = await reservaDe('ana.mover11@example.com', martesA(9));

    const respuesta = await mover(
      bookingId,
      { startsAt: martesA(9).plus({ days: 2 }).toUTC().toISO() },
      await comoDiego(),
    );

    expect(respuesta.status).toBe(200);
  });

  it('LIMPIEZA NO', async () => {
    const bookingId = await reservaDe('ana.mover12@example.com', martesA(9));

    const respuesta = await mover(
      bookingId,
      { startsAt: martesA(9).plus({ days: 2 }).toUTC().toISO() },
      await comoCleo(),
    );

    expect(respuesta.status).toBe(403);
  });

  it('sin sesion tampoco', async () => {
    const bookingId = await reservaDe('ana.mover13@example.com', martesA(9));

    const respuesta = await request(app.getHttpServer())
      .patch(`${RUTA}/${bookingId}/schedule`)
      .send({ startsAt: martesA(9).plus({ days: 2 }).toUTC().toISO() });

    expect(respuesta.status).toBe(401);
  });
});

describe('el recordatorio vuelve a armarse', () => {
  it('se borra la fila del recordatorio ya enviado', async () => {
    /*
     * El barrido de la vispera busca reservas SIN una fila de recordatorio
     * enviada. Si la cita del martes ya recibio el suyo y se mueve a la
     * semana siguiente, esa fila la deja fuera para siempre: el cliente se
     * queda sin aviso de la fecha nueva, que es justo la que no tiene en la
     * cabeza.
     */
    const bookingId = await reservaDe('ana.mover14@example.com', martesA(9));

    await db.exec(`
      INSERT INTO notifications (id, "bookingId", event, channel, audience, status, target)
      VALUES (gen_random_uuid(), '${bookingId}', 'BOOKING_REMINDER', 'EMAIL', 'CUSTOMER', 'SENT', 'a***@example.com');
    `);

    await mover(bookingId, { startsAt: martesA(9).plus({ days: 7 }).toUTC().toISO() });

    const quedan = await db.query(
      `SELECT id FROM notifications WHERE "bookingId" = '${bookingId}' AND event = 'BOOKING_REMINDER'`,
    );
    expect(quedan.rows).toHaveLength(0);

    const filas = await db.query<{ metadata: { reminderReset?: boolean } }>(
      `SELECT metadata FROM audit_logs WHERE action = 'booking.rescheduled'`,
    );
    expect(filas.rows[0]?.metadata.reminderReset).toBe(true);
  });
});

describe('lo que queda anotado', () => {
  it('las dos fechas, para poder reconstruir el movimiento', async () => {
    const inicio = martesA(9);
    const bookingId = await reservaDe('ana.mover15@example.com', inicio);
    const destino = inicio.plus({ days: 2 });

    await mover(bookingId, { startsAt: destino.toUTC().toISO() });

    const filas = await db.query<{
      metadata: { from?: string; to?: string; late?: boolean };
      surface: string;
    }>(`SELECT metadata, surface FROM audit_logs WHERE action = 'booking.rescheduled'`);

    expect(filas.rows[0]?.surface).toBe('PANEL');
    expect(filas.rows[0]?.metadata.from).toBe(inicio.toUTC().toISO());
    expect(filas.rows[0]?.metadata.to).toBe(destino.toUTC().toISO());
    expect(filas.rows[0]?.metadata.late).toBe(false);
  });

  it('Y NO EL NOMBRE NI LA DIRECCION DEL CLIENTE', async () => {
    /*
     * La referencia abre la ficha, y en la ficha esta todo. El registro de
     * auditoria se guarda un ano y se consulta desde una pantalla: no es
     * sitio para una lista de nombres y direcciones.
     */
    const bookingId = await reservaDe('ana.mover16@example.com', martesA(9));

    await mover(bookingId, { startsAt: martesA(9).plus({ days: 2 }).toUTC().toISO() });

    const filas = await db.query<{ metadata: unknown }>(
      `SELECT metadata FROM audit_logs WHERE action = 'booking.rescheduled'`,
    );
    const anotado = JSON.stringify(filas.rows[0]?.metadata);

    for (const dato of ['Ana', 'Perez', 'Oak Ridge', 'ana.mover16@example.com', '404 555']) {
      expect(anotado, `no deberia llevar: ${dato}`).not.toContain(dato);
    }
  });
});
