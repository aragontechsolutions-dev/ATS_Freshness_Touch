import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { HORAS_DE_VIDA_DEL_PIN, finDeLaVidaDelPin } from '@freshness/types';
import { SQL_BORRAR_PINES_VENCIDOS } from './door-pin-sweep.service';
import { pinVisible } from './door-pin.helper';

/**
 * EL PIN DE LA PUERTA, CONTRA UNA BASE DE DATOS REAL
 * ==================================================
 * Lo que se prueba aqui, por orden de importancia:
 *
 *   1. QUE LAS DOS MITADES DE LA PROMESA DIGAN LO MISMO. La regla de
 *      caducidad existe dos veces —en SQL para borrar, en TypeScript para no
 *      dejar leer— y no hay forma de que compartan codigo. Si se separan, el
 *      sistema prometeria una cosa y haria otra.
 *   2. QUE LA BASE DE DATOS SE DEFIENDA SOLA. Los `CHECK` tienen que
 *      rechazar media coordenada y un punto fuera de Georgia aunque quien
 *      escriba sea un UPDATE a mano, no la API.
 *   3. QUE EL BARRIDO NO SE LLEVE POR DELANTE UN PIN QUE AUN SIRVE.
 *
 * Se usa Postgres de verdad (PGlite) y no un doble, porque lo que se esta
 * probando ES Postgres: `COALESCE`, `INTERVAL` y los `CHECK` no existen en
 * un doble.
 */

const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');

/** Atlanta. Dentro de Georgia, como exige el `CHECK`. */
const LAT = 33.749;
const LON = -84.388;

let db: PGlite;

beforeAll(async () => {
  db = await PGlite.create();
  for (const m of readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, m.name, 'migration.sql'), 'utf8'));
  }
}, 60_000);

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.exec('DELETE FROM "bookings"; DELETE FROM "addresses"; DELETE FROM "customers";');
  await db.exec(`
    INSERT INTO "customers" ("id", "firstName", "lastName", "email", "phone", "locale",
                             "marketingOptIn", "createdAt", "updatedAt")
    VALUES ('c0000000-0000-4000-8000-0000000000f1', 'Luis', 'Pin', 'luis.pin@example.com',
            '+14045550111', 'en', false, NOW(), NOW());
    INSERT INTO "addresses" ("id", "customerId", "line1", "city", "state", "postalCode",
                             "isPrimary", "createdAt", "updatedAt")
    VALUES ('a0000000-0000-4000-8000-0000000000f1', 'c0000000-0000-4000-8000-0000000000f1',
            '100 Peachtree St', 'Atlanta', 'GA', '30303', true, NOW(), NOW());
  `);
});

/** Crea una reserva con pin y las fechas que decidan su vida. */
async function reservaConPin(
  id: string,
  opciones: { finEnHoras: number; completadaHaceHoras?: number; canceladaHaceHoras?: number },
): Promise<void> {
  const fin = `NOW() + (${opciones.finEnHoras} * INTERVAL '1 hour')`;
  const completada =
    opciones.completadaHaceHoras === undefined
      ? 'NULL'
      : `NOW() - (${opciones.completadaHaceHoras} * INTERVAL '1 hour')`;
  const cancelada =
    opciones.canceladaHaceHoras === undefined
      ? 'NULL'
      : `NOW() - (${opciones.canceladaHaceHoras} * INTERVAL '1 hour')`;

  await db.exec(`
    INSERT INTO "bookings" (
      "id", "reference", "customerId", "addressId", "status", "service", "frequency",
      "bedrooms", "bathrooms", "squareFeet", "addOns", "scheduledStart", "scheduledEnd",
      "timezone", "lines", "serviceCents", "addOnsCents", "surchargesCents", "discountCents",
      "taxCents", "totalCents", "depositCents", "balanceDueCents", "pricingVersion",
      "distanceMiles", "zone",
      "completedAt", "cancelledAt", "doorPinLatitude", "doorPinLongitude",
      "createdAt", "updatedAt"
    ) VALUES (
      '${id}', 'FT-PIN-${id.slice(-4)}', 'c0000000-0000-4000-8000-0000000000f1',
      'a0000000-0000-4000-8000-0000000000f1', 'CONFIRMED', 'STANDARD', 'ONE_TIME',
      3, 2, 1800, '[]'::jsonb, ${fin} - INTERVAL '2 hours', ${fin},
      'America/New_York', '[]'::jsonb, 12000, 0, 0, 0, 0, 12000, 3500, 8500, 'pruebas',
      12.5, 'A',
      ${completada}, ${cancelada}, ${LAT}, ${LON}, NOW(), NOW()
    );
  `);
}

