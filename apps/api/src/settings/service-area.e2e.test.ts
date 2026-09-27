import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminServiceAreaSchema, DEFAULT_SERVICE_AREA } from '@freshness/types';
import { AppModule } from '../app.module';
import { AUTH_PROVIDER } from '../auth/auth.types';
import type { LocalAuthProvider } from '../auth/providers/local-auth.provider';
import { ServiceAreaService } from './service-area.service';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-del-area';
  process.env.EMAIL_PROVIDER = 'log';
  process.env.REMINDER_SWEEP_MINUTES = '0';
  process.env.AUDIT_PURGE_HOURS = '0';
  process.env.RATE_LIMIT_MAX = '2000';
});

/**
 * EL AREA DE SERVICIO, CONTRA UNA BASE DE DATOS REAL
 * ---------------------------------------------------
 * Es la configuracion que mas dinero mueve: CADA RESERVA QUE ENTRE DESPUES
 * SE COBRA CON ESTO. Lo que se comprueba, por orden de importancia:
 *
 *   1. Que solo administracion pueda tocarla.
 *   2. Que el contrato rechace las combinaciones que no significan nada,
 *      porque una de ellas cobraria de menos y otra prometeria precios
 *      imposibles.
 *   3. Que el cambio llegue DE VERDAD al cotizador, que es el punto de
 *      haberlo sacado del codigo.
 */

const PUERTO = 55479;
const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');
const RUTA = '/api/v1/admin/service-area';

const ADA = 'aaa90000-0000-4000-8000-000000000001';
const DIEGO = 'ddd90000-0000-4000-8000-000000000002';
const ADA_AUTH = 'auth-ada-area';
const DIEGO_AUTH = 'auth-diego-area';

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

async function guardar(zones: unknown, token?: string) {
  return request(app.getHttpServer())
    .put(RUTA)
    .set('authorization', `Bearer ${token ?? (await comoAda())}`)
    .send({ zones });
}

/** El area de partida, como la manda el panel. */
const PARTIDA = DEFAULT_SERVICE_AREA.zones;

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
  // La cache es por instancia: sin esto, una prueba veria lo guardado por otra.
  app.get(ServiceAreaService).invalidate();
});

/* ======================================================================== */

describe('quien puede tocar el area', () => {
  it('administracion lee, y sin nada guardado recibe el area de partida', async () => {
    const respuesta = await leer();

    expect(respuesta.status).toBe(200);
    expect(AdminServiceAreaSchema.safeParse(respuesta.body).success).toBe(true);
    // Tres bandas, no cinco anillos: ver DEFAULT_SERVICE_AREA.
    expect(respuesta.body.settings.zones).toHaveLength(3);
  });

  /*
   * Coordinacion mueve la agenda; no decide hasta donde llega la empresa ni
   * hasta donde el precio sale solo. Eso es una decision comercial.
   */
  it('coordinacion no puede leerla ni cambiarla', async () => {
    const token = await comoDiego();

    expect((await leer(token)).status).toBe(403);
    expect((await guardar(PARTIDA, token)).status).toBe(403);
  });

  it('sin sesion no se llega', async () => {
    expect((await request(app.getHttpServer()).get(RUTA)).status).toBe(401);
  });
});

/* ======================================================================== */

