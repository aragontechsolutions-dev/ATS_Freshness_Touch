import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminGallerySchema, PublicGallerySchema } from '@freshness/types';
import { AppModule } from '../app.module';
import { applyBodyParsers } from '../common/body-parsers';
import { AUTH_PROVIDER } from '../auth/auth.types';
import type { LocalAuthProvider } from '../auth/providers/local-auth.provider';
import { IMAGE_STORAGE } from '../storage/storage.types';
import type { MemoryImageStorageProvider } from '../storage/providers/memory-image-storage.provider';
import { GalleryService } from './gallery.service';
import { MediaConsentsService } from './media-consents.service';

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

/** Una ruta de foto con el formato que pone el servidor. */
const FOTO = 'photos/0123456789abcdef0123456789abcdef.jpg';

/** Y una de miniatura, que vive en su propia carpeta. */
const MINI = 'posters/fedcba9876543210fedcba9876543210.jpg';

/** La marca que se busca despues: si sobrevive, el GPS tambien lo haria. */
const GPS = [0x47, 0x50, 0x53, 0x5f, 0x41, 0x51, 0x55, 0x49]; // "GPS_AQUI"

/**
 * Un JPEG minimo con un EXIF dentro.
 *
 * Se construye byte a byte a proposito: un archivo binario de prueba no se
 * puede leer en una revision, y nadie sabria si de verdad lleva un EXIF.
 */
function jpegConExif(): Buffer {
  const exif = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...GPS];
  return Buffer.from([
    0xff,
    0xd8, //                                 SOI
    0xff,
    0xe1,
    0x00,
    exif.length + 2,
    ...exif, //  APP1 con el GPS
    0xff,
    0xc0,
    0x00,
    0x08,
    0x08,
    0x00,
    0x10,
    0x00,
    0x10,
    0x01, // SOF0
    0xff,
    0xda,
    0x00,
    0x08,
    0x01,
    0x01,
    0x00,
    0x11,
    0x22,
    0x33, // datos
    0xff,
    0xd9, //                                 EOI
  ]);
}

const ADA = 'aaa94000-0000-4000-8000-000000000001';
const DIEGO = 'ddd94000-0000-4000-8000-000000000002';
const ADA_AUTH = 'auth-ada-galeria';
const DIEGO_AUTH = 'auth-diego-galeria';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: NestExpressApplication;
let provider: LocalAuthProvider;
let almacen: MemoryImageStorageProvider;

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

/**
 * Anota un permiso firmado que ampara las piezas que se le pasen.
 *
 * HACE FALTA EN CASI TODAS LAS PRUEBAS porque la galeria publica funciona en
 * MODO ESTRICTO: sin un permiso en pie, una pieza no se publica. Lo que se
 * prueba en este archivo es la galeria, no el registro de permisos, asi que
 * el papel se mete por SQL y se da por hecho — su propio comportamiento se
 * prueba en `media-consents.e2e.test.ts`.
 */
async function amparar(
  piezas: { videoIds?: string[]; photoPaths?: string[] },
  revocado = false,
): Promise<void> {
  const videos = piezas.videoIds ?? [];
  const fotos = piezas.photoPaths ?? [];

  await db.query(
    `INSERT INTO media_consents
       (reference, "customerName", "propertyAddress", "serviceDate", "signedAt",
        "coversInterior", "coversExterior", "allowsBefore", channels, "removalDays",
        "videoIds", "photoPaths", "revokedAt", "updatedAt")
     VALUES ('FT-PRUEBA', 'Cliente', 'Una calle', DATE '2026-10-20', DATE '2026-10-18',
             true, false, true, ARRAY['WEBSITE'], 5, $1::text[], $2::text[], $3, now())`,
    [videos, fotos, revocado ? new Date() : null],
  );

  app.get(MediaConsentsService).invalidate();
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
  app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
  /*
   * Los mismos lectores de cuerpo que en produccion. Sin esto, la ruta de
   * subida no leeria los bytes de la imagen y la prueba comprobaria una
   * aplicacion que no es la que corre de verdad — que es exactamente el
   * motivo de que los lectores vivan en su propio archivo.
   */
  applyBodyParsers(app, 'api/v1');
  await app.init();

  provider = app.get<LocalAuthProvider>(AUTH_PROVIDER);
  almacen = app.get<MemoryImageStorageProvider>(IMAGE_STORAGE);
}, 120_000);

