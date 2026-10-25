import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { StoredMediaConsentSchema } from '@freshness/types';
import { AppModule } from '../app.module';
import { applyBodyParsers } from '../common/body-parsers';
import { AUTH_PROVIDER } from '../auth/auth.types';
import type { LocalAuthProvider } from '../auth/providers/local-auth.provider';
import { EMAIL_PROVIDER } from '../notifications/notifications.types';
import type { LogEmailProvider } from '../notifications/providers/log-email.provider';
import { NotificationSettingsService } from '../notifications/notification-settings.service';
import { RemovalDeadlineSweepService } from '../notifications/removal-deadline-sweep.service';
import { GalleryService } from './gallery.service';
import { MediaConsentsService } from './media-consents.service';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-de-los-permisos';
  process.env.EMAIL_PROVIDER = 'log';
  process.env.REMINDER_SWEEP_MINUTES = '0';
  /* El barrido de plazos, a mano: una prueba no puede depender del reloj. */
  process.env.REMOVAL_SWEEP_MINUTES = '0';
  /* Sin esto el correo de constancia saldria sin enlace de retirada. */
  process.env.PUBLIC_SITE_URL = 'https://freshnesstouch.example';
  process.env.AUDIT_PURGE_HOURS = '0';
  process.env.RATE_LIMIT_MAX = '2000';
  process.env.QUOTE_RATE_LIMIT_MAX = '2000';
});

/**
 * EL REGISTRO DE CONSENTIMIENTOS, CONTRA UNA BASE DE DATOS REAL
 * =============================================================
 * El papel que firma un cliente promete dos cosas, y las dos se comprueban
 * aqui porque las dos son promesas legales, no funcionalidades:
 *
 *   1. QUE SE PUEDE RETIRAR. Revocar tiene que hacer que la pieza DEJE DE
 *      SERVIRSE, sin que nadie se acuerde de editar la galeria despues.
 *   2. QUE QUEDA CONSTANCIA. La pregunta que llega tarde es «cuando se
 *      retiro», y se responde con el registro o no se responde.
 *
 * Y una tercera que no esta en el papel pero es igual de seria: el nombre y
 * la direccion del cliente NO PUEDEN SALIR al sitio publico ni al registro
 * de auditoria.
 */

const PUERTO = 55491;
const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');
const RUTA = '/api/v1/admin/media-consents';
const RUTA_GALERIA = '/api/v1/admin/gallery';
const RUTA_PUBLICA = '/api/v1/gallery';

const ADA = 'aaa95000-0000-4000-8000-000000000001';
const DIEGO = 'ddd95000-0000-4000-8000-000000000002';
const ADA_AUTH = 'auth-ada-permisos';
const DIEGO_AUTH = 'auth-diego-permisos';

const VIDEO = 'dQw4w9WgXcQ';
const FOTO = 'photos/0123456789abcdef0123456789abcdef.jpg';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: NestExpressApplication;
let provider: LocalAuthProvider;

const comoAda = (): Promise<string> => provider.issue(ADA_AUTH, 'ada@example.com', 3600);
const comoDiego = (): Promise<string> => provider.issue(DIEGO_AUTH, 'diego@example.com', 3600);

/** Una ficha valida. Lo que cambia en cada prueba se pasa encima. */
function papel(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    reference: 'FT-2026-001',
    customerName: 'Marta Jimenez',
    propertyAddress: '742 Evergreen Terrace, Marietta',
    serviceDate: '2026-10-20',
    signedAt: '2026-10-18',
    coversInterior: true,
    coversExterior: false,
    allowsBefore: true,
    channels: ['WEBSITE'],
    removalDays: 5,
    videoIds: [],
    photoPaths: [],
    notes: null,
    ...extra,
  };
}

async function crear(cuerpo: unknown, token?: string) {
  return request(app.getHttpServer())
    .post(RUTA)
    .set('authorization', `Bearer ${token ?? (await comoAda())}`)
    .send(cuerpo);
}

async function listar(token?: string) {
  return request(app.getHttpServer())
    .get(RUTA)
    .set('authorization', `Bearer ${token ?? (await comoAda())}`);
}

async function revocar(id: string, token?: string) {
  const respuesta = await request(app.getHttpServer())
    .post(`${RUTA}/${id}/revoke`)
    .set('authorization', `Bearer ${token ?? (await comoAda())}`);
  app.get(GalleryService).invalidate();
  return respuesta;
}

async function restituir(id: string) {
  const respuesta = await request(app.getHttpServer())
    .post(`${RUTA}/${id}/restore`)
    .set('authorization', `Bearer ${await comoAda()}`);
  app.get(GalleryService).invalidate();
  return respuesta;
}

/** Publica un video y una foto en la galeria. */
async function publicarGaleria() {
  const respuesta = await request(app.getHttpServer())
    .put(RUTA_GALERIA)
    .set('authorization', `Bearer ${await comoAda()}`)
    .send({
      videos: [{ videoId: VIDEO, title: { en: null, es: null } }],
      photos: [{ path: FOTO, title: { en: null, es: null } }],
    });

  app.get(GalleryService).invalidate();
  return respuesta;
}

