import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultPricingConfig, defaultPricingRates } from '@freshness/pricing';
import { AppModule } from '../app.module';
import { AUTH_PROVIDER } from '../auth/auth.types';
import type { LocalAuthProvider } from '../auth/providers/local-auth.provider';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-de-ajustes-de-campo';
  process.env.EMAIL_PROVIDER = 'log';
  process.env.REMINDER_SWEEP_MINUTES = '0';
  process.env.GEOCODING_SWEEP_MINUTES = '0';
  process.env.RATE_LIMIT_MAX = '2000';
});

/**
 * AJUSTES DE CAMPO, CONTRA UNA BASE DE DATOS REAL
 * -----------------------------------------------
 * Esta es la unica parte del sistema capaz de mover un precio ya pactado, asi
 * que lo que se prueba, por orden de importancia:
 *
 *   1. QUE PROPONER NO CAMBIE LA RESERVA. Es toda la decision de la etapa.
 *   2. QUE SOLO EL RESPONSABLE PUEDA PROPONER, y solo tras haber fichado.
 *   3. QUE APROBAR RE-TARIFIQUE CON LA TABLA DE LA RESERVA, no con la de hoy.
 *   4. QUE LIMPIEZA NO VEA NI UN IMPORTE.
 */

const PUERTO = 55473;
const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');
const MIS_TRABAJOS = '/api/v1/admin/my-jobs';
const RESERVAS = '/api/v1/admin/bookings';

const CLEO_AUTH = 'auth-cleo-ajustes';
const DARIO_AUTH = 'auth-dario-ajustes';
const ADA_AUTH = 'auth-ada-ajustes';
/** Coordinacion: aprueba precios calculados, NO teclea importes. */
const BETO_AUTH = 'auth-beto-ajustes';

const CLEO = 'ccc44444-4444-4444-8444-444444444444';
const DARIO = 'ddd55555-5555-4555-8555-555555555555';
const ADA = 'aaa66666-6666-4666-8666-666666666666';
const BETO = 'bbb77777-7777-4777-8777-777777777777';

const CUSTOMER = 'c0000000-0000-4000-8000-000000000011';
const ADDRESS = 'a0000000-0000-4000-8000-000000000011';
const TRABAJO = '10000000-0000-4000-8000-000000000011';

/** La version con la que se contrato la reserva de estas pruebas. */
const VERSION_DE_LA_RESERVA = 'pruebas-2026.01';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;
let provider: LocalAuthProvider;

/** Cleo es la responsable; Dario va con ella; Ada es administracion. */
const comoCleo = (): Promise<string> => provider.issue(CLEO_AUTH, 'cleo@example.com', 3600);
const comoDario = (): Promise<string> => provider.issue(DARIO_AUTH, 'dario@example.com', 3600);
const comoAda = (): Promise<string> => provider.issue(ADA_AUTH, 'ada@example.com', 3600);

async function proponer(
  cuerpo: Record<string, unknown>,
  token?: string,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .patch(`${MIS_TRABAJOS}/${TRABAJO}/adjustment`)
    .set('authorization', `Bearer ${token ?? (await comoCleo())}`)
    .send(cuerpo);
}

async function resolver(
  adjustmentId: string,
  cuerpo: Record<string, unknown>,
  token?: string,
): Promise<request.Response> {
  return request(app.getHttpServer())
    .post(`${RESERVAS}/${TRABAJO}/adjustment/${adjustmentId}`)
    .set('authorization', `Bearer ${token ?? (await comoAda())}`)
    .send(cuerpo);
}

interface FilaReserva {
  squareFeet: number;
  totalCents: number;
  balanceDueCents: number;
  pricingVersion: string;
}

async function reserva(): Promise<FilaReserva> {
  const filas = await db.query<FilaReserva>(
    `SELECT "squareFeet", "totalCents", "balanceDueCents", "pricingVersion"
       FROM bookings WHERE id = '${TRABAJO}'`,
  );
  const fila = filas.rows[0];
  if (!fila) throw new Error('la reserva de las pruebas no existe');
  return fila;
}