afterAll(async () => {
  await app?.close();
  await socket?.stop();
  await db?.close();
});

beforeEach(async () => {
  await db.exec(
    `DELETE FROM audit_logs; DELETE FROM media_consents; DELETE FROM business_settings;`,
  );
  // El almacen de desarrollo vive en memoria y sobrevive entre pruebas.
  await almacen.remove(almacen.rutas);
  app.get(GalleryService).invalidate();
  app.get(MediaConsentsService).invalidate();

  /*
   * Un permiso que ampara todo lo que usan estas pruebas. Sin el, la galeria
   * publica no serviria nada: sin papel no se publica.
   */
  await amparar({ videoIds: [UNO, DOS], photoPaths: [FOTO] });
});

/* ======================================================================== */

describe('la galeria publica', () => {
  it('es de todos, sin sesion: son videos ya publicados en YouTube', async () => {
    const respuesta = await leer();

    expect(respuesta.status).toBe(200);
    expect(PublicGallerySchema.safeParse(respuesta.body).success).toBe(true);
  });

  it('sin nada configurado viene vacia, y entonces la seccion no se pinta', async () => {
    expect((await leer()).body).toEqual({ videos: [], photos: [] });
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
    expect(respuesta.body).toEqual({ videos: [], photos: [] });
  });

  it('con un identificador que no es de YouTube, se ignora la fila entera', async () => {
    // A proposito la fila entera y no solo ese video: si se colaran los
    // validos y se tirara el malo, la dueña veria la galeria «casi bien» y no
    // sabria que le falta uno.
    await guardarFilaCruda({ videos: [{ videoId: 'https://evil.example/x', title: null }] });

    expect((await leer()).body).toEqual({ videos: [], photos: [] });
  });

  /*
   * LA RUTA DE UNA FOTO LA PONE EL SERVIDOR, y el contrato lo exige. Si en la
   * fila hubiera una direccion completa, la portada cargaria una imagen —o un
   * rastreador de un solo pixel— desde cualquier sitio de internet.
   */
  it('con una direccion completa en vez de una ruta de foto, tambien', async () => {
    await guardarFilaCruda({
      videos: [],
      photos: [{ path: 'https://evil.example/pixel.gif', title: { en: null, es: null } }],
    });

    expect((await leer()).body).toEqual({ videos: [], photos: [] });
  });

  it('con un salto de ruta en el nombre de la foto, tambien', async () => {
    await guardarFilaCruda({
      videos: [],
      photos: [{ path: 'photos/../../secreto.jpg', title: { en: null, es: null } }],
    });

    expect((await leer()).body).toEqual({ videos: [], photos: [] });
  });

  it('con una clave que el contrato no conoce, tambien', async () => {
    await guardarFilaCruda({ videos: [], retratos: ['cocina.jpg'] });

    expect((await leer()).body).toEqual({ videos: [], photos: [] });
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
    expect(respuesta.body).toEqual({ videos: [], photos: [] });
  });

  /*
   * EL CASO QUE DE VERDAD VA A PASAR: la fila se guardo con la version
   * anterior, cuando la galeria solo tenia videos. Si el contrato la
   * rechazara por no traer `photos`, los videos ya publicados desaparecerian
   * de la portada en el despliegue y nadie lo relacionaria con el cambio.
   */
  it('una fila de la version anterior, con videos y sin fotos, sigue valiendo', async () => {
    await guardarFilaCruda({ videos: [{ videoId: UNO, title: { en: null, es: null } }] });

    const respuesta = await leer();
    expect(respuesta.body.videos).toHaveLength(1);
    expect(respuesta.body.photos).toEqual([]);
  });
});

/* ======================================================================== */

