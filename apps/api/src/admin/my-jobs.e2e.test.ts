import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MyJobsSchema } from '@freshness/types';
import { AppModule } from '../app.module';
import { AUTH_PROVIDER } from '../auth/auth.types';
import type { LocalAuthProvider } from '../auth/providers/local-auth.provider';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-de-mis-trabajos';
  process.env.EMAIL_PROVIDER = 'log';
  process.env.REMINDER_SWEEP_MINUTES = '0';
  process.env.RATE_LIMIT_MAX = '2000';
});

/**
 * MIS TRABAJOS, CONTRA UNA BASE DE DATOS REAL
 * -------------------------------------------
 * Lo que se prueba, por orden de importancia:
 *
 *   1. Que NO se vean los trabajos de otra persona. Es la unica garantia que
 *      sostiene toda la pantalla.
 *   2. Que NO salga ningun importe. Quien limpia no factura.
 *   3. Que solo se pueda marcar empezado y terminado, y solo en lo propio.
 */

const PUERTO = 55464;
const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');
const RUTA = '/api/v1/admin/my-jobs';

const CLEO_AUTH = 'auth-cleo-mis-trabajos';
const DARIO_AUTH = 'auth-dario-mis-trabajos';
const ADA_AUTH = 'auth-ada-mis-trabajos';

const CLEO = 'ccc11111-1111-4111-8111-111111111111';
const DARIO = 'ddd22222-2222-4222-8222-222222222222';
const ADA = 'aaa33333-3333-4333-8333-333333333333';

const CUSTOMER = 'c0000000-0000-4000-8000-000000000001';
const ADDRESS = 'a0000000-0000-4000-8000-000000000001';

/** De Cleo; de Dario; y una cancelada de Cleo. */
const DE_CLEO = '10000000-0000-4000-8000-000000000001';
const DE_DARIO = '20000000-0000-4000-8000-000000000002';
const CANCELADA = '30000000-0000-4000-8000-000000000003';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;
let provider: LocalAuthProvider;

const comoCleo = (): Promise<string> => provider.issue(CLEO_AUTH, 'cleo@example.com', 3600);
const comoDario = (): Promise<string> => provider.issue(DARIO_AUTH, 'dario@example.com', 3600);
const comoAda = (): Promise<string> => provider.issue(ADA_AUTH, 'ada@example.com', 3600);

async function misTrabajos(token?: string) {
  return request(app.getHttpServer())
    .get(RUTA)
    .set('authorization', `Bearer ${token ?? (await comoCleo())}`);
}

async function marcar(
  bookingId: string,
  status: string,
  token?: string,
  resto: Record<string, unknown> = {},
) {
  return request(app.getHttpServer())
    .patch(`${RUTA}/${bookingId}/progress`)
    .set('authorization', `Bearer ${token ?? (await comoCleo())}`)
    .send({ status, ...resto });
}

/** La casa de estas pruebas: centro de Atlanta. */
const CASA = { latitude: 33.749, longitude: -84.388 };

/** En la puerta de la casa, con un GPS decente. */
const EN_LA_PUERTA = { latitude: 33.7491, longitude: -84.3881, accuracyMeters: 12 };

/** Marietta: a unos 25 km. El «fiche desde mi casa» del enunciado. */
const EN_SU_CASA = { latitude: 33.9526, longitude: -84.5499, accuracyMeters: 18 };

/** Le da coordenadas a la casa de las pruebas. */
async function geocodificarLaCasa() {
  await db.exec(`
    UPDATE addresses
       SET latitude = ${CASA.latitude}, longitude = ${CASA.longitude},
           "geocodePrecision" = 'INTERPOLATED', "geocodeProvider" = 'census',
           "geocodedAt" = now()
     WHERE id = '${ADDRESS}';
  `);
}

/** Se la quita, que es el estado de una casa recien reservada. */
async function casaSinCoordenadas() {
  await db.exec(
    `UPDATE addresses SET latitude = NULL, longitude = NULL, "geocodedAt" = NULL
      WHERE id = '${ADDRESS}';`,
  );
}

interface FilaFichaje {
  kind: string;
  locationState: string;
  distanceMeters: number | null;
  accuracyMeters: number | null;
}

