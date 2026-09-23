import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MyJobsSchema } from '@freshness/types';
import { AppModule } from '../app.module';
import { AUTH_PROVIDER } from '../auth/auth.types';
import type { LocalAuthProvider } from '../auth/providers/local-auth.provider';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-de-mis-trabajos';
  process.env.EMAIL_PROVIDER = 'log';
  process.env.REMINDER_SWEEP_MINUTES = '0';
  process.env.RATE_LIMIT_MAX = '2000';
});

/**
 * MIS TRABAJOS, CONTRA UNA BASE DE DATOS REAL
 * -------------------------------------------
 * Lo que se prueba, por orden de importancia:
 *
 *   1. Que NO se vean los trabajos de otra persona. Es la unica garantia que
 *      sostiene toda la pantalla.
 *   2. Que NO salga ningun importe. Quien limpia no factura.
 *   3. Que solo se pueda marcar empezado y terminado, y solo en lo propio.
 */

const PUERTO = 55464;
const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');
const RUTA = '/api/v1/admin/my-jobs';

const CLEO_AUTH = 'auth-cleo-mis-trabajos';
const DARIO_AUTH = 'auth-dario-mis-trabajos';
const ADA_AUTH = 'auth-ada-mis-trabajos';

const CLEO = 'ccc11111-1111-4111-8111-111111111111';
const DARIO = 'ddd22222-2222-4222-8222-222222222222';
const ADA = 'aaa33333-3333-4333-8333-333333333333';

const CUSTOMER = 'c0000000-0000-4000-8000-000000000001';
const ADDRESS = 'a0000000-0000-4000-8000-000000000001';

/** De Cleo; de Dario; y una cancelada de Cleo. */
const DE_CLEO = '10000000-0000-4000-8000-000000000001';
const DE_DARIO = '20000000-0000-4000-8000-000000000002';
const CANCELADA = '30000000-0000-4000-8000-000000000003';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;
let provider: LocalAuthProvider;

const comoCleo = (): Promise<string> => provider.issue(CLEO_AUTH, 'cleo@example.com', 3600);
const comoDario = (): Promise<string> => provider.issue(DARIO_AUTH, 'dario@example.com', 3600);
const comoAda = (): Promise<string> => provider.issue(ADA_AUTH, 'ada@example.com', 3600);

async function misTrabajos(token?: string) {
  return request(app.getHttpServer())
    .get(RUTA)
    .set('authorization', `Bearer ${token ?? (await comoCleo())}`);
}

async function marcar(bookingId: string, status: string, token?: string) {
  return request(app.getHttpServer())
    .patch(`${RUTA}/${bookingId}/progress`)
    .set('authorization', `Bearer ${token ?? (await comoCleo())}`)
    .send({ status });
}

/** Una reserva dentro de la ventana que mira la pantalla. */
async function sembrarReserva(id: string, referencia: string, horas: number, status = 'CONFIRMED') {
  const inicio = new Date(Date.now() + horas * 3_600_000);
  const fin = new Date(inicio.getTime() + 2 * 3_600_000);

  await db.query(
    `INSERT INTO bookings (
       id, reference, "customerId", "addressId", service, frequency,
       bedrooms, bathrooms, "squareFeet", "scheduledStart", "scheduledEnd",
       "distanceMiles", zone, lines, "serviceCents", "addOnsCents",
       "surchargesCents", "discountCents", "taxCents", "totalCents",
       "depositCents", "balanceDueCents", "pricingVersion", status,
       "customerNotes", "updatedAt"
     ) VALUES (
       '${id}', '${referencia}', '${CUSTOMER}', '${ADDRESS}', 'STANDARD', 'ONE_TIME',
       3, 2, 1800, '${inicio.toISOString()}', '${fin.toISOString()}', 12, 'A', '[]'::jsonb,
       18000, 0, 0, 0, 1440, 19440, 5000, 14440, 'v1', '${status}',
       'Por favor no toquen el escritorio', now()
     )`,
  );
}

