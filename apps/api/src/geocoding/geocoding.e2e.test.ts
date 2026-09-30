import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeocodeQuery, GeocodeResult } from '@freshness/types';
import { AppModule } from '../app.module';
import { GeocodingService } from './geocoding.service';
import { GeocodingSweepService } from './geocoding-sweep.service';
import { GEOCODING_PROVIDER, type GeocodingProvider } from './geocoding.types';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-de-geocodificacion';
  process.env.EMAIL_PROVIDER = 'log';
  process.env.REMINDER_SWEEP_MINUTES = '0';
  process.env.AUDIT_PURGE_HOURS = '0';
  // El barrido se llama a mano, para no depender del reloj.
  process.env.GEOCODING_SWEEP_MINUTES = '0';
  process.env.GEOCODING_SWEEP_BATCH = '3';
  process.env.RATE_LIMIT_MAX = '2000';
  process.env.QUOTE_RATE_LIMIT_MAX = '2000';
});

/**
 * LA GEOCODIFICACION, CONTRA UNA BASE DE DATOS REAL
 * -------------------------------------------------
 * Lo que se comprueba es lo que no se ve leyendo el codigo:
 *
 *   1. Que una direccion se resuelva UNA vez y quede guardada.
 *   2. Que una coincidencia FUERA DEL ESTADO no se guarde. Es la que miente:
 *      dejaria la casa en Ohio y todos los fichajes de ese cliente dirian
 *      «a 800 kilometros» sin que nada fallara.
 *   3. Que NADA de esto pueda romperse hacia arriba. El servicio caido, la
 *      direccion inexistente y la respuesta ilegible acaban todos en «sin
 *      coordenadas», nunca en una excepcion.
 *   4. Que el barrido recoja lo que quedo pendiente, que es lo unico que
 *      impide que una direccion se quede sin punto en el mapa para siempre.
 */

const PUERTO = 55485;
const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');

const CLIENTE = 'ccc94000-0000-4000-8000-000000000001';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;
let geocoding: GeocodingService;
let barrido: GeocodingSweepService;

/** El proveedor que la aplicacion tiene inyectado, para poder dirigirlo. */
let respuesta: GeocodeResult | null = null;
let fallar = false;
let llamadas = 0;

const proveedorDirigible: GeocodingProvider = {
  name: 'mock',
  locate(_query: GeocodeQuery): Promise<GeocodeResult | null> {
    llamadas += 1;
    if (fallar) return Promise.reject(new Error('el servicio no responde'));
    return Promise.resolve(respuesta);
  },
};

const EN_ATLANTA: GeocodeResult = {
  latitude: 33.749,
  longitude: -84.388,
  precision: 'INTERPOLATED',
  matchedAddress: '123 MAIN ST, ATLANTA, GA, 30303',
  provider: 'census',
};

/** Crea una direccion sin coordenadas y devuelve su identificador. */
async function nuevaDireccion(sufijo: string, postalCode = '30303'): Promise<string> {
  /*
   * El ultimo grupo de un UUID son 12 digitos EXACTOS: 10 ceros + 2 del
   * sufijo. Con un sufijo de otro tamano, Postgres rechaza el identificador y
   * fallan las trece pruebas a la vez con un error que no menciona el sufijo.
   * Ya paso dos veces, asi que se comprueba aqui en vez de confiar en que
   * quien anada una prueba se acuerde.
   */
  if (!/^[0-9a-f]{2}$/.test(sufijo)) {
    throw new Error(`El sufijo debe ser 2 digitos hexadecimales, y llego "${sufijo}"`);
  }
  const id = `ddd94000-0000-4000-8000-0000000000${sufijo}`;
  await db.exec(`
    INSERT INTO addresses (id, "customerId", line1, city, state, "postalCode", "updatedAt")
    VALUES ('${id}', '${CLIENTE}', '${sufijo} Main St', 'Atlanta', 'GA', '${postalCode}', now());
  `);
  return id;
}

interface FilaGuardada {
  latitude: number | null;
  geocodeProvider: string | null;
  geocodeMatchedAddress: string | null;
}