describe('quien puede ver y cambiar la galeria', () => {
  it('administracion lee, y sin nada guardado recibe la galeria vacia', async () => {
    const respuesta = await leerComoAdmin();

    expect(respuesta.status).toBe(200);
    expect(AdminGallerySchema.safeParse(respuesta.body).success).toBe(true);
    expect(respuesta.body.gallery).toEqual({ videos: [], photos: [] });
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

    expect((await leer()).body).toEqual({ videos: [], photos: [] });
  });

  it('rechaza un identificador que no es de YouTube, con 400 y sin guardar nada', async () => {
    // Si esto entrara, quien tenga el panel podria incrustar en la portada un
    // marco de cualquier sitio de internet.
    const respuesta = await guardar({
      videos: [{ videoId: 'https://evil.example/x', title: { en: null, es: null } }],
    });

    expect(respuesta.status).toBe(400);
    expect((await leer()).body).toEqual({ videos: [], photos: [] });
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
    expect(filas.rows[1]?.metadata).toEqual({
      added: [DOS],
      removed: [UNO],
      photosAdded: [],
      photosRemoved: [],
      postersAdded: [],
      postersRemoved: [],
    });
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
    expect(Object.keys(filas.rows[0]?.metadata as object).sort()).toEqual([
      'added',
      'photosAdded',
      'photosRemoved',
      'postersAdded',
      'postersRemoved',
      'removed',
    ]);
  });
});

/* ======================================================================== */

describe('subir una imagen', () => {
  const RUTA_IMAGENES = `${RUTA_ADMIN}/images`;

  async function subir(bytes: Buffer, tipo: string, token?: string, kind = 'photo') {
    return request(app.getHttpServer())
      .post(`${RUTA_IMAGENES}?kind=${kind}`)
      .set('authorization', `Bearer ${token ?? (await comoAda())}`)
      .set('content-type', tipo)
      .send(bytes);
  }

  it('devuelve una ruta con el nombre que pone el servidor', async () => {
    const respuesta = await subir(jpegConExif(), 'image/jpeg');

    expect(respuesta.status).toBe(201);
    // Treinta y dos hexadecimales: nada del nombre original sobrevive.
    expect(respuesta.body.path).toMatch(/^photos\/[0-9a-f]{32}\.jpg$/);
  });

  /*
   * CADA COSA EN SU CARPETA. Si vivieran juntas, retirar una foto de la
   * galeria podria llevarse por delante la portada de un video —y al
   * contrario—, y nadie entenderia por que al quitar una foto un video se
   * quedo en gris.
   */
  it('una miniatura va a su propia carpeta', async () => {
    const respuesta = await subir(jpegConExif(), 'image/jpeg', undefined, 'poster');

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.path).toMatch(/^posters\/[0-9a-f]{32}\.jpg$/);
  });

  it('sin decir que carpeta, no se sube', async () => {
    // Adivinarlo seria decidir por quien llama donde acaba su archivo.
    const respuesta = await request(app.getHttpServer())
      .post(RUTA_IMAGENES)
      .set('authorization', `Bearer ${await comoAda()}`)
      .set('content-type', 'image/jpeg')
      .send(jpegConExif());

    expect(respuesta.status).toBe(415);
    expect(almacen.rutas).toHaveLength(0);
  });

  it('con una carpeta inventada, tampoco', async () => {
    const respuesta = await subir(jpegConExif(), 'image/jpeg', undefined, 'privado');

    expect(respuesta.status).toBe(415);
    expect(almacen.rutas).toHaveLength(0);
  });

  /*
   * ESTA ES LA PRUEBA QUE IMPORTA DE TODA LA ETAPA.
   *
   * Una foto de movil lleva dentro las coordenadas GPS de la casa. El permiso
   * que firma el cliente dice que no se mostrara su calle, y el encuadre se
   * cuida para que no salga la placa. Publicar el archivo con su direccion
   * exacta escrita dentro deja todo ese cuidado en nada.
   */
  it('lo que llega al almacen ya no lleva el GPS', async () => {
    const original = jpegConExif();
    expect([...original].join(',')).toContain(GPS.join(','));

    const respuesta = await subir(original, 'image/jpeg');
    const guardada = almacen.contenido(respuesta.body.path);

    expect(guardada).toBeDefined();
    expect([...(guardada ?? [])].join(',')).not.toContain(GPS.join(','));
  });

  it('subir no publica nada: la galeria sigue vacia', async () => {
    // Deja elegir el titulo y el orden antes de que la casa de nadie salga en
    // la portada.
    await subir(jpegConExif(), 'image/jpeg');

    expect((await leer()).body).toEqual({ videos: [], photos: [] });
  });

  it('coordinacion no puede subir', async () => {
    expect((await subir(jpegConExif(), 'image/jpeg', await comoDiego())).status).toBe(403);
  });

  it('sin sesion no se llega', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(`${RUTA_IMAGENES}?kind=photo`)
      .set('content-type', 'image/jpeg')
      .send(jpegConExif());

    expect(respuesta.status).toBe(401);
  });

  /*
   * UN SVG ES UN DOCUMENTO QUE PUEDE LLEVAR JAVASCRIPT DENTRO. Servido desde
   * un bucket publico seria un hueco de seguridad real, asi que no basta con
   * no listarlo: hay que comprobar los BYTES, porque el tipo que declara
   * quien sube no se puede creer.
   */
  it('un SVG disfrazado de JPEG no pasa', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
    const respuesta = await subir(svg, 'image/jpeg');

    expect(respuesta.status).toBe(415);
    expect(almacen.rutas).toHaveLength(0);
  });

  it('un tipo que no es imagen no pasa', async () => {
    const respuesta = await subir(Buffer.from('%PDF-1.7'), 'application/pdf');

    expect(respuesta.status).toBe(415);
    expect(almacen.rutas).toHaveLength(0);
  });

  it('un cuerpo vacio no pasa', async () => {
    const respuesta = await subir(Buffer.alloc(0), 'image/jpeg');

    expect(respuesta.status).toBe(415);
  });
});

