import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminGallerySchema, GallerySchema } from '@freshness/types';
import { AppModule } from '../app.module';
import { AUTH_PROVIDER } from '../auth/auth.types';
import type { LocalAuthProvider } from '../auth/providers/local-auth.provider';
import { GalleryService } from './gallery.service';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-de-la-galeria';
  process.env.EMAIL_PROVIDER = 'log';
  process.env.REMINDER_SWEEP_MINUTES = '0';
  process.env.AUDIT_PURGE_HOURS = '0';
  process.env.RATE_LIMIT_MAX = '2000';
  process.env.QUOTE_RATE_LIMIT_MAX = '2000';
});

/**
 * LA GALERIA, CONTRA UNA BASE DE DATOS REAL
 * -----------------------------------------
 * Lo que se comprueba aqui no es que la lista se lea —eso lo prueba el
 * contrato—, sino LO QUE PASA CUANDO LA FILA ESTA MAL.
 *
 * Importa porque esta seccion no la mira nadie a diario: si una fila con
 * basura tumbara la portada, se descubriria por una venta perdida. Y porque
 * la trampa del objeto estricto ya costo una etapa entera con las tarifas:
 * una fila guardada antes de anadir un campo tiene que seguir leyendose.
 */

const PUERTO = 55489;
const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');
const RUTA = '/api/v1/gallery';
const RUTA_ADMIN = '/api/v1/admin/gallery';

const UNO = 'dQw4w9WgXcQ';
const DOS = 'aBcDeFgHiJk';

const ADA = 'aaa94000-0000-4000-8000-000000000001';
const DIEGO = 'ddd94000-0000-4000-8000-000000000002';
const ADA_AUTH = 'auth-ada-galeria';
const DIEGO_AUTH = 'auth-diego-galeria';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;
let provider: LocalAuthProvider;

const comoAda = (): Promise<string> => provider.issue(ADA_AUTH, 'ada@example.com', 3600);
const comoDiego = (): Promise<string> => provider.issue(DIEGO_AUTH, 'diego@example.com', 3600);

async function leerComoAdmin(token?: string) {
  return request(app.getHttpServer())
    .get(RUTA_ADMIN)
    .set('authorization', `Bearer ${token ?? (await comoAda())}`);
}

async function guardar(gallery: unknown, token?: string) {
  const respuesta = await request(app.getHttpServer())
    .put(RUTA_ADMIN)
    .set('authorization', `Bearer ${token ?? (await comoAda())}`)
    .send(gallery);

  // La cache es por instancia: sin esto el endpoint publico de la prueba
  // siguiente seguiria sirviendo la galeria anterior durante medio minuto.
  app.get(GalleryService).invalidate();
  return respuesta;
}

/** Mete la fila tal cual, sin pasar por ningun contrato. */
async function guardarFilaCruda(valor: unknown): Promise<void> {
  await db.query(
    `INSERT INTO business_settings (key, value, "updatedAt")
     VALUES ('gallery', $1::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, "updatedAt" = now()`,
    [JSON.stringify(valor)],
  );
  app.get(GalleryService).invalidate();
}

function leer() {
  return request(app.getHttpServer()).get(RUTA);
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
  app.get(GalleryService).invalidate();
});

/* ======================================================================== */

describe('la galeria publica', () => {
  it('es de todos, sin sesion: son videos ya publicados en YouTube', async () => {
    const respuesta = await leer();

    expect(respuesta.status).toBe(200);
    expect(GallerySchema.safeParse(respuesta.body).success).toBe(true);
  });

  it('sin nada configurado viene vacia, y entonces la seccion no se pinta', async () => {
    expect((await leer()).body).toEqual({ videos: [] });
  });

  it('devuelve los videos guardados, en el orden en que estan', async () => {
    await guardarFilaCruda({
      videos: [
        { videoId: UNO, title: { en: 'Kitchen', es: 'Cocina' } },
        { videoId: DOS, title: { en: null, es: null } },
      ],
    });

    const respuesta = await leer();
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.videos.map((v: { videoId: string }) => v.videoId)).toEqual([UNO, DOS]);
  });

  it('la cache es corta, porque un consentimiento se puede revocar', async () => {
    // La empresa promete retirar el material en unos dias. Una cache larga en
    // el navegador alargaria esa promesa sin que nadie lo notara.
    const cabecera = (await leer()).headers['cache-control'];
    expect(cabecera).toContain('max-age=300');
  });
});

