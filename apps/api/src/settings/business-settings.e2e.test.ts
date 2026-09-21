import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  AdminBusinessSettingsSchema,
  BusinessSettingsSchema,
  DEFAULT_BUSINESS_SETTINGS,
  type BusinessSettings,
} from '@freshness/types';
import { AppModule } from '../app.module';
import { AUTH_PROVIDER } from '../auth/auth.types';
import type { LocalAuthProvider } from '../auth/providers/local-auth.provider';
import { BusinessSettingsService } from './business-settings.service';

/*
 * El entorno se fija ANTES de los imports: ConfigModule congela process.env
 * al importar app.module, no cuando corre beforeAll.
 */
vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-de-configuracion';
});

/**
 * CONFIGURACION DEL NEGOCIO, CONTRA UNA BASE DE DATOS REAL
 * --------------------------------------------------------
 * Lo que se prueba aqui, por orden de importancia:
 *
 *   1. Que NADIE fuera de administracion pueda cambiar el telefono publico.
 *      Es la accion mas peligrosa del panel: desviar el telefono de la
 *      empresa es suplantarla ante todos sus clientes a la vez.
 *   2. Que no se pueda guardar nada que acabe siendo un enlace peligroso.
 *   3. Que el horario guardado mande de verdad sobre la agenda.
 */

const PORT = 55453;
const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');

const ADMIN_AUTH_ID = 'auth-admin-settings';
const DISPATCHER_AUTH_ID = 'auth-dispatcher-settings';

const PUBLICO = '/api/v1/business-settings';
const ADMIN = '/api/v1/admin/settings';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;
let provider: LocalAuthProvider;
let settings: BusinessSettingsService;

/** Configuracion valida completa, para partir de algo que si se guarda. */
const VALIDA: BusinessSettings = {
  phone: '+14045550123',
  email: 'contact@freshnesstouch.com',
  hours: DEFAULT_BUSINESS_SETTINGS.hours,
};

async function comoAdmin(): Promise<string> {
  return provider.issue(ADMIN_AUTH_ID, 'ada@example.com', 3600);
}

async function comoCoordinacion(): Promise<string> {
  return provider.issue(DISPATCHER_AUTH_ID, 'beto@example.com', 3600);
}

/** Guarda directamente con permiso de administracion. */
async function guardar(body: unknown): Promise<request.Response> {
  return request(app.getHttpServer())
    .put(ADMIN)
    .set('authorization', `Bearer ${await comoAdmin()}`)
    .send(body);
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
    INSERT INTO staff (id, "authUserId", "firstName", "lastName", email, role, "isActive", "updatedAt")
    VALUES
      ('aaaaaaaa-9999-4999-8999-999999999991', '${ADMIN_AUTH_ID}', 'Ada', 'Jefa', 'ada@example.com', 'ADMIN', true, now()),
      ('bbbbbbbb-9999-4999-8999-999999999992', '${DISPATCHER_AUTH_ID}', 'Beto', 'Agenda', 'beto@example.com', 'DISPATCHER', true, now())
  `);

  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`;

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
  await app.init();

  provider = app.get<LocalAuthProvider>(AUTH_PROVIDER);
  settings = app.get(BusinessSettingsService);
}, 120_000);

afterAll(async () => {
  await app?.close();
  await socket?.stop();
  await db?.close();
});