const leerPublica = () => request(app.getHttpServer()).get(RUTA_PUBLICA);

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
   * Los mismos lectores de cuerpo que en produccion. Sin esto la ruta de la
   * prueba llegaria sin bytes y la prueba diria que algo esta roto cuando lo
   * unico roto seria el montaje.
   */
  applyBodyParsers(app, 'api/v1');
  await app.init();

  provider = app.get<LocalAuthProvider>(AUTH_PROVIDER);
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
  app.get(GalleryService).invalidate();
  app.get(MediaConsentsService).invalidate();
});

/* ======================================================================== */

describe('quien puede ver y anotar los permisos', () => {
  it('administracion anota y lee', async () => {
    expect((await crear(papel())).status).toBe(201);

    const lista = await listar();
    expect(lista.status).toBe(200);
    expect(StoredMediaConsentSchema.safeParse(lista.body[0]).success).toBe(true);
  });

  /*
   * NO ES SOLO ESCRITURA: TAMPOCO PUEDE LEERLO.
   *
   * Cada ficha lleva el nombre de un cliente y LA DIRECCION DE SU CASA, que
   * es justo lo que el permiso promete no mostrar. Coordinacion coordina una
   * agenda; esto no es una agenda.
   */
  it('coordinacion no puede leerlos ni anotarlos', async () => {
    const token = await comoDiego();

    expect((await listar(token)).status).toBe(403);
    expect((await crear(papel(), token)).status).toBe(403);
  });

  it('sin sesion no se llega', async () => {
    expect((await request(app.getHttpServer()).get(RUTA)).status).toBe(401);
    expect((await request(app.getHttpServer()).post(RUTA).send(papel())).status).toBe(401);
  });

  it('y NADA de esto sale por el endpoint publico de la galeria', async () => {
    await crear(papel({ photoPaths: [FOTO] }));
    await publicarGaleria();

    const publica = await leerPublica();
    const texto = JSON.stringify(publica.body);

    expect(texto).not.toContain('Marta');
    expect(texto).not.toContain('Evergreen');
    expect(texto).not.toContain('FT-2026-001');
  });
});

describe('lo que el contrato no deja pasar', () => {
  it('un permiso que no cubre ni interior ni exterior no ampara nada', async () => {
    // Pero lo PARECE, que es peor que no tenerlo.
    const respuesta = await crear(papel({ coversInterior: false, coversExterior: false }));
    expect(respuesta.status).toBe(400);
  });

  /*
   * SI AMPARA ALGUNA PIEZA, EL PAPEL TIENE QUE PERMITIR LA WEB.
   *
   * Es donde se publica. Atar una foto a un papel que solo autoriza
   * Instagram es peor que no tener papel, porque parece que si lo hay.
   */
  it('no se puede atar una pieza a un papel que no autoriza la web', async () => {
    const respuesta = await crear(papel({ channels: ['INSTAGRAM'], photoPaths: [FOTO] }));
    expect(respuesta.status).toBe(400);
  });

  it('pero un papel sin piezas si puede ser solo de redes', async () => {
    expect((await crear(papel({ channels: ['INSTAGRAM'] }))).status).toBe(201);
  });

  it.each([
    ['un plazo de cero dias', { removalDays: 0 }],
    ['un plazo de un ano', { removalDays: 365 }],
    ['sin decir donde se publica', { channels: [] }],
    ['una fecha que no es una fecha', { signedAt: '18/10/2026' }],
    ['sin referencia del papel', { reference: '' }],
    ['una ruta de foto inventada', { photoPaths: ['photos/casa-de-marta.jpg'] }],
    ['un identificador de video inventado', { videoIds: ['https://evil.example/x'] }],
    ['un medio que no existe', { evidenceKind: 'LLAMADA' }],
  ])('rechaza %s', async (_caso, extra) => {
    expect((await crear(papel(extra))).status).toBe(400);
  });
});

/* ------------------------------------------------------------------------ */

describe('como se obtuvo el permiso', () => {
  /*
   * EL SUPUESTO QUE NO AGUANTABA EL CASO NORMAL.
   *
   * El registro nacio suponiendo un papel firmado en el salon. Pero en una
   * limpieza de mudanza la casa esta vacia, en una recurrente el cliente esta
   * trabajando, y hay clientes que contratan desde otro estado. Si el permiso
   * solo se puede obtener en persona, no se obtiene — y con el modo estricto,
   * lo que no se obtiene no se publica.
   */
  it.each(['SIGNED_PAPER', 'WEB_FORM', 'EMAIL', 'MESSAGE'])(
    'un permiso dado por %s vale igual',
    async (medio) => {
      const ficha = await crear(papel({ evidenceKind: medio, photoPaths: [FOTO] }));

      expect(ficha.status).toBe(201);
      expect(ficha.body.consent.evidenceKind).toBe(medio);

      await publicarGaleria();
      expect((await leerPublica()).body.photos).toHaveLength(1);
    },
  );

  /*
   * Las fichas anotadas antes de que esto existiera son todas de papel: era
   * lo unico que el panel permitia. Sin este valor por defecto, el dia del
   * despliegue dejarian de validarse y la galeria entera se quedaria vacia.
   */
  it('una ficha que no dice el medio se lee como papel firmado', async () => {
    const sinMedio = papel();
    delete sinMedio.evidenceKind;

    const ficha = await crear(sinMedio);

    expect(ficha.status).toBe(201);
    expect(ficha.body.consent.evidenceKind).toBe('SIGNED_PAPER');
  });

  it('el medio queda en la auditoria, pero el nombre y la direccion no', async () => {
    await crear(papel({ evidenceKind: 'WEB_FORM' }));

    const fila = await db.query<{ metadata: unknown }>(
      `SELECT metadata FROM audit_logs WHERE action = 'media_consent.created'`,
    );
    const metadata = JSON.stringify(fila.rows[0]?.metadata);

    expect(metadata).toContain('WEB_FORM');
    expect(metadata).not.toContain('Marta');
    expect(metadata).not.toContain('Evergreen');
  });
});