describe('publicar y retirar una foto', () => {
  it('la galeria publica trae la direccion, no la ruta', async () => {
    // La compone el servidor, que es el unico que sabe donde esta el almacen.
    // La web no construye ninguna direccion: usa la que recibe.
    await guardar({ videos: [], photos: [{ path: FOTO, title: { en: 'Kitchen', es: 'Cocina' } }] });

    const publica = await leer();
    expect(publica.body.photos).toHaveLength(1);
    expect(publica.body.photos[0].url).toContain(FOTO);
    expect(publica.body.photos[0].path).toBeUndefined();
    expect(publica.body.photos[0].title).toEqual({ en: 'Kitchen', es: 'Cocina' });
  });

  /*
   * RETIRAR UNA FOTO LA BORRA DEL ALMACEN DE VERDAD.
   *
   * Quitarla solo de la fila dejaria el archivo accesible con su direccion
   * para quien la tuviera. El permiso promete retirar el material, no
   * esconder el enlace.
   */
  it('retirarla la borra del almacen, no solo de la fila', async () => {
    const subida = await request(app.getHttpServer())
      .post(`${RUTA_ADMIN}/images?kind=photo`)
      .set('authorization', `Bearer ${await comoAda()}`)
      .set('content-type', 'image/jpeg')
      .send(jpegConExif());

    const path: string = subida.body.path;
    await guardar({ videos: [], photos: [{ path, title: { en: null, es: null } }] });
    expect(almacen.rutas).toContain(path);

    await guardar({ videos: [], photos: [] });

    expect(almacen.rutas).not.toContain(path);
    expect((await leer()).body.photos).toEqual([]);
  });

  it('queda registrado que foto entro y cual salio', async () => {
    await guardar({ videos: [], photos: [{ path: FOTO, title: { en: null, es: null } }] });
    await guardar({ videos: [], photos: [] });

    const filas = await db.query<{ metadata: { photosAdded: string[]; photosRemoved: string[] } }>(
      `SELECT metadata FROM audit_logs ORDER BY "createdAt"`,
    );

    expect(filas.rows[0]?.metadata.photosAdded).toEqual([FOTO]);
    expect(filas.rows[1]?.metadata.photosRemoved).toEqual([FOTO]);
  });

  it('rechaza una ruta que no puso el servidor, con 400 y sin guardar nada', async () => {
    const respuesta = await guardar({
      videos: [],
      photos: [{ path: 'photos/casa-de-los-martinez.jpg', title: { en: null, es: null } }],
    });

    expect(respuesta.status).toBe(400);
    expect((await leer()).body.photos).toEqual([]);
  });

  it('rechaza la misma foto dos veces', async () => {
    const respuesta = await guardar({
      videos: [],
      photos: [
        { path: FOTO, title: { en: null, es: null } },
        { path: FOTO, title: { en: null, es: null } },
      ],
    });

    expect(respuesta.status).toBe(400);
  });
});

