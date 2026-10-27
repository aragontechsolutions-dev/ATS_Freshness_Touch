import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module';
import { AUTH_PROVIDER } from '../auth/auth.types';
import type { LocalAuthProvider } from '../auth/providers/local-auth.provider';
import { StaffNotificationsService } from './staff-notifications.service';

/**
 * LA BANDEJA DEL EQUIPO
 * ---------------------
 * Lo que se prueba aqui es QUIEN VE QUE, que es lo unico de este modulo que
 * puede filtrar algo: la bandeja de un puesto no es la de otro, y una
 * notificacion dirigida a una persona no es de sus companeras.
 */

const PUERTO = 55494;
const MIGRACIONES = join(import.meta.dirname, '../../prisma/migrations');
const RUTA = '/api/v1/admin/notifications';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;
let provider: LocalAuthProvider;

const ADA = '11111111-1111-4111-8111-111111111111';
const ADA_AUTH = 'auth-ada';
const BEA = '22222222-2222-4222-8222-222222222222';
const BEA_AUTH = 'auth-bea';
const DIEGO = '33333333-3333-4333-8333-333333333333';
const DIEGO_AUTH = 'auth-diego';
const CLEO = '44444444-4444-4444-8444-444444444444';
const CLEO_AUTH = 'auth-cleo';

const comoAda = (): Promise<string> => provider.issue(ADA_AUTH, 'ada@example.com', 3600);
const comoBea = (): Promise<string> => provider.issue(BEA_AUTH, 'bea@example.com', 3600);
const comoDiego = (): Promise<string> => provider.issue(DIEGO_AUTH, 'diego@example.com', 3600);
const comoCleo = (): Promise<string> => provider.issue(CLEO_AUTH, 'cleo@example.com', 3600);

async function bandeja(token: string, limite?: number) {
  return request(app.getHttpServer())
    .get(limite === undefined ? RUTA : `${RUTA}?limit=${String(limite)}`)
    .set('authorization', `Bearer ${token}`);
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
      ('${BEA}', '${BEA_AUTH}', 'Bea', 'Jefa', 'bea@example.com', 'ADMIN', true, now()),
      ('${DIEGO}', '${DIEGO_AUTH}', 'Diego', 'Coordina', 'diego@example.com', 'DISPATCHER', true, now()),
      ('${CLEO}', '${CLEO_AUTH}', 'Cleo', 'Limpia', 'cleo@example.com', 'CLEANER', true, now());
  `);

  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-de-la-bandeja';
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

beforeEach(async () => {
  await db.exec(`DELETE FROM staff_notification_reads; DELETE FROM staff_notifications;`);
});

describe('quien ve que', () => {
  /*
   * LA REGLA DEL MODULO. «Hay una reserva nueva» le toca a coordinacion, sea
   * quien sea quien entre ese dia; administracion tiene su propia bandeja.
   */
  it('cada puesto ve lo suyo y no lo del otro', async () => {
    const bandejaDe = app.get(StaffNotificationsService);
    await bandejaDe.emitir({ kind: 'booking.confirmed', params: { reference: 'FT-1' } });
    await bandejaDe.emitir({ kind: 'payment.refund_failed', params: { reference: 'FT-2' } });

    const deCoordinacion = await bandeja(await comoDiego());
    const deAdministracion = await bandeja(await comoAda());

    expect(deCoordinacion.body.notifications.map((n: { kind: string }) => n.kind)).toEqual([
      'booking.confirmed',
    ]);
    expect(deAdministracion.body.notifications.map((n: { kind: string }) => n.kind)).toEqual([
      'payment.refund_failed',
    ]);
  });

  /*
   * «TE HAN ASIGNADO UN TRABAJO» ES DE QUIEN LO TIENE. Si la viera todo el
   * puesto, cada persona de limpieza recibiria los trabajos de las demas.
   */
  it('una dirigida a una persona no la ven sus companeras', async () => {
    await app.get(StaffNotificationsService).emitir({
      kind: 'job.assigned',
      staffId: CLEO,
      params: { reference: 'FT-3' },
    });

    expect((await bandeja(await comoCleo())).body.notifications).toHaveLength(1);
    /* Diego es de otro puesto; ademas no es ella. */
    expect((await bandeja(await comoDiego())).body.notifications).toHaveLength(0);
  });

  it('sin sesion no se ve nada', async () => {
    expect((await request(app.getHttpServer()).get(RUTA)).status).toBe(401);
  });

  /*
   * LA BANDEJA NO ES DE UN PUESTO, ES DE TODOS. Poner un `@Roles` habria
   * dejado a limpieza sin bandeja, que es justo quien mas la necesita.
   */
  it('limpieza tambien tiene bandeja', async () => {
    expect((await bandeja(await comoCleo())).status).toBe(200);
  });
});

describe('lo leido', () => {
  /*
   * CADA PERSONA LLEVA SU CUENTA. Una notificacion del puesto la ven varias:
   * si fuera una marca en la fila, la primera que la abriera la haria
   * desaparecer del globo de las demas.
   */
  it('marcarla leida no la marca para el resto del puesto', async () => {
    await app
      .get(StaffNotificationsService)
      .emitir({ kind: 'payment.refund_failed', params: { reference: 'FT-4' } });

    const deAda = await bandeja(await comoAda());
    const id = deAda.body.notifications[0].id;

    await request(app.getHttpServer())
      .post(`${RUTA}/read`)
      .set('authorization', `Bearer ${await comoAda()}`)
      .send({ ids: [id] })
      .expect(204);

    expect((await bandeja(await comoAda())).body.unreadCount).toBe(0);
    /* Bea tambien es administracion y no la ha abierto. */
    expect((await bandeja(await comoBea())).body.unreadCount).toBe(1);
  });

  it('marcarla dos veces no falla', async () => {
    await app
      .get(StaffNotificationsService)
      .emitir({ kind: 'payment.refund_failed', params: { reference: 'FT-5' } });

    const id = (await bandeja(await comoAda())).body.notifications[0].id;
    const marcar = async () =>
      request(app.getHttpServer())
        .post(`${RUTA}/read`)
        .set('authorization', `Bearer ${await comoAda()}`)
        .send({ ids: [id] });

    expect((await marcar()).status).toBe(204);
    expect((await marcar()).status).toBe(204);
  });

  it('las marca todas de golpe', async () => {
    const servicio = app.get(StaffNotificationsService);
    for (const reference of ['FT-6', 'FT-7', 'FT-8']) {
      await servicio.emitir({ kind: 'payment.refund_failed', params: { reference } });
    }

    await request(app.getHttpServer())
      .post(`${RUTA}/read-all`)
      .set('authorization', `Bearer ${await comoAda()}`)
      .expect(204);

    expect((await bandeja(await comoAda())).body.unreadCount).toBe(0);
  });
});

describe('el contador del globo', () => {
  /*
   * CUENTA TODAS, NO LAS DE LA PAGINA. Un globo que dice «5» porque solo se
   * pidieron cinco es un globo que miente en cuanto hay una sexta, y lo que
   * el globo decide es si merece la pena abrirlo.
   */
  it('cuenta todas aunque solo se pidan cinco', async () => {
    const servicio = app.get(StaffNotificationsService);
    for (let i = 0; i < 8; i += 1) {
      await servicio.emitir({
        kind: 'payment.refund_failed',
        params: { reference: `FT-${String(i)}` },
      });
    }

    const respuesta = await bandeja(await comoAda(), 5);

    expect(respuesta.body.notifications).toHaveLength(5);
    expect(respuesta.body.unreadCount).toBe(8);
  });
});
