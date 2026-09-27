import { createServer, type Server } from 'node:http';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import { getStorageToken, type ThrottlerStorageService } from '@nestjs/throttler';
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
let limitador: ThrottlerStorageService;

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

/**
 * Pedir un enlace para volver a entrar. SIN CABECERA DE SESION a proposito:
 * es publico porque quien lo usa es justamente quien no puede entrar.
 */
async function recuperar(email: string) {
  return request(app.getHttpServer()).post('/api/v1/password-recovery').send({ email });
}

async function directorio(token?: string) {
  return request(app.getHttpServer())
    .get(RUTA)
    .set('authorization', `Bearer ${token ?? (await comoAdmin())}`);
}

/**
 * Las cuentas que «existen» en el proveedor de mentira.
 *
 * Un correo siempre devuelve el mismo identificador, igual que el proveedor
 * real: invitar dos veces al mismo correo NO crea dos cuentas.
 */
const cuentaDe = (email: string): string => {
  const existente = [...correoDeCuenta].find(([, valor]) => valor === email)?.[0];
  if (existente) return existente;

  const id = `abcd0000-0000-4000-8000-${String(correoDeCuenta.size + 1).padStart(12, '0')}`;
  correoDeCuenta.set(id, email);
  return id;
};

const correoDeCuenta = new Map<string, string>();
/** Cuentas cuyo titular ya inicio sesion alguna vez. */
const yaEntraron = new Set<string>();
/** Si ese correo tiene ya cuenta en el proveedor de mentira. */
const cuentaExiste = (email: string): boolean => [...correoDeCuenta.values()].includes(email);
/** Los tipos de enlace que se le han pedido al proveedor, en orden. */
const tiposPedidos: string[] = [];

