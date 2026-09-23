import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../app.module';
import { AUTH_PROVIDER } from '../auth/auth.types';
import type { LocalAuthProvider } from '../auth/providers/local-auth.provider';

/*
 * SIN CLAVE DE SERVICIO CONFIGURADA.
 *
 * Va en un fichero aparte porque la configuracion se congela al importar el
 * modulo de la aplicacion: no se puede tener el mismo proceso con la clave
 * puesta y sin poner.
 *
 * Lo que se comprueba: que la ausencia de la clave se note como una
 * funcionalidad apagada —un aviso claro y el boton escondido— y NO como un
 * error raro del proveedor el dia que alguien intente usarla.
 */
vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-sin-invitaciones';
  process.env.EMAIL_PROVIDER = 'log';
  process.env.REMINDER_SWEEP_MINUTES = '0';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
});

const PUERTO = 55462;
const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');
const RUTA = '/api/v1/admin/staff-directory';
const ADMIN_AUTH = 'auth-admin-sin-invitaciones';
const ADA = 'aaaa1111-1111-4111-8111-111111111111';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;
let provider: LocalAuthProvider;

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
    VALUES ('${ADA}', '${ADMIN_AUTH}', 'Ada', 'Jefa', 'ada@example.com', 'ADMIN', true, now())
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

describe('despliegue sin invitaciones configuradas', () => {
  it('arranca igual: la clave es opcional', () => {
    expect(app).toBeDefined();
  });

  it('el directorio avisa de que no se puede invitar', async () => {
    const token = await provider.issue(ADMIN_AUTH, 'ada@example.com', 3600);
    const respuesta = await request(app.getHttpServer())
      .get(RUTA)
      .set('authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.canInvite).toBe(false);
  });

  it('invitar responde con un motivo claro, no con un error del proveedor', async () => {
    const token = await provider.issue(ADMIN_AUTH, 'ada@example.com', 3600);
    const respuesta = await request(app.getHttpServer())
      .post(`${RUTA}/${ADA}/invite`)
      .set('authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(503);
    expect(respuesta.body.code).toBe('STAFF_INVITE_UNAVAILABLE');
  });

  it('dar de alta sigue funcionando: existir no depende de poder entrar', async () => {
    const token = await provider.issue(ADMIN_AUTH, 'ada@example.com', 3600);
    const respuesta = await request(app.getHttpServer())
      .post(RUTA)
      .set('authorization', `Bearer ${token}`)
      .send({
        firstName: 'Cleo',
        lastName: 'Limpia',
        email: 'cleo@example.com',
        phone: null,
        role: 'CLEANER',
        locale: 'en',
      });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.access).toBe('NONE');
  });
});