async function fichajes(bookingId: string): Promise<FilaFichaje[]> {
  const filas = await db.query<FilaFichaje>(
    `SELECT kind, "locationState", "distanceMeters", "accuracyMeters"
       FROM booking_clock_ins WHERE "bookingId" = '${bookingId}' ORDER BY "occurredAt"`,
  );
  return filas.rows;
}

/** Una reserva dentro de la ventana que mira la pantalla. */
async function sembrarReserva(id: string, referencia: string, horas: number, status = 'CONFIRMED') {
  const inicio = new Date(Date.now() + horas * 3_600_000);
  const fin = new Date(inicio.getTime() + 2 * 3_600_000);

  await db.query(
    `INSERT INTO bookings (
       id, reference, "customerId", "addressId", service, frequency,
       bedrooms, bathrooms, "squareFeet", "scheduledStart", "scheduledEnd",
       "distanceMiles", zone, lines, "serviceCents", "addOnsCents",
       "surchargesCents", "discountCents", "taxCents", "totalCents",
       "depositCents", "balanceDueCents", "pricingVersion", status,
       "customerNotes", "updatedAt"
     ) VALUES (
       '${id}', '${referencia}', '${CUSTOMER}', '${ADDRESS}', 'STANDARD', 'ONE_TIME',
       3, 2, 1800, '${inicio.toISOString()}', '${fin.toISOString()}', 12, 'A', '[]'::jsonb,
       18000, 0, 0, 0, 1440, 19440, 5000, 14440, 'v1', '${status}',
       'Por favor no toquen el escritorio', now()
     )`,
  );
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
      ('${CLEO}', '${CLEO_AUTH}', 'Cleo', 'Limpia', 'cleo@example.com', 'CLEANER', true, now()),
      ('${DARIO}', '${DARIO_AUTH}', 'Dario', 'Brilla', 'dario@example.com', 'CLEANER', true, now()),
      ('${ADA}', '${ADA_AUTH}', 'Ada', 'Jefa', 'ada@example.com', 'ADMIN', true, now());

    INSERT INTO customers (id, email, "firstName", "lastName", phone, "updatedAt")
    VALUES ('${CUSTOMER}', 'luis@example.com', 'Luis', 'Perez', '+14045559999', now());

    INSERT INTO addresses (id, "customerId", line1, line2, city, state, "postalCode", "accessNotes", "updatedAt")
    VALUES ('${ADDRESS}', '${CUSTOMER}', '100 Peachtree St', 'Apt 4B', 'Atlanta', 'GA', '30303',
            'Codigo de la puerta 4321. Perro en el jardin.', now());
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
  await db.exec(
    'DELETE FROM audit_logs; DELETE FROM booking_clock_ins; ' +
      'DELETE FROM booking_assignments; DELETE FROM bookings;',
  );
  await geocodificarLaCasa();

  await sembrarReserva(DE_CLEO, 'FT-M-0001', 26);
  await sembrarReserva(DE_DARIO, 'FT-M-0002', 30);
  await sembrarReserva(CANCELADA, 'FT-M-0003', 28, 'CANCELLED');

  await db.exec(`
    INSERT INTO booking_assignments ("bookingId", "staffId", "isLead", "assignedAt")
    VALUES
      ('${DE_CLEO}', '${CLEO}', true, now()),
      ('${DE_CLEO}', '${DARIO}', false, now()),
      ('${DE_DARIO}', '${DARIO}', true, now()),
      ('${CANCELADA}', '${CLEO}', true, now());
  `);
});

/* ======================================================================== */

