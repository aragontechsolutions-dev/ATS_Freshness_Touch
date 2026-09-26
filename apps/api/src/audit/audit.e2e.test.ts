import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { SignJWT } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditPageSchema } from '@freshness/types';
import { AppModule } from '../app.module';
import { AUTH_PROVIDER } from '../auth/auth.types';
import type { LocalAuthProvider } from '../auth/providers/local-auth.provider';
import { AuditPurgeService } from './audit-purge.service';

const SECRETO = 'secreto-de-pruebas-de-auditoria';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-de-auditoria';
  process.env.EMAIL_PROVIDER = 'log';
  process.env.REMINDER_SWEEP_MINUTES = '0';
  // La purga se llama a mano en las pruebas: depender del reloj las haria
  // lentas y fragiles. Cero apaga el temporizador, no la logica.
  process.env.AUDIT_PURGE_HOURS = '0';
  process.env.AUDIT_RETENTION_DAYS = '365';
  process.env.RATE_LIMIT_MAX = '2000';
});

/**
 * EL MODULO DE AUDITORIA, CONTRA UNA BASE DE DATOS REAL
 * -----------------------------------------------------
 * Lo que se prueba, por orden de importancia:
 *
 *   1. Que SOLO administracion pueda leer el registro, y que el intento de
 *      los demas quede anotado.
 *   2. Que consultar el registro deje rastro ANTES de responder. Es la regla
 *      que impide revisar a los companeros en silencio.
 *   3. Que no se guarde nada sensible: ni codigos de puerta, ni datos del
 *      cliente, ni el identificador de sesion.
 *   4. Que la purga borre por antiguedad y NADA MAS, y que diga que borro.
 */

const PUERTO = 55471;
const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');
const RUTA = '/api/v1/admin/audit';

const ADA_AUTH = 'auth-ada-auditoria';
const DIEGO_AUTH = 'auth-diego-auditoria';
const CLEO_AUTH = 'auth-cleo-auditoria';

const ADA = 'aaa10000-0000-4000-8000-000000000001';
const DIEGO = 'ddd20000-0000-4000-8000-000000000002';
const CLEO = 'ccc30000-0000-4000-8000-000000000003';

const CUSTOMER = 'c0000000-0000-4000-8000-000000000011';
const ADDRESS = 'a0000000-0000-4000-8000-000000000011';
const RESERVA = '10000000-0000-4000-8000-000000000011';

/** El texto que NO puede acabar en ninguna fila del registro. */
const CODIGO_DE_PUERTA = 'Codigo de la puerta 4321. Perro en el jardin.';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;
let provider: LocalAuthProvider;

const comoAda = (): Promise<string> => provider.issue(ADA_AUTH, 'ada@example.com', 3600);
const comoDiego = (): Promise<string> => provider.issue(DIEGO_AUTH, 'diego@example.com', 3600);
const comoCleo = (): Promise<string> => provider.issue(CLEO_AUTH, 'cleo@example.com', 3600);

/**
 * Un token CON identificador de sesion, como los que emite Supabase.
 *
 * El proveedor local no lo pone, asi que se firma a mano: sin el no se puede
 * comprobar la deduplicacion del registro de acceso, que es justo lo que
 * impide que el registro se llene de una fila por cambio de pestana.
 */
