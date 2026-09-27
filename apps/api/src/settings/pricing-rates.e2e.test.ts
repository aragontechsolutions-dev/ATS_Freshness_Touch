import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminPricingRatesSchema, type PricingRates } from '@freshness/types';
import { defaultPricingConfig, defaultPricingRates } from '@freshness/pricing';
import { AppModule } from '../app.module';
import { AUTH_PROVIDER } from '../auth/auth.types';
import type { LocalAuthProvider } from '../auth/providers/local-auth.provider';
import { PricingConfigService } from './pricing-config.service';
import { PricingRatesService } from './pricing-rates.service';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-de-tarifas';
  process.env.EMAIL_PROVIDER = 'log';
  process.env.REMINDER_SWEEP_MINUTES = '0';
  process.env.AUDIT_PURGE_HOURS = '0';
  process.env.RATE_LIMIT_MAX = '2000';
  process.env.QUOTE_RATE_LIMIT_MAX = '2000';
});

/**
 * LAS TARIFAS, CONTRA UNA BASE DE DATOS REAL
 * -------------------------------------------
 * ES LA CONFIGURACION QUE MAS DINERO MUEVE DEL SISTEMA, y la mas silenciosa
 * cuando se equivoca: un precio mal puesto no rompe nada. Cotiza, cobra y
 * factura, con la cifra equivocada, y no hay pantalla roja que avise.
 *
 * Lo que se comprueba, por orden de importancia:
 *
 *   1. Que el cambio LLEGUE DE VERDAD AL COTIZADOR. Si las tarifas se
 *      guardan pero el precio sigue saliendo del codigo, no se ha sacado
 *      nada del codigo.
 *   2. Que una version antigua se pueda volver a leer. Es la promesa que
 *      `pricingVersion` lleva escrita en el esquema desde el primer dia y
 *      que hasta esta etapa no se cumplia.
 *   3. Que guardar NO destruya la tabla anterior.
 *   4. Que solo administracion pueda tocarla.
 */

const PUERTO = 55481;
const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');
const RUTA = '/api/v1/admin/pricing-rates';

const ADA = 'aaa91000-0000-4000-8000-000000000001';
const DIEGO = 'ddd91000-0000-4000-8000-000000000002';
const ADA_AUTH = 'auth-ada-tarifas';
const DIEGO_AUTH = 'auth-diego-tarifas';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;
let provider: LocalAuthProvider;

const comoAda = (): Promise<string> => provider.issue(ADA_AUTH, 'ada@example.com', 3600);
const comoDiego = (): Promise<string> => provider.issue(DIEGO_AUTH, 'diego@example.com', 3600);

const PARTIDA: PricingRates = defaultPricingRates(defaultPricingConfig);

async function leer(token?: string) {
  return request(app.getHttpServer())
    .get(RUTA)
    .set('authorization', `Bearer ${token ?? (await comoAda())}`);
}

async function guardar(rates: unknown, token?: string) {
  const respuesta = await request(app.getHttpServer())
    .put(RUTA)
    .set('authorization', `Bearer ${token ?? (await comoAda())}`)
    .send(rates);

  // La cache es por instancia: sin esto, el cotizador de la prueba siguiente
  // veria la tabla anterior durante treinta segundos.
  app.get(PricingRatesService).invalidate();
  return respuesta;
}

/** Una cotizacion normal, para ver el precio que sale de verdad. */
async function cotizar(servicio = 'STANDARD') {
  return request(app.getHttpServer())
    .post('/api/v1/quotes/estimate')
    .send({
      service: servicio,
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 1200,
      destination: { postalCode: '30303' },
    });
}

/** La tabla de partida con un solo cambio, que es como se edita de verdad. */
function conCambio(cambio: (rates: PricingRates) => PricingRates): PricingRates {
  return cambio(structuredClone(PARTIDA));
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
  await db.exec(`DELETE FROM audit_logs; DELETE FROM pricing_tables;`);
  app.get(PricingRatesService).invalidate();
});

/* ======================================================================== */