/* ======================================================================== */

describe('la miniatura de un video', () => {
  it('la galeria publica trae su direccion, no su ruta', async () => {
    await guardar({
      videos: [{ videoId: UNO, title: { en: null, es: null }, poster: MINI }],
      photos: [],
    });

    const publica = await leer();
    expect(publica.body.videos[0].posterUrl).toContain(MINI);
    expect(publica.body.videos[0].poster).toBeUndefined();
  });

  it('un video sin miniatura sigue saliendo, con la direccion a null', async () => {
    /*
     * No es como una foto, que sin direccion no es nada: el video se ve
     * igual, solo que la tarjeta se pinta con los colores de la marca.
     */
    await guardar({ videos: [{ videoId: UNO, title: { en: null, es: null } }], photos: [] });

    const publica = await leer();
    expect(publica.body.videos).toHaveLength(1);
    expect(publica.body.videos[0].posterUrl).toBeNull();
  });

  it('rechaza una ruta de foto como miniatura, y al contrario', async () => {
    // Son dos carpetas distintas a proposito; mezclarlas haria que retirar
    // una foto se llevara por delante la portada de un video.
    const comoMini = await guardar({
      videos: [{ videoId: UNO, title: { en: null, es: null }, poster: FOTO }],
      photos: [],
    });
    expect(comoMini.status).toBe(400);

    const comoFoto = await guardar({
      videos: [],
      photos: [{ path: MINI, title: { en: null, es: null } }],
    });
    expect(comoFoto.status).toBe(400);
  });

  it('rechaza una ruta que no puso el servidor', async () => {
    const respuesta = await guardar({
      videos: [
        { videoId: UNO, title: { en: null, es: null }, poster: 'posters/portada-bonita.jpg' },
      ],
      photos: [],
    });

    expect(respuesta.status).toBe(400);
  });

  /*
   * SUSTITUIR UNA MINIATURA BORRA LA ANTERIOR DEL ALMACEN.
   *
   * Es lo que mas va a pasar con las portadas. Sin esto, cada cambio dejaria
   * la anterior ahi para siempre, accesible con su direccion para quien la
   * tuviera.
   */
  it('sustituirla borra la anterior del almacen', async () => {
    const primera = await request(app.getHttpServer())
      .post(`${RUTA_ADMIN}/images?kind=poster`)
      .set('authorization', `Bearer ${await comoAda()}`)
      .set('content-type', 'image/jpeg')
      .send(jpegConExif());

    const segunda = await request(app.getHttpServer())
      .post(`${RUTA_ADMIN}/images?kind=poster`)
      .set('authorization', `Bearer ${await comoAda()}`)
      .set('content-type', 'image/jpeg')
      .send(jpegConExif());

    const vieja: string = primera.body.path;
    const nueva: string = segunda.body.path;

    await guardar({
      videos: [{ videoId: UNO, title: { en: null, es: null }, poster: vieja }],
      photos: [],
    });
    await guardar({
      videos: [{ videoId: UNO, title: { en: null, es: null }, poster: nueva }],
      photos: [],
    });

    expect(almacen.rutas).not.toContain(vieja);
    expect(almacen.rutas).toContain(nueva);
  });

  it('quitar el video entero tambien borra su miniatura', async () => {
    const subida = await request(app.getHttpServer())
      .post(`${RUTA_ADMIN}/images?kind=poster`)
      .set('authorization', `Bearer ${await comoAda()}`)
      .set('content-type', 'image/jpeg')
      .send(jpegConExif());

    const path: string = subida.body.path;

    await guardar({
      videos: [{ videoId: UNO, title: { en: null, es: null }, poster: path }],
      photos: [],
    });
    await guardar({ videos: [], photos: [] });

    expect(almacen.rutas).not.toContain(path);
  });

  it('queda registrado que miniatura entro y cual salio', async () => {
    await guardar({
      videos: [{ videoId: UNO, title: { en: null, es: null }, poster: MINI }],
      photos: [],
    });
    await guardar({ videos: [{ videoId: UNO, title: { en: null, es: null } }], photos: [] });

    const filas = await db.query<{
      metadata: { postersAdded: string[]; postersRemoved: string[] };
    }>(`SELECT metadata FROM audit_logs ORDER BY "createdAt"`);

    expect(filas.rows[0]?.metadata.postersAdded).toEqual([MINI]);
    expect(filas.rows[1]?.metadata.postersRemoved).toEqual([MINI]);
  });

  it('una fila de la version anterior, sin el campo, se sigue leyendo', async () => {
    /*
     * El caso que de verdad va a pasar en el despliegue: los videos ya
     * publicados no traen `poster`. Si el contrato los rechazara, la galeria
     * apareceria vacia y nadie lo relacionaria con el cambio.
     */
    await guardarFilaCruda({ videos: [{ videoId: UNO, title: { en: null, es: null } }] });

    const publica = await leer();
    expect(publica.body.videos).toHaveLength(1);
    expect(publica.body.videos[0].posterUrl).toBeNull();
  });
});