function conSesion(authUserId: string, email: string, sessionId: string): Promise<string> {
  return new SignJWT({ email, session_id: sessionId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(authUserId)
    .setIssuer('freshness-touch-local')
    .setAudience('authenticated')
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(SECRETO));
}

async function consultar(token: string, query = '') {
  return request(app.getHttpServer())
    .get(`${RUTA}${query}`)
    .set('authorization', `Bearer ${token}`);
}

async function filas(): Promise<
  {
    action: string;
    surface: string;
    actorType: string;
    actorId: string | null;
    metadata: unknown;
  }[]
> {
  const resultado = await db.query<{
    action: string;
    surface: string;
    actorType: string;
    actorId: string | null;
    metadata: unknown;
  }>(
    'SELECT action, surface, "actorType", "actorId", metadata FROM audit_logs ORDER BY "createdAt"',
  );
  return resultado.rows;
}

/**
 * Inserta una entrada con una antiguedad concreta.
 *
 * El identificador va explicito: `@default(uuid())` de Prisma se resuelve en
 * el cliente, no en la base, asi que un INSERT a mano tiene que traerlo.
 */
async function sembrarEntrada(accion: string, diasAtras: number): Promise<void> {
  const cuando = new Date(Date.now() - diasAtras * 86_400_000);
  await db.query(
    `INSERT INTO audit_logs (id, "actorType", "actorId", surface, action, "entityType", "entityId", "createdAt")
     VALUES ($1, 'STAFF', $2, 'PANEL', $3, 'booking', $4, $5)`,
    [randomUUID(), ADA, accion, RESERVA, cuando.toISOString()],
  );
}

/**
 * Da tiempo a las escrituras que van sin esperar.
 *
 * El acceso, el acceso denegado y las lecturas sensibles se anotan con
 * `void`: una lectura no puede fallar porque no se pueda registrar. El precio
 * es que la fila llega un instante despues de la respuesta.
 */
function dejarQueSeAnote(): Promise<void> {
  return new Promise((listo) => setTimeout(listo, 200));
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

  const inicio = new Date(Date.now() + 48 * 3_600_000);
  const fin = new Date(inicio.getTime() + 2 * 3_600_000);

  await db.exec(`
    INSERT INTO staff (id, "authUserId", "firstName", "lastName", email, role, "isActive", "updatedAt")
    VALUES
      ('${ADA}', '${ADA_AUTH}', 'Ada', 'Jefa', 'ada@example.com', 'ADMIN', true, now()),
      ('${DIEGO}', '${DIEGO_AUTH}', 'Diego', 'Coordina', 'diego@example.com', 'DISPATCHER', true, now()),
      ('${CLEO}', '${CLEO_AUTH}', 'Cleo', 'Limpia', 'cleo@example.com', 'CLEANER', true, now());

    INSERT INTO customers (id, email, "firstName", "lastName", phone, "updatedAt")
    VALUES ('${CUSTOMER}', 'luis@example.com', 'Luis', 'Perez', '+14045559999', now());

    INSERT INTO addresses (id, "customerId", line1, line2, city, state, "postalCode", "accessNotes", "updatedAt")
    VALUES ('${ADDRESS}', '${CUSTOMER}', '100 Peachtree St', 'Apt 4B', 'Atlanta', 'GA', '30303',
            '${CODIGO_DE_PUERTA}', now());

    INSERT INTO bookings (
      id, reference, "customerId", "addressId", service, frequency,
      bedrooms, bathrooms, "squareFeet", "scheduledStart", "scheduledEnd",
      "distanceMiles", zone, lines, "serviceCents", "addOnsCents",
      "surchargesCents", "discountCents", "taxCents", "totalCents",
      "depositCents", "balanceDueCents", "pricingVersion", status, "updatedAt"
    ) VALUES (
      '${RESERVA}', 'FT-A-0001', '${CUSTOMER}', '${ADDRESS}', 'STANDARD', 'ONE_TIME',
      3, 2, 1800, '${inicio.toISOString()}', '${fin.toISOString()}', 12, 'A', '[]'::jsonb,
      18000, 0, 0, 0, 1440, 19440, 5000, 14440, 'v1', 'CONFIRMED', now()
    );
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
  await db.exec('DELETE FROM audit_logs;');
});

/* ======================================================================== */

describe('quien puede leer el registro', () => {
  it('administracion entra', async () => {
    const respuesta = await consultar(await comoAda());

    expect(respuesta.status).toBe(200);
    expect(AuditPageSchema.safeParse(respuesta.body).success).toBe(true);
  });

  /*
   * LA PRUEBA QUE SOSTIENE LA PANTALLA. Coordinacion mueve la agenda y
   * asigna equipos; eso no le da derecho a revisar la actividad de sus
   * companeros.
   */
  it('coordinacion NO entra, y su intento queda anotado', async () => {
    const respuesta = await consultar(await comoDiego());

    expect(respuesta.status).toBe(403);
    await dejarQueSeAnote();

    const anotadas = await filas();
    const denegado = anotadas.find((fila) => fila.action === 'session.denied');
    expect(denegado).toBeDefined();
    expect(denegado?.actorId).toBe(DIEGO);
    expect(denegado?.metadata).toMatchObject({ role: 'DISPATCHER', path: '/api/v1/admin/audit' });
  });

  it('limpieza tampoco entra', async () => {
    expect((await consultar(await comoCleo())).status).toBe(403);
  });

  it('sin sesion no se llega', async () => {
    expect((await request(app.getHttpServer()).get(RUTA)).status).toBe(401);
  });

  /*
   * SOLO LECTURA, y no por olvido. Un registro que se puede editar o borrar
   * no prueba nada, y el dia que alguien quiera cambiarlo sera justo el dia
   * en que importe.
   */
  it('no hay forma de escribir ni de borrar desde la API', async () => {
    const token = await comoAda();
    const servidor = app.getHttpServer();

    expect(
      (await request(servidor).post(RUTA).set('authorization', `Bearer ${token}`).send({})).status,
    ).toBe(404);
    expect(
      (await request(servidor).delete(RUTA).set('authorization', `Bearer ${token}`)).status,
    ).toBe(404);
    expect(
      (await request(servidor).patch(RUTA).set('authorization', `Bearer ${token}`).send({})).status,
    ).toBe(404);
  });
});

/* ======================================================================== */

describe('consultar el registro deja rastro', () => {
  it('la consulta se anota con los filtros usados', async () => {
    await consultar(await comoAda(), `?surface=PANEL&action=session.opened`);

    const anotadas = await filas();
    const consulta = anotadas.find((fila) => fila.action === 'audit.queried');

    expect(consulta).toBeDefined();
    expect(consulta?.actorId).toBe(ADA);
    expect(consulta?.surface).toBe('PANEL');
    expect(consulta?.metadata).toMatchObject({ surface: 'PANEL', action: 'session.opened' });
  });

  /*
   * Se anota ANTES de responder, no despues y sin esperar. Al reves habria
   * una ventana en la que se puede consultar sin rastro, y bastaria provocar
   * fallos de escritura para tener barra libre. Se comprueba mirando la base
   * justo al recibir la respuesta, sin esperas.
   */
  it('el rastro ya esta escrito cuando llega la respuesta', async () => {
    await consultar(await comoAda());

    const acciones = (await filas()).map((fila) => fila.action);
    expect(acciones).toContain('audit.queried');
  });
});

/* ======================================================================== */

describe('que se guarda y que no', () => {
  /*
   * Abrir la ficha de una reserva CON instrucciones de acceso deja una
   * accion distinta que abrir una sin ellas. Asi «quien ha visto codigos de
   * puerta este mes» es un filtro y no una lectura de todas las filas.
   */
  it('abrir una ficha con instrucciones de acceso se anota como tal', async () => {
    const respuesta = await request(app.getHttpServer())
      .get(`/api/v1/admin/bookings/${RESERVA}`)
      .set('authorization', `Bearer ${await comoAda()}`);

    expect(respuesta.status).toBe(200);
    await dejarQueSeAnote();

    const anotadas = await filas();
    const lectura = anotadas.find((fila) => fila.action === 'access_notes.viewed');

    expect(lectura).toBeDefined();
    expect(lectura?.metadata).toEqual({ reference: 'FT-A-0001' });
  });

  /*
   * LA PRUEBA MAS IMPORTANTE DE TODO EL MODULO. Si el registro guardara el
   * contenido de las instrucciones de acceso, se convertiria en el sitio mas
   * jugoso del sistema: la lista de codigos de puerta de todos los clientes,
   * en una sola tabla, sin las protecciones de la ficha original.
   */
  it('el codigo de la puerta NO acaba en ninguna fila', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/admin/bookings/${RESERVA}`)
      .set('authorization', `Bearer ${await comoAda()}`);
    await dejarQueSeAnote();

    const todo = JSON.stringify(await filas());
    expect(todo).not.toContain('4321');
    expect(todo).not.toContain('Perro en el jardin');
    // Ni el correo ni el telefono del cliente, ya puestos.
    expect(todo).not.toContain('luis@example.com');
    expect(todo).not.toContain('4045559999');
  });

  /*
   * El identificador de sesion sirve para deduplicar EN MEMORIA y no se
   * guarda: es un secreto de una sesion en vigor, y quien leyera el registro
   * tendria material para intentar suplantarla.
   */
  it('el acceso se anota una sola vez por sesion, y sin guardar su identificador', async () => {
    const token = await conSesion(ADA_AUTH, 'ada@example.com', 'sesion-unica-de-prueba');

    // Tres peticiones, como quien cambia de pestana tres veces.
    for (let vuelta = 0; vuelta < 3; vuelta += 1) {
      await request(app.getHttpServer())
        .get('/api/v1/admin/session')
        .set('authorization', `Bearer ${token}`);
    }
    await dejarQueSeAnote();

    const anotadas = await filas();
    const accesos = anotadas.filter((fila) => fila.action === 'session.opened');

    expect(accesos).toHaveLength(1);
    expect(accesos[0]?.metadata).toEqual({ role: 'ADMIN' });
    expect(JSON.stringify(anotadas)).not.toContain('sesion-unica-de-prueba');
  });
});