/** Pasa el barrido, con el MISMO SQL que corre en produccion. */
async function pasarElBarrido(): Promise<void> {
  await db.query(SQL_BORRAR_PINES_VENCIDOS, [HORAS_DE_VIDA_DEL_PIN]);
}

/** La fila, con lo que hace falta para decidir sobre su pin. */
async function leer(id: string) {
  const { rows } = await db.query<{
    doorPinLatitude: number | null;
    doorPinLongitude: number | null;
    completedAt: Date | null;
    cancelledAt: Date | null;
    scheduledEnd: Date;
  }>(
    `SELECT "doorPinLatitude", "doorPinLongitude", "completedAt", "cancelledAt", "scheduledEnd"
       FROM "bookings" WHERE "id" = $1`,
    [id],
  );
  const fila = rows[0];
  if (!fila) throw new Error(`no existe la reserva ${id}`);
  return fila;
}

const ID_A = '10000000-0000-4000-8000-0000000000a1';
const ID_B = '10000000-0000-4000-8000-0000000000b1';
const ID_C = '10000000-0000-4000-8000-0000000000c1';

describe('la base de datos se defiende sola', () => {
  it('RECHAZA MEDIA COORDENADA', async () => {
    /*
     * Media coordenada no es un punto: es un dato que parece util y señala
     * a cualquier sitio. El `CHECK` existe para que ni un UPDATE a mano ni
     * una version futura del codigo puedan dejarla a medias.
     */
    await reservaConPin(ID_A, { finEnHoras: 2 });

    await expect(
      db.exec(`UPDATE "bookings" SET "doorPinLongitude" = NULL WHERE "id" = '${ID_A}'`),
    ).rejects.toThrow(/door_pin_completo/);
  });

  it('RECHAZA UN PUNTO FUERA DE GEORGIA', async () => {
    await reservaConPin(ID_A, { finEnHoras: 2 });

    // Miami: latitud valida para el planeta, no para nuestro estado.
    await expect(
      db.exec(
        `UPDATE "bookings" SET "doorPinLatitude" = 25.76, "doorPinLongitude" = -80.19
           WHERE "id" = '${ID_A}'`,
      ),
    ).rejects.toThrow(/door_pin_en_georgia/);
  });

  it('y caza la latitud y la longitud intercambiadas', async () => {
    await reservaConPin(ID_A, { finEnHoras: 2 });

    await expect(
      db.exec(
        `UPDATE "bookings" SET "doorPinLatitude" = ${LON}, "doorPinLongitude" = ${LAT}
           WHERE "id" = '${ID_A}'`,
      ),
    ).rejects.toThrow(/door_pin_en_georgia/);
  });
});

describe('el barrido', () => {
  it('NO SE LLEVA UN PIN QUE TODAVIA SIRVE', async () => {
    // El trabajo es dentro de dos horas: el equipo esta a punto de ir.
    await reservaConPin(ID_A, { finEnHoras: 2 });

    await pasarElBarrido();

    expect((await leer(ID_A)).doorPinLatitude).toBe(LAT);
  });

  it('ni el del dia siguiente, antes de que pasen las 24 h', async () => {
    // Termino hace 23 horas: queda una.
    await reservaConPin(ID_A, { finEnHoras: -23, completadaHaceHoras: 23 });

    await pasarElBarrido();

    expect((await leer(ID_A)).doorPinLatitude).toBe(LAT);
  });

  it('BORRA EL DE UN TRABAJO TERMINADO HACE MAS DE 24 H', async () => {
    await reservaConPin(ID_A, { finEnHoras: -30, completadaHaceHoras: 30 });

    await pasarElBarrido();

    const fila = await leer(ID_A);
    expect(fila.doorPinLatitude).toBeNull();
    expect(fila.doorPinLongitude).toBeNull();
  });

  it('una cancelacion lo mata antes que la fecha prevista', async () => {
    /*
     * El trabajo era para dentro de una semana, pero se cancelo hace dos
     * dias. Medido por `scheduledEnd` el pin viviria otros siete dias; la
     * cancelacion manda.
     */
    await reservaConPin(ID_A, { finEnHoras: 24 * 7, canceladaHaceHoras: 48 });

    await pasarElBarrido();

    expect((await leer(ID_A)).doorPinLatitude).toBeNull();
  });

  it('AUNQUE NADIE MARQUE QUE TERMINO', async () => {
    /*
     * El caso que sostiene la promesa. Si el equipo se olvida de pulsar «he
     * terminado», `completedAt` se queda nulo para siempre. Medido desde el
     * final PREVISTO, el pin muere igual.
     */
    await reservaConPin(ID_A, { finEnHoras: -72 });

    await pasarElBarrido();

    expect((await leer(ID_A)).doorPinLatitude).toBeNull();
  });

  it('no toca los demas campos de la reserva', async () => {
    await reservaConPin(ID_A, { finEnHoras: -30, completadaHaceHoras: 30 });

    await pasarElBarrido();

    const { rows } = await db.query<{ totalCents: number; status: string }>(
      `SELECT "totalCents", "status" FROM "bookings" WHERE "id" = $1`,
      [ID_A],
    );
    expect(rows[0]).toEqual({ totalCents: 12000, status: 'CONFIRMED' });
  });
});