/* ------------------------------------------------------------------------ */

describe('cuando en la casa vive alguien que no firma', () => {
  /*
   * EL CASO QUE SE CUELA SIN QUE NADIE LO NOTE.
   *
   * El dueno contrata, el dueno firma, y en las imagenes salen los muebles,
   * la ropa y los objetos de OTRA persona que no ha dicho nada. Sobre la vida
   * privada de un tercero no se puede dar permiso.
   */
  it('su permiso no puede amparar ninguna pieza mientras falte el del inquilino', async () => {
    const conFoto = await crear(
      papel({ occupiedByOthers: true, occupantConsent: false, photoPaths: [FOTO] }),
    );
    expect(conFoto.status).toBe(400);

    const conVideo = await crear(
      papel({ occupiedByOthers: true, occupantConsent: false, videoIds: [VIDEO] }),
    );
    expect(conVideo.status).toBe(400);
  });

  /*
   * La ficha SI se puede anotar. Es util saber que existe y que falta la otra
   * mitad; lo que no puede es llevar piezas, y sin piezas el modo estricto no
   * publica ninguna. La regla se cumple sola.
   */
  it('pero la ficha se anota igual, sin piezas', async () => {
    const ficha = await crear(papel({ occupiedByOthers: true, occupantConsent: false }));

    expect(ficha.status).toBe(201);
    expect(ficha.body.consent.occupiedByOthers).toBe(true);
    expect(ficha.body.consent.occupantConsent).toBe(false);
  });

  it('con los dos permisos, ampara como cualquier otra', async () => {
    const ficha = await crear(
      papel({ occupiedByOthers: true, occupantConsent: true, photoPaths: [FOTO] }),
    );
    expect(ficha.status).toBe(201);

    await publicarGaleria();
    expect((await leerPublica()).body.photos).toHaveLength(1);
  });

  it('si solo vive quien firma, no hace falta nada mas', async () => {
    const ficha = await crear(papel({ occupiedByOthers: false, photoPaths: [FOTO] }));
    expect(ficha.status).toBe(201);
  });
});

describe('retirar un permiso', () => {
  /*
   * ESTA ES LA PRUEBA QUE JUSTIFICA TODA LA ETAPA.
   *
   * El papel promete que se puede retirar y que se retira en un plazo. Sin
   * esto, cumplirlo significa revisar el canal entero a ojo intentando
   * reconocer una cocina. Con esto, el plazo prometido pasa a ser el tiempo
   * que se tarda en pulsar.
   */
  it('las piezas que amparaba dejan de servirse al momento', async () => {
    const ficha = await crear(papel({ videoIds: [VIDEO], photoPaths: [FOTO] }));
    await publicarGaleria();

    const antes = await leerPublica();
    expect(antes.body.videos).toHaveLength(1);
    expect(antes.body.photos).toHaveLength(1);

    await revocar(ficha.body.id);

    const despues = await leerPublica();
    expect(despues.body.videos).toEqual([]);
    expect(despues.body.photos).toEqual([]);
  });

  it('y las de los demas permisos siguen ahi', async () => {
    const deMarta = await crear(papel({ photoPaths: [FOTO] }));
    await crear(papel({ reference: 'FT-2026-002', videoIds: [VIDEO] }));
    await publicarGaleria();

    await revocar(deMarta.body.id);

    const publica = await leerPublica();
    expect(publica.body.photos).toEqual([]);
    expect(publica.body.videos).toHaveLength(1);
  });

  /*
   * NO SE BORRA LA FICHA. Un permiso retirado es exactamente lo que hay que
   * poder demostrar: que existio, que amparaba estas piezas y cuando dejo de
   * hacerlo. Borrarlo dejaria el registro contando solo la mitad buena.
   */
  it('la ficha no se borra: se marca con la fecha', async () => {
    const ficha = await crear(papel({ photoPaths: [FOTO] }));
    await revocar(ficha.body.id);

    const lista = await listar();
    expect(lista.body).toHaveLength(1);
    expect(lista.body[0].revokedAt).not.toBeNull();
    expect(lista.body[0].consent.photoPaths).toEqual([FOTO]);
  });

  it('restituir vuelve a publicarlas, por si se revoco por error', async () => {
    const ficha = await crear(papel({ photoPaths: [FOTO] }));
    await publicarGaleria();
    await revocar(ficha.body.id);

    await restituir(ficha.body.id);

    expect((await leerPublica()).body.photos).toHaveLength(1);
  });

  it('coordinacion no puede retirar un permiso', async () => {
    const ficha = await crear(papel());
    expect((await revocar(ficha.body.id, await comoDiego())).status).toBe(403);
  });

  it('un permiso que no existe da 404, no un 500', async () => {
    const respuesta = await revocar('11111111-1111-4111-8111-111111111111');
    expect(respuesta.status).toBe(404);
  });
});