describe('las reglas del conjunto', () => {
  it('guarda un area valida y dice quien la cambio', async () => {
    const respuesta = await guardar(PARTIDA);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.updatedBy).toBe('Ada Jefa');
    expect(respuesta.body.updatedAt).not.toBeNull();
  });

  /*
   * El motor recorre la lista y se queda con la primera zona cuyo limite
   * alcanza la distancia. Con los anillos desordenados asignaria la zona
   * equivocada —y con ella el recargo equivocado— sin fallar por ningun
   * sitio: cobraria de menos en silencio.
   */
  it('rechaza anillos que no crecen', async () => {
    const respuesta = await guardar([
      { code: 'A', maxMiles: 50, instantQuote: true },
      { code: 'B', maxMiles: 20, instantQuote: true },
    ]);

    expect(respuesta.status).toBe(400);
  });

  /*
   * Si a 50 millas hay que dar precio en persona, a 200 tambien. Lo
   * contrario describe un negocio que no existe y deja al cotizador dando
   * cifras mas lejos de donde ya ha dicho que no puede.
   */
  it('rechaza que el precio automatico vuelva mas lejos', async () => {
    const respuesta = await guardar([
      { code: 'A', maxMiles: 20, instantQuote: true },
      { code: 'B', maxMiles: 60, instantQuote: false },
      { code: 'C', maxMiles: 100, instantQuote: true },
    ]);

    expect(respuesta.status).toBe(400);
  });

  /*
   * SIN LA PRIMERA ZONA NO HAY COTIZADOR: el sitio pediria los datos para
   * no dar ninguna cifra a nadie, ni siquiera a quien vive al lado. Es un
   * area valida zona a zona que deja el negocio sin su puerta de entrada.
   */
  it('rechaza que ni siquiera la zona mas cercana de precio automatico', async () => {
    const respuesta = await guardar([
      { code: 'A', maxMiles: 20, instantQuote: false },
      { code: 'B', maxMiles: 100, instantQuote: false },
    ]);

    expect(respuesta.status).toBe(400);
  });

  it('rechaza saltarse un codigo de zona', async () => {
    const respuesta = await guardar([
      { code: 'A', maxMiles: 20, instantQuote: true },
      { code: 'C', maxMiles: 60, instantQuote: true },
    ]);

    expect(respuesta.status).toBe(400);
  });

  /*
   * Un cero de mas convierte el area de servicio en medio pais. El tope no
   * es una mania: es lo que impide que una errata se guarde.
   */
  it('rechaza una distancia absurda', async () => {
    const respuesta = await guardar([
      { code: 'A', maxMiles: 9999, instantQuote: true },
    ]);

    expect(respuesta.status).toBe(400);
  });

  it('no se pueden inventar zonas fuera del catalogo', async () => {
    const respuesta = await guardar([
      { code: 'Z', maxMiles: 20, instantQuote: true },
    ]);

    expect(respuesta.status).toBe(400);
  });
});

/* ======================================================================== */

describe('el cambio llega al cotizador', () => {
  /*
   * ES EL PUNTO DE TODA LA ETAPA. Si el area se guarda pero el cotizador
   * sigue con la del codigo, no se ha sacado nada del codigo.
   */
  it('reducir el area deja fuera una direccion que antes se atendia', async () => {
    const catalogoAntes = await request(app.getHttpServer()).get('/api/v1/pricing/catalog');
    expect(catalogoAntes.body.zones.at(-2).maxMiles).toBe(325);

    await guardar([{ code: 'A', maxMiles: 15, instantQuote: true }]);
    app.get(ServiceAreaService).invalidate();

    const catalogoDespues = await request(app.getHttpServer()).get('/api/v1/pricing/catalog');
    const atendidas = catalogoDespues.body.zones.filter(
      (z: { serviceable: boolean }) => z.serviceable,
    );

    expect(atendidas).toHaveLength(1);
    expect(atendidas[0].maxMiles).toBe(15);
  });

  /*
   * LAS FILAS DE ANTES NO SE TIRAN. Hay areas guardadas con el recargo por
   * zona que ya no existe. Si se descartaran enteras, la empresa volveria
   * a las zonas de partida sin enterarse: sus 60 millas configuradas se
   * convertirian en 35, y con ellas el precio de cada reserva posterior.
   */
  it('una fila guardada con el recargo antiguo se sigue leyendo', async () => {
    await db.exec(`
      INSERT INTO business_settings (key, value, "updatedAt")
      VALUES (
        'service_area',
        '{"zones":[{"code":"A","maxMiles":40,"surchargeCents":0,"instantQuote":true},
                   {"code":"B","maxMiles":90,"surchargeCents":2500,"instantQuote":false}]}'::jsonb,
        now()
      )
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
    `);
    app.get(ServiceAreaService).invalidate();

    const respuesta = await leer();

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.settings.zones).toEqual([
      { code: 'A', maxMiles: 40, instantQuote: true },
      { code: 'B', maxMiles: 90, instantQuote: false },
    ]);
  });

  it('el cambio queda en el registro de auditoria, con las cifras', async () => {
    await guardar([
      { code: 'A', maxMiles: 20, instantQuote: true },
      { code: 'B', maxMiles: 200, instantQuote: false },
    ]);

    const filas = await db.query<{ action: string; metadata: unknown }>(
      `SELECT action, metadata FROM audit_logs WHERE action = 'service_area.updated'`,
    );

    expect(filas.rows).toHaveLength(1);
    expect(filas.rows[0]?.metadata).toMatchObject({
      radiusMilesAfter: 200,
      instantRadiusMilesAfter: 20,
      zones: 2,
    });
  });
});
