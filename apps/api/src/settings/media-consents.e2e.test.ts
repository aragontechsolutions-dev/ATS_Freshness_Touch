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
import { AUTH_PROVIDER } from '../auth/auth.types';
import type { LocalAuthProvider } from '../auth/providers/local-auth.provider';
import { GalleryService } from './gallery.service';
import { MediaConsentsService } from './media-consents.service';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-de-los-permisos';
  process.env.EMAIL_PROVIDER = 'log';
  process.env.REMINDER_SWEEP_MINUTES = '0';
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