beforeAll(async () => {
  db = await PGlite.create();
  socket = new PGLiteSocketServer({ db, port: PUERTO, host: '127.0.0.1', maxConnections: 10 });
  await socket.start();

  for (const migracion of readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, migracion.name, 'migration.sql'), 'utf8'));
  }

  await db.exec(`
    INSERT INTO staff (id, "authUserId", "firstName", "lastName", email, role, "isActive", "updatedAt")
    VALUES
      ('${CLEO}', '${CLEO_AUTH}', 'Cleo', 'Limpia', 'cleo@example.com', 'CLEANER', true, now()),
      ('${DARIO}', '${DARIO_AUTH}', 'Dario', 'Brilla', 'dario@example.com', 'CLEANER', true, now()),
      ('${ADA}', '${ADA_AUTH}', 'Ada', 'Jefa', 'ada@example.com', 'ADMIN', true, now());

    INSERT INTO customers (id, email, "firstName", "lastName", phone, "updatedAt")
    VALUES ('${CUSTOMER}', 'luis@example.com', 'Luis', 'Perez', '+14045559999', now());

    INSERT INTO addresses (id, "customerId", line1, line2, city, state, "postalCode", "accessNotes", "updatedAt")
    VALUES ('${ADDRESS}', '${CUSTOMER}', '100 Peachtree St', 'Apt 4B', 'Atlanta', 'GA', '30303',
            'Codigo de la puerta 4321. Perro en el jardin.', now());
  `);

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
  await db.exec('DELETE FROM audit_logs; DELETE FROM booking_assignments; DELETE FROM bookings;');

  await sembrarReserva(DE_CLEO, 'FT-M-0001', 26);
  await sembrarReserva(DE_DARIO, 'FT-M-0002', 30);
  await sembrarReserva(CANCELADA, 'FT-M-0003', 28, 'CANCELLED');

  await db.exec(`
    INSERT INTO booking_assignments ("bookingId", "staffId", "isLead", "assignedAt")
    VALUES
      ('${DE_CLEO}', '${CLEO}', true, now()),
      ('${DE_CLEO}', '${DARIO}', false, now()),
      ('${DE_DARIO}', '${DARIO}', true, now()),
      ('${CANCELADA}', '${CLEO}', true, now());
  `);
});

/* ======================================================================== */

describe('solo los trabajos propios', () => {
  /*
   * LA PRUEBA QUE SOSTIENE LA PANTALLA ENTERA. El filtro va en la consulta,
   * asi que un trabajo ajeno no llega siquiera a salir de la base de datos.
   */
  it('Cleo ve el suyo y NO el de Dario', async () => {
    const respuesta = await misTrabajos();

    expect(respuesta.status).toBe(200);
    const referencias = respuesta.body.jobs.map((j: { reference: string }) => j.reference);
    expect(referencias).toContain('FT-M-0001');
    expect(referencias).not.toContain('FT-M-0002');
  });

  it('Dario ve los dos suyos', async () => {
    const respuesta = await misTrabajos(await comoDario());
    const referencias = respuesta.body.jobs.map((j: { reference: string }) => j.reference);

    expect(referencias).toEqual(['FT-M-0001', 'FT-M-0002']);
  });

  /*
   * A una cancelada no va nadie. Dejarla en la lista del dia es la forma de
   * que alguien se presente en una casa donde ya no se le espera.
   */
  it('las canceladas no aparecen aunque esten asignadas', async () => {
    const referencias = (await misTrabajos()).body.jobs.map(
      (j: { reference: string }) => j.reference,
    );

    expect(referencias).not.toContain('FT-M-0003');
  });

  it('quien no tiene nada asignado ve una lista vacia, no un error', async () => {
    const respuesta = await misTrabajos(await comoAda());

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.jobs).toEqual([]);
  });

  it('sin sesion no se llega', async () => {
    expect((await request(app.getHttpServer()).get(RUTA)).status).toBe(401);
  });
});