describe('el rastro', () => {
  it('anotar, corregir, retirar y restituir dejan su propia huella', async () => {
    const ficha = await crear(papel({ photoPaths: [FOTO] }));

    await request(app.getHttpServer())
      .put(`${RUTA}/${ficha.body.id}`)
      .set('authorization', `Bearer ${await comoAda()}`)
      .send(papel({ photoPaths: [FOTO], removalDays: 7 }));

    await revocar(ficha.body.id);
    await restituir(ficha.body.id);

    const filas = await db.query<{ action: string }>(
      `SELECT action FROM audit_logs ORDER BY "createdAt"`,
    );

    expect(filas.rows.map((f) => f.action)).toEqual([
      'media_consent.created',
      'media_consent.updated',
      'media_consent.revoked',
      'media_consent.restored',
    ]);
  });

  /*
   * LA PREGUNTA QUE LLEGA TARDE ES «CUANDO SE RETIRO», y se responde con
   * esto o no se responde.
   */
  it('la retirada queda con su autor y su entidad', async () => {
    const ficha = await crear(papel());
    await revocar(ficha.body.id);

    const filas = await db.query<{ actorId: string; entityType: string; entityId: string }>(
      `SELECT "actorId", "entityType", "entityId" FROM audit_logs WHERE action = 'media_consent.revoked'`,
    );

    expect(filas.rows[0]?.actorId).toBe(ADA);
    expect(filas.rows[0]?.entityType).toBe('media_consent');
    expect(filas.rows[0]?.entityId).toBe(ficha.body.id);
  });

  /*
   * NI EL NOMBRE NI LA DIRECCION EN LA METADATA. El registro se consulta, se
   * exporta y se ensena; de ahi vendria el problema. La referencia del papel,
   * por que via llego y cuantas piezas ampara bastan para responder a lo que
   * se pregunta. El medio es una categoria de cuatro valores: no identifica a
   * nadie, y es lo que dice donde buscar la prueba.
   */
  it('la metadata no lleva nada del cliente', async () => {
    await crear(papel({ photoPaths: [FOTO] }));

    const filas = await db.query<{ metadata: Record<string, unknown> }>(
      `SELECT metadata FROM audit_logs`,
    );
    const metadata = filas.rows[0]?.metadata ?? {};

    expect(Object.keys(metadata).sort()).toEqual([
      'allowsBefore',
      'evidenceKind',
      'photos',
      'reference',
      'videos',
    ]);
    expect(JSON.stringify(metadata)).not.toContain('Marta');
    expect(JSON.stringify(metadata)).not.toContain('Evergreen');
  });
});

/* ------------------------------------------------------------------------ */