describe('quien puede cambiar los datos publicos de la empresa', () => {
  it('sin sesion no se puede leer la pantalla de configuracion', async () => {
    const respuesta = await request(app.getHttpServer()).get(ADMIN);
    expect(respuesta.status).toBe(401);
  });

  it('sin sesion no se puede guardar', async () => {
    const respuesta = await request(app.getHttpServer()).put(ADMIN).send(VALIDA);
    expect(respuesta.status).toBe(401);
  });

  /*
   * LA PRUEBA CENTRAL. Coordinacion mueve la agenda todos los dias y tiene
   * sesion valida; si pudiera tocar esto, podria redirigir el telefono de la
   * empresa entera sin que nadie lo notase hasta que dejaran de entrar
   * llamadas.
   */
  it('coordinacion NO puede guardar aunque tenga sesion valida', async () => {
    const respuesta = await request(app.getHttpServer())
      .put(ADMIN)
      .set('authorization', `Bearer ${await comoCoordinacion()}`)
      .send({ ...VALIDA, phone: '+19995550000' });

    expect(respuesta.status).toBe(403);
  });

  it('coordinacion tampoco ve quien cambio que', async () => {
    const respuesta = await request(app.getHttpServer())
      .get(ADMIN)
      .set('authorization', `Bearer ${await comoCoordinacion()}`);

    expect(respuesta.status).toBe(403);
  });

  it('el intento de coordinacion no dejo el cambio a medias', async () => {
    const respuesta = await request(app.getHttpServer()).get(PUBLICO);
    expect(respuesta.body.phone).not.toBe('+19995550000');
  });

  it('administracion si puede guardar', async () => {
    const respuesta = await guardar(VALIDA);

    expect(respuesta.status).toBe(200);
    expect(AdminBusinessSettingsSchema.safeParse(respuesta.body).success).toBe(true);
    expect(respuesta.body.settings.phone).toBe('+14045550123');
  });

  it('queda registrado quien lo cambio y cuando', async () => {
    const respuesta = await request(app.getHttpServer())
      .get(ADMIN)
      .set('authorization', `Bearer ${await comoAdmin()}`);

    expect(respuesta.body.updatedBy).toBe('Ada Jefa');
    expect(Date.parse(respuesta.body.updatedAt)).not.toBeNaN();
  });

  it('la auditoria guarda que campos cambiaron, no solo que se guardo algo', async () => {
    await guardar({ ...VALIDA, email: 'hola@freshnesstouch.com' });

    const registro = await db.query<{ action: string; metadata: { changed: string[] } }>(
      `SELECT action, metadata FROM audit_logs
       WHERE "entityType" = 'BusinessSetting' ORDER BY "createdAt" DESC LIMIT 1`,
    );

    expect(registro.rows[0]?.action).toBe('settings.updated');
    expect(registro.rows[0]?.metadata.changed).toEqual(['email']);
  });
});

describe('lo que no se deja guardar', () => {
  /*
   * El telefono acaba dentro de un enlace `tel:` en todas las paginas. Si se
   * colara otro esquema, el boton de llamar del sitio entero pasaria a hacer
   * lo que quiera quien lo guardo, contra cada visitante que lo pulse.
   */
  it.each(['javascript:alert(1)', 'tel:+14045550123', '404-555-0123', '<script>alert(1)</script>'])(
    'rechaza %j como telefono',
    async (phone) => {
      const respuesta = await guardar({ ...VALIDA, phone });
      expect(respuesta.status).toBe(400);
    },
  );

  it('rechaza un correo que no lo es', async () => {
    const respuesta = await guardar({ ...VALIDA, email: 'javascript:alert(1)' });
    expect(respuesta.status).toBe(400);
  });

  it('rechaza cerrar antes de abrir', async () => {
    const respuesta = await guardar({
      ...VALIDA,
      hours: { ...VALIDA.hours, 1: { open: '18:00', close: '08:00' } },
    });

    expect(respuesta.status).toBe(400);
  });

  it('rechaza una hora imposible', async () => {
    const respuesta = await guardar({
      ...VALIDA,
      hours: { ...VALIDA.hours, 1: { open: '25:00', close: '26:00' } },
    });

    expect(respuesta.status).toBe(400);
  });

  it('rechaza una semana incompleta', async () => {
    const { 7: _domingo, ...seisDias } = VALIDA.hours;
    const respuesta = await guardar({ ...VALIDA, hours: seisDias });

    expect(respuesta.status).toBe(400);
  });

  it('rechaza campos que no existen en el contrato', async () => {
    const respuesta = await guardar({ ...VALIDA, crews: 99 });
    expect(respuesta.status).toBe(400);
  });

  it('despues de todos los intentos fallidos, lo guardado sigue intacto', async () => {
    const respuesta = await request(app.getHttpServer()).get(PUBLICO);

    expect(respuesta.body.phone).toBe('+14045550123');
    expect(respuesta.body.hours['1']).toEqual({ open: '08:00', close: '18:00' });
  });
});