/** Marca que Cleo ha llegado, que es lo que habilita proponer. */
async function cleoFicha(): Promise<void> {
  await db.exec(
    `INSERT INTO booking_clock_ins (id, "bookingId", "staffId", kind, "locationState")
     VALUES ('f0000000-0000-4000-8000-000000000001', '${TRABAJO}', '${CLEO}',
             'ARRIVAL', 'UNAVAILABLE')`,
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

  /*
   * DOS VERSIONES DE TARIFAS, Y AHI ESTA LA GRACIA DE ESTE ARCHIVO.
   *
   * La reserva se contrato con la vieja; la vigente es la nueva y el doble de
   * cara. Si aprobar un ajuste usara la vigente, el cliente veria subir todo
   * el trabajo —no solo los pies de mas— sin que nadie lo hubiera tocado.
   */
  const tarifas = defaultPricingRates(defaultPricingConfig);
  const carasEl = {
    ...tarifas,
    sizeBands: tarifas.sizeBands.map((banda) => ({
      ...banda,
      deepCents: banda.deepCents * 2,
      standardMonthlyCents: banda.standardMonthlyCents * 2,
      standardBiweeklyCents: banda.standardBiweeklyCents * 2,
      standardWeeklyCents: banda.standardWeeklyCents * 2,
      windowsAndCabinetsCents: banda.windowsAndCabinetsCents * 2,
    })),
  };

  await db.query(
    `INSERT INTO pricing_tables (version, rates, "createdAt")
     VALUES ($1, $2, now() - interval '60 days'), ($3, $4, now())`,
    [VERSION_DE_LA_RESERVA, JSON.stringify(tarifas), 'pruebas-2026.99', JSON.stringify(carasEl)],
  );

  await db.exec(`
    INSERT INTO staff (id, "authUserId", "firstName", "lastName", email, role, "isActive", "updatedAt")
    VALUES
      ('${CLEO}', '${CLEO_AUTH}', 'Cleo', 'Limpia', 'cleo@example.com', 'CLEANER', true, now()),
      ('${DARIO}', '${DARIO_AUTH}', 'Dario', 'Brilla', 'dario@example.com', 'CLEANER', true, now()),
      ('${ADA}', '${ADA_AUTH}', 'Ada', 'Jefa', 'ada@example.com', 'ADMIN', true, now()),
      ('${BETO}', '${BETO_AUTH}', 'Beto', 'Coordina', 'beto@example.com', 'DISPATCHER', true, now());

    INSERT INTO customers (id, email, "firstName", "lastName", phone, "updatedAt")
    VALUES ('${CUSTOMER}', 'luis@example.com', 'Luis', 'Perez', '+14045559911', now());

    INSERT INTO addresses (id, "customerId", line1, city, state, "postalCode", "updatedAt")
    VALUES ('${ADDRESS}', '${CUSTOMER}', '100 Peachtree St', 'Atlanta', 'GA', '30303', now());
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
    'DELETE FROM audit_logs; DELETE FROM booking_field_adjustments; ' +
      'DELETE FROM booking_clock_ins; DELETE FROM booking_assignments; DELETE FROM bookings;',
  );

  const inicio = new Date(Date.now() + 3_600_000);
  await db.query(
    `INSERT INTO bookings (
       id, reference, "customerId", "addressId", service, frequency,
       bedrooms, bathrooms, "squareFeet", "scheduledStart", "scheduledEnd",
       "distanceMiles", zone, lines, "serviceCents", "addOnsCents",
       "surchargesCents", "discountCents", "taxCents", "totalCents",
       "depositCents", "balanceDueCents", "pricingVersion", status, "updatedAt"
     ) VALUES (
       '${TRABAJO}', 'FT-A-0001', '${CUSTOMER}', '${ADDRESS}', 'DEEP', 'ONE_TIME',
       3, 2, 900, '${inicio.toISOString()}', '${new Date(inicio.getTime() + 7_200_000).toISOString()}',
       10, 'A', '[]'::jsonb, 25000, 0, 0, 0, 0, 25000,
       3500, 21500, '${VERSION_DE_LA_RESERVA}', 'IN_PROGRESS', now()
     )`,
  );

  // Cleo es la RESPONSABLE; Dario va con ella pero no lidera.
  await db.exec(`
    INSERT INTO booking_assignments ("bookingId", "staffId", "isLead", "assignedAt")
    VALUES ('${TRABAJO}', '${CLEO}', true, now()),
           ('${TRABAJO}', '${DARIO}', false, now());
  `);
});

/* ======================================================================== */

describe('quien puede proponer un ajuste', () => {
  it('EL RESPONSABLE SI, despues de fichar la llegada', async () => {
    await cleoFicha();

    const respuesta = await proponer({ squareFeet: 1300, note: 'La casa es mucho mas grande' });

    expect(respuesta.status).toBe(200);
    // Devuelve EL TRABAJO, no el ajuste: ver la prueba de los importes.
    const ajuste = respuesta.body.adjustments[0];
    expect(ajuste.state).toBe('PROPOSED');
    expect(ajuste.booked.squareFeet).toBe(900);
    expect(ajuste.found.squareFeet).toBe(1300);
  });

  it('QUIEN NO ES RESPONSABLE RECIBE 403, no 404', async () => {
    /*
     * La diferencia con el resto de la pantalla es deliberada: Dario YA SABE
     * que el trabajo existe, lo tiene delante. Esconderselo no protege nada y
     * lo dejaria sin entender por que no puede. Lo que se le dice es que esto
     * lo hace la responsable.
     */
    await db.exec(
      `INSERT INTO booking_clock_ins (id, "bookingId", "staffId", kind, "locationState")
       VALUES ('f0000000-0000-4000-8000-000000000002', '${TRABAJO}', '${DARIO}',
               'ARRIVAL', 'UNAVAILABLE')`,
    );

    const respuesta = await proponer({ squareFeet: 1300, note: 'nota' }, await comoDario());

    expect(respuesta.status).toBe(403);
    expect(await contarAjustes()).toBe(0);
  });

  it('quien no esta en el trabajo recibe 404 y no escribe nada', async () => {
    const respuesta = await proponer({ squareFeet: 1300, note: 'nota' }, await comoAda());

    expect(respuesta.status).toBe(404);
    expect(await contarAjustes()).toBe(0);
  });

  it('SIN FICHAR LA LLEGADA NO SE PUEDE PROPONER', async () => {
    /*
     * «Solo se ajusta lo que se ha visto». Cada propuesta queda con un
     * fichaje detras, con su hora y su distancia a la casa, asi que ante un
     * «esto no era asi» hay prueba de que alguien estuvo alli.
     */
    const respuesta = await proponer({ squareFeet: 1300, note: 'nota' });

    expect(respuesta.status).toBe(400);
    expect(await contarAjustes()).toBe(0);
  });

  it('y el fichaje tiene que ser SUYO, no de una companera', async () => {
    // Lo que respalda la propuesta es que quien la firma estuvo en la casa.
    await db.exec(
      `INSERT INTO booking_clock_ins (id, "bookingId", "staffId", kind, "locationState")
       VALUES ('f0000000-0000-4000-8000-000000000003', '${TRABAJO}', '${DARIO}',
               'ARRIVAL', 'UNAVAILABLE')`,
    );

    expect((await proponer({ squareFeet: 1300, note: 'nota' })).status).toBe(400);
  });

  it('sin sesion no se llega', async () => {
    const respuesta = await request(app.getHttpServer())
      .patch(`${MIS_TRABAJOS}/${TRABAJO}/adjustment`)
      .send({ squareFeet: 1300, note: 'nota' });

    expect(respuesta.status).toBe(401);
  });
});

describe('proponer NO cambia la reserva', () => {
  it('LA RESERVA QUEDA EXACTAMENTE IGUAL', async () => {
    /*
     * ES TODA LA DECISION DE LA ETAPA, Y ESTA ES SU PRUEBA. Un cero de mas
     * tecleado de pie en una puerta no puede convertirse en la factura de un
     * cliente con el que nadie ha hablado.
     */
    await cleoFicha();
    const antes = await reserva();

    await proponer({ squareFeet: 1300, note: 'Es mas grande' });

    expect(await reserva()).toEqual(antes);
  });

  it('pero deja calculada la diferencia para quien decide', async () => {
    await cleoFicha();
    await proponer({ squareFeet: 1300, note: 'Es mas grande' });

    // Guardada en la base, lista para el panel. Al movil NO viaja: eso lo
    // comprueba la prueba de los importes, mas abajo.
    const fila = await db.query<{ differenceCents: number; newTotalCents: number }>(
      `SELECT "differenceCents", "newTotalCents" FROM booking_field_adjustments
        WHERE "bookingId" = '${TRABAJO}'`,
    );

    expect(fila.rows[0]?.differenceCents).toBeGreaterThan(0);
    expect(fila.rows[0]?.newTotalCents).toBeGreaterThan(25000);
  });

  it('una segunda propuesta sustituye a la primera, sin borrarla', async () => {
    /*
     * El lider puede corregirse —mide otra vez, cuenta otra nevera— y lo que
     * creyo ver la primera vez tambien es informacion.
     */
    await cleoFicha();
    await proponer({ squareFeet: 1300, note: 'Primera medida' });
    await proponer({ squareFeet: 1200, note: 'La volvi a medir' });

    const estados = await db.query<{ state: string }>(
      `SELECT state FROM booking_field_adjustments
        WHERE "bookingId" = '${TRABAJO}' ORDER BY "proposedAt"`,
    );

    expect(estados.rows.map((f) => f.state)).toEqual(['SUPERSEDED', 'PROPOSED']);
  });

  it('rechaza una propuesta que no cambia nada', async () => {
    await cleoFicha();

    const respuesta = await proponer({ squareFeet: 900, note: 'Todo correcto' });

    expect(respuesta.status).toBe(400);
  });
});

describe('aprobar y rechazar', () => {
  /** Deja una propuesta abierta y devuelve su identificador. */
  async function propuestaAbierta(cambios: Record<string, unknown> = {}): Promise<string> {
    await cleoFicha();
    const respuesta = await proponer({ squareFeet: 1300, note: 'Es mas grande', ...cambios });
    // La respuesta es el TRABAJO; el identificador del ajuste sale de dentro.
    return respuesta.body.adjustments[0].id as string;
  }

  it('APROBAR RE-TARIFICA LA RESERVA', async () => {
    const id = await propuestaAbierta();
    const antes = await reserva();

    const respuesta = await resolver(id, { approve: true });

    expect(respuesta.status).toBe(200);
    const despues = await reserva();
    expect(despues.squareFeet).toBe(1300);
    expect(despues.totalCents).toBeGreaterThan(antes.totalCents);
    // Lo que queda por cobrar baja el deposito ya retenido.
    expect(despues.balanceDueCents).toBe(despues.totalCents - 3500);
  });

  it('SE RE-TARIFICA CON LA TABLA DE LA RESERVA, NO CON LA VIGENTE', async () => {
    /*
     * LA PRUEBA QUE MAS DINERO PROTEGE DE TODO EL ARCHIVO.
     *
     * La tabla vigente de estas pruebas es el DOBLE de cara que aquella con
     * la que se contrato. Si aprobar usara la vigente, el cliente veria subir
     * todo el trabajo —no solo los 400 pies de mas— y nadie sabria explicar
     * de donde salio la cifra.
     *
     * Con la tabla correcta, una profunda de 1.300 pies cuesta lo que costaba
     * en enero. Se comprueba que el total nuevo esta por debajo del doble del
     * viejo, que es donde caeria si se hubiera usado la tabla cara.
     */
    const id = await propuestaAbierta();

    await resolver(id, { approve: true });

    const despues = await reserva();
    expect(despues.totalCents).toBeLessThan(50000);
    // Y la version de la reserva no se mueve: el trabajo sigue siendo de enero.
    expect(despues.pricingVersion).toBe(VERSION_DE_LA_RESERVA);
  });

  it('rechazar deja la reserva intacta y guarda el motivo', async () => {
    const id = await propuestaAbierta();
    const antes = await reserva();

    const respuesta = await resolver(id, { approve: false, note: 'Lo asumimos nosotros' });

    expect(respuesta.status).toBe(200);
    expect(await reserva()).toEqual(antes);

    const fila = await db.query<{ state: string; resolutionNote: string }>(
      `SELECT state, "resolutionNote" FROM booking_field_adjustments WHERE id = '${id}'`,
    );
    expect(fila.rows[0]?.state).toBe('REJECTED');
    expect(fila.rows[0]?.resolutionNote).toBe('Lo asumimos nosotros');
  });

  it('RECHAZAR SIN MOTIVO NO SE PUEDE', async () => {
    /*
     * Un rechazo mudo deja al equipo sin saber si midio mal o si la empresa
     * decidio comerse la diferencia. La proxima vez no lo reportara, y
     * entonces se pierde el dato de verdad.
     */
    const id = await propuestaAbierta();

    expect((await resolver(id, { approve: false })).status).toBe(400);
  });

  it('LIMPIEZA NO PUEDE APROBAR SU PROPIA PROPUESTA', async () => {
    // Seria el agujero entero: proponer y aprobarse uno mismo es exactamente
    // lo que la separacion en dos tiempos existe para impedir.
    const id = await propuestaAbierta();

    const respuesta = await resolver(id, { approve: true }, await comoCleo());

    expect(respuesta.status).toBe(403);
    expect((await reserva()).squareFeet).toBe(900);
  });

  it('una propuesta ya resuelta no se resuelve dos veces', async () => {
    const id = await propuestaAbierta();
    await resolver(id, { approve: true });

    expect((await resolver(id, { approve: true })).status).toBe(400);
  });
});

describe('lo que ve cada quien', () => {
  it('LA PANTALLA DE LIMPIEZA NO TRAE NI UN IMPORTE', async () => {
    /*
     * Es la regla de `my-jobs` aplicada aqui, y este es el sitio donde mas
     * falta hace: si la responsable viera «+40 $» al reportar que la casa es
     * mas grande, la siguiente frase previsible en esa puerta es «esto le va
     * a costar cuarenta dolares mas», dicha por quien no decide los precios y
     * antes de que nadie lo haya aprobado.
     */
    await cleoFicha();

    /*
     * SE MIRAN LAS DOS PUERTAS, y la primera version de esta prueba solo
     * miraba una: la respuesta de PROPONER tambien va al movil, y estaba
     * devolviendo el ajuste con sus importes dentro. La fuga vivio en `main`
     * hasta que se escribio la pantalla y hubo que mirar que devolvia.
     */
    const alProponer = await proponer({ squareFeet: 1300, note: 'Es mas grande' });

    const mis = await request(app.getHttpServer())
      .get(MIS_TRABAJOS)
      .set('authorization', `Bearer ${await comoCleo()}`);

    for (const [donde, cuerpo] of [
      ['la respuesta de proponer', alProponer.body],
      ['la lista de mis trabajos', mis.body],
    ] as const) {
      const texto = JSON.stringify(cuerpo);
      expect(texto, `${donde} no trae el ajuste`).toContain('1300');

      for (const prohibido of ['differenceCents', 'newTotalCents', 'totalCents', 'depositCents']) {
        expect(texto, `${donde} trae ${prohibido}`).not.toContain(prohibido);
      }
    }
  });

  it('y coordinacion si los ve, con las dos columnas', async () => {
    await cleoFicha();
    await proponer({ squareFeet: 1300, note: 'Es mas grande' });

    const detalle = await request(app.getHttpServer())
      .get(`${RESERVAS}/${TRABAJO}`)
      .set('authorization', `Bearer ${await comoAda()}`);

    const ajuste = detalle.body.adjustments[0];
    expect(ajuste.booked.squareFeet).toBe(900);
    expect(ajuste.found.squareFeet).toBe(1300);
    expect(ajuste.differenceCents).toBeGreaterThan(0);
    expect(ajuste.proposedByFirstName).toBe('Cleo');
  });

  it('el equipo si ve el motivo del rechazo', async () => {
    // Un rechazo mudo ensena a no volver a reportar nada.
    await cleoFicha();
    const propuesta = await proponer({ squareFeet: 1300, note: 'Es mas grande' });
    await resolver(propuesta.body.adjustments[0].id as string, {
      approve: false,
      note: 'Ya lo sabiamos',
    });

    const mis = await request(app.getHttpServer())
      .get(MIS_TRABAJOS)
      .set('authorization', `Bearer ${await comoDario()}`);

    expect(mis.body.jobs[0].adjustments[0].resolutionNote).toBe('Ya lo sabiamos');
  });
});

describe('la auditoria', () => {
  it('deja las tres acciones, con las cifras y sin datos del cliente', async () => {
    await cleoFicha();
    const propuesta = await proponer({ squareFeet: 1300, note: 'Es mas grande' });
    await resolver(propuesta.body.adjustments[0].id as string, { approve: true });

    const filas = await db.query<{ action: string; metadata: unknown }>(
      `SELECT action, metadata FROM audit_logs
        WHERE action LIKE 'booking.adjustment%' ORDER BY "createdAt"`,
    );

    expect(filas.rows.map((f) => f.action)).toEqual([
      'booking.adjustment.proposed',
      'booking.adjustment.applied',
    ]);

    const texto = JSON.stringify(filas.rows);
    expect(texto).toContain('900 → 1300');
    // Ni nombre, ni correo, ni telefono, ni direccion del cliente.
    for (const dato of ['Luis', 'luis@example.com', '+14045559911', 'Peachtree']) {
      expect(texto, `la auditoria lleva ${dato}`).not.toContain(dato);
    }
  });
});

async function contarAjustes(): Promise<number> {
  const filas = await db.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM booking_field_adjustments WHERE "bookingId" = '${TRABAJO}'`,
  );
  return filas.rows[0]?.n ?? 0;
}

/* ======================================================================== */
/*  SIN PRECIO AUTOMATICO: EL IMPORTE LO PONE ADMINISTRACION                */
/* ======================================================================== */

describe('cuando el motor no puede dar precio', () => {
  /*
   * ESTE BLOQUE SALE DE UN CASO REAL: un ajuste en una casa de Gainesville se
   * quedaba sin poder resolverse. Gainesville esta a unas 50 millas de
   * Atlanta, fuera de las 35 del area metropolitana, y ahi Georgia entera se
   * atiende SIN precio automatico por diseno (`docs/17`). O sea que no es un
   * caso raro: es la mayor parte del estado.
   */

  /** Deja la reserva en una zona donde no hay precio automatico. */
  async function enZonaLejana(): Promise<void> {
    await db.exec(`UPDATE bookings SET "distanceMiles" = 90, zone = 'C' WHERE id = '${TRABAJO}'`);
  }

  async function propuestaSinPrecio(): Promise<string> {
    await enZonaLejana();
    await cleoFicha();
    const respuesta = await proponer({ squareFeet: 2000, note: 'La casa es mas grande' });
    return respuesta.body.adjustments[0].id as string;
  }

  it('la propuesta dice POR QUE no hay precio, no solo que no lo hay', async () => {
    /*
     * El motor se niega por siete razones distintas y el panel las juntaba
     * todas en «este tamano no tiene precio automatico». Casi nunca es el
     * tamano: aqui son 2.000 pies, que la tabla cubre de sobra.
     */
    const id = await propuestaSinPrecio();

    const fila = await db.query<{ noPriceReasonKey: string | null; newTotalCents: number | null }>(
      `SELECT "noPriceReasonKey", "newTotalCents" FROM booking_field_adjustments WHERE id = '${id}'`,
    );

    expect(fila.rows[0]?.newTotalCents).toBeNull();
    expect(fila.rows[0]?.noPriceReasonKey).toBe('quote.review.farZone');
  });

  it('ADMINISTRACION LO APRUEBA CON UN IMPORTE TECLEADO', async () => {
    const id = await propuestaSinPrecio();

    const respuesta = await resolver(id, { approve: true, newTotalCents: 42000 });

    expect(respuesta.status).toBe(200);
    const despues = await reserva();
    expect(despues.totalCents).toBe(42000);
    expect(despues.squareFeet).toBe(2000);
    expect(despues.balanceDueCents).toBe(42000 - 3500);
  });

  it('y queda marcado que el importe lo puso una persona', async () => {
    /*
     * Un total calculado y uno tecleado valen lo mismo en la factura y NO
     * valen lo mismo al revisar las cuentas de un mes: ante un importe raro,
     * lo primero que se pregunta es si lo puso el sistema o alguien.
     */
    const id = await propuestaSinPrecio();
    await resolver(id, { approve: true, newTotalCents: 42000 });

    const fila = await db.query<{ manualPrice: boolean }>(
      `SELECT "manualPrice" FROM booking_field_adjustments WHERE id = '${id}'`,
    );
    expect(fila.rows[0]?.manualPrice).toBe(true);

    const auditoria = await db.query<{ metadata: unknown }>(
      `SELECT metadata FROM audit_logs WHERE action = 'booking.adjustment.applied'`,
    );
    expect(JSON.stringify(auditoria.rows)).toContain('manualPrice');
  });

  it('EL DESGLOSE SIGUE CUADRANDO: se anade una linea con la diferencia', async () => {
    /*
     * No se puede recalcular el desglose —no hay precio automatico, que es
     * todo el motivo de estar aqui— asi que se conserva y se le anade la
     * diferencia. Sin esa linea, el desglose sumaria una cosa y el total
     * diria otra, que es lo que nadie sabe explicar al revisar una factura.
     */
    const id = await propuestaSinPrecio();
    await resolver(id, { approve: true, newTotalCents: 42000 });

    const fila = await db.query<{ lines: { code: string; amountCents: number }[] }>(
      `SELECT lines FROM bookings WHERE id = '${TRABAJO}'`,
    );
    const ajuste = fila.rows[0]?.lines.find((l) => l.code === 'FIELD_ADJUSTMENT');

    expect(ajuste).toBeDefined();
    expect(ajuste?.amountCents).toBe(42000 - 25000);
  });

  it('COORDINACION NO PUEDE TECLEAR IMPORTES', async () => {
    /*
     * LA GUARDIA QUE MAS IMPORTA DE ESTE BLOQUE. La linea es la misma que
     * separa mover una cita de cobrar una tarjeta: el numero que calcula el
     * motor lo aprueba quien lleva la agenda; un numero que sale de la cabeza
     * de una persona lo pone quien responde del dinero.
     */
    const id = await propuestaSinPrecio();

    const respuesta = await resolver(
      id,
      { approve: true, newTotalCents: 42000 },
      await provider.issue(BETO_AUTH, 'beto@example.com', 3600),
    );

    expect(respuesta.status).toBe(403);
    expect((await reserva()).totalCents).toBe(25000);
  });

  it('sin importe no se puede aprobar', async () => {
    const id = await propuestaSinPrecio();

    expect((await resolver(id, { approve: true })).status).toBe(400);
    expect((await reserva()).totalCents).toBe(25000);
  });

  it('rechazar sigue funcionando igual, sin importe', async () => {
    const id = await propuestaSinPrecio();

    const respuesta = await resolver(id, { approve: false, note: 'Lo asumimos' });

    expect(respuesta.status).toBe(200);
    expect((await reserva()).totalCents).toBe(25000);
  });

  it('un importe desmesurado se rechaza', async () => {
    // El tope es el techo de cordura que impide que un cero de mas al
    // teclear se convierta en la factura.
    const id = await propuestaSinPrecio();

    expect((await resolver(id, { approve: true, newTotalCents: 99_000_000 })).status).toBe(400);
  });
});

describe('cuando el motor SI puede dar precio', () => {
  it('NO SE ADMITE UN IMPORTE TECLEADO ENCIMA', async () => {
    /*
     * Dejar sobreescribir el calculo convertiria la tabla de precios en una
     * sugerencia, y entonces dos casas iguales costarian cosas distintas
     * segun quien aprobara el ajuste.
     */
    await cleoFicha();
    const propuesta = await proponer({ squareFeet: 1300, note: 'Es mas grande' });
    const id = propuesta.body.adjustments[0].id as string;

    const respuesta = await resolver(id, { approve: true, newTotalCents: 1 });

    expect(respuesta.status).toBe(400);
    expect((await reserva()).squareFeet).toBe(900);
  });
});