describe('quien puede tocar los precios', () => {
  it('administracion lee, y sin nada guardado recibe las tarifas del codigo', async () => {
    const respuesta = await leer();

    expect(respuesta.status).toBe(200);
    expect(AdminPricingRatesSchema.safeParse(respuesta.body).success).toBe(true);
    expect(respuesta.body.rates.services.STANDARD.baseCents).toBe(
      defaultPricingConfig.services.STANDARD.baseCents,
    );
  });

  /*
   * Quien pueda tocar esta pantalla decide cuanto factura la empresa.
   * Coordinacion organiza la agenda; no fija precios.
   */
  it('coordinacion no puede leerlas ni cambiarlas', async () => {
    const token = await comoDiego();

    expect((await leer(token)).status).toBe(403);
    expect((await guardar(PARTIDA, token)).status).toBe(403);
  });

  it('sin sesion no se llega', async () => {
    expect((await request(app.getHttpServer()).get(RUTA)).status).toBe(401);
  });
});

describe('la semilla', () => {
  it('la primera lectura deja guardada la tabla del codigo, con SU version', async () => {
    await leer();

    const filas = await db.query<{ version: string }>(
      `SELECT version FROM pricing_tables ORDER BY "createdAt"`,
    );

    /*
     * LA VERSION ES LA DEL CODIGO Y NO UNA NUEVA, y eso es lo que hace que
     * la historia empiece sin agujero: todas las cotizaciones y reservas
     * que ya existen llevan guardada esta misma cadena.
     */
    expect(filas.rows).toHaveLength(1);
    expect(filas.rows[0]?.version).toBe(defaultPricingConfig.version);
  });

  it('no siembra dos veces', async () => {
    await leer();
    app.get(PricingRatesService).invalidate();
    await leer();

    const filas = await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM pricing_tables`);
    expect(filas.rows[0]?.n).toBe('1');
  });
});

describe('el cambio llega al cotizador', () => {
  /*
   * ES EL PUNTO DE TODA LA ETAPA. Si las tarifas se guardan pero el precio
   * sigue saliendo del codigo, no se ha sacado nada del codigo.
   */
  it('subir el cargo base sube el precio de la siguiente cotizacion', async () => {
    const antes = await cotizar();
    expect(antes.status).toBe(200);

    await guardar(
      conCambio((r) => {
        r.services.STANDARD.baseCents += 5000; // 50 $ mas
        return r;
      }),
    );

    const despues = await cotizar();

    expect(despues.body.totals.totalCents).toBe(antes.body.totals.totalCents + 5000);
  });

  it('subir el descuento semanal se ve en el catalogo publico', async () => {
    await guardar(
      conCambio((r) => {
        r.frequencyDiscounts.weeklyPercent = 20;
        return r;
      }),
    );

    const catalogo = await request(app.getHttpServer()).get('/api/v1/pricing/catalog');
    const semanal = catalogo.body.frequencies.find(
      (f: { code: string }) => f.code === 'WEEKLY',
    ) as { discountPercent: number };

    expect(semanal.discountPercent).toBe(20);
  });

  it('la version que se congela en cada reserva es la de la tabla vigente', async () => {
    /*
     * `bookings.service.ts` guarda en cada reserva la version que devuelve
     * `PricingConfigService.current()`, y es lo que permite volver a leer
     * meses despues con que precios se calculo. Antes de esta etapa esa
     * version era siempre la del codigo, dijera lo que dijera la tabla.
     *
     * Se comprueba sobre el servicio y no cotizando porque
     * `/quotes/estimate` NO guarda fila: la cotizacion se persiste al
     * reservar. Montar una reserva entera aqui probaria el flujo de
     * reservas, no las tarifas.
     */
    const respuesta = await guardar(
      conCambio((r) => {
        r.services.STANDARD.baseCents += 100;
        return r;
      }),
    );

    const config = await app.get(PricingConfigService).current();

    expect(config.version).toBe(respuesta.body.version);
    // Y no la del codigo, que es la que se congelaba antes de esta etapa.
    expect(config.version).not.toBe(defaultPricingConfig.version);
  });

  it('el servicio comercial sigue sin dar precio automatico', async () => {
    /*
     * No es editable a proposito: se visita y se propone a mano. Que siga
     * asi despues de guardar tarifas es la comprobacion de que
     * `applyPricingRates` no toca lo que no debe.
     */
    await guardar(PARTIDA);

    const respuesta = await cotizar('COMMERCIAL');

    expect(respuesta.body.manualReview.required).toBe(true);
  });
});

describe('el historial', () => {
  it('guardar crea una version nueva y NO borra la anterior', async () => {
    await leer(); // siembra

    const primera = await guardar(
      conCambio((r) => {
        r.services.DEEP.baseCents = 10_000;
        return r;
      }),
    );
    const segunda = await guardar(
      conCambio((r) => {
        r.services.DEEP.baseCents = 11_000;
        return r;
      }),
    );

    expect(primera.body.version).not.toBe(segunda.body.version);

    const filas = await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM pricing_tables`);
    // La semilla y las dos nuevas.
    expect(filas.rows[0]?.n).toBe('3');
  });

  it('una version antigua se puede volver a leer con SUS precios', async () => {
    /*
     * LA PROMESA QUE EL ESQUEMA LLEVA ESCRITA DESDE EL PRIMER DIA y que
     * hasta esta etapa no se cumplia: la version apuntaba a un archivo del
     * codigo del que solo existe su version actual.
     */
    const vieja = await guardar(
      conCambio((r) => {
        r.services.DEEP.baseCents = 10_000;
        return r;
      }),
    );
    await guardar(
      conCambio((r) => {
        r.services.DEEP.baseCents = 11_000;
        return r;
      }),
    );

    const config = await app.get(PricingConfigService).atVersion(vieja.body.version as string);

    expect(config?.services.DEEP.baseCents).toBe(10_000);
    expect(config?.version).toBe(vieja.body.version);
  });

  it('una version que no existe devuelve null, no revienta', async () => {
    const config = await app.get(PricingConfigService).atVersion('1999.01.01.1');

    expect(config).toBeNull();
  });

  it('guarda quien la puso, como texto', async () => {
    const respuesta = await guardar(PARTIDA);

    /*
     * Como TEXTO y no como referencia a su ficha: quien subio un precio el
     * ano pasado puede haber causado baja, y «lo cambio alguien que ya no
     * esta» no sirve al revisar una factura.
     */
    expect(respuesta.body.updatedBy).toBe('Ada Jefa');
  });
});

