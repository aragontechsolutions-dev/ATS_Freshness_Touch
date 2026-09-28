import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminCompanyLocationSchema, DEFAULT_COMPANY_LOCATION } from '@freshness/types';
import { AppModule } from '../app.module';
import { AUTH_PROVIDER } from '../auth/auth.types';
import type { LocalAuthProvider } from '../auth/providers/local-auth.provider';
import { CompanyLocationService } from './company-location.service';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-de-la-ubicacion';
  process.env.EMAIL_PROVIDER = 'log';
  process.env.REMINDER_SWEEP_MINUTES = '0';
  process.env.AUDIT_PURGE_HOURS = '0';
  process.env.RATE_LIMIT_MAX = '2000';
  process.env.QUOTE_RATE_LIMIT_MAX = '2000';
});

/**
 * LA UBICACION DE LA EMPRESA, CONTRA UNA BASE DE DATOS REAL
 * ---------------------------------------------------------
 * Es el origen desde el que se mide TODO: la distancia de cada presupuesto,
 * las millas de traslado que se cobran y la zona que se guarda en cada
 * reserva. Moverla no rompe nada —el sistema sigue cotizando y facturando,
 * desde el sitio equivocado—, asi que lo que se comprueba es:
 *
 *   1. Que solo administracion pueda verla y moverla.
 *   2. Que el contrato pare los dedazos que la sacarian del estado.
 *   3. Que moverla LLEGUE DE VERDAD al cotizador, que es el punto de
 *      haberla sacado de las variables de entorno.
 */

const PUERTO = 55483;
const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');
const RUTA = '/api/v1/admin/company-location';

const ADA = 'aaa92000-0000-4000-8000-000000000001';
const DIEGO = 'ddd92000-0000-4000-8000-000000000002';
const ADA_AUTH = 'auth-ada-ubicacion';
const DIEGO_AUTH = 'auth-diego-ubicacion';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;
let provider: LocalAuthProvider;

const comoAda = (): Promise<string> => provider.issue(ADA_AUTH, 'ada@example.com', 3600);
const comoDiego = (): Promise<string> => provider.issue(DIEGO_AUTH, 'diego@example.com', 3600);

async function leer(token?: string) {
  return request(app.getHttpServer())
    .get(RUTA)
    .set('authorization', `Bearer ${token ?? (await comoAda())}`);
}

async function guardar(settings: unknown, token?: string) {
  const respuesta = await request(app.getHttpServer())
    .put(RUTA)
    .set('authorization', `Bearer ${token ?? (await comoAda())}`)
    .send(settings);

  // La cache es por instancia: sin esto, el cotizador de la prueba siguiente
  // mediria desde el punto anterior durante treinta segundos.
  app.get(CompanyLocationService).invalidate();
  return respuesta;
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
      ('${ADA}', '${ADA_AUTH}', 'Ada', 'Jefa', 'ada@example.com', 'ADMIN', true, now()),
      ('${DIEGO}', '${DIEGO_AUTH}', 'Diego', 'Coordina', 'diego@example.com', 'DISPATCHER', true, now());
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
  await db.exec(`DELETE FROM audit_logs; DELETE FROM business_settings;`);
  app.get(CompanyLocationService).invalidate();
});

/* ======================================================================== */

describe('quien puede ver y mover la sede', () => {
  it('administracion lee, y sin nada guardado recibe la de partida', async () => {
    const respuesta = await leer();

    expect(respuesta.status).toBe(200);
    expect(AdminCompanyLocationSchema.safeParse(respuesta.body).success).toBe(true);
    expect(respuesta.body.settings.city).toBe(DEFAULT_COMPANY_LOCATION.city);
  });

  /*
   * NO ES SOLO ESCRITURA: TAMPOCO PUEDE LEERLA.
   *
   * Es la direccion de trabajo del equipo, y quien pueda moverla decide
   * cuanto factura la empresa en cada reserva posterior. Coordinacion mueve
   * la agenda, no la sede.
   */
  it('coordinacion no puede leerla ni moverla', async () => {
    const token = await comoDiego();

    expect((await leer(token)).status).toBe(403);
    expect((await guardar(DEFAULT_COMPANY_LOCATION, token)).status).toBe(403);
  });

  it('sin sesion no se llega', async () => {
    expect((await request(app.getHttpServer()).get(RUTA)).status).toBe(401);
  });
});

/* ======================================================================== */