/* ======================================================================== */

describe('filtros y paginacion', () => {
  it('filtra por accion, y no devuelve las demas', async () => {
    await sembrarEntrada('booking.status.completed', 1);
    await sembrarEntrada('booking.status.cancelled', 1);

    const respuesta = await consultar(await comoAda(), '?action=booking.status.completed');
    const acciones = respuesta.body.items.map((item: { action: string }) => item.action);

    expect(acciones).toContain('booking.status.completed');
    expect(acciones).not.toContain('booking.status.cancelled');
  });

  it('rechaza una accion que no esta en el catalogo', async () => {
    const respuesta = await consultar(await comoAda(), '?action=bokking.created');
    expect(respuesta.status).toBe(400);
  });

  it('rechaza una pagina mas grande que el tope', async () => {
    expect((await consultar(await comoAda(), '?limit=5000')).status).toBe(400);
  });

  /*
   * El cursor es el INSTANTE de la ultima fila, no un numero de pagina: la
   * tabla crece por el extremo nuevo constantemente, y con `?page=N` una
   * entrada que llega mientras se lee empuja a las demas y se acaba viendo
   * dos veces la misma fila y saltandose otra.
   */
  it('la segunda pagina continua donde acabo la primera, sin repetir', async () => {
    for (let dia = 1; dia <= 5; dia += 1) await sembrarEntrada('booking.viewed', dia);

    const primera = await consultar(await comoAda(), '?action=booking.viewed&limit=2');
    expect(primera.body.items).toHaveLength(2);
    expect(primera.body.nextBefore).not.toBeNull();

    const segunda = await consultar(
      await comoAda(),
      `?action=booking.viewed&limit=2&before=${encodeURIComponent(primera.body.nextBefore)}`,
    );

    const idsPrimera = primera.body.items.map((item: { id: string }) => item.id);
    const idsSegunda = segunda.body.items.map((item: { id: string }) => item.id);

    expect(segunda.body.items).toHaveLength(2);
    expect(idsSegunda.some((id: string) => idsPrimera.includes(id))).toBe(false);
  });

  /*
   * El nombre se resuelve AL LEER y no se copia en la fila: si alguien se
   * cambia el apellido, el historial entero pasa a mostrar el nuevo.
   */
  it('pone el nombre de quien actuo sin haberlo guardado en la fila', async () => {
    await sembrarEntrada('booking.viewed', 1);

    const respuesta = await consultar(await comoAda(), '?action=booking.viewed');
    expect(respuesta.body.items[0].actorName).toBe('Ada Jefa');

    const guardado = await db.query<{ metadata: unknown }>(
      `SELECT metadata FROM audit_logs WHERE action = 'booking.viewed'`,
    );
    expect(JSON.stringify(guardado.rows)).not.toContain('Ada');
  });
});