beforeAll(async () => {
  // --- Servidor de mentira que imita la API de administracion de Supabase ---
  supabase = createServer((peticion, respuesta) => {
    let cuerpo = '';
    peticion.on('data', (t) => (cuerpo += t));
    peticion.on('end', () => {
      const json = (): void => respuesta.writeHead(200, { 'content-type': 'application/json' });

      /*
       * CONSULTA DE UNA CUENTA: `GET /auth/v1/admin/users/{id}`.
       *
       * Es lo que permite distinguir «invitada y nunca entro» de «ya entra»,
       * que en nuestra tabla se ven igual. `last_sign_in_at` solo aparece
       * cuando la prueba lo pide.
       */
      const usuario = /\/auth\/v1\/admin\/users\/(.+)$/.exec(peticion.url ?? '');
      if (peticion.method === 'GET' && usuario) {
        const id = decodeURIComponent(usuario[1] ?? '');
        const email = correoDeCuenta.get(id);

        if (!email) {
          respuesta.writeHead(404, { 'content-type': 'application/json' });
          respuesta.end(JSON.stringify({ msg: 'User not found' }));
          return;
        }

        json();
        respuesta.end(
          JSON.stringify({
            id,
            email,
            ...(yaEntraron.has(id) ? { last_sign_in_at: '2026-09-01T10:00:00Z' } : {}),
          }),
        );
        return;
      }

      const pedido = JSON.parse(cuerpo || '{}') as { email?: string; type?: string };
      recibido = {
        email: pedido.email ?? null,
        apikey: (peticion.headers.apikey as string) ?? null,
        authorization: peticion.headers.authorization ?? null,
      };
      tiposPedidos.push(pedido.type ?? '');

      /*
       * `recovery` SOLO FUNCIONA SOBRE UNA CUENTA QUE YA EXISTE, igual que
       * en el proveedor real. Es la diferencia que obliga a la recuperacion
       * a tener red de seguridad: quien nunca abrio su invitacion no tiene
       * cuenta confirmada, y para esa persona el unico enlace posible es
       * uno de invitacion. Si el doble aceptara los dos tipos siempre, esa
       * rama no se probaria nunca.
       */
      if (pedido.type === 'recovery' && !cuentaExiste(pedido.email ?? '')) {
        respuesta.writeHead(404, { 'content-type': 'application/json' });
        respuesta.end(JSON.stringify({ msg: 'User not found' }));
        return;
      }

      if (rechazarInvitaciones) {
        respuesta.writeHead(422, { 'content-type': 'application/json' });
        respuesta.end(JSON.stringify({ msg: 'Signups not allowed for this instance' }));
        return;
      }

      /*
       * EL IDENTIFICADOR SE DERIVA DEL CORREO, como en el proveedor real.
       *
       * Importa mucho para que estas pruebas signifiquen algo: pedir
       * invitacion para un correo que YA tiene cuenta no crea una segunda,
       * devuelve la que hay. Un identificador fijo lo escondia; uno aleatorio
       * fingiria que cada invitacion crea una cuenta nueva. Ninguno de los
       * dos habria destapado el choque que rompio produccion.
       */
      const email = recibido.email ?? '';
      const id = cuentaDe(email);

      json();
      respuesta.end(
        JSON.stringify({
          id,
          email,
          /*
           * `generate_link` devuelve el enlace en vez de mandar el correo, y
           * lo devuelve CON LOS TOKENS EN EL FRAGMENTO. Es justamente lo que
           * hace que funcione abrirlo en otro navegador: no hay verificador
           * que tenga que estar guardado en ningun sitio.
           */
          action_link: `https://panel.example.com/#access_token=t&refresh_token=r&type=${pedido.type ?? 'invite'}`,
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
  limitador = app.get<ThrottlerStorageService>(getStorageToken());
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
  correoDeCuenta.clear();
  yaEntraron.clear();
  tiposPedidos.length = 0;
  /*
   * EL LIMITADOR SE VACIA ENTRE PRUEBAS. El de recuperacion es de cinco
   * peticiones cada cuarto de hora —a proposito, cada una manda un correo a
   * una persona real— y su contador sobrevive de una prueba a la siguiente.
   * Sin esto, la sexta prueba del bloque falla con un 429 que no tiene nada
   * que ver con lo que esa prueba comprueba.
   */
  limitador.storage.clear();

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

    expect(fila.rows[0]?.authUserId).toBeTruthy();
  });

  /*
   * EL CASO QUE COSTO UN INCIDENTE EN PRODUCCION.
   *
   * El enlace de invitacion caduca. Antes, a quien no lo abria a tiempo se
   * le quedaba una ficha que decia «invitada» y una puerta cerrada, sin
   * ninguna salida desde el panel: volver a pulsar respondia «ya esta
   * invitada» para siempre.
   */
  it('reenvia la invitacion a quien nunca llego a entrar', async () => {
    const creada = await crear();
    await invitar(creada.body.staffId);
    correo.sent.length = 0;

    const segunda = await invitar(creada.body.staffId);

    expect(segunda.status).toBe(200);
    expect(segunda.body.access).toBe('INVITED');
    // Salio un correo nuevo, que es el punto de reenviar.
    expect(correo.sent).toHaveLength(1);
  });

  it('el reenvio queda registrado como tal, no como una primera invitacion', async () => {
    const creada = await crear();
    await invitar(creada.body.staffId);
    await invitar(creada.body.staffId);

    const acciones = await db.query<{ action: string }>(
      `SELECT action FROM audit_logs WHERE action LIKE 'staff.%invited%' OR action = 'staff.reinvited' ORDER BY "createdAt"`,
    );

    expect(acciones.rows.map((f) => f.action)).toEqual(['staff.invited', 'staff.reinvited']);
  });

  /*
   * Reenviar a quien YA entra no procede: no es una invitacion pendiente,
   * es una contrasena que se le olvido, y eso lo resuelve ella sola desde
   * «he olvidado mi contrasena» sin depender de nadie.
   */
  it('no reenvia a quien ya entra con normalidad', async () => {
    const creada = await crear();
    await invitar(creada.body.staffId);

    const fila = await db.query<{ authUserId: string }>(
      `SELECT "authUserId" FROM staff WHERE id = '${creada.body.staffId}'`,
    );
    yaEntraron.add(fila.rows[0]!.authUserId);

    const segunda = await invitar(creada.body.staffId);

    expect(segunda.status).toBe(409);
    expect(segunda.body.code).toBe('STAFF_ALREADY_INVITED');
  });

  /*
   * EL 500 QUE ROMPIO PRODUCCION, REPRODUCIDO PASO A PASO.
   *
   * Se invita a alguien; se le corrige despues el correo en su ficha (lo
   * cual NO cambia su cuenta); se da de alta a la misma persona con el
   * correo original; y se la invita. El proveedor devuelve la cuenta que ya
   * existe, que pertenece a la primera ficha.
   *
   * Antes esto reventaba con «Unique constraint failed on
   * staff_authUserId_key» y un 500 sin explicacion.
   */
  it('dice de quien es la cuenta en vez de reventar con un 500', async () => {
    const primera = await crear();
    await invitar(primera.body.staffId);
    await editar(primera.body.staffId, {
      ...FICHA,
      isActive: true,
      email: 'cleo.nueva@example.com',
    });

    const segunda = await crear({ ...FICHA, firstName: 'Cleo (duplicada)' });
    const respuesta = await invitar(segunda.body.staffId);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.code).toBe('STAFF_ACCOUNT_TAKEN');
    // Dice CUAL es la otra ficha: sin eso no hay forma de deshacer el lio.
    expect(JSON.stringify(respuesta.body.fields)).toContain('cleo.nueva@example.com');
  });

  /*
   * EL AVISO QUE HABRIA EVITADO TODO. Tras cambiar el correo de contacto, la
   * ficha tiene que decir con cual se entra de verdad.
   */
  it('avisa con que correo entra cuando ya no es el de contacto', async () => {
    const creada = await crear();
    await invitar(creada.body.staffId);
    const editada = await editar(creada.body.staffId, {
      ...FICHA,
      isActive: true,
      email: 'otro@example.com',
    });

    expect(editada.body.signInEmail).toBe('cleo@example.com');
  });

  it('no avisa de nada cuando los dos correos coinciden', async () => {
    const creada = await crear();
    const invitada = await invitar(creada.body.staffId);

    expect(invitada.body.signInEmail).toBeNull();
  });

  /*
   * El reenvio va al correo de la CUENTA, no al de la ficha. Mandarlo al de
   * contacto crearia una segunda cuenta y cambiaria en silencio con que
   * correo entra esa persona.
   */
  it('el reenvio va al correo con el que se creo la cuenta', async () => {
    const creada = await crear();
    await invitar(creada.body.staffId);
    await editar(creada.body.staffId, {
      ...FICHA,
      isActive: true,
      email: 'otro@example.com',
    });

    await invitar(creada.body.staffId);

    expect(recibido.email).toBe('cleo@example.com');
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

/* ======================================================================== */

describe('volver a entrar cuando se perdio la contrasena', () => {
  /*
   * ESTE ES EL CAMINO QUE ESTABA ROTO Y QUE DEJO A UNA PERSONA FUERA.
   *
   * El correo lo mandaba Supabase y el enlace se generaba en el NAVEGADOR,
   * que guardaba un verificador en su propia pestana y lo exigia al
   * canjearlo. Como el enlace llega por correo y un correo se abre siempre
   * en otra pestana, el verificador nunca estaba y el canje fallaba
   * SIEMPRE. La pantalla decia «enlace caducado» sobre un enlace recien
   * generado.
   *
   * Ahora lo genera el servidor. Lo que estas pruebas vigilan, por orden de
   * importancia, es que el enlace salga de verdad y que la respuesta no
   * cuente nunca nada.
   */

  /** Espera a que el trabajo de fondo termine: se responde sin esperarlo. */
  const asentarse = async (): Promise<void> => {
    await new Promise((listo) => setTimeout(listo, 150));
  };

  async function personaConAcceso(): Promise<string> {
    const creada = await crear();
    await invitar(creada.body.staffId);
    correo.sent.length = 0;
    tiposPedidos.length = 0;
    /*
     * EL LIMITADOR SE VACIA ENTRE PRUEBAS. El de recuperacion es de cinco
     * peticiones cada cuarto de hora —a proposito, cada una manda un correo a
     * una persona real— y su contador sobrevive de una prueba a la siguiente.
     * Sin esto, la sexta prueba del bloque falla con un 429 que no tiene nada
     * que ver con lo que esa prueba comprueba.
     */
    limitador.storage.clear();
    return creada.body.staffId as string;
  }

  it('manda el enlace a quien tiene acceso', async () => {
    await personaConAcceso();

    const respuesta = await recuperar('cleo@example.com');
    await asentarse();

    expect(respuesta.status).toBe(202);
    expect(correo.sent).toHaveLength(1);
    expect(correo.sent[0]?.to).toBe('cleo@example.com');
  });

  it('el enlace vuelve con la sesion en el fragmento, no con un codigo que canjear', async () => {
    await personaConAcceso();

    await recuperar('cleo@example.com');
    await asentarse();

    /*
     * LA COMPROBACION QUE HABRIA EVITADO EL INCIDENTE. Un enlace con `?code=`
     * exige un verificador guardado en el navegador que lo pidio; uno con
     * `#access_token=` no exige nada y funciona se abra donde se abra.
     */
    expect(correo.sent[0]?.text).toContain('#access_token=');
    expect(correo.sent[0]?.text).not.toContain('?code=');
  });

  it('pide un enlace de recuperacion, no de invitacion', async () => {
    await personaConAcceso();

    await recuperar('cleo@example.com');
    await asentarse();

    expect(tiposPedidos).toEqual(['recovery']);
  });

  it('cae a un enlace de invitacion si la cuenta nunca se confirmo', async () => {
    /*
     * El caso real: se la invito, no abrio el enlace a tiempo y se le
     * caduco. Para el proveedor esa cuenta no admite recuperacion. Sin esta
     * red de seguridad, la unica salida que le queda a esa persona tampoco
     * funcionaria.
     */
    const creada = await crear();
    await invitar(creada.body.staffId);
    correo.sent.length = 0;
    tiposPedidos.length = 0;
    /*
     * EL LIMITADOR SE VACIA ENTRE PRUEBAS. El de recuperacion es de cinco
     * peticiones cada cuarto de hora —a proposito, cada una manda un correo a
     * una persona real— y su contador sobrevive de una prueba a la siguiente.
     * Sin esto, la sexta prueba del bloque falla con un 429 que no tiene nada
     * que ver con lo que esa prueba comprueba.
     */
    limitador.storage.clear();

    // Se olvida la cuenta en el proveedor: recovery respondera 404.
    correoDeCuenta.clear();

    await recuperar('cleo@example.com');
    await asentarse();

    expect(tiposPedidos).toEqual(['recovery', 'invite']);
    expect(correo.sent).toHaveLength(1);
  });

  it('responde igual para un correo que no existe, y no manda nada', async () => {
    const respuesta = await recuperar('nadie@example.com');
    await asentarse();

    expect(respuesta.status).toBe(202);
    expect(respuesta.body).toEqual({});
    expect(correo.sent).toHaveLength(0);
  });

  it('responde igual para quien causo baja, y no manda nada', async () => {
    const staffId = await personaConAcceso();
    await editar(staffId, { ...FICHA, isActive: false });

    const respuesta = await recuperar('cleo@example.com');
    await asentarse();

    expect(respuesta.status).toBe(202);
    expect(correo.sent).toHaveLength(0);
  });

  it('responde igual para una ficha que nunca fue invitada, y no manda nada', async () => {
    await crear();

    const respuesta = await recuperar('cleo@example.com');
    await asentarse();

    expect(respuesta.status).toBe(202);
    expect(correo.sent).toHaveLength(0);
  });

  it('encuentra a quien cambio su correo de contacto despues de invitar', async () => {
    /*
     * Tras editar el correo de contacto, la cuenta sigue respondiendo al
     * antiguo. Buscar solo por el de contacto dejaria fuera exactamente a
     * quien mas probablemente esta perdida.
     */
    const staffId = await personaConAcceso();
    await editar(staffId, { ...FICHA, email: 'cleo.nueva@example.com', isActive: true });

    await recuperar('cleo@example.com');
    await asentarse();

    expect(correo.sent).toHaveLength(1);
    // Y va al correo DE LA CUENTA, no al de contacto recien cambiado.
    expect(correo.sent[0]?.to).toBe('cleo@example.com');
  });

  it('da igual como se escriban las mayusculas', async () => {
    await personaConAcceso();

    await recuperar('  CLEO@Example.com  ');
    await asentarse();

    expect(correo.sent).toHaveLength(1);
  });

  it('el correo no lleva ninguna contrasena', async () => {
    await personaConAcceso();

    await recuperar('cleo@example.com');
    await asentarse();

    const cuerpo = `${correo.sent[0]?.text ?? ''}${correo.sent[0]?.html ?? ''}`.toLowerCase();
    expect(cuerpo).not.toContain('contraseña temporal');
    expect(cuerpo).not.toContain('temporary password');
  });

  it('deja rastro en la auditoria solo cuando el correo sale', async () => {
    await personaConAcceso();

    await recuperar('nadie@example.com');
    await asentarse();

    const sinFila = await db.query<{ count: string }>(
      `SELECT count(*)::text FROM audit_logs WHERE action = 'staff.recovery_sent'`,
    );
    /*
     * Registrar tambien los intentos fallidos convertiria la auditoria en la
     * lista ordenada por hora de las direcciones que alguien fue probando.
     */
    expect(sinFila.rows[0]?.count).toBe('0');

    await recuperar('cleo@example.com');
    await asentarse();

    const conFila = await db.query<{ count: string; metadata: unknown }>(
      `SELECT count(*)::text, max(metadata::text) AS metadata
         FROM audit_logs WHERE action = 'staff.recovery_sent'`,
    );
    expect(conFila.rows[0]?.count).toBe('1');
    // Y nunca el enlace: es una credencial de un solo uso.
    expect(String(conFila.rows[0]?.metadata)).not.toContain('access_token');
  });

  it('corta a la sexta peticion desde la misma conexion', async () => {
    /*
     * Cada peticion manda un correo a una persona real. Sin tope, esta API
     * es una forma gratuita de inundar el buzon de alguien y de gastar la
     * cuota de envio de la empresa por el camino.
     *
     * El limite se cuenta por IP y NO por correo: contarlo por correo
     * dejaria que una sola conexion recorriera la plantilla entera a razon
     * de cinco correos por persona.
     */
    await personaConAcceso();

    const estados: number[] = [];
    for (let intento = 0; intento < 6; intento += 1) {
      estados.push((await recuperar('cleo@example.com')).status);
    }
    await asentarse();

    expect(estados).toEqual([202, 202, 202, 202, 202, 429]);
  });

  it('el contrato es estricto: no se puede elegir a donde vuelve el enlace', async () => {
    /*
     * Si el destino viajara en la peticion, cualquiera podria pedir un
     * enlace para el correo de otra persona apuntando a un sitio propio: le
     * llegaria a su buzon legitimo y, al abrirlo, entregaria la sesion.
     */
    await personaConAcceso();

    const respuesta = await request(app.getHttpServer())
      .post('/api/v1/password-recovery')
      .send({ email: 'cleo@example.com', redirectTo: 'https://sitio-del-atacante.example' });
    await asentarse();

    expect(respuesta.status).toBe(400);
    expect(correo.sent).toHaveLength(0);
  });
});
