import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GallerySchema } from '@freshness/types';
import { AppModule } from '../app.module';
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

const UNO = 'dQw4w9WgXcQ';
const DOS = 'aBcDeFgHiJk';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;

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

  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PUERTO}/postgres`;

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
  await app.init();
}, 120_000);

afterAll(async () => {
  await app?.close();
  await socket?.stop();
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`DELETE FROM business_settings;`);
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