describe('lo que ve el visitante', () => {
  it('es publico y cumple el contrato', async () => {
    const respuesta = await request(app.getHttpServer()).get(PUBLICO);

    expect(respuesta.status).toBe(200);
    expect(BusinessSettingsSchema.safeParse(respuesta.body).success).toBe(true);
  });

  /*
   * El telefono es publico; quien lo cambio, no. Si esto se filtrara, la
   * plantilla de la empresa estaria en la web sin que nadie lo hubiera
   * decidido.
   */
  it('NO dice quien lo cambio ni cuando', async () => {
    const respuesta = await request(app.getHttpServer()).get(PUBLICO);

    expect(respuesta.body).not.toHaveProperty('updatedBy');
    expect(respuesta.body).not.toHaveProperty('updatedAt');
    expect(JSON.stringify(respuesta.body)).not.toContain('Ada');
  });

  it('se puede guardar en cache un rato, para no castigar a la API', async () => {
    const respuesta = await request(app.getHttpServer()).get(PUBLICO);
    expect(respuesta.headers['cache-control']).toContain('max-age=300');
  });
});

describe('el horario guardado manda sobre la agenda', () => {
  const LUNES = '2026-10-05';

  /** Consulta franjas para un lunes concreto con un trabajo pequeno. */
  async function franjasDelLunes(): Promise<{ businessOpen: boolean; slots: unknown[] }> {
    const respuesta = await request(app.getHttpServer()).get('/api/v1/availability').query({
      date: LUNES,
      service: 'STANDARD',
      bedrooms: 1,
      bathrooms: 1,
      squareFeet: 800,
    });

    return respuesta.body;
  }

  it('con el lunes abierto hay franjas', async () => {
    await guardar(VALIDA);
    settings.invalidate();

    const { businessOpen, slots } = await franjasDelLunes();

    expect(businessOpen).toBe(true);
    expect(slots.length).toBeGreaterThan(0);
  });

  /*
   * Esta es la prueba de que el trabajo sirve para algo: cerrar el lunes
   * desde el panel deja de ofrecer franjas ese dia, SIN desplegar nada.
   */
  it('cerrar el lunes desde el panel vacia su agenda', async () => {
    await guardar({ ...VALIDA, hours: { ...VALIDA.hours, 1: null } });
    settings.invalidate();

    const { businessOpen, slots } = await franjasDelLunes();

    expect(businessOpen).toBe(false);
    expect(slots).toHaveLength(0);
  });

  it('acortar el horario reduce las franjas ofrecidas', async () => {
    await guardar({ ...VALIDA, hours: { ...VALIDA.hours, 1: { open: '08:00', close: '18:00' } } });
    settings.invalidate();
    const amplio = await franjasDelLunes();

    await guardar({ ...VALIDA, hours: { ...VALIDA.hours, 1: { open: '10:00', close: '12:00' } } });
    settings.invalidate();
    const corto = await franjasDelLunes();

    expect(corto.slots.length).toBeLessThan(amplio.slots.length);
    expect(corto.slots.length).toBeGreaterThan(0);
  });

  it('deja el horario completo para no afectar a otras pruebas', async () => {
    await guardar(VALIDA);
    settings.invalidate();

    const { businessOpen } = await franjasDelLunes();
    expect(businessOpen).toBe(true);
  });
});

describe('cuando lo guardado no sirve', () => {
  /*
   * Escenario real: se cambia el contrato y queda una fila de la version
   * anterior. El sitio publico NO puede caerse por eso: es la pagina que
   * genera los ingresos, y prefiere un horario de partida a un error.
   */
  it('una fila corrupta no tumba el sitio publico', async () => {
    await db.exec(`UPDATE business_settings SET value = '{"phone": 12345}'::jsonb`);
    settings.invalidate();

    const respuesta = await request(app.getHttpServer()).get(PUBLICO);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual(DEFAULT_BUSINESS_SETTINGS);
  });

  it('y la agenda sigue funcionando con el horario de partida', async () => {
    const respuesta = await request(app.getHttpServer()).get('/api/v1/availability').query({
      date: '2026-10-05',
      service: 'STANDARD',
      bedrooms: 1,
      bathrooms: 1,
      squareFeet: 800,
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.businessOpen).toBe(true);
  });

  it('guardar de nuevo desde el panel repara la fila', async () => {
    await guardar(VALIDA);
    settings.invalidate();

    const respuesta = await request(app.getHttpServer()).get(PUBLICO);
    expect(respuesta.body.phone).toBe('+14045550123');
  });
});