async function coordenadasEnLaBase(id: string): Promise<FilaGuardada | undefined> {
  const filas = await db.query<FilaGuardada>(
    `SELECT latitude, "geocodeProvider", "geocodeMatchedAddress"
       FROM addresses WHERE id = '${id}'`,
  );
  return filas.rows[0];
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
    INSERT INTO customers (id, "firstName", "lastName", email, phone, locale, "updatedAt")
    VALUES ('${CLIENTE}', 'Ana', 'Cliente', 'ana@example.com', '+14045550123', 'en', now());
  `);

  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PUERTO}/postgres`;

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(GEOCODING_PROVIDER)
    .useValue(proveedorDirigible)
    .compile();

  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
  await app.init();

  geocoding = app.get(GeocodingService);
  barrido = app.get(GeocodingSweepService);
}, 120_000);

afterAll(async () => {
  await app?.close();
  await socket?.stop();
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`DELETE FROM addresses;`);
  respuesta = EN_ATLANTA;
  fallar = false;
  llamadas = 0;
});

/* ======================================================================== */

describe('resolver y guardar', () => {
  it('guarda las coordenadas, la precision y quien las resolvio', async () => {
    const id = await nuevaDireccion('01');
    const resultado = await geocoding.resolveAndStore(id);

    expect(resultado?.latitude).toBe(33.749);
    expect(resultado?.longitude).toBe(-84.388);
    expect(resultado?.precision).toBe('INTERPOLATED');
    expect(resultado?.provider).toBe('census');
    expect(resultado?.geocodedAt).not.toBeNull();

    const guardada = await coordenadasEnLaBase(id);
    expect(guardada?.latitude).toBe(33.749);
    expect(guardada?.geocodeProvider).toBe('census');
  });

  it('guarda la direccion que ENTENDIO el servicio, para poder auditarla', async () => {
    /*
     * La guardia del estado atrapa la coincidencia que cae en Ohio. No puede
     * atrapar la plausible: pedir «123 Main St, Atlanta» y que el servicio
     * entienda «123 Main Ave, Atlanta». Misma ciudad, coordenadas validas,
     * casa a kilometro y medio de donde esta. Nada falla; miente.
     *
     * Comparar las dos cadenas es la unica forma de verlo.
     */
    const id = await nuevaDireccion('13');
    await geocoding.resolveAndStore(id);

    expect((await coordenadasEnLaBase(id))?.geocodeMatchedAddress).toBe(
      '123 MAIN ST, ATLANTA, GA, 30303',
    );
  });

  it('esa direccion NO sale de la base: no esta en lo que se devuelve', async () => {
    // Se guarda para diagnosticar, no para que viaje. Lo que consume estas
    // coordenadas es el fichaje, que las manda al movil de un empleado.
    const id = await nuevaDireccion('14');
    const devuelto = await geocoding.resolveAndStore(id);

    expect(devuelto).not.toBeNull();
    expect(Object.keys(devuelto ?? {})).not.toContain('matchedAddress');
  });

  it('UNA sola consulta por direccion: la segunda vez sale de lo guardado', async () => {
    /*
     * Una casa no se mueve. Consultar el servicio en cada uso seria pagar
     * —en tiempo, y en cuota si algun dia se cambia a un proveedor de pago—
     * por la misma respuesta.
     */
    const id = await nuevaDireccion('02');

    await geocoding.coordinatesFor(id);
    expect(llamadas).toBe(1);

    const segunda = await geocoding.coordinatesFor(id);
    expect(llamadas).toBe(1);
    expect(segunda?.latitude).toBe(33.749);
  });

  it('sin coordenadas guardadas, `stored` devuelve null sin consultar nada', async () => {
    const id = await nuevaDireccion('03');
    expect(await geocoding.stored(id)).toBeNull();
    expect(llamadas).toBe(0);
  });
});

describe('la guardia del estado', () => {
  it('NO guarda una coincidencia fuera de Georgia', async () => {
    /*
     * LA PRUEBA QUE MAS IMPORTA. Los geocodificadores devuelven «lo mas
     * parecido», y hay una Main Street en cada pueblo del pais. Guardar la
     * de Ohio dejaria la casa alli, y a partir de ahi todos los fichajes de
     * ese cliente dirian «a 800 kilometros». No fallaria: mentiria.
     */
    respuesta = { ...EN_ATLANTA, latitude: 39.9612, longitude: -82.9988 }; // Columbus, Ohio
    const id = await nuevaDireccion('04');

    expect(await geocoding.resolveAndStore(id)).toBeNull();
    expect((await coordenadasEnLaBase(id))?.latitude).toBeNull();
  });

  it('mejor sin coordenadas que con las de otro sitio', async () => {
    // Dicho de otra forma: el rechazo deja la direccion recuperable. El
    // barrido volvera a intentarlo, y si algun dia el servicio acierta, se
    // guardara la buena.
    respuesta = { ...EN_ATLANTA, latitude: 35.0456, longitude: -85.3097 }; // Chattanooga
    const id = await nuevaDireccion('05');
    await geocoding.resolveAndStore(id);

    expect(await geocoding.pendingAddressIds(10)).toContain(id);
  });
});

