import { createServer, type Server } from 'node:http';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminStaffDirectorySchema } from '@freshness/types';
import { AppModule } from '../app.module';
import { AUTH_PROVIDER } from '../auth/auth.types';
import { EMAIL_PROVIDER } from '../notifications/notifications.types';
import type { LogEmailProvider } from '../notifications/providers/log-email.provider';
import type { LocalAuthProvider } from '../auth/providers/local-auth.provider';

/*
 * Los puertos van escritos tal cual dentro del bloque elevado: `vi.hoisted`
 * se ejecuta ANTES que las constantes del modulo, asi que una referencia a
 * ellas aqui falla. Y tiene que ir elevado porque la configuracion se congela
 * al importar el modulo de la aplicacion.
 */
const PUERTO_DB = 55458;
const PUERTO_SUPABASE = 55459;

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-de-personal';
  process.env.EMAIL_PROVIDER = 'log';
  process.env.REMINDER_SWEEP_MINUTES = '0';

  /*
   * El proveedor de invitaciones apunta a un servidor de mentira que se
   * levanta en esta misma prueba. Asi se recorre EL MISMO codigo que en
   * produccion —la peticion real, sus cabeceras, el analisis de la
   * respuesta— sin ninguna cuenta ni clave de verdad.
   *
   * Es tambien el motivo de que no exista un "proveedor simulado de
   * invitaciones": uno asi no probaria nada de lo que puede fallar, y en
   * cambio podria quedarse encendido en produccion.
   */
  process.env.SUPABASE_URL = 'http://127.0.0.1:55459';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-servicio-de-mentira';

  // Solo el limitador global. El de cotizaciones se queda en su valor real
  // como guardia de que el panel sigue exento: ver admin-throttling.test.ts.
  process.env.RATE_LIMIT_MAX = '2000';
});

/**
 * ALTA Y GESTION DE PERSONAL, CONTRA UNA BASE DE DATOS REAL
 * ---------------------------------------------------------
 * Lo que se prueba, por orden de importancia:
 *
 *   1. Que NO se pueda dejar el sistema sin administrador activo. Es la unica
 *      puerta de este panel que no se puede reabrir desde dentro.
 *   2. Que nadie se cierre la puerta a si mismo.
 *   3. Que dar de alta NO sea dar acceso.
 *   4. Que el directorio no filtre el identificador de la cuenta.
 */

const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');
const RUTA = '/api/v1/admin/staff-directory';

const ADMIN_AUTH = 'auth-admin-personal';
const ADMIN2_AUTH = 'auth-admin2-personal';
const DISPATCHER_AUTH = 'auth-dispatcher-personal';

const ADA = 'aaaa1111-1111-4111-8111-111111111111';
const BRUNO = 'bbbb2222-2222-4222-8222-222222222222';
const ADMIN2 = 'cccc3333-3333-4333-8333-333333333333';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;
let provider: LocalAuthProvider;
let correo: LogEmailProvider;
let supabase: Server;

/** Lo que recibio el servidor de mentira en la ultima invitacion. */
let recibido: { email: string | null; apikey: string | null; authorization: string | null };
/** Permite forzar que el proveedor rechace. */
let rechazarInvitaciones = false;

const comoAdmin = (): Promise<string> => provider.issue(ADMIN_AUTH, 'ada@example.com', 3600);
const comoAdmin2 = (): Promise<string> => provider.issue(ADMIN2_AUTH, 'alba@example.com', 3600);
const comoCoordinacion = (): Promise<string> =>
  provider.issue(DISPATCHER_AUTH, 'bruno@example.com', 3600);

const FICHA = {
  firstName: 'Cleo',
  lastName: 'Limpia',
  email: 'cleo@example.com',
  phone: '+14045550123',
  role: 'CLEANER',
  locale: 'es',
};

async function crear(ficha: Record<string, unknown> = FICHA, token?: string) {
  return request(app.getHttpServer())
    .post(RUTA)
    .set('authorization', `Bearer ${token ?? (await comoAdmin())}`)
    .send(ficha);
}

async function editar(staffId: string, ficha: Record<string, unknown>, token?: string) {
  return request(app.getHttpServer())
    .put(`${RUTA}/${staffId}`)
    .set('authorization', `Bearer ${token ?? (await comoAdmin())}`)
    .send(ficha);
}