describe('cuando la fila esta mal', () => {
  /*
   * Nada de esto puede devolver un 500. La seccion se queda sin pintar y la
   * portada sale entera: lo contrario seria perder ventas por una lista de
   * videos.
   */
  it('con basura dentro, la seccion se queda vacia y la portada sigue viva', async () => {
    await guardarFilaCruda({ videos: 'esto no es una lista' });

    const respuesta = await leer();
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ videos: [] });
  });

  it('con un identificador que no es de YouTube, se ignora la fila entera', async () => {
    // A proposito la fila entera y no solo ese video: si se colaran los
    // validos y se tirara el malo, la dueña veria la galeria «casi bien» y no
    // sabria que le falta uno.
    await guardarFilaCruda({ videos: [{ videoId: 'https://evil.example/x', title: null }] });

    expect((await leer()).body).toEqual({ videos: [] });
  });

  it('con una clave que el contrato no conoce, tambien', async () => {
    await guardarFilaCruda({ videos: [], fotos: ['cocina.jpg'] });

    expect((await leer()).body).toEqual({ videos: [] });
  });

  /*
   * LA TRAMPA DEL OBJETO ESTRICTO, CONTRA LA BASE DE VERDAD.
   *
   * El dia que la galeria gane un campo nuevo, las filas ya guardadas no lo
   * traeran. Si el contrato las rechazara por eso, la galeria apareceria
   * vacia sin que nadie hubiera borrado nada, y nadie lo relacionaria con el
   * despliegue. Ya paso con las tarifas.
   */
  it('una fila guardada sin el campo se lee igual', async () => {
    await guardarFilaCruda({});

    const respuesta = await leer();
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ videos: [] });
  });
});

/* ======================================================================== */

describe('quien puede ver y cambiar la galeria', () => {
  it('administracion lee, y sin nada guardado recibe la galeria vacia', async () => {
    const respuesta = await leerComoAdmin();

    expect(respuesta.status).toBe(200);
    expect(AdminGallerySchema.safeParse(respuesta.body).success).toBe(true);
    expect(respuesta.body.gallery).toEqual({ videos: [] });
    expect(respuesta.body.updatedAt).toBeNull();
  });

  /*
   * NO ES SOLO ESCRITURA: TAMPOCO PUEDE LEERLO.
   *
   * Escribir, porque publicar el interior de la casa de un cliente sin su
   * permiso firmado es el peor escenario legal del sistema, y eso no tiene
   * nada que ver con coordinar una agenda.
   *
   * Leer, porque esta pantalla trae ademas quien lo publico y cuando, que es
   * informacion interna. La lista a secas esta en el endpoint publico.
   */
  it('coordinacion no puede leerla ni cambiarla', async () => {
    const token = await comoDiego();

    expect((await leerComoAdmin(token)).status).toBe(403);
    expect((await guardar({ videos: [] }, token)).status).toBe(403);
  });

  it('sin sesion no se llega', async () => {
    expect((await request(app.getHttpServer()).get(RUTA_ADMIN)).status).toBe(401);
    expect((await request(app.getHttpServer()).put(RUTA_ADMIN).send({ videos: [] })).status).toBe(
      401,
    );
  });
});