describe('lo que el contrato no deja pasar', () => {
  it('rechaza un cargo base con un cero de mas', async () => {
    const respuesta = await guardar(
      conCambio((r) => {
        r.services.STANDARD.baseCents = 99_999_999;
        return r;
      }),
    );

    expect(respuesta.status).toBe(400);
  });

  it('rechaza que el descuento baje al aumentar la frecuencia', async () => {
    const respuesta = await guardar(
      conCambio((r) => {
        r.frequencyDiscounts = { weeklyPercent: 5, biweeklyPercent: 10, monthlyPercent: 15 };
        return r;
      }),
    );

    expect(respuesta.status).toBe(400);
  });

  it('rechaza precio para el servicio comercial', async () => {
    const respuesta = await guardar({
      ...PARTIDA,
      services: {
        ...PARTIDA.services,
        COMMERCIAL: {
          baseCents: 5000,
          perBedroomCents: 0,
          perBathroomCents: 0,
          centsPerSquareFoot: 0,
          minimumCents: 1000,
        },
      },
    });

    expect(respuesta.status).toBe(400);
  });

  it('un rechazo no deja ninguna version a medias', async () => {
    await leer(); // siembra

    await guardar(
      conCambio((r) => {
        r.services.STANDARD.baseCents = 99_999_999;
        return r;
      }),
    );

    const filas = await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM pricing_tables`);
    expect(filas.rows[0]?.n).toBe('1');
  });
});

describe('la auditoria', () => {
  it('registra QUE cambio, no un volcado de la tabla entera', async () => {
    await guardar(
      conCambio((r) => {
        r.services.DEEP.baseCents = 12_345;
        return r;
      }),
    );

    const filas = await db.query<{ action: string; metadata: unknown }>(
      `SELECT action, metadata::text AS metadata FROM audit_logs WHERE action = 'pricing.updated'`,
    );

    expect(filas.rows).toHaveLength(1);

    const metadata = String(filas.rows[0]?.metadata);
    expect(metadata).toContain('DEEP.base');
    expect(metadata).toContain('12345');
    /*
     * Y NO los cuarenta numeros que no se movieron. Un volcado en cada fila
     * no se lee, y la pregunta real es siempre «que subio y cuanto».
     */
    expect(metadata).not.toContain('STANDARD.base');
  });

  it('tiene accion propia, distinta de la de los ajustes', async () => {
    /*
     * Cambiar un precio mueve dinero en CADA reserva posterior. Ante una
     * reclamacion la pregunta es «quien subio este precio y cuando», y eso
     * se responde con un filtro, no leyendo cincuenta cambios de telefono.
     */
    await guardar(PARTIDA);

    const filas = await db.query<{ action: string }>(`SELECT action FROM audit_logs`);

    expect(filas.rows.map((f) => f.action)).toEqual(['pricing.updated']);
  });
});