describe('nada de esto puede romperse hacia arriba', () => {
  it('cuando el proveedor LANZA en vez de devolver null', async () => {
    /*
     * El contrato del puerto dice que un geocodificador no lanza nunca. Esta
     * prueba comprueba que incumplirlo no cuesta el servicio, y el motivo es
     * concreto: al crear una reserva esto se llama SIN esperarlo
     * (`void resolveAndStore(...)`). Una promesa rechazada que nadie recoge
     * es un `unhandledRejection`, y en Node 22 eso tumba el proceso entero.
     *
     * O sea que la diferencia entre devolver null y lanzar no es «una
     * direccion sin coordenadas» frente a «un error»: es una direccion sin
     * coordenadas frente a LA API CAIDA, y con ella todas las reservas.
     *
     * Esta prueba fallaba cuando se escribio. El fallo era real.
     */
    fallar = true;
    const id = await nuevaDireccion('06');
    await expect(geocoding.resolveAndStore(id)).resolves.toBeNull();
  });

  it('cuando el servicio no encuentra la direccion', async () => {
    respuesta = null;
    const id = await nuevaDireccion('07');
    await expect(geocoding.resolveAndStore(id)).resolves.toBeNull();
  });

  it('cuando la direccion no existe', async () => {
    await expect(
      geocoding.resolveAndStore('ddd94000-0000-4000-8000-000000009999'),
    ).resolves.toBeNull();
  });

  it('cuando la direccion tiene un codigo postal invalido, ni se consulta', async () => {
    /*
     * Se descarta antes de salir: gastar una llamada para no encontrar nada
     * es tiempo tirado contra un servicio publico gratuito.
     */
    const id = await nuevaDireccion('08', '3030');
    await expect(geocoding.resolveAndStore(id)).resolves.toBeNull();
    expect(llamadas).toBe(0);
  });
});

describe('el barrido', () => {
  it('resuelve las que quedaron pendientes', async () => {
    const a = await nuevaDireccion('10');
    const b = await nuevaDireccion('11');

    expect(await barrido.ejecutar()).toBe(2);
    expect((await coordenadasEnLaBase(a))?.latitude).toBe(33.749);
    expect((await coordenadasEnLaBase(b))?.latitude).toBe(33.749);
  });

  it('no toca las que ya tienen coordenadas', async () => {
    const id = await nuevaDireccion('12');
    await geocoding.resolveAndStore(id);
    llamadas = 0;

    expect(await barrido.ejecutar()).toBe(0);
    expect(llamadas).toBe(0);
  });

  it('respeta el tope por pasada, para no atacar al servicio', async () => {
    /*
     * Al desplegar puede haber cientos sin geocodificar. Resolverlas todas
     * de golpe seria atacar a un servicio publico gratuito. El tope de esta
     * prueba es 3, puesto en las variables de entorno de arriba.
     */
    for (const sufijo of ['20', '21', '22', '23', '24']) await nuevaDireccion(sufijo);

    expect(await barrido.ejecutar()).toBe(3);
    expect(await barrido.ejecutar()).toBe(2);
    expect(await barrido.ejecutar()).toBe(0);
  });

  it('un servicio caido no lo rompe: devuelve cero y seguira intentandolo', async () => {
    fallar = true;
    const id = await nuevaDireccion('30');

    await expect(barrido.ejecutar()).resolves.toBe(0);
    expect(await geocoding.pendingAddressIds(10)).toContain(id);
  });

  it('las mas antiguas primero', async () => {
    // Para que una direccion no se quede al final de la cola para siempre.
    const vieja = await nuevaDireccion('40');
    await db.exec(
      `UPDATE addresses SET "createdAt" = now() - interval '1 day' WHERE id = '${vieja}'`,
    );
    await nuevaDireccion('41');

    expect((await geocoding.pendingAddressIds(1))[0]).toBe(vieja);
  });
});
