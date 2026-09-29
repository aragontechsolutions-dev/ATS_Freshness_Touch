import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdminSiteCopySchema,
  SITE_COPY_LONG_MAX,
  SITE_COPY_SHORT_MAX,
  type SiteCopy,
} from '@freshness/types';
import { AppModule } from '../app.module';
import { AUTH_PROVIDER } from '../auth/auth.types';
import type { LocalAuthProvider } from '../auth/providers/local-auth.provider';
import { SiteCopyService } from './site-copy.service';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-de-los-textos';
  process.env.EMAIL_PROVIDER = 'log';
  process.env.REMINDER_SWEEP_MINUTES = '0';
  process.env.AUDIT_PURGE_HOURS = '0';
  process.env.RATE_LIMIT_MAX = '2000';
  process.env.QUOTE_RATE_LIMIT_MAX = '2000';
});

/**
 * LOS TEXTOS DE LA WEB, CONTRA UNA BASE DE DATOS REAL
 * ---------------------------------------------------
 * Lo que se edita aqui no son ajustes, son COMPROMISOS: el seguro, la
 * verificacion de antecedentes, la garantia, el plazo para cancelar. Por eso
 * se comprueba:
 *
 *   1. Que solo administracion pueda verlos y cambiarlos. Coordinacion
 *      coordina; no decide lo que la empresa promete por escrito.
 *   2. Que el contrato pare lo que romperia la portada: textos enormes,
 *      saltos de linea, claves inventadas.
 *   3. Que el cambio LLEGUE al endpoint publico, que es el punto entero de
 *      haberlos sacado del codigo.
 *   4. Que quede auditado con el texto nuevo, porque la pregunta que llega
 *      tarde es «que prometia la web cuando este cliente reservo».
 */

const PUERTO = 55484;
const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');
const RUTA = '/api/v1/admin/site-copy';
const RUTA_PUBLICA = '/api/v1/site-copy';

const ADA = 'aaa93000-0000-4000-8000-000000000001';
const DIEGO = 'ddd93000-0000-4000-8000-000000000002';
const ADA_AUTH = 'auth-ada-textos';
const DIEGO_AUTH = 'auth-diego-textos';

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

async function guardar(copy: unknown, token?: string) {
  const respuesta = await request(app.getHttpServer())
    .put(RUTA)
    .set('authorization', `Bearer ${token ?? (await comoAda())}`)
    .send(copy);

  // La cache es por instancia: sin esto el endpoint publico de la prueba
  // siguiente seguiria sirviendo el texto anterior durante medio minuto.
  app.get(SiteCopyService).invalidate();
  return respuesta;
}

const GARANTIA_48H: SiteCopy = {
  'whyUs.guarantee.body': {
    en: 'Not happy? Tell us within 48 hours and we come back.',
    es: 'No quedaste conforme? Avisanos en 48 horas y volvemos.',
  },
};

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
  app.get(SiteCopyService).invalidate();
});

/* ======================================================================== */

describe('quien puede ver y cambiar los textos', () => {
  it('administracion lee, y sin nada guardado recibe el conjunto vacio', async () => {
    const respuesta = await leer();

    expect(respuesta.status).toBe(200);
    expect(AdminSiteCopySchema.safeParse(respuesta.body).success).toBe(true);
    // Vacio significa «el sitio usa sus propios textos», que es el estado de partida.
    expect(respuesta.body.copy).toEqual({});
    expect(respuesta.body.updatedAt).toBeNull();
  });

  /*
   * NO ES SOLO ESCRITURA: TAMPOCO PUEDE LEERLO.
   *
   * Quien pueda cambiar esto hace que la empresa prometa por escrito, a todo
   * el que entre en la web, algo que quiza no piensa cumplir. Y leer trae
   * ademas quien lo escribio y cuando, que es informacion interna.
   */
  it('coordinacion no puede leerlos ni cambiarlos', async () => {
    const token = await comoDiego();

    expect((await leer(token)).status).toBe(403);
    expect((await guardar(GARANTIA_48H, token)).status).toBe(403);
  });

  it('sin sesion no se llega', async () => {
    expect((await request(app.getHttpServer()).get(RUTA)).status).toBe(401);
    expect((await request(app.getHttpServer()).put(RUTA).send(GARANTIA_48H)).status).toBe(401);
  });

  it('el endpoint publico SI es de todos, sin sesion', async () => {
    // Es el que usa el sitio: son literalmente las frases de la portada.
    const respuesta = await request(app.getHttpServer()).get(RUTA_PUBLICA);
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({});
  });
});

describe('guardar', () => {
  it('guarda y lo devuelve con quien lo hizo', async () => {
    const respuesta = await guardar(GARANTIA_48H);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.copy['whyUs.guarantee.body'].en).toContain('48 hours');
    expect(respuesta.body.updatedBy).toBe('Ada Jefa');
    expect(respuesta.body.updatedAt).not.toBeNull();
  });

  it('el cambio llega al endpoint publico: es el punto de todo esto', async () => {
    await guardar(GARANTIA_48H);

    const publico = await request(app.getHttpServer()).get(RUTA_PUBLICA);
    expect(publico.body['whyUs.guarantee.body']).toEqual(GARANTIA_48H['whyUs.guarantee.body']);
  });

  it('un idioma a medias se guarda: el otro usara el texto del codigo', async () => {
    const respuesta = await guardar({
      'whyUs.insured.title': { en: 'Fully insured', es: null },
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.copy['whyUs.insured.title']).toEqual({ en: 'Fully insured', es: null });
  });

  it('una clave sin nada escrito no se guarda, para que la fila no acumule restos', async () => {
    await guardar(GARANTIA_48H);
    const respuesta = await guardar({
      'whyUs.guarantee.body': { en: null, es: null },
      'faq.q1.q': { en: 'Do I pay tax?', es: null },
    });

    expect(respuesta.body.copy['whyUs.guarantee.body']).toBeUndefined();
    expect(respuesta.body.copy['faq.q1.q'].en).toBe('Do I pay tax?');
  });

  it('volver a mandar el conjunto vacio deja el sitio con sus textos', async () => {
    await guardar(GARANTIA_48H);
    const respuesta = await guardar({});

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.copy).toEqual({});
    expect((await request(app.getHttpServer()).get(RUTA_PUBLICA)).body).toEqual({});
  });
});