/* ======================================================================== */

describe('purga por antiguedad', () => {
  it('borra lo caducado, deja lo reciente y dice cuanto borro', async () => {
    await sembrarEntrada('booking.viewed', 400);
    await sembrarEntrada('booking.viewed', 366);
    await sembrarEntrada('booking.viewed', 10);

    const borradas = await app.get(AuditPurgeService).ejecutar();
    expect(borradas).toBe(2);

    const quedan = await filas();
    // La reciente y la fila que deja la propia purga.
    expect(quedan).toHaveLength(2);

    const purga = quedan.find((fila) => fila.action === 'audit.purged');
    expect(purga).toBeDefined();
    expect(purga?.surface).toBe('SYSTEM');
    expect(purga?.actorType).toBe('SYSTEM');
    expect(purga?.metadata).toMatchObject({ deleted: 2 });
  });

  /*
   * La purga no elige. Borra por antiguedad y nada mas: no hay parametro de
   * accion, de persona ni de reserva, asi que nadie puede pedirle que haga
   * desaparecer lo que hizo el martes.
   */
  it('no anota nada cuando no hay nada que borrar', async () => {
    await sembrarEntrada('booking.viewed', 10);

    expect(await app.get(AuditPurgeService).ejecutar()).toBe(0);
    expect(await filas()).toHaveLength(1);
  });
});