describe('los dedazos que el contrato para', () => {
  it('guarda una ubicacion valida y dice quien la movio', async () => {
    const savannah = {
      latitude: 32.0809,
      longitude: -81.0912,
      city: 'Savannah',
      state: 'GA',
      postalCode: '31401',
    };

    const respuesta = await guardar(savannah);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.settings.city).toBe('Savannah');
    expect(respuesta.body.updatedBy).toBe('Ada Jefa');
    expect(respuesta.body.updatedAt).not.toBeNull();
  });

  it('rechaza un punto fuera de Georgia', async () => {
    // Chattanooga: a 110 millas de Atlanta, pero es Tennessee.
    const respuesta = await guardar({
      latitude: 35.0456,
      longitude: -85.3097,
      city: 'Chattanooga',
      state: 'GA',
      postalCode: '37402',
    });

    expect(respuesta.status).toBe(400);
  });

  it('rechaza el signo cambiado en la longitud', async () => {
    /*
     * EL FALLO REALISTA. Con +84 en vez de -84 la base acaba en Asia y
     * todos los clientes pasan a estar a miles de millas: cada presupuesto
     * saldria fuera de area sin que nada fallara.
     */
    const respuesta = await guardar({ ...DEFAULT_COMPANY_LOCATION, longitude: 84.388 });

    expect(respuesta.status).toBe(400);
  });

  it('un rechazo no deja nada guardado a medias', async () => {
    await guardar({ ...DEFAULT_COMPANY_LOCATION, longitude: 84.388 });

    const filas = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM business_settings WHERE key = 'company_location'`,
    );
    expect(filas.rows[0]?.n).toBe('0');
  });
});

/* ======================================================================== */

describe('mover la sede llega al cotizador', () => {
  /** Una cotizacion desde el centro de Atlanta. */
  async function cotizar() {
    return request(app.getHttpServer())
      .post('/api/v1/quotes/estimate')
      .send({
        service: 'STANDARD',
        frequency: 'ONE_TIME',
        squareFeet: 1200,
        destination: { postalCode: '30303' },
      });
  }

  /*
   * ES EL PUNTO DE TODA LA ETAPA. Si la ubicacion se guarda pero la
   * distancia se sigue midiendo desde la variable de entorno, no se ha
   * sacado nada del entorno — y el mapa diria una cosa mientras la factura
   * dice otra.
   */
  it('el catalogo publico se centra en la ubicacion guardada', async () => {
    await guardar({
      latitude: 32.0809,
      longitude: -81.0912,
      city: 'Savannah',
      state: 'GA',
      postalCode: '31401',
    });

    const catalogo = await request(app.getHttpServer()).get('/api/v1/pricing/catalog');

    expect(catalogo.body.baseOfOperations).toMatchObject({
      city: 'Savannah',
      latitude: 32.0809,
      longitude: -81.0912,
    });
  });

  it('el cotizador sigue dando precio despues de mover la sede', async () => {
    /*
     * NO SE COMPRUEBA AQUI QUE LA DISTANCIA CAMBIE, y conviene explicarlo:
     * el proveedor simulado es una tabla de millas desde el centro de
     * Atlanta por prefijo del DESTINO, asi que ignora el origen. Que el
     * origen guardado llegue de verdad al proveedor se prueba en
     * `distance.service.test.ts`, con un proveedor falso que lo devuelve.
     *
     * Lo que si se comprueba aqui es que mover la sede no deja el cotizador
     * roto, que es el riesgo de tocar el camino del que cuelga el precio.
     */
    await guardar({
      latitude: 32.0809,
      longitude: -81.0912,
      city: 'Savannah',
      state: 'GA',
      postalCode: '31401',
    });

    const respuesta = await cotizar();

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.totals.totalCents).toBeGreaterThan(0);
    expect(respuesta.body.distance.zone).toBe('A');
  });
});

/* ======================================================================== */

describe('la auditoria', () => {
  it('registra cuantas millas se movio, no solo que se movio', async () => {
    await guardar({
      latitude: 32.0809,
      longitude: -81.0912,
      city: 'Savannah',
      state: 'GA',
      postalCode: '31401',
    });

    const filas = await db.query<{ action: string; metadata: unknown }>(
      `SELECT action, metadata FROM audit_logs WHERE action = 'company_location.updated'`,
    );

    expect(filas.rows).toHaveLength(1);
    /*
     * «Se cambio la ubicacion» no informa. «Se movio 215 millas» explica
     * por que los presupuestos de esta semana no cuadran con los de la
     * pasada, que es la pregunta que alguien va a hacer.
     */
    expect(filas.rows[0]?.metadata).toMatchObject({
      cityAfter: 'Savannah',
      latitudeBefore: DEFAULT_COMPANY_LOCATION.latitude,
      latitudeAfter: 32.0809,
    });
    expect((filas.rows[0]?.metadata as { movedMiles: number }).movedMiles).toBeGreaterThan(200);
  });

  it('tiene accion propia, distinta de la de los ajustes', async () => {
    await guardar(DEFAULT_COMPANY_LOCATION);

    const filas = await db.query<{ action: string }>(`SELECT action FROM audit_logs`);

    expect(filas.rows.map((f) => f.action)).toEqual(['company_location.updated']);
  });
});
