import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminStaffListSchema } from '@freshness/types';
import { AppModule } from '../app.module';
import { AUTH_PROVIDER } from '../auth/auth.types';
import type { LocalAuthProvider } from '../auth/providers/local-auth.provider';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-de-asignaciones';
  process.env.EMAIL_PROVIDER = 'log';
  process.env.REMINDER_SWEEP_MINUTES = '0';
  /*
   * Se sube SOLO el limitador global, y solo aqui. El limite real de 60
   * peticiones por minuto sigue aplicando al panel en produccion —y debe
   * seguir: una sesion robada no puede martillear la API— pero en este
   * fichero estorba, porque hace mas de sesenta llamadas en pocos segundos y
   * lo que se comprueba son las asignaciones, no la limitacion, que tiene sus
   * propias pruebas.
   */
  process.env.RATE_LIMIT_MAX = '2000';
  /*
   * EL DE COTIZACIONES SE DEJA EN SU VALOR REAL (10 por minuto) A PROPOSITO.
   *
   * Con limitadores con nombre propio, el de cotizaciones se aplica a TODA la
   * API, no solo a /quotes: cubre cualquier ruta que no lo desactive. Cuando
   * este fichero se escribio, los controladores del panel no lo desactivaban,
   * y catorce pruebas fallaban con 429 a partir de la undecima peticion. No
   * era un problema de la prueba: era el panel real cayendose con la agenda
   * abierta un rato.
   *
   * Dejandolo en 10, este fichero —que hace mas de sesenta llamadas al
   * panel— es la guardia de que eso no vuelva a pasar. Si alguien quita el
   * @SkipThrottle de un controlador de /admin, esto se pone rojo.
   */
});

/**
 * ASIGNAR EQUIPO, CONTRA UNA BASE DE DATOS REAL
 * ----------------------------------------------
 * Lo que se prueba, por orden de importancia:
 *
 *   1. Que NO se pueda poner a la misma persona en dos casas a la vez. Es el
 *      error que no se descubre hasta que el equipo llega y no hay nadie.
 *   2. Que el listado de personal no filtre datos de contacto.
 *   3. Que limpieza no pueda repartirse trabajos a si misma.
 */

const PORT = 55456;
const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');

const ADMIN_AUTH = 'auth-admin-asignaciones';
const DISPATCHER_AUTH = 'auth-dispatcher-asignaciones';
const CLEANER_AUTH = 'auth-cleaner-asignaciones';

const ANA = 'a5a5a5a5-1111-4111-8111-111111111111';
const BETO = 'b5b5b5b5-2222-4222-8222-222222222222';
const CARLA_BAJA = 'c5c5c5c5-3333-4333-8333-333333333333';

const CUSTOMER = 'd5d5d5d5-4444-4444-8444-444444444444';
const ADDRESS = 'e5e5e5e5-5555-4555-8555-555555555555';

/** Dos reservas que se pisan, y una tercera pegada pero sin solapar. */
const MANANA = '55550001-0000-4000-8000-000000000001';
const SOLAPADA = '55550002-0000-4000-8000-000000000002';
const CONSECUTIVA = '55550003-0000-4000-8000-000000000003';
const CANCELADA = '55550004-0000-4000-8000-000000000004';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;
let provider: LocalAuthProvider;

const comoAdmin = (): Promise<string> => provider.issue(ADMIN_AUTH, 'ada@example.com', 3600);
const comoCoordinacion = (): Promise<string> =>
  provider.issue(DISPATCHER_AUTH, 'beto@example.com', 3600);
const comoLimpieza = (): Promise<string> => provider.issue(CLEANER_AUTH, 'cleo@example.com', 3600);

function equipo(bookingId: string): string {
  return `/api/v1/admin/bookings/${bookingId}/assignments`;
}

async function asignar(
  bookingId: string,
  assignments: { staffId: string; isLead: boolean }[],
  token?: string,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .put(equipo(bookingId))
    .set('authorization', `Bearer ${token ?? (await comoCoordinacion())}`)
    .send({ assignments });
}