describe('solo los trabajos propios', () => {
  /*
   * LA PRUEBA QUE SOSTIENE LA PANTALLA ENTERA. El filtro va en la consulta,
   * asi que un trabajo ajeno no llega siquiera a salir de la base de datos.
   */
  it('Cleo ve el suyo y NO el de Dario', async () => {
    const respuesta = await misTrabajos();

    expect(respuesta.status).toBe(200);
    const referencias = respuesta.body.jobs.map((j: { reference: string }) => j.reference);
    expect(referencias).toContain('FT-M-0001');
    expect(referencias).not.toContain('FT-M-0002');
  });

  it('Dario ve los dos suyos', async () => {
    const respuesta = await misTrabajos(await comoDario());
    const referencias = respuesta.body.jobs.map((j: { reference: string }) => j.reference);

    expect(referencias).toEqual(['FT-M-0001', 'FT-M-0002']);
  });

  /*
   * A una cancelada no va nadie. Dejarla en la lista del dia es la forma de
   * que alguien se presente en una casa donde ya no se le espera.
   */
  it('las canceladas no aparecen aunque esten asignadas', async () => {
    const referencias = (await misTrabajos()).body.jobs.map(
      (j: { reference: string }) => j.reference,
    );

    expect(referencias).not.toContain('FT-M-0003');
  });

  it('quien no tiene nada asignado ve una lista vacia, no un error', async () => {
    const respuesta = await misTrabajos(await comoAda());

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.jobs).toEqual([]);
  });

  it('sin sesion no se llega', async () => {
    expect((await request(app.getHttpServer()).get(RUTA)).status).toBe(401);
  });
});

describe('lo que se ve y lo que no', () => {
  /*
   * NINGUN IMPORTE. Ni siquiera se leen de la base: no se puede filtrar al
   * pintar algo que nunca salio.
   */
  it('no aparece ningun importe por ningun lado', async () => {
    const crudo = JSON.stringify((await misTrabajos()).body);

    for (const pista of ['Cents', '19440', '5000', '14440', 'total', 'deposit', 'payment']) {
      expect(crudo.toLowerCase()).not.toContain(pista.toLowerCase());
    }
  });

  it('el cliente sale por su nombre de pila, sin apellido ni correo', async () => {
    const trabajo = (await misTrabajos()).body.jobs[0];

    expect(trabajo.customerFirstName).toBe('Luis');
    expect(JSON.stringify(trabajo)).not.toContain('Perez');
    expect(JSON.stringify(trabajo)).not.toContain('luis@example.com');
  });

  it('el telefono si, que para eso esta en la puerta', async () => {
    expect((await misTrabajos()).body.jobs[0].customerPhone).toBe('+14045559999');
  });

  /*
   * Las instrucciones de acceso SI se mandan: sin ellas quien llega no puede
   * entrar, que es justo para lo que existen. Pero solo en lo propio.
   */
  it('las instrucciones de acceso llegan en el trabajo propio', async () => {
    expect((await misTrabajos()).body.jobs[0].accessNotes).toContain('4321');
  });

  it('dice quien mas va y quien manda', async () => {
    const trabajo = (await misTrabajos()).body.jobs[0];

    expect(trabajo.iAmLead).toBe(true);
    expect(trabajo.teammates).toEqual([{ name: 'Dario Brilla', isLead: false }]);
  });

  it('el contrato es estricto, asi que un campo de mas se veria', async () => {
    expect(MyJobsSchema.safeParse((await misTrabajos()).body).success).toBe(true);
  });
});