describe('la prueba del permiso', () => {
  /** Un PDF minimo: lo que importa es que empiece por `%PDF-`. */
  const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n');

  /** Ocho bytes reconocibles, para poder buscarlos despues. */
  const GPS = [0x47, 0x50, 0x53, 0x5f, 0x41, 0x51, 0x55, 0x49]; // "GPS_AQUI"

  /**
   * Un JPEG minimo CON un EXIF dentro.
   *
   * Se construye byte a byte a proposito: un archivo binario de prueba no se
   * puede leer en una revision, y nadie sabria si de verdad lleva un EXIF.
   */
  function jpegConExif(): Buffer {
    const exif = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...GPS];
    return Buffer.from([
      0xff,
      0xd8, //                                     SOI
      0xff,
      0xe1,
      0x00,
      exif.length + 2,
      ...exif, //      APP1 con el GPS
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
      0xd9, //                                     EOI
    ]);
  }

  const JPEG = jpegConExif();

  async function subir(id: string, bytes: Buffer, tipo: string, token?: string) {
    return request(app.getHttpServer())
      .post(`${RUTA}/${id}/evidence`)
      .set('authorization', `Bearer ${token ?? (await comoAda())}`)
      .set('content-type', tipo)
      .send(bytes);
  }

  async function descargar(id: string, token?: string) {
    return request(app.getHttpServer())
      .get(`${RUTA}/${id}/evidence`)
      .set('authorization', `Bearer ${token ?? (await comoAda())}`);
  }

  /*
   * LA PRUEBA QUE JUSTIFICA ESTA ETAPA.
   *
   * Hasta ahora el registro guardaba el NUMERO del papel, no el papel. Una
   * referencia a un PDF que esta en el correo de alguien no se le puede
   * ensenar a nadie.
   */
  it('se guarda, se descarga igual y se queda atada a la ficha', async () => {
    const ficha = await crear(papel());

    const subida = await subir(ficha.body.id, PDF, 'application/pdf');
    expect(subida.status).toBe(201);
    expect(subida.body.evidencePath).toMatch(/^evidence\/[0-9a-f]{32}\.pdf$/);

    const bajada = await descargar(ficha.body.id);
    expect(bajada.status).toBe(200);
    expect(bajada.headers['content-type']).toContain('application/pdf');
    expect(Buffer.from(bajada.body as Buffer).equals(PDF)).toBe(true);

    const lista = await listar();
    expect(lista.body[0].evidencePath).toBe(subida.body.evidencePath);
  });

  /*
   * LA RUTA NO ES UNA DIRECCION. El bucket es privado y su puerto no sabe
   * dar direcciones publicas, asi que la unica puerta es este endpoint — y
   * este endpoint pide una sesion de administracion.
   */
  it('no se descarga sin sesion, ni con una que no es de administracion', async () => {
    const ficha = await crear(papel());
    await subir(ficha.body.id, PDF, 'application/pdf');

    const sinSesion = await request(app.getHttpServer()).get(`${RUTA}/${ficha.body.id}/evidence`);
    expect(sinSesion.status).toBe(401);

    const comoCoordinador = await descargar(ficha.body.id, await comoDiego());
    expect(comoCoordinador.status).toBe(403);
  });

  it('se sirve como descarga y sin dejar copia en ninguna cache', async () => {
    const ficha = await crear(papel());
    await subir(ficha.body.id, PDF, 'application/pdf');

    const bajada = await descargar(ficha.body.id);
    expect(bajada.headers['content-disposition']).toBe('attachment');
    expect(bajada.headers['cache-control']).toBe('no-store');
  });

  /*
   * LO QUE MANDA SON LOS BYTES, NO LA CABECERA. Quien sube elige lo que pone
   * en `Content-Type`: llamar `application/pdf` a un SVG colaria un
   * documento con JavaScript dentro.
   */
  it('un archivo que dice ser un PDF y no lo es se rechaza', async () => {
    const ficha = await crear(papel());
    const svg = Buffer.from('<svg onload="alert(1)"></svg>');

    expect((await subir(ficha.body.id, svg, 'application/pdf')).status).toBe(415);
    expect((await subir(ficha.body.id, svg, 'image/png')).status).toBe(415);
  });

  it('un tipo que no esta admitido no llega ni a leerse', async () => {
    const ficha = await crear(papel());
    expect((await subir(ficha.body.id, PDF, 'image/svg+xml')).status).toBe(415);
  });

  it('una imagen tambien vale: hay quien fotografia el papel', async () => {
    const ficha = await crear(papel());

    const subida = await subir(ficha.body.id, JPEG, 'image/jpeg');
    expect(subida.status).toBe(201);
    expect(subida.body.evidencePath).toMatch(/\.jpg$/);
  });

  /*
   * SE LE QUITAN LOS METADATOS AUNQUE NO SE PUBLIQUE.
   *
   * Aqui el archivo no sale a internet, asi que las coordenadas de dentro no
   * se ensenarian a nadie. Se quitan igual porque el habito tiene que ser el
   * mismo en los dos almacenes: el dia que alguien copie este codigo al que
   * si publica, no puede depender de que se acuerde.
   */
  it('a una imagen se le quita el EXIF antes de guardarla', async () => {
    const ficha = await crear(papel());
    expect(JPEG.includes(Buffer.from(GPS))).toBe(true);

    await subir(ficha.body.id, JPEG, 'image/jpeg');

    const bajada = await descargar(ficha.body.id);
    expect(Buffer.from(bajada.body as Buffer).includes(Buffer.from(GPS))).toBe(false);
  });

  it('sustituir deja una sola prueba, la nueva', async () => {
    const ficha = await crear(papel());

    const primera = await subir(ficha.body.id, PDF, 'application/pdf');
    const segunda = await subir(ficha.body.id, JPEG, 'image/jpeg');

    expect(segunda.status).toBe(201);
    expect(segunda.body.evidencePath).not.toBe(primera.body.evidencePath);

    const bajada = await descargar(ficha.body.id);
    expect(bajada.headers['content-type']).toContain('image/jpeg');
  });

  /*
   * BORRAR LA PRUEBA NO BORRA EL PERMISO. Un permiso anotado sin su archivo
   * sigue amparando lo que ampara; que le falte la prueba se ve en la
   * pantalla y se arregla volviendo a subirla.
   */
  it('borrar la prueba deja la ficha y lo que ampara', async () => {
    const ficha = await crear(papel({ photoPaths: [FOTO] }));
    await subir(ficha.body.id, PDF, 'application/pdf');
    await publicarGaleria();

    const borrado = await request(app.getHttpServer())
      .delete(`${RUTA}/${ficha.body.id}/evidence`)
      .set('authorization', `Bearer ${await comoAda()}`);

    expect(borrado.status).toBe(200);
    expect(borrado.body.evidencePath).toBeNull();
    expect(borrado.body.consent.photoPaths).toEqual([FOTO]);
    expect((await leerPublica()).body.photos).toHaveLength(1);
    expect((await descargar(ficha.body.id)).status).toBe(404);
  });

  /*
   * NI LA RUTA EN LA AUDITORIA. Es el unico dato que, sumado a la clave de
   * servicio, abre el documento; y el registro se consulta, se exporta y se
   * ensena.
   */
  it('queda registrado quien la guardo, pero no donde esta', async () => {
    const ficha = await crear(papel());
    const subida = await subir(ficha.body.id, PDF, 'application/pdf');

    const filas = await db.query<{ action: string; metadata: Record<string, unknown> }>(
      `SELECT action, metadata FROM audit_logs WHERE action LIKE 'media_consent.evidence%'`,
    );

    expect(filas.rows[0]?.action).toBe('media_consent.evidence_attached');
    const metadata = JSON.stringify(filas.rows[0]?.metadata);
    expect(metadata).not.toContain(subida.body.evidencePath);
    expect(metadata).not.toContain('evidence/');
    expect(metadata).toContain('application/pdf');
  });

  it('un permiso sin prueba responde que no la hay', async () => {
    const ficha = await crear(papel());
    expect((await descargar(ficha.body.id)).status).toBe(404);
  });
});