/** Crea una reserva con horario explicito. */
async function sembrarReserva(
  id: string,
  referencia: string,
  inicio: string,
  fin: string,
  status = 'CONFIRMED',
): Promise<void> {
  await db.query(
    `INSERT INTO bookings (
       id, reference, "customerId", "addressId", service, frequency,
       bedrooms, bathrooms, "squareFeet", "scheduledStart", "scheduledEnd",
       "distanceMiles", zone, lines, "serviceCents", "addOnsCents",
       "surchargesCents", "discountCents", "taxCents", "totalCents",
       "depositCents", "balanceDueCents", "pricingVersion", status, "updatedAt"
     ) VALUES (
       '${id}', '${referencia}', '${CUSTOMER}', '${ADDRESS}', 'STANDARD', 'ONE_TIME',
       2, 1, 1200, '${inicio}', '${fin}', 5, 'A', '[]'::jsonb,
       12000, 0, 0, 0, 960, 12960, 3000, 9960, 'v1', '${status}', now()
     )`,
  );
}

beforeAll(async () => {
  db = await PGlite.create();
  socket = new PGLiteSocketServer({ db, port: PORT, host: '127.0.0.1', maxConnections: 10 });
  await socket.start();

  for (const migracion of readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, migracion.name, 'migration.sql'), 'utf8'));
  }

  await db.exec(`
    INSERT INTO staff (id, "authUserId", "firstName", "lastName", email, phone, role, "isActive", "updatedAt")
    VALUES
      ('${ANA}', NULL, 'Ana', 'Limpia', 'ana@example.com', '+14045550001', 'CLEANER', true, now()),
      ('${BETO}', NULL, 'Beto', 'Brilla', 'beto.b@example.com', '+14045550002', 'CLEANER', true, now()),
      ('${CARLA_BAJA}', NULL, 'Carla', 'Baja', 'carla@example.com', '+14045550003', 'CLEANER', false, now()),
      ('aaaa1111-1111-4111-8111-111111111111', '${ADMIN_AUTH}', 'Ada', 'Jefa', 'ada@example.com', NULL, 'ADMIN', true, now()),
      ('bbbb2222-2222-4222-8222-222222222222', '${DISPATCHER_AUTH}', 'Bruno', 'Agenda', 'beto@example.com', NULL, 'DISPATCHER', true, now()),
      ('cccc3333-3333-4333-8333-333333333333', '${CLEANER_AUTH}', 'Cleo', 'Trapo', 'cleo@example.com', NULL, 'CLEANER', true, now());

    INSERT INTO customers (id, email, "firstName", "lastName", phone, "updatedAt")
    VALUES ('${CUSTOMER}', 'cliente@example.com', 'Luis', 'Perez', '+14045559999', now());

    INSERT INTO addresses (id, "customerId", line1, city, state, "postalCode", "updatedAt")
    VALUES ('${ADDRESS}', '${CUSTOMER}', '1 Peachtree St', 'Atlanta', 'GA', '30301', now());
  `);

  // 10:00-13:00, 11:00-14:00 (se pisa), 13:00-16:00 (pegada, no se pisa).
  await sembrarReserva(MANANA, 'FT-A-0001', '2026-12-01T15:00:00Z', '2026-12-01T18:00:00Z');
  await sembrarReserva(SOLAPADA, 'FT-A-0002', '2026-12-01T16:00:00Z', '2026-12-01T19:00:00Z');
  await sembrarReserva(CONSECUTIVA, 'FT-A-0003', '2026-12-01T18:00:00Z', '2026-12-01T21:00:00Z');
  await sembrarReserva(
    CANCELADA,
    'FT-A-0004',
    '2026-12-02T15:00:00Z',
    '2026-12-02T18:00:00Z',
    'CANCELLED',
  );

  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`;

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
  await db.exec(`DELETE FROM booking_assignments`);
});

describe('listado de personal', () => {
  it('coordinacion puede verlo', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/v1/admin/staff')
      .set('authorization', `Bearer ${await comoCoordinacion()}`);

    expect(respuesta.status).toBe(200);
    expect(AdminStaffListSchema.safeParse(respuesta.body).success).toBe(true);
  });

  /*
   * LA PRUEBA DE PRIVACIDAD. Esta pantalla se abre a diario y puede quedarse
   * abierta en un portatil compartido. Para elegir a quien mandar a una casa
   * basta el nombre y el puesto; el correo y el telefono de la plantilla
   * convertirian el selector en la agenda de contactos de la empresa.
   */
  it('NO devuelve correos ni telefonos del personal', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/v1/admin/staff')
      .set('authorization', `Bearer ${await comoCoordinacion()}`);

    const texto = JSON.stringify(respuesta.body);
    expect(texto).not.toContain('@example.com');
    expect(texto).not.toContain('+1404');
  });

  it('no ofrece a quien esta de baja', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/v1/admin/staff')
      .set('authorization', `Bearer ${await comoCoordinacion()}`);

    const nombres = respuesta.body.staff.map((s: { firstName: string }) => s.firstName);
    expect(nombres).toContain('Ana');
    expect(nombres).not.toContain('Carla');
  });

  it('limpieza no puede consultarlo', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/v1/admin/staff')
      .set('authorization', `Bearer ${await comoLimpieza()}`);

    expect(respuesta.status).toBe(403);
  });

  it('sin sesion tampoco', async () => {
    const respuesta = await request(app.getHttpServer()).get('/api/v1/admin/staff');
    expect(respuesta.status).toBe(401);
  });
});

describe('asignar equipo', () => {
  it('coordinacion asigna a dos personas con un responsable', async () => {
    const respuesta = await asignar(MANANA, [
      { staffId: ANA, isLead: true },
      { staffId: BETO, isLead: false },
    ]);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.assignedStaff).toHaveLength(2);
    // El responsable va primero, que es a quien se llama.
    expect(respuesta.body.assignedStaff[0]).toEqual(
      expect.objectContaining({ name: 'Ana Limpia', isLead: true }),
    );
  });

  it('administracion tambien', async () => {
    const respuesta = await asignar(MANANA, [{ staffId: ANA, isLead: true }], await comoAdmin());
    expect(respuesta.status).toBe(200);
  });

  /*
   * Limpieza no se reparte trabajos a si misma: cambiar quien va a una casa
   * cambia de quien es la responsabilidad si algo sale mal alli.
   */
  it('limpieza NO puede asignar', async () => {
    const respuesta = await asignar(MANANA, [{ staffId: ANA, isLead: true }], await comoLimpieza());
    expect(respuesta.status).toBe(403);
  });

  it('un equipo vacio es valido: desasigna a todo el mundo', async () => {
    await asignar(MANANA, [{ staffId: ANA, isLead: true }]);
    const respuesta = await asignar(MANANA, []);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.assignedStaff).toHaveLength(0);
  });

  it('reemplaza el equipo entero, no acumula', async () => {
    await asignar(MANANA, [{ staffId: ANA, isLead: true }]);
    const respuesta = await asignar(MANANA, [{ staffId: BETO, isLead: true }]);

    expect(respuesta.body.assignedStaff).toHaveLength(1);
    expect(respuesta.body.assignedStaff[0].name).toBe('Beto Brilla');
  });

  it('el cambio queda en la auditoria con el antes y el despues', async () => {
    await asignar(MANANA, [{ staffId: ANA, isLead: true }]);
    await asignar(MANANA, [{ staffId: BETO, isLead: true }]);

    const registro = await db.query<{ action: string; metadata: { before: unknown[] } }>(
      `SELECT action, metadata FROM audit_logs
       WHERE action = 'booking.team_changed' ORDER BY "createdAt" DESC LIMIT 1`,
    );

    expect(registro.rows[0]?.metadata.before).toHaveLength(1);
  });
});

describe('nadie en dos sitios a la vez', () => {
  /*
   * LA PRUEBA CENTRAL DE ESTA ETAPA. Ana esta en una casa de 10:00 a 13:00;
   * ponerla en otra de 11:00 a 14:00 significa que a una de las dos no llega.
   * Sin esta guardia, el error se descubre cuando el cliente llama.
   */
  it('rechaza asignar a alguien que ya tiene un trabajo que se pisa', async () => {
    await asignar(MANANA, [{ staffId: ANA, isLead: true }]);

    const respuesta = await asignar(SOLAPADA, [{ staffId: ANA, isLead: true }]);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.code).toBe('STAFF_DOUBLE_BOOKED');
  });

  it('el error dice QUIEN choca y con QUE reserva', async () => {
    await asignar(MANANA, [{ staffId: ANA, isLead: true }]);
    const respuesta = await asignar(SOLAPADA, [{ staffId: ANA, isLead: true }]);

    const detalle = respuesta.body.fields?.[0]?.message ?? '';
    expect(detalle).toContain('Ana Limpia');
    expect(detalle).toContain('FT-A-0001');
  });

  /*
   * El reverso, y es igual de importante: dos trabajos PEGADOS no se pisan.
   * Uno acaba a las 13:00 y el siguiente empieza a las 13:00. Rechazarlos
   * haria imposible encadenar limpiezas, que es como trabaja este negocio.
   */
  it('permite encadenar dos trabajos consecutivos', async () => {
    await asignar(MANANA, [{ staffId: ANA, isLead: true }]);

    const respuesta = await asignar(CONSECUTIVA, [{ staffId: ANA, isLead: true }]);
    expect(respuesta.status).toBe(200);
  });

  it('otra persona si puede coger el trabajo que se solapa', async () => {
    await asignar(MANANA, [{ staffId: ANA, isLead: true }]);

    const respuesta = await asignar(SOLAPADA, [{ staffId: BETO, isLead: true }]);
    expect(respuesta.status).toBe(200);
  });

  it('reasignar la MISMA reserva no choca consigo misma', async () => {
    await asignar(MANANA, [{ staffId: ANA, isLead: true }]);

    // Se vuelve a guardar el mismo equipo: no debe verse como un conflicto.
    const respuesta = await asignar(MANANA, [
      { staffId: ANA, isLead: true },
      { staffId: BETO, isLead: false },
    ]);

    expect(respuesta.status).toBe(200);
  });

  /*
   * Una reserva cancelada no ocupa a nadie. Si contara, el personal que
   * estuvo asignado a un trabajo que ya no existe quedaria bloqueado para
   * trabajos reales en esa franja.
   */
  it('una reserva cancelada no bloquea la franja de nadie', async () => {
    await db.query(
      `INSERT INTO booking_assignments ("bookingId", "staffId", "isLead")
       VALUES ('${CANCELADA}', '${ANA}', true)`,
    );

    await sembrarReserva(
      '55550005-0000-4000-8000-000000000005',
      'FT-A-0005',
      '2026-12-02T15:00:00Z',
      '2026-12-02T18:00:00Z',
    );

    const respuesta = await asignar('55550005-0000-4000-8000-000000000005', [
      { staffId: ANA, isLead: true },
    ]);

    expect(respuesta.status).toBe(200);
  });
});

describe('lo que no se deja guardar', () => {
  it('rechaza dos responsables', async () => {
    const respuesta = await asignar(MANANA, [
      { staffId: ANA, isLead: true },
      { staffId: BETO, isLead: true },
    ]);

    expect(respuesta.status).toBe(400);
  });

  it('rechaza a la misma persona dos veces', async () => {
    const respuesta = await asignar(MANANA, [
      { staffId: ANA, isLead: true },
      { staffId: ANA, isLead: false },
    ]);

    expect(respuesta.status).toBe(400);
  });

  it('rechaza a alguien que esta de baja', async () => {
    const respuesta = await asignar(MANANA, [{ staffId: CARLA_BAJA, isLead: true }]);
    expect(respuesta.status).toBe(400);
  });

  it('rechaza un identificador inventado', async () => {
    const respuesta = await asignar(MANANA, [
      { staffId: '00000000-0000-4000-8000-000000000000', isLead: true },
    ]);

    expect(respuesta.status).toBe(400);
  });

  it('rechaza mas de diez personas', async () => {
    const muchos = Array.from({ length: 11 }, () => ({ staffId: ANA, isLead: false }));
    const respuesta = await asignar(MANANA, muchos);

    expect(respuesta.status).toBe(400);
  });

  /*
   * A una reserva cancelada no va nadie. Ademas de inutil, dejaria personal
   * "ocupado" en una franja que en realidad esta libre.
   */
  it('rechaza asignar a una reserva cancelada', async () => {
    const respuesta = await asignar(CANCELADA, [{ staffId: ANA, isLead: true }]);
    expect(respuesta.status).toBe(400);
  });

  it('rechaza una reserva que no existe', async () => {
    const respuesta = await asignar('99999999-0000-4000-8000-000000000009', [
      { staffId: ANA, isLead: true },
    ]);

    expect(respuesta.status).toBe(404);
  });

  it('rechaza campos que no existen en el contrato', async () => {
    const respuesta = await request(app.getHttpServer())
      .put(equipo(MANANA))
      .set('authorization', `Bearer ${await comoCoordinacion()}`)
      .send({ assignments: [{ staffId: ANA, isLead: true, sueldo: 999 }] });

    expect(respuesta.status).toBe(400);
  });
});