describe('marcar empezado y terminado', () => {
  it('marca que ha llegado', async () => {
    const respuesta = await marcar(DE_CLEO, 'IN_PROGRESS');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.status).toBe('IN_PROGRESS');
  });

  it('y despues que ha terminado', async () => {
    await marcar(DE_CLEO, 'IN_PROGRESS');
    const respuesta = await marcar(DE_CLEO, 'COMPLETED');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.status).toBe('COMPLETED');
  });

  it('guarda la hora de inicio y la de fin', async () => {
    await marcar(DE_CLEO, 'IN_PROGRESS');
    await marcar(DE_CLEO, 'COMPLETED');

    const fila = await db.query<{ startedAt: Date | null; completedAt: Date | null }>(
      `SELECT "startedAt", "completedAt" FROM bookings WHERE id = '${DE_CLEO}'`,
    );

    expect(fila.rows[0]?.startedAt).not.toBeNull();
    expect(fila.rows[0]?.completedAt).not.toBeNull();
  });

  /*
   * UN TRABAJO AJENO RESPONDE 404, NO 403. Con un 403 se aprenderia que esa
   * reserva existe y simplemente no es suya; probando identificadores se
   * podria ir dibujando la agenda de la empresa.
   */
  it('no se puede marcar un trabajo ajeno, y no se admite ni que existe', async () => {
    const respuesta = await marcar(DE_DARIO, 'IN_PROGRESS');

    expect(respuesta.status).toBe(404);
  });

  it('el trabajo ajeno sigue intacto despues del intento', async () => {
    await marcar(DE_DARIO, 'IN_PROGRESS');

    const fila = await db.query<{ status: string }>(
      `SELECT status FROM bookings WHERE id = '${DE_DARIO}'`,
    );

    expect(fila.rows[0]?.status).toBe('CONFIRMED');
  });

  /*
   * Cancelar y "no estaban" mueven dinero y los discute el cliente, asi que
   * los decide coordinacion. El contrato ni siquiera los admite.
   */
  it.each(['CANCELLED', 'NO_SHOW', 'PENDING_PAYMENT', 'CONFIRMED'])(
    'rechaza marcar %s',
    async (estado) => {
      expect((await marcar(DE_CLEO, estado)).status).toBe(400);
    },
  );

  /*
   * No se puede terminar lo que no se ha empezado: desde CONFIRMED la unica
   * salida hacia adelante es IN_PROGRESS. Lo dice la tabla de transiciones
   * del contrato, la misma que usa el panel, no una lista escrita aqui.
   *
   * Y no es burocracia: sin pasar por "he llegado" no queda la hora de
   * entrada, que es el dato que sostiene cualquier discusion sobre si el
   * equipo estuvo alli y cuanto.
   */
  it('rechaza terminar sin haber empezado', async () => {
    const respuesta = await marcar(DE_CLEO, 'COMPLETED');

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.code).toBe('INVALID_TRANSITION');
  });

  it('deja rastro de que lo marco limpieza y no coordinacion', async () => {
    await marcar(DE_CLEO, 'IN_PROGRESS');

    const registros = await db.query<{ metadata: Record<string, unknown> }>(
      `SELECT metadata FROM audit_logs WHERE action = 'booking.status.in_progress'`,
    );

    expect(registros.rows).toHaveLength(1);
    expect(registros.rows[0]?.metadata).toMatchObject({ source: 'my-jobs', to: 'IN_PROGRESS' });
  });
});

describe('el fichaje con ubicacion', () => {
  it('guarda la distancia a la casa y el margen del GPS', async () => {
    const respuesta = await marcar(DE_CLEO, 'IN_PROGRESS', undefined, {
      location: EN_LA_PUERTA,
    });

    expect(respuesta.status).toBe(200);

    const [fichaje] = await fichajes(DE_CLEO);
    expect(fichaje.kind).toBe('ARRIVAL');
    expect(fichaje.locationState).toBe('RECORDED');
    expect(fichaje.distanceMeters).toBeLessThan(30);
    expect(fichaje.accuracyMeters).toBe(12);
  });

  it('distingue quien llego a la casa de quien ficho desde la suya', async () => {
    // LA PREGUNTA QUE JUSTIFICA TODA LA ETAPA, en una sola prueba.
    await marcar(DE_CLEO, 'IN_PROGRESS', undefined, { location: EN_SU_CASA });

    const [fichaje] = await fichajes(DE_CLEO);
    expect(fichaje.locationState).toBe('RECORDED');
    expect(fichaje.distanceMeters).toBeGreaterThan(25_000);
  });

  it('la salida se ficha como DEPARTURE', async () => {
    await marcar(DE_CLEO, 'IN_PROGRESS', undefined, { location: EN_LA_PUERTA });
    await marcar(DE_CLEO, 'COMPLETED', undefined, { location: EN_LA_PUERTA });

    expect((await fichajes(DE_CLEO)).map((f) => f.kind)).toEqual(['ARRIVAL', 'DEPARTURE']);
  });

  it('cada persona del equipo ficha lo suyo, sin pisar a la otra', async () => {
    /*
     * POR ESTO EL FICHAJE ES UNA TABLA Y NO COLUMNAS EN `bookings`. Cleo esta
     * en la puerta y Dario todavia en el coche a dos manzanas: los dos datos
     * tienen que caber, y con columnas en la reserva el segundo borraria al
     * primero.
     */
    await marcar(DE_CLEO, 'IN_PROGRESS', undefined, { location: EN_LA_PUERTA });
    await marcar(DE_CLEO, 'COMPLETED', await comoDario(), { location: EN_SU_CASA });

    const filas = await fichajes(DE_CLEO);
    expect(filas).toHaveLength(2);
    expect(filas[0].distanceMeters).toBeLessThan(30);
    expect(filas[1].distanceMeters).toBeGreaterThan(25_000);
  });
});