describe('las dos mitades de la promesa dicen lo mismo', () => {
  it('LO QUE BORRA EL SQL ES EXACTAMENTE LO QUE YA NO DEJA LEER TYPESCRIPT', async () => {
    /*
     * ====================================================================
     * LA PRUEBA QUE MAS IMPORTA DE ESTE ARCHIVO
     * ====================================================================
     * La regla de caducidad vive dos veces: en SQL (el barrido, que borra) y
     * en TypeScript (`finDeLaVidaDelPin`, que impide leer). No pueden
     * compartir codigo —una la ejecuta Postgres y la otra Node—, asi que
     * nada impide que alguien cambie una y se olvide de la otra.
     *
     * Si eso pasara, el sistema prometeria una cosa y haria otra: pines
     * visibles que la base cree borrados, o al reves.
     *
     * Aqui se comparan con las MISMAS fechas y en los MISMOS casos limite, y
     * el SQL que se ejecuta es la constante que usa el servicio, no una
     * copia escrita en la prueba.
     */
    await reservaConPin(ID_A, { finEnHoras: 2 }); // vivo: aun no ha pasado
    await reservaConPin(ID_B, { finEnHoras: -23, completadaHaceHoras: 23 }); // vivo por una hora
    await reservaConPin(ID_C, { finEnHoras: -30, completadaHaceHoras: 30 }); // vencido

    // Lo que dice TypeScript ANTES de que el barrido toque nada.
    const antes = {
      A: pinVisible(await leer(ID_A)) !== null,
      B: pinVisible(await leer(ID_B)) !== null,
      C: pinVisible(await leer(ID_C)) !== null,
    };

    await pasarElBarrido();

    // Lo que dice la base DESPUES.
    const despues = {
      A: (await leer(ID_A)).doorPinLatitude !== null,
      B: (await leer(ID_B)).doorPinLatitude !== null,
      C: (await leer(ID_C)).doorPinLatitude !== null,
    };

    expect(despues).toEqual(antes);
    // Y que el caso vencido de verdad lo era, para que la igualdad de arriba
    // no se cumpla solo porque todo esta vivo.
    expect(antes.C).toBe(false);
    expect(antes.A).toBe(true);
  });

  it('UN PIN VENCIDO NO SE PUEDE LEER AUNQUE EL BARRIDO NO HAYA PASADO', async () => {
    /*
     * El escenario que justifica tener las dos defensas: la API lleva el fin
     * de semana caida, el barrido no ha corrido, la fila sigue con sus
     * coordenadas. La promesa se cumple igual porque nadie puede leerlas.
     */
    await reservaConPin(ID_A, { finEnHoras: -30, completadaHaceHoras: 30 });

    const fila = await leer(ID_A);
    expect(fila.doorPinLatitude).toBe(LAT); // la fila SIGUE AHI
    expect(pinVisible(fila)).toBeNull(); // y aun asi no sale
  });

  it('la fecha que calcula TypeScript es la que dice la base', async () => {
    await reservaConPin(ID_A, { finEnHoras: 5 });

    const fila = await leer(ID_A);
    const vence = finDeLaVidaDelPin(fila);
    const esperado = fila.scheduledEnd.getTime() + HORAS_DE_VIDA_DEL_PIN * 3_600_000;

    expect(vence.getTime()).toBe(esperado);
  });
});