/* ======================================================================== */

describe('sin papel no se publica', () => {
  /*
   * ========================================================================
   * MODO ESTRICTO: LISTA BLANCA, NO LISTA NEGRA
   * ========================================================================
   * Solo sale lo que tiene un permiso firmado y en pie. Con una lista negra
   * —quitar lo revocado— una foto que nadie anoto se publicaria igual, y
   * publicar la casa de alguien sin su permiso es el escenario que todo este
   * modulo existe para evitar.
   *
   * Olvidar anotar un papel tiene ahora una consecuencia VISIBLE —la foto no
   * sale— en vez de una invisible —la foto sale sin permiso—. De las dos,
   * esta es la que se arregla, porque se nota.
   */
  it('una foto sin permiso anotado no sale, aunque este guardada', async () => {
    await db.exec(`DELETE FROM media_consents;`);
    app.get(MediaConsentsService).invalidate();

    await guardar({
      videos: [],
      photos: [{ path: FOTO, title: { en: null, es: null } }],
    });

    expect((await leer()).body.photos).toEqual([]);
  });

  it('un video sin permiso anotado tampoco', async () => {
    await db.exec(`DELETE FROM media_consents;`);
    app.get(MediaConsentsService).invalidate();

    await guardar({ videos: [{ videoId: UNO, title: { en: null, es: null } }], photos: [] });

    expect((await leer()).body.videos).toEqual([]);
  });

  it('pero el panel SI la ve, y dice que no se esta publicando', async () => {
    /*
     * Sin esto el modo estricto seria una trampa: se sube una foto, se
     * guarda, se ve en el panel y no aparece en la web, y no hay forma de
     * saber por que.
     */
    await db.exec(`DELETE FROM media_consents;`);
    app.get(MediaConsentsService).invalidate();

    await guardar({
      videos: [{ videoId: UNO, title: { en: null, es: null } }],
      photos: [{ path: FOTO, title: { en: null, es: null } }],
    });

    const panel = await leerComoAdmin();
    expect(panel.body.gallery.photos).toHaveLength(1);
    expect(panel.body.uncovered.photoPaths).toEqual([FOTO]);
    expect(panel.body.uncovered.videoIds).toEqual([UNO]);
  });

  it('con el permiso anotado, el panel ya no avisa de nada', async () => {
    await guardar({
      videos: [{ videoId: UNO, title: { en: null, es: null } }],
      photos: [{ path: FOTO, title: { en: null, es: null } }],
    });

    const panel = await leerComoAdmin();
    expect(panel.body.uncovered).toEqual({ videoIds: [], photoPaths: [] });
  });

  /*
   * UNA PIEZA CON UN PERMISO REVOCADO NO SE PUBLICA AUNQUE OTRO LA AMPARE.
   * No deberia pasar —una pieza es de una casa— pero si pasara, lo que manda
   * es la voluntad de quien dijo que no.
   */
  it('un permiso revocado gana a otro que si ampare la misma pieza', async () => {
    await amparar({ photoPaths: [FOTO] }, true);

    await guardar({
      videos: [],
      photos: [{ path: FOTO, title: { en: null, es: null } }],
    });

    expect((await leer()).body.photos).toEqual([]);
  });
});