describe('LAS COORDENADAS DEL EMPLEADO NO ACABAN EN NINGUN SITIO', () => {
  /*
   * ======================================================================
   * LA PRUEBA QUE SOSTIENE LA PROMESA DE PRIVACIDAD DE TODA LA ETAPA
   * ======================================================================
   * Se dice en el contrato, en la migracion y en el servicio que la
   * ubicacion de quien ficha no se guarda. Esto lo COMPRUEBA, y lo comprueba
   * de la forma mas bruta posible: buscando los numeros por toda la base de
   * datos.
   *
   * Es la clase de promesa que se rompe sin que nadie lo note —basta que
   * alguien anada un campo a una metadata «por si acaso»—, asi que la
   * comprobacion no puede ser mirar un sitio concreto.
   */

  const COORDENADAS_ENVIADAS = [
    String(EN_SU_CASA.latitude),
    String(EN_SU_CASA.longitude),
    // Y sin el signo, por si alguien las guardara en valor absoluto.
    String(Math.abs(EN_SU_CASA.longitude)),
  ];

  it('no estan en la tabla de fichajes: no hay columna donde ponerlas', async () => {
    await marcar(DE_CLEO, 'IN_PROGRESS', undefined, { location: EN_SU_CASA });

    const columnas = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'booking_clock_ins'`,
    );
    const nombres = columnas.rows.map((c) => c.column_name.toLowerCase());

    expect(nombres).not.toContain('latitude');
    expect(nombres).not.toContain('longitude');
    // Ni con cualquier otro nombre que suene a posicion.
    for (const nombre of nombres) {
      expect(nombre).not.toMatch(/lat|lon|coord|position|geo/);
    }
  });

  it('no estan en la auditoria, que es por donde se colarian', async () => {
    await marcar(DE_CLEO, 'IN_PROGRESS', undefined, { location: EN_SU_CASA });

    const filas = await db.query<{ metadata: unknown }>(
      `SELECT metadata FROM audit_logs WHERE "entityId" = '${DE_CLEO}'`,
    );
    const serializada = JSON.stringify(filas.rows);

    for (const numero of COORDENADAS_ENVIADAS) {
      expect(serializada).not.toContain(numero);
    }

    // Pero SI esta la distancia, que es el dato que resuelve un «esto se
    // cerro sin hacerse» sin decir donde estaba nadie.
    expect(serializada).toContain('distanceMeters');
  });

  it('no estan en NINGUNA tabla de la base de datos', async () => {
    /*
     * La comprobacion de fuerza bruta: recorre todas las columnas de texto y
     * numericas de todo el esquema buscando los valores que se enviaron. Si
     * alguien los guardara en cualquier sitio —una metadata, una nota, un
     * campo nuevo—, esto lo encuentra.
     */
    await marcar(DE_CLEO, 'IN_PROGRESS', undefined, { location: EN_SU_CASA });

    const columnas = await db.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type IN ('text','character varying','jsonb','json',
                            'double precision','numeric','real')`,
    );

    const hallazgos: string[] = [];
    for (const { table_name, column_name } of columnas.rows) {
      for (const numero of COORDENADAS_ENVIADAS) {
        const encontrado = await db.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM "${table_name}"
            WHERE "${column_name}"::text LIKE '%${numero}%'`,
        );
        if ((encontrado.rows[0]?.n ?? 0) > 0) {
          hallazgos.push(`${table_name}.${column_name} contiene ${numero}`);
        }
      }
    }

    expect(hallazgos).toEqual([]);
  });

  it('tampoco viajan de vuelta en la respuesta', async () => {
    const respuesta = await marcar(DE_CLEO, 'IN_PROGRESS', undefined, { location: EN_SU_CASA });
    const serializada = JSON.stringify(respuesta.body);

    for (const numero of COORDENADAS_ENVIADAS) {
      expect(serializada).not.toContain(numero);
    }
  });

  it('y la posicion de la CASA tampoco sale hacia el movil', async () => {
    /*
     * La otra mitad, que es facil de olvidar: la casa SI tiene coordenadas
     * guardadas, y se usan para calcular. Pero no hay razon para que la
     * posicion exacta del domicilio de un cliente viaje a un telefono.
     */
    const respuesta = await marcar(DE_CLEO, 'IN_PROGRESS', undefined, { location: EN_LA_PUERTA });
    const serializada = JSON.stringify(respuesta.body);

    expect(serializada).not.toContain(String(CASA.latitude));
    expect(serializada).not.toContain(String(CASA.longitude));
  });
});

describe('el fichaje NUNCA se bloquea', () => {
  it('sin ubicacion se ficha igual, marcado como no disponible', async () => {
    const respuesta = await marcar(DE_CLEO, 'IN_PROGRESS');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.status).toBe('IN_PROGRESS');

    const [fichaje] = await fichajes(DE_CLEO);
    expect(fichaje.locationState).toBe('UNAVAILABLE');
    expect(fichaje.distanceMeters).toBeNull();
  });

  it('si la persona deniega el permiso, queda anotado como tal', async () => {
    await marcar(DE_CLEO, 'IN_PROGRESS', undefined, { locationState: 'DENIED' });

    expect((await fichajes(DE_CLEO))[0].locationState).toBe('DENIED');
  });

  it('si la casa no tiene coordenadas, el fallo es NUESTRO y se distingue', async () => {
    /*
     * IMPORTA QUE NO SE CONFUNDA CON `UNAVAILABLE`. Si se anotara asi
     * pareceria que el GPS de esa persona no funciona, cuando lo que pasa es
     * que nuestra geocodificacion no habia resuelto la casa todavia.
     */
    await casaSinCoordenadas();

    const respuesta = await marcar(DE_CLEO, 'IN_PROGRESS', undefined, {
      location: EN_LA_PUERTA,
    });

    expect(respuesta.status).toBe(200);

    const [fichaje] = await fichajes(DE_CLEO);
    expect(fichaje.locationState).toBe('NO_HOUSE');
    expect(fichaje.distanceMeters).toBeNull();
  });

  it('un trabajo que no es suyo sigue siendo 404, ubicacion o no', async () => {
    // La ubicacion no abre ninguna puerta: el filtro por asignacion manda.
    const respuesta = await marcar(DE_DARIO, 'IN_PROGRESS', undefined, {
      location: EN_LA_PUERTA,
    });

    expect(respuesta.status).toBe(404);
    expect(await fichajes(DE_DARIO)).toHaveLength(0);
  });
});

describe('el cliente no puede mentir sobre su ubicacion', () => {
  it('RECHAZA que se declare RECORDED sin mandar coordenadas', async () => {
    /*
     * Seria afirmar que se comprobo algo que nadie comprobo. Lo pone el
     * servidor, y solo despues de calcular los metros.
     */
    const respuesta = await marcar(DE_CLEO, 'IN_PROGRESS', undefined, {
      locationState: 'RECORDED',
    });

    expect(respuesta.status).toBe(400);
    expect(await fichajes(DE_CLEO)).toHaveLength(0);
  });

  it('RECHAZA que se declare NO_HOUSE, que es un hecho de nuestra base', async () => {
    const respuesta = await marcar(DE_CLEO, 'IN_PROGRESS', undefined, {
      locationState: 'NO_HOUSE',
    });

    expect(respuesta.status).toBe(400);
  });

  it('RECHAZA una distancia enviada a mano', async () => {
    // La distancia la calcula el servidor. Aceptarla del cliente seria
    // dejarle escribir el dato que la funcion existe para comprobar.
    const respuesta = await marcar(DE_CLEO, 'IN_PROGRESS', undefined, { distanceMeters: 5 });

    expect(respuesta.status).toBe(400);
  });

  it('RECHAZA los campos de mas que da la API del navegador', async () => {
    const respuesta = await marcar(DE_CLEO, 'IN_PROGRESS', undefined, {
      location: { ...EN_LA_PUERTA, altitude: 320, speed: 0 },
    });

    expect(respuesta.status).toBe(400);
  });
});