describe('publicar y retirar', () => {
  it('guarda, lo devuelve con quien lo hizo, y llega al endpoint publico', async () => {
    const respuesta = await guardar({
      videos: [{ videoId: UNO, title: { en: 'Kitchen', es: 'Cocina' } }],
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.updatedBy).toBe('Ada Jefa');
    expect(respuesta.body.updatedAt).not.toBeNull();

    // El punto entero de haberlo sacado del codigo.
    const publica = await leer();
    expect(publica.body.videos).toHaveLength(1);
    expect(publica.body.videos[0].videoId).toBe(UNO);
  });

  /*
   * ESTA ES LA OPERACION QUE DE VERDAD IMPORTA.
   *
   * Lo que mas va a pasar es RETIRAR un video porque un cliente revoco su
   * permiso. Se manda el conjunto entero, asi que lo que no viene es que ya
   * no esta: no hay que inventar una operacion de borrado que se pueda
   * perder por el camino dejando publicada la casa de alguien que pidio que
   * la quitaran.
   */
  it('retirar un video es mandar la lista sin el', async () => {
    await guardar({
      videos: [
        { videoId: UNO, title: { en: null, es: null } },
        { videoId: DOS, title: { en: null, es: null } },
      ],
    });

    await guardar({ videos: [{ videoId: DOS, title: { en: null, es: null } }] });

    const publica = await leer();
    expect(publica.body.videos.map((v: { videoId: string }) => v.videoId)).toEqual([DOS]);
  });

  it('vaciarla del todo deja la seccion sin pintar', async () => {
    await guardar({ videos: [{ videoId: UNO, title: { en: null, es: null } }] });
    await guardar({ videos: [] });

    expect((await leer()).body).toEqual({ videos: [] });
  });

  it('rechaza un identificador que no es de YouTube, con 400 y sin guardar nada', async () => {
    // Si esto entrara, quien tenga el panel podria incrustar en la portada un
    // marco de cualquier sitio de internet.
    const respuesta = await guardar({
      videos: [{ videoId: 'https://evil.example/x', title: { en: null, es: null } }],
    });

    expect(respuesta.status).toBe(400);
    expect((await leer()).body).toEqual({ videos: [] });
  });

  it('rechaza el mismo video dos veces', async () => {
    const respuesta = await guardar({
      videos: [
        { videoId: UNO, title: { en: null, es: null } },
        { videoId: UNO, title: { en: null, es: null } },
      ],
    });

    expect(respuesta.status).toBe(400);
  });
});

describe('el rastro', () => {
  /*
   * Si un cliente revoca su permiso o reclama, la pregunta es «quien lo
   * publico, cuando, y cuando se retiro». Se responde con esto o no se
   * responde.
   */
  it('queda registrado que entro y que salio, no la lista entera', async () => {
    await guardar({ videos: [{ videoId: UNO, title: { en: null, es: null } }] });
    await guardar({ videos: [{ videoId: DOS, title: { en: null, es: null } }] });

    const filas = await db.query<{ action: string; metadata: unknown; actorId: string }>(
      `SELECT action, metadata, "actorId" FROM audit_logs ORDER BY "createdAt"`,
    );

    expect(filas.rows.map((f) => f.action)).toEqual(['gallery.updated', 'gallery.updated']);
    expect(filas.rows[1]?.actorId).toBe(ADA);
    // La diferencia, que es lo que responde a «cuando se retiro este video».
    expect(filas.rows[1]?.metadata).toEqual({ added: [DOS], removed: [UNO] });
  });

  it('un rechazo no deja rastro, porque no cambio nada', async () => {
    await guardar({ videos: [{ videoId: 'no-vale', title: { en: null, es: null } }] });

    const filas = await db.query(`SELECT 1 FROM audit_logs`);
    expect(filas.rows).toHaveLength(0);
  });

  /*
   * NI UNA DIRECCION NI UN DATO DEL CLIENTE EN LA METADATA.
   *
   * De ahi vendria el problema: el registro se consulta, se exporta y se
   * ensena. Lo que se guarda son identificadores de videos ya publicos en
   * YouTube.
   */
  it('la metadata no lleva nada del cliente', async () => {
    await guardar({ videos: [{ videoId: UNO, title: { en: 'Kitchen', es: 'Cocina' } }] });

    const filas = await db.query<{ metadata: unknown }>(`SELECT metadata FROM audit_logs`);
    expect(Object.keys(filas.rows[0]?.metadata as object).sort()).toEqual(['added', 'removed']);
  });
});