describe('lo que se ve y lo que no', () => {
  /*
   * NINGUN IMPORTE. Ni siquiera se leen de la base: no se puede filtrar al
   * pintar algo que nunca salio.
   */
  it('no aparece ningun importe por ningun lado', async () => {
    const crudo = JSON.stringify((await misTrabajos()).body);

    for (const pista of ['Cents', '19440', '5000', '14440', 'total', 'deposit', 'payment']) {
      expect(crudo.toLowerCase()).not.toContain(pista.toLowerCase());
    }
  });

  it('el cliente sale por su nombre de pila, sin apellido ni correo', async () => {
    const trabajo = (await misTrabajos()).body.jobs[0];

    expect(trabajo.customerFirstName).toBe('Luis');
    expect(JSON.stringify(trabajo)).not.toContain('Perez');
    expect(JSON.stringify(trabajo)).not.toContain('luis@example.com');
  });

  it('el telefono si, que para eso esta en la puerta', async () => {
    expect((await misTrabajos()).body.jobs[0].customerPhone).toBe('+14045559999');
  });

  /*
   * Las instrucciones de acceso SI se mandan: sin ellas quien llega no puede
   * entrar, que es justo para lo que existen. Pero solo en lo propio.
   */
  it('las instrucciones de acceso llegan en el trabajo propio', async () => {
    expect((await misTrabajos()).body.jobs[0].accessNotes).toContain('4321');
  });

  it('dice quien mas va y quien manda', async () => {
    const trabajo = (await misTrabajos()).body.jobs[0];

    expect(trabajo.iAmLead).toBe(true);
    expect(trabajo.teammates).toEqual([{ name: 'Dario Brilla', isLead: false }]);
  });

  it('el contrato es estricto, asi que un campo de mas se veria', async () => {
    expect(MyJobsSchema.safeParse((await misTrabajos()).body).success).toBe(true);
  });
});

describe('marcar empezado y terminado', () => {
  it('marca que ha llegado', async () => {
    const respuesta = await marcar(DE_CLEO, 'IN_PROGRESS');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.status).toBe('IN_PROGRESS');
  });

  it('y despues que ha terminado', async () => {
    await marcar(DE_CLEO, 'IN_PROGRESS');
    const respuesta = await marcar(DE_CLEO, 'COMPLETED');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.status).toBe('COMPLETED');
  });

  it('guarda la hora de inicio y la de fin', async () => {
    await marcar(DE_CLEO, 'IN_PROGRESS');
    await marcar(DE_CLEO, 'COMPLETED');

    const fila = await db.query<{ startedAt: Date | null; completedAt: Date | null }>(
      `SELECT "startedAt", "completedAt" FROM bookings WHERE id = '${DE_CLEO}'`,
    );

    expect(fila.rows[0]?.startedAt).not.toBeNull();
    expect(fila.rows[0]?.completedAt).not.toBeNull();
  });

  /*
   * UN TRABAJO AJENO RESPONDE 404, NO 403. Con un 403 se aprenderia que esa
   * reserva existe y simplemente no es suya; probando identificadores se
   * podria ir dibujando la agenda de la empresa.
   */
  it('no se puede marcar un trabajo ajeno, y no se admite ni que existe', async () => {
    const respuesta = await marcar(DE_DARIO, 'IN_PROGRESS');

    expect(respuesta.status).toBe(404);
  });

  it('el trabajo ajeno sigue intacto despues del intento', async () => {
    await marcar(DE_DARIO, 'IN_PROGRESS');

    const fila = await db.query<{ status: string }>(
      `SELECT status FROM bookings WHERE id = '${DE_DARIO}'`,
    );

    expect(fila.rows[0]?.status).toBe('CONFIRMED');
  });

  /*
   * Cancelar y "no estaban" mueven dinero y los discute el cliente, asi que
   * los decide coordinacion. El contrato ni siquiera los admite.
   */
  it.each(['CANCELLED', 'NO_SHOW', 'PENDING_PAYMENT', 'CONFIRMED'])(
    'rechaza marcar %s',
    async (estado) => {
      expect((await marcar(DE_CLEO, estado)).status).toBe(400);
    },
  );

  /*
   * No se puede terminar lo que no se ha empezado: desde CONFIRMED la unica
   * salida hacia adelante es IN_PROGRESS. Lo dice la tabla de transiciones
   * del contrato, la misma que usa el panel, no una lista escrita aqui.
   *
   * Y no es burocracia: sin pasar por "he llegado" no queda la hora de
   * entrada, que es el dato que sostiene cualquier discusion sobre si el
   * equipo estuvo alli y cuanto.
   */
  it('rechaza terminar sin haber empezado', async () => {
    const respuesta = await marcar(DE_CLEO, 'COMPLETED');

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.code).toBe('INVALID_TRANSITION');
  });

  it('deja rastro de que lo marco limpieza y no coordinacion', async () => {
    await marcar(DE_CLEO, 'IN_PROGRESS');

    const registros = await db.query<{ metadata: Record<string, unknown> }>(
      `SELECT metadata FROM audit_logs WHERE action = 'booking.status_changed'`,
    );

    expect(registros.rows).toHaveLength(1);
    expect(registros.rows[0]?.metadata).toMatchObject({ source: 'my-jobs', to: 'IN_PROGRESS' });
  });
});