describe('lo que el contrato rechaza, y sin dejar nada a medias', () => {
  it('una clave inventada', async () => {
    const respuesta = await guardar({ 'whyUs.inventada.title': { en: 'Hola', es: null } });
    expect(respuesta.status).toBe(400);
  });

  it('un titulo pasado del tope corto', async () => {
    const respuesta = await guardar({
      'whyUs.insured.title': { en: 'a'.repeat(SITE_COPY_SHORT_MAX + 1), es: null },
    });
    expect(respuesta.status).toBe(400);
  });

  it('un cuerpo pasado del tope largo', async () => {
    const respuesta = await guardar({
      'faq.q1.a': { en: 'a'.repeat(SITE_COPY_LONG_MAX + 1), es: null },
    });
    expect(respuesta.status).toBe(400);
  });

  it('saltos de linea', async () => {
    const respuesta = await guardar({ 'faq.q1.a': { en: 'Dos\nlineas', es: null } });
    expect(respuesta.status).toBe(400);
  });

  it('un rechazo no deja nada guardado', async () => {
    await guardar(GARANTIA_48H);

    // Una tanda con un texto valido y otro invalido: no puede entrar la mitad.
    const respuesta = await guardar({
      'faq.q1.q': { en: 'Valida', es: null },
      'whyUs.insured.title': { en: 'a'.repeat(SITE_COPY_SHORT_MAX + 1), es: null },
    });
    expect(respuesta.status).toBe(400);

    const despues = await leer();
    expect(despues.body.copy['faq.q1.q']).toBeUndefined();
    expect(despues.body.copy['whyUs.guarantee.body'].en).toContain('48 hours');
  });
});

describe('la auditoria', () => {
  it('deja una fila con su accion propia, las claves y el texto nuevo', async () => {
    await guardar(GARANTIA_48H);

    const filas = await db.query<{ action: string; metadata: Record<string, unknown> }>(
      `SELECT action, metadata FROM audit_logs WHERE action = 'site_copy.updated'`,
    );

    expect(filas.rows).toHaveLength(1);
    const metadata = filas.rows[0]?.metadata as {
      changed: string[];
      value: Record<string, { en: string | null }>;
    };
    expect(metadata.changed).toEqual(['whyUs.guarantee.body']);
    /*
     * El texto nuevo va en la metadata a proposito. Sin el, el registro diria
     * «se cambio la garantia», que no responde a lo unico que importa: a que
     * se cambio. No hay nada secreto: es texto escrito para publicarse.
     */
    expect(metadata.value['whyUs.guarantee.body']?.en).toContain('48 hours');
  });

  it('solo anota las claves que de verdad cambiaron', async () => {
    await guardar(GARANTIA_48H);
    await db.exec(`DELETE FROM audit_logs;`);

    // Se reenvia lo mismo mas una clave nueva.
    await guardar({ ...GARANTIA_48H, 'faq.q6.a': { en: 'Give us 24 hours.', es: null } });

    const filas = await db.query<{ metadata: { changed: string[] } }>(
      `SELECT metadata FROM audit_logs WHERE action = 'site_copy.updated'`,
    );
    expect(filas.rows[0]?.metadata.changed).toEqual(['faq.q6.a']);
  });

  it('un rechazo no deja fila de auditoria', async () => {
    await guardar({ 'faq.q1.a': { en: 'Dos\nlineas', es: null } });

    const filas = await db.query(`SELECT action FROM audit_logs`);
    expect(filas.rows).toHaveLength(0);
  });
});

describe('lo guardado que ya no cumple el contrato', () => {
  it('una clave retirada se ignora, y el resto se sigue sirviendo', async () => {
    /*
     * Simula lo que pasaria al RETIRAR un texto editable del contrato: la
     * fila guardada conserva la clave vieja. Sin la limpieza previa, la fila
     * entera dejaria de validar y la empresa perderia TODO lo que escribio.
     */
    await guardar(GARANTIA_48H);
    await db.exec(`
      UPDATE business_settings
      SET value = value || '{"faq.q9.q": {"en": "Pregunta retirada", "es": null}}'::jsonb
      WHERE key = 'site_copy';
    `);
    app.get(SiteCopyService).invalidate();

    const publico = await request(app.getHttpServer()).get(RUTA_PUBLICA);
    expect(publico.status).toBe(200);
    expect(publico.body['whyUs.guarantee.body'].en).toContain('48 hours');
    expect(publico.body['faq.q9.q']).toBeUndefined();
  });

  it('una fila con basura no tumba el sitio: se sirven los textos del codigo', async () => {
    await db.exec(`
      UPDATE business_settings SET value = '"esto no es un objeto"'::jsonb WHERE key = 'site_copy';
    `);
    await guardar(GARANTIA_48H);
    await db.exec(`
      UPDATE business_settings SET value = '"esto no es un objeto"'::jsonb WHERE key = 'site_copy';
    `);
    app.get(SiteCopyService).invalidate();

    const publico = await request(app.getHttpServer()).get(RUTA_PUBLICA);
    expect(publico.status).toBe(200);
    expect(publico.body).toEqual({});
  });
});