/* ------------------------------------------------------------------------ */

describe('el plazo de retirada', () => {
  const BUZON = 'operaciones@example.com';

  /** El dia de hoy y el de hace `dias` dias, en el formato del papel. */
  function haceDias(dias: number): string {
    const fecha = new Date();
    fecha.setUTCDate(fecha.getUTCDate() - dias);
    return fecha.toISOString().slice(0, 10);
  }

  async function pedirRetirada(id: string, requestedAt: string) {
    return request(app.getHttpServer())
      .post(`${RUTA}/${id}/removal-request`)
      .set('authorization', `Bearer ${await comoAda()}`)
      .send({ requestedAt });
  }

  async function anularPeticion(id: string) {
    return request(app.getHttpServer())
      .post(`${RUTA}/${id}/removal-request/cancel`)
      .set('authorization', `Bearer ${await comoAda()}`)
      .send();
  }

  function correos(): LogEmailProvider {
    return app.get<LogEmailProvider>(EMAIL_PROVIDER);
  }

  async function buzonInterno(destino: string | null): Promise<void> {
    const ajustes = app.get(NotificationSettingsService);
    const actuales = await ajustes.get();
    await ajustes.update(
      { ...actuales, internalEmail: destino },
      { staffId: ADA, role: 'ADMIN', email: 'ada@example.com', firstName: 'Ada' },
      null,
    );
  }

  const conBuzonInterno = () => buzonInterno(BUZON);

  async function barrer(): Promise<void> {
    await app.get(RemovalDeadlineSweepService).pasada();
  }

  beforeEach(() => {
    correos().sent.length = 0;
  });

  /*
   * ANOTAR NO RETIRA. Son dos acciones distintas a proposito: anotar una
   * peticion de hace tres dias para dejar constancia no puede despublicar
   * sin querer.
   */
  it('anotar la peticion arranca el reloj pero no despublica nada', async () => {
    const ficha = await crear(papel({ photoPaths: [FOTO] }));
    await publicarGaleria();

    const anotada = await pedirRetirada(ficha.body.id, haceDias(1));

    expect(anotada.status).toBe(201);
    expect(anotada.body.removalRequestedAt).toBe(haceDias(1));
    expect(anotada.body.revokedAt).toBeNull();
    expect((await leerPublica()).body.photos).toHaveLength(1);
  });

  it('no admite una fecha que no es una fecha', async () => {
    const ficha = await crear(papel());
    expect((await pedirRetirada(ficha.body.id, '20/10/2026')).status).toBe(400);
  });

  it('se puede anular si se anoto por error', async () => {
    const ficha = await crear(papel());
    await pedirRetirada(ficha.body.id, haceDias(1));

    const anulada = await anularPeticion(ficha.body.id);
    expect(anulada.body.removalRequestedAt).toBeNull();
  });

  /*
   * LA PRUEBA QUE JUSTIFICA LA ETAPA: hasta ahora, si nadie entraba al
   * panel, el plazo se incumplia en silencio.
   */
  it('el barrido avisa al buzon interno de lo que sigue pendiente', async () => {
    const ficha = await crear(papel());
    await pedirRetirada(ficha.body.id, haceDias(1));
    await conBuzonInterno();

    await barrer();

    expect(correos().sent).toHaveLength(1);
    expect(correos().sent[0]?.to).toBe(BUZON);
    expect(correos().sent[0]?.text).toContain('FT-2026-001');
  });

  /*
   * NI UN NOMBRE NI UNA DIRECCION EN EL CORREO. Es el canal menos controlado
   * que tiene el sistema: se reenvia, se queda en un movil y en un buzon
   * para siempre. Y lo que el permiso promete no exponer es justo eso.
   */
  it('y el correo no lleva el nombre del cliente ni su direccion', async () => {
    const ficha = await crear(papel());
    await pedirRetirada(ficha.body.id, haceDias(1));
    await conBuzonInterno();

    await barrer();

    const enviado = correos().sent[0];
    for (const cuerpo of [enviado?.text ?? '', enviado?.html ?? '', enviado?.subject ?? '']) {
      expect(cuerpo).not.toContain('Marta');
      expect(cuerpo).not.toContain('Evergreen');
    }
  });

  /*
   * UNA VEZ AL DIA Y NO EN CADA PASADA. El barrido corre cada hora; un aviso
   * que se repite cada hora es un aviso que se deja de leer.
   */
  it('no repite el aviso en la siguiente pasada del mismo dia', async () => {
    const ficha = await crear(papel());
    await pedirRetirada(ficha.body.id, haceDias(1));
    await conBuzonInterno();

    await barrer();
    await barrer();

    expect(correos().sent).toHaveLength(1);
  });

  it('retirarla la saca de los avisos', async () => {
    const ficha = await crear(papel());
    await pedirRetirada(ficha.body.id, haceDias(1));
    await conBuzonInterno();
    await revocar(ficha.body.id);

    await barrer();

    expect(correos().sent).toHaveLength(0);
  });

  it('sin peticiones abiertas no manda nada', async () => {
    await crear(papel());
    await conBuzonInterno();

    await barrer();

    expect(correos().sent).toHaveLength(0);
  });

  /*
   * EL ASUNTO DICE SI ALGO SE PASO. Es lo unico que se lee sin abrir el
   * correo, y la diferencia entre «hay trabajo» y «se esta incumpliendo una
   * promesa» tiene que verse desde la bandeja de entrada.
   */
  it('cuando el plazo se paso, el asunto lo dice', async () => {
    const ficha = await crear(papel());
    // Cinco dias de plazo pedidos hace diez: cinco de retraso.
    await pedirRetirada(ficha.body.id, haceDias(10));
    await conBuzonInterno();

    await barrer();

    expect(correos().sent[0]?.subject).toContain('fuera de plazo');
  });

  /*
   * SIN CANAL CONFIGURADO NO SE MARCA COMO AVISADA. Si se marcara, el dia
   * que alguien ponga un buzon el aviso ya no saldria: el sistema creeria
   * haberlo dado.
   */
  it('sin buzon ni chat, no se da por avisada', async () => {
    const ficha = await crear(papel());
    await pedirRetirada(ficha.body.id, haceDias(1));

    /*
     * SE QUITA A MANO. Los ajustes de avisos no se borran entre pruebas y el
     * servicio los cachea, asi que dar por hecho que estan vacios es dar por
     * hecho algo que no esta escrito en ninguna parte.
     */
    await buzonInterno(null);

    await barrer();
    expect(correos().sent).toHaveLength(0);

    await conBuzonInterno();
    await barrer();
    expect(correos().sent).toHaveLength(1);
  });
});