async function invitar(staffId: string, token?: string) {
  return request(app.getHttpServer())
    .post(`${RUTA}/${staffId}/invite`)
    .set('authorization', `Bearer ${token ?? (await comoAdmin())}`);
}

async function directorio(token?: string) {
  return request(app.getHttpServer())
    .get(RUTA)
    .set('authorization', `Bearer ${token ?? (await comoAdmin())}`);
}

beforeAll(async () => {
  // --- Servidor de mentira que imita la API de administracion de Supabase ---
  supabase = createServer((peticion, respuesta) => {
    let cuerpo = '';
    peticion.on('data', (t) => (cuerpo += t));
    peticion.on('end', () => {
      recibido = {
        email: (JSON.parse(cuerpo || '{}') as { email?: string }).email ?? null,
        apikey: (peticion.headers.apikey as string) ?? null,
        authorization: peticion.headers.authorization ?? null,
      };

      if (rechazarInvitaciones) {
        respuesta.writeHead(422, { 'content-type': 'application/json' });
        respuesta.end(JSON.stringify({ msg: 'Signups not allowed for this instance' }));
        return;
      }

      respuesta.writeHead(200, { 'content-type': 'application/json' });
      respuesta.end(
        JSON.stringify({
          id: '99999999-9999-4999-8999-999999999999',
          email: recibido.email,
          // `generate_link` devuelve el enlace en vez de mandar el correo.
          action_link: 'https://panel.example.com/#access_token=t&refresh_token=r&type=invite',
        }),
      );
    });
  });
  await new Promise<void>((listo) => supabase.listen(PUERTO_SUPABASE, '127.0.0.1', listo));

  db = await PGlite.create();
  socket = new PGLiteSocketServer({ db, port: PUERTO_DB, host: '127.0.0.1', maxConnections: 10 });
  await socket.start();

  for (const migracion of readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, migracion.name, 'migration.sql'), 'utf8'));
  }

  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PUERTO_DB}/postgres`;

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
  await app.init();

  provider = app.get<LocalAuthProvider>(AUTH_PROVIDER);
  correo = app.get<LogEmailProvider>(EMAIL_PROVIDER);
}, 120_000);

afterAll(async () => {
  await app?.close();
  await socket?.stop();
  await db?.close();
  await new Promise<void>((listo) => supabase.close(() => listo()));
});

beforeEach(async () => {
  rechazarInvitaciones = false;
  correo.sent.length = 0;

  // Estado de partida: una administradora y coordinacion, nada mas.
  await db.exec(`
    DELETE FROM audit_logs;
    DELETE FROM staff;
    INSERT INTO staff (id, "authUserId", "firstName", "lastName", email, role, "isActive", "updatedAt")
    VALUES
      ('${ADA}', '${ADMIN_AUTH}', 'Ada', 'Jefa', 'ada@example.com', 'ADMIN', true, now()),
      ('${BRUNO}', '${DISPATCHER_AUTH}', 'Bruno', 'Agenda', 'bruno@example.com', 'DISPATCHER', true, now());
  `);
});

/* ======================================================================== */

describe('quien puede gestionar personal', () => {
  it('administracion ve el directorio', async () => {
    const respuesta = await directorio();

    expect(respuesta.status).toBe(200);
    expect(AdminStaffDirectorySchema.safeParse(respuesta.body).success).toBe(true);
  });

  /*
   * Coordinacion ya ve los NOMBRES de la plantilla en el selector de
   * asignacion. Lo que no debe ver es esta pantalla: aqui van el correo, el
   * telefono y —sobre todo— quien tiene acceso al panel, que es un mapa de
   * que cuentas existen para quien quiera colarse.
   */
  it('coordinacion no ve el directorio aunque tenga sesion valida', async () => {
    expect((await directorio(await comoCoordinacion())).status).toBe(403);
  });

  it('coordinacion no puede dar de alta', async () => {
    expect((await crear(FICHA, await comoCoordinacion())).status).toBe(403);
  });

  it('coordinacion no puede invitar', async () => {
    expect((await invitar(ADA, await comoCoordinacion())).status).toBe(403);
  });

  it('sin sesion no se llega a ningun sitio', async () => {
    expect((await request(app.getHttpServer()).get(RUTA)).status).toBe(401);
  });
});

describe('dar de alta', () => {
  it('crea la ficha activa', async () => {
    const respuesta = await crear();

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.firstName).toBe('Cleo');
    expect(respuesta.body.isActive).toBe(true);
  });

  /*
   * LA PRUEBA QUE SOSTIENE EL DISENO. Dar de alta NO es dar acceso. Si esto
   * se rompiera, cada alta de una limpiadora crearia una cuenta capaz de ver
   * los datos de todos los clientes.
   */
  it('nace SIN acceso al panel', async () => {
    const respuesta = await crear();

    expect(respuesta.body.access).toBe('NONE');
    expect(respuesta.body.invitedAt).toBeNull();
  });

  it('normaliza el correo', async () => {
    const respuesta = await crear({ ...FICHA, email: '  Cleo@Example.COM  ' });

    expect(respuesta.body.email).toBe('cleo@example.com');
  });

  it('rechaza un correo ya usado', async () => {
    await crear();
    const repetida = await crear({ ...FICHA, firstName: 'Otra' });

    expect(repetida.status).toBe(409);
    expect(repetida.body.code).toBe('STAFF_EMAIL_TAKEN');
  });

  it.each([
    ['sin nombre', { ...FICHA, firstName: '' }],
    ['con correo invalido', { ...FICHA, email: 'cleo' }],
    ['con telefono en otro formato', { ...FICHA, phone: '404-555-0123' }],
    ['con un puesto inventado', { ...FICHA, role: 'DUENO' }],
  ])('rechaza una ficha %s', async (_caso, ficha) => {
    expect((await crear(ficha)).status).toBe(400);
  });

  /*
   * El contrato es estricto: por esta puerta no puede entrar nada que
   * conceda acceso. Mandar `authUserId` en el alta seria vincular una ficha a
   * una cuenta cualquiera sin pasar por la invitacion.
   */
  it('rechaza que el alta traiga el identificador de una cuenta', async () => {
    const respuesta = await crear({ ...FICHA, authUserId: 'auth-colado' });

    expect(respuesta.status).toBe(400);
  });

  it('deja rastro en la auditoria', async () => {
    await crear();
    const registros = await db.query<{ action: string }>(
      `SELECT action FROM audit_logs WHERE action = 'staff.created'`,
    );

    expect(registros.rows).toHaveLength(1);
  });
});

describe('la guardia del ultimo administrador', () => {
  /*
   * ES LA UNICA PUERTA QUE NO SE PUEDE REABRIR DESDE DENTRO. Sin ningun
   * administrador activo nadie puede crear otro, y la unica salida seria
   * entrar a la base de datos a mano.
   *
   * SOLO SE ALCANZA EN CARRERA, y conviene entender por que. Quien pide el
   * cambio siempre es administracion activa, y no puede tocarse a si misma
   * (ver el bloque siguiente), asi que en una peticion suelta siempre queda
   * al menos ella. Lo que si puede pasar es que DOS administradoras se
   * degraden mutuamente a la vez: ninguna se toca a si misma, cada
   * transaccion ve a la otra todavia como administradora, y las dos se
   * confirman dejando el sistema sin ninguna.
   *
   * Por eso la guardia cuenta DESPUES de escribir y con las filas de
   * administracion bloqueadas: obliga a las dos peticiones a ponerse en fila.
   *
   * HAY TRES CAPAS y cual de ellas salta depende del instante:
   *
   *   1. El bloqueo pone las transacciones en fila.
   *   2. El recuento posterior a la escritura tumba la que dejaria cero.
   *   3. Y si la primera ya se confirmo, la segunda peticion ni llega: la
   *      comprobacion de rol relee la ficha en cada peticion y su autora ya
   *      no es administradora, asi que recibe un 403.
   *
   * La prueba NO fija cual salta —eso seria fijar una carrera, que es como
   * se escriben las pruebas que fallan un dia de cada veinte— sino la
   * propiedad que importa: una de las dos pasa, la otra no, y queda alguien
   * que pueda administrar.
   */
  it('dos administradoras que se degradan a la vez: una pasa y la otra no', async () => {
    await db.exec(`
      INSERT INTO staff (id, "authUserId", "firstName", "lastName", email, role, "isActive", "updatedAt")
      VALUES ('${ADMIN2}', '${ADMIN2_AUTH}', 'Alba', 'Dos', 'alba@example.com', 'ADMIN', true, now())
    `);

    // Los dos tokens ANTES de lanzar, para que las peticiones corran de verdad
    // a la vez y no se serialicen esperando a emitirlos.
    const tokenAda = await comoAdmin();
    const tokenAlba = await comoAdmin2();

    const [unaDegradaALaOtra, laOtraDegradaAUna] = await Promise.all([
      editar(
        ADMIN2,
        {
          firstName: 'Alba',
          lastName: 'Dos',
          email: 'alba@example.com',
          phone: null,
          role: 'CLEANER',
          locale: 'en',
          isActive: true,
        },
        tokenAda,
      ),
      editar(
        ADA,
        {
          firstName: 'Ada',
          lastName: 'Jefa',
          email: 'ada@example.com',
          phone: null,
          role: 'CLEANER',
          locale: 'en',
          isActive: true,
        },
        tokenAlba,
      ),
    ]);

    const estados = [unaDegradaALaOtra.status, laOtraDegradaAUna.status].sort((a, b) => a - b);
    expect(estados[0]).toBe(200);
    expect(estados[1]).toBeGreaterThanOrEqual(400);

    // Lo que de verdad importa: queda alguien que pueda administrar.
    const quedan = await db.query<{ total: bigint }>(
      `SELECT count(*)::int AS total FROM staff WHERE role = 'ADMIN' AND "isActive" = true`,
    );
    expect(Number(quedan.rows[0]?.total)).toBeGreaterThanOrEqual(1);
  });

  it('degradar a otra administradora si se permite mientras quede alguna', async () => {
    await db.exec(`
      INSERT INTO staff (id, "authUserId", "firstName", "lastName", email, role, "isActive", "updatedAt")
      VALUES ('${ADMIN2}', '${ADMIN2_AUTH}', 'Alba', 'Dos', 'alba@example.com', 'ADMIN', true, now())
    `);

    const respuesta = await editar(ADMIN2, {
      firstName: 'Alba',
      lastName: 'Dos',
      email: 'alba@example.com',
      phone: null,
      role: 'CLEANER',
      locale: 'en',
      isActive: true,
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.role).toBe('CLEANER');
  });

  it('un rechazo no deja el cambio a medias', async () => {
    await editar(ADA, {
      firstName: 'Cambiada',
      lastName: 'Jefa',
      email: 'ada@example.com',
      phone: null,
      role: 'DISPATCHER',
      locale: 'en',
      isActive: true,
    });

    const fila = await db.query<{ firstName: string; role: string }>(
      `SELECT "firstName", role FROM staff WHERE id = '${ADA}'`,
    );

    expect(fila.rows[0]?.role).toBe('ADMIN');
    expect(fila.rows[0]?.firstName).toBe('Ada');
  });
});

describe('nadie se cierra la puerta a si mismo', () => {
  it('no puede cambiarse el propio puesto', async () => {
    await db.exec(`
      INSERT INTO staff (id, "authUserId", "firstName", "lastName", email, role, "isActive", "updatedAt")
      VALUES ('${ADMIN2}', '${ADMIN2_AUTH}', 'Alba', 'Dos', 'alba@example.com', 'ADMIN', true, now())
    `);

    const respuesta = await editar(ADA, {
      firstName: 'Ada',
      lastName: 'Jefa',
      email: 'ada@example.com',
      phone: null,
      role: 'DISPATCHER',
      locale: 'en',
      isActive: true,
    });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.code).toBe('STAFF_SELF_CHANGE');
  });

  it('no puede darse de baja a si misma', async () => {
    await db.exec(`
      INSERT INTO staff (id, "authUserId", "firstName", "lastName", email, role, "isActive", "updatedAt")
      VALUES ('${ADMIN2}', '${ADMIN2_AUTH}', 'Alba', 'Dos', 'alba@example.com', 'ADMIN', true, now())
    `);

    const respuesta = await editar(ADA, {
      firstName: 'Ada',
      lastName: 'Jefa',
      email: 'ada@example.com',
      phone: null,
      role: 'ADMIN',
      locale: 'en',
      isActive: false,
    });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.code).toBe('STAFF_SELF_CHANGE');
  });

  /*
   * Lo que si puede: corregir su propio nombre o telefono. La guardia cierra
   * lo que te deja fuera, no la edicion de tu ficha.
   */
  it('si puede corregir su propio nombre y telefono', async () => {
    const respuesta = await editar(ADA, {
      firstName: 'Ada Maria',
      lastName: 'Jefa',
      email: 'ada@example.com',
      phone: '+14045559999',
      role: 'ADMIN',
      locale: 'en',
      isActive: true,
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.firstName).toBe('Ada Maria');
    expect(respuesta.body.phone).toBe('+14045559999');
  });
});

describe('dar de baja', () => {
  it('conserva la ficha y la marca inactiva', async () => {
    const creada = await crear();

    const baja = await editar(creada.body.staffId, {
      ...FICHA,
      isActive: false,
    });

    expect(baja.status).toBe(200);
    expect(baja.body.isActive).toBe(false);

    const filas = await db.query(`SELECT id FROM staff WHERE id = '${creada.body.staffId}'`);
    expect(filas.rows).toHaveLength(1);
  });

  /*
   * La baja cierra el acceso EN LA SIGUIENTE PETICION, sin esperar a que
   * caduque ningun token: la sesion comprueba `isActive` cada vez.
   */
  it('quien causa baja deja de entrar al panel de inmediato', async () => {
    const token = await comoCoordinacion();
    expect(
      (await request(app.getHttpServer()).get(RUTA).set('authorization', `Bearer ${token}`)).status,
    ).toBe(403);

    await editar(BRUNO, {
      firstName: 'Bruno',
      lastName: 'Agenda',
      email: 'bruno@example.com',
      phone: null,
      role: 'DISPATCHER',
      locale: 'en',
      isActive: false,
    });

    const sesion = await request(app.getHttpServer())
      .get('/api/v1/admin/session')
      .set('authorization', `Bearer ${token}`);

    expect(sesion.status).toBe(403);
  });
});

describe('invitar al panel', () => {
  it('manda la invitacion y vincula la cuenta', async () => {
    const creada = await crear();
    const respuesta = await invitar(creada.body.staffId);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.access).toBe('INVITED');
    expect(respuesta.body.invitedAt).not.toBeNull();
    expect(recibido.email).toBe('cleo@example.com');
  });

  it('manda la clave de servicio en las dos cabeceras que exige el proveedor', async () => {
    const creada = await crear();
    await invitar(creada.body.staffId);

    expect(recibido.apikey).toBe('clave-de-servicio-de-mentira');
    expect(recibido.authorization).toBe('Bearer clave-de-servicio-de-mentira');
  });

  it('guarda el identificador de la cuenta en la ficha', async () => {
    const creada = await crear();
    await invitar(creada.body.staffId);

    const fila = await db.query<{ authUserId: string }>(
      `SELECT "authUserId" FROM staff WHERE id = '${creada.body.staffId}'`,
    );

    expect(fila.rows[0]?.authUserId).toBe('99999999-9999-4999-8999-999999999999');
  });

  it('no invita dos veces: crearia una segunda cuenta', async () => {
    const creada = await crear();
    await invitar(creada.body.staffId);
    const segunda = await invitar(creada.body.staffId);

    expect(segunda.status).toBe(409);
    expect(segunda.body.code).toBe('STAFF_ALREADY_INVITED');
  });

  it('no invita a quien esta de baja', async () => {
    const creada = await crear();
    await editar(creada.body.staffId, { ...FICHA, isActive: false });

    expect((await invitar(creada.body.staffId)).status).toBe(400);
  });

  /*
   * EL ORDEN IMPORTA: si el proveedor rechaza, la ficha NO puede quedar
   * marcada como invitada. Lo contrario dejaria a quien administra creyendo
   * que dio acceso a alguien que no lo tiene.
   */
  it('si el proveedor rechaza, la ficha se queda sin acceso', async () => {
    const creada = await crear();
    rechazarInvitaciones = true;

    const respuesta = await invitar(creada.body.staffId);

    expect(respuesta.status).toBe(503);
    expect(respuesta.body.code).toBe('STAFF_INVITE_FAILED');
    // El motivo del proveedor llega para poder arreglarlo sin adivinar.
    expect(respuesta.body.fields?.[0]?.message).toContain('Signups not allowed');

    const fila = await db.query<{ authUserId: string | null; invitedAt: Date | null }>(
      `SELECT "authUserId", "invitedAt" FROM staff WHERE id = '${creada.body.staffId}'`,
    );

    expect(fila.rows[0]?.authUserId).toBeNull();
    expect(fila.rows[0]?.invitedAt).toBeNull();
  });

  it('deja rastro en la auditoria sin guardar el identificador de la cuenta', async () => {
    const creada = await crear();
    await invitar(creada.body.staffId);

    const registros = await db.query<{ metadata: Record<string, unknown> }>(
      `SELECT metadata FROM audit_logs WHERE action = 'staff.invited'`,
    );

    expect(registros.rows).toHaveLength(1);
    expect(JSON.stringify(registros.rows[0]?.metadata)).not.toContain('99999999');
  });
});

describe('el correo de invitacion es nuestro, no el del proveedor', () => {
  /*
   * LA PRUEBA QUE JUSTIFICA EL CAMBIO. Antes el proveedor mandaba su propia
   * plantilla: una sola para todo el mundo y en un solo idioma. Ahora el
   * enlace se genera sin correo y el correo sale de aqui.
   */
  it('sale un correo nuestro con el enlace dentro', async () => {
    const creada = await crear();
    await invitar(creada.body.staffId);

    expect(correo.sent).toHaveLength(1);
    expect(correo.sent[0]?.to).toBe('cleo@example.com');
    expect(correo.sent[0]?.html).toContain('access_token');
    expect(correo.sent[0]?.text).toContain('access_token');
  });

  it('va en el idioma de la persona', async () => {
    // La ficha de prueba se da de alta en espanol.
    const creada = await crear();
    await invitar(creada.body.staffId);

    expect(correo.sent[0]?.subject).toContain('bienvenida');
  });

  it('y en ingles cuando esa es su ficha', async () => {
    const creada = await crear({ ...FICHA, email: 'otra@example.com', locale: 'en' });
    await invitar(creada.body.staffId);

    expect(correo.sent[0]?.subject).toContain('Welcome');
  });

  /*
   * No existe tal cosa como una contrasena inicial en este sistema: la
   * persona elige la suya al abrir el enlace. Si algun dia alguien anadiera
   * una, este correo es donde acabaria, y se quedaria para siempre en un
   * buzon.
   */
  it('no lleva ninguna contrasena dentro', async () => {
    const creada = await crear();
    await invitar(creada.body.staffId);

    const cuerpo = `${correo.sent[0]?.text ?? ''} ${correo.sent[0]?.html ?? ''}`.toLowerCase();
    expect(cuerpo).not.toContain('contrase\u00f1a inicial');
    expect(cuerpo).not.toContain('temporary password');
  });
});

describe('cuando el correo no sale', () => {
  /*
   * EL CASO QUE HABRIA DEJADO A ALGUIEN SIN PODER ENTRAR NUNCA.
   *
   * La cuenta ya existe en el proveedor en cuanto se genera el enlace. Si no
   * se guardara el vinculo, esa ficha quedaria imposible de invitar de nuevo
   * —el proveedor rechaza el correo repetido— y sin nada que lo indicara.
   *
   * Guardandolo, esa persona todavia puede entrar por "he olvidado mi
   * contrasena", y el error lo dice con esas palabras.
   */
  it('la cuenta queda vinculada para que pueda entrar por recuperacion', async () => {
    const creada = await crear();
    vi.spyOn(correo, 'send').mockResolvedValueOnce({
      ok: false,
      providerMessageId: null,
      failureReason: 'dominio no verificado',
    });

    const respuesta = await invitar(creada.body.staffId);

    expect(respuesta.status).toBe(503);
    expect(respuesta.body.code).toBe('STAFF_INVITE_FAILED');

    const fila = await db.query<{ authUserId: string | null; invitedAt: Date | null }>(
      `SELECT "authUserId", "invitedAt" FROM staff WHERE id = '${creada.body.staffId}'`,
    );

    // Vinculada, para que la recuperacion funcione...
    expect(fila.rows[0]?.authUserId).not.toBeNull();
    // ...pero NO marcada como invitada: el correo no salio.
    expect(fila.rows[0]?.invitedAt).toBeNull();
  });
});

describe('privacidad del directorio', () => {
  /*
   * El identificador de la cuenta no le sirve al panel para pintar nada y en
   * cambio ayuda a quien quiera suplantar a alguien. Se traduce a un estado
   * antes de salir.
   */
  it('nunca sale el identificador de la cuenta', async () => {
    const creada = await crear();
    await invitar(creada.body.staffId);

    const respuesta = await directorio();

    expect(JSON.stringify(respuesta.body)).not.toContain('99999999');
    expect(JSON.stringify(respuesta.body)).not.toContain('authUserId');
  });

  it('el contrato es estricto, asi que un campo de mas se veria', async () => {
    const respuesta = await directorio();

    expect(AdminStaffDirectorySchema.safeParse(respuesta.body).success).toBe(true);
  });

  it('dice que este despliegue puede invitar', async () => {
    expect((await directorio()).body.canInvite).toBe(true);
  });
});