/* ------------------------------------------------------------------------ */

describe('el cliente retira sus fotos sin pedirle permiso a nadie', () => {
  const RUTA_PUBLICA_RETIRADA = '/api/v1/media-removal';
  const CORREO = 'marta@example.com';

  /*
   * ========================================================================
   * ESTE BLOQUE TIENE UN PRESUPUESTO DE CINCO LLAMADAS, Y LAS GASTA TODAS
   * ========================================================================
   * La ruta publica esta limitada a CINCO INTENTOS POR CUARTO DE HORA Y POR
   * IP, igual que la recuperacion de contrasena. No es por carga —esto se usa
   * tres veces al ano— sino porque un testigo es un secreto de 32 bytes y la
   * unica forma de atacarlo es probar muchos.
   *
   * Ese limite es lo que se quiere en produccion, asi que la prueba se adapta
   * a el y no al reves. Si hace falta comprobar algo mas, va DENTRO de una
   * de estas llamadas: una sexta no fallaria por lo que prueba, fallaria con
   * un 429 que manda a buscar el error donde no esta.
   */

  function correos(): LogEmailProvider {
    return app.get<LogEmailProvider>(EMAIL_PROVIDER);
  }

  /** La ficha con correo, y el testigo que saco el correo de constancia. */
  async function conEnlace(extra: Record<string, unknown> = {}) {
    correos().sent.length = 0;

    const ficha = await crear(papel({ customerEmail: CORREO, ...extra }));
    const constancia = correos().sent.find((mensaje) => mensaje.to === CORREO);

    const testigo = /#t=([A-Za-z0-9_-]{43})/.exec(constancia?.text ?? '')?.[1] ?? null;
    return { ficha, testigo };
  }

  async function retirar(token: unknown) {
    return request(app.getHttpServer()).post(RUTA_PUBLICA_RETIRADA).send({ token });
  }

  /*
   * LA PRUEBA QUE JUSTIFICA LA ETAPA, y lleva dentro todo lo que se puede
   * comprobar de una sola retirada: hasta aqui, retirar dependia SIEMPRE de
   * que alguien del equipo leyera un mensaje y pulsara un boton.
   */
  it('el enlace del correo despublica, avisa a la empresa y no filtra nada', async () => {
    const ajustes = app.get(NotificationSettingsService);
    const actuales = await ajustes.get();
    await ajustes.update(
      { ...actuales, internalEmail: 'operaciones@example.com' },
      { staffId: ADA, role: 'ADMIN', email: 'ada@example.com', firstName: 'Ada' },
      null,
    );

    const { ficha, testigo } = await conEnlace({ photoPaths: [FOTO] });
    await publicarGaleria();
    expect((await leerPublica()).body.photos).toHaveLength(1);

    expect(testigo).not.toBeNull();
    correos().sent.length = 0;

    const respuesta = await retirar(testigo);

    // --- Despublica al momento -------------------------------------------
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ done: true });
    expect((await leerPublica()).body.photos).toEqual([]);

    const lista = await listar();
    expect(lista.body.find((f: { id: string }) => f.id === ficha.body.id).revokedAt).not.toBeNull();

    /*
     * --- No devuelve nada de nadie ---------------------------------------
     * Quien llegue con un enlace filtrado puede despublicar —que es
     * reversible desde el panel— pero no puede averiguar de quien era.
     */
    expect(Object.keys(respuesta.body)).toEqual(['done']);

    /*
     * --- Queda como accion del CLIENTE -----------------------------------
     * Si quedara a nombre de quien anoto la ficha, el registro atribuiria a
     * una persona algo que no hizo.
     */
    const filas = await db.query<{
      actorType: string;
      surface: string;
      metadata: Record<string, unknown>;
    }>(
      `SELECT "actorType", surface, metadata FROM audit_logs
        WHERE action = 'media_consent.revoked'`,
    );

    expect(filas.rows[0]?.actorType).toBe('CUSTOMER');
    expect(filas.rows[0]?.surface).toBe('SITE');

    const metadata = JSON.stringify(filas.rows[0]?.metadata);
    expect(metadata).toContain('FT-2026-001');
    expect(metadata).not.toContain('Marta');
    expect(metadata).not.toContain('Evergreen');
    /* Y NUNCA EL TESTIGO: es una credencial. */
    expect(metadata).not.toContain(testigo);

    /*
     * --- La empresa se entera --------------------------------------------
     * Es la unica pega real de dejar que el cliente retire por su cuenta: la
     * portada deja de ensenar algo y nadie lo sabe hasta que mira.
     */
    const aviso = correos().sent.find((m) => m.to === 'operaciones@example.com');
    expect(aviso).toBeDefined();
    expect(aviso?.subject).toContain('FT-2026-001');
    expect(aviso?.text).not.toContain('Marta');
  });

  /*
   * EL TESTIGO SE GASTA. Un enlace que sigue sirviendo despues de usarse es
   * una credencial viva en un buzon para siempre.
   */
  it('el mismo enlace no sirve dos veces', async () => {
    const { testigo } = await conEnlace();

    expect((await retirar(testigo)).body).toEqual({ done: true });
    expect((await retirar(testigo)).body).toEqual({ done: false });
  });

  /*
   * UN TESTIGO FALSO Y UNO GASTADO RESPONDEN IGUAL, y los dos con 200.
   * Distinguirlos convertiria esta ruta en una forma de averiguar que
   * enlaces existieron; devolver 404 convertiria los registros del servidor
   * en un contador de aciertos.
   */
  it('un enlace que no existe responde lo mismo que uno gastado', async () => {
    const respuesta = await retirar('a'.repeat(43));

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ done: false });
  });

  /*
   * LO QUE NO TIENE NI FORMA DE ENLACE NI LLEGA A LA BASE. Es la primera
   * puerta: evita una consulta por cada cadena que alguien pegue.
   */
  it('algo que ni siquiera tiene forma de enlace se rechaza', async () => {
    expect((await retirar('corto')).status).toBe(400);
  });
});

/* ------------------------------------------------------------------------ */

describe('la constancia que recibe el cliente', () => {
  const CORREO = 'marta@example.com';

  function correos(): LogEmailProvider {
    return app.get<LogEmailProvider>(EMAIL_PROVIDER);
  }

  beforeEach(() => {
    correos().sent.length = 0;
  });

  /*
   * HASTA AHORA EL CLIENTE NO RECIBIA NADA. Ni que habia autorizado, ni que
   * podia retirarlo, ni como. Un permiso del que la persona no conserva
   * constancia solo tiene nuestra palabra detras.
   */
  it('se le manda al anotar la ficha, con su enlace', async () => {
    await crear(papel({ customerEmail: CORREO }));

    const constancia = correos().sent.find((m) => m.to === CORREO);
    expect(constancia).toBeDefined();
    expect(constancia?.text).toContain('https://freshnesstouch.example/retirar-fotos#t=');
    expect(constancia?.text).toContain('FT-2026-001');
  });

  /*
   * EN SU IDIOMA. Mandarle en un idioma que no lee un correo que habla de
   * publicar fotos de su casa es la peor version posible de este correo: ni
   * sirve de constancia ni se atreve a pulsar el boton.
   */
  it('en el idioma del cliente, no en el de quien la anota', async () => {
    await crear(papel({ customerEmail: CORREO, customerLocale: 'es' }));

    const constancia = correos().sent.find((m) => m.to === CORREO);
    expect(constancia?.subject).toBe('Constancia de su permiso de imagen');
  });

  it('sin correo no se manda nada, y la ficha vale igual', async () => {
    const ficha = await crear(papel());

    expect(ficha.status).toBe(201);
    expect(ficha.body.hasRemovalLink).toBe(false);
    expect(correos().sent).toHaveLength(0);
  });

  /*
   * EL RESUMEN NO SALE NUNCA HACIA EL PANEL. Una pantalla que lo recibiera
   * lo dejaria en la memoria del navegador y en cualquier extension.
   */
  it('el panel sabe que hay enlace, pero no cual', async () => {
    const ficha = await crear(papel({ customerEmail: CORREO }));

    expect(ficha.body.hasRemovalLink).toBe(true);
    expect(JSON.stringify(ficha.body)).not.toContain('removalTokenHash');
    expect(JSON.stringify(ficha.body)).not.toContain('#t=');
  });
});
