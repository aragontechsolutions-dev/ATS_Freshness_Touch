import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DateTime } from 'luxon';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PRIVACY_VERSION, TERMS_VERSION } from '@freshness/types';
import { AppModule } from '../app.module';

/**
 * SIN ACEPTAR, NO SE RESERVA
 * --------------------------
 * Es la unica regla del formulario que no protege de un error sino de una
 * AUSENCIA: una reserva sin constancia de lo que se acepto no se puede
 * defender despues, y no se nota hasta el dia que hace falta.
 *
 * ========================================================================
 * EN SU PROPIO ARCHIVO POR EL LIMITE DE PETICIONES
 * ========================================================================
 * `POST /bookings` admite CINCO POR MINUTO, y ese limite esta puesto para
 * produccion: cada reserva escribe en la base y crea una retencion en una
 * tarjeta. Metidas en `bookings.e2e.test.ts` estas tres pruebas gastaban un
 * presupuesto ya consumido y respondian 429.
 *
 * Bajar el limite en las pruebas seria dejar de probar lo que corre de
 * verdad. Otro archivo con su propia aplicacion cuesta unos segundos y no
 * toca produccion.
 */

const PUERTO = 55497;
const MIGRACIONES = join(import.meta.dirname, '../../prisma/migrations');
const RUTA = '/api/v1/bookings';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;

const TRABAJO = {
  service: 'STANDARD' as const,
  frequency: 'MONTHLY' as const,
  bedrooms: 3,
  bathrooms: 2,
  squareFeet: 1500,
  addOns: [],
};

const DIRECCION = {
  line1: '123 Peachtree St NE',
  city: 'Atlanta',
  state: 'GA',
  postalCode: '30303',
};

const CONTACTO = {
  firstName: 'Ana',
  lastName: 'Perez',
  phone: '+1 404 555 0101',
};

/** Un dia laborable con horario completo, para que siempre haya franjas. */
function proximoDiaLaborable(): string {
  let dia = DateTime.now().setZone('America/New_York').plus({ days: 3 }).startOf('day');
  while (dia.weekday > 5) dia = dia.plus({ days: 1 });
  return dia.toFormat('yyyy-MM-dd');
}

async function primeraFranjaLibre(): Promise<string> {
  const { frequency: _cadencia, ...sinCadencia } = TRABAJO;

  const disponibilidad = await request(app.getHttpServer())
    .get('/api/v1/availability')
    .query({ date: proximoDiaLaborable(), ...sinCadencia, addOns: [] })
    .expect(200);

  const libre = (disponibilidad.body.slots as { available: boolean; startsAt: string }[]).find(
    (slot) => slot.available,
  );

  return libre?.startsAt ?? '';
}

beforeAll(async () => {
  db = await PGlite.create();
  socket = new PGLiteSocketServer({ db, port: PUERTO, host: '127.0.0.1', maxConnections: 10 });
  await socket.start();

  for (const migracion of readdirSync(MIGRACIONES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await db.exec(readFileSync(join(MIGRACIONES, migracion.name, 'migration.sql'), 'utf8'));
  }

  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.GEOCODING_SWEEP_MINUTES = '0';
  process.env.REMINDER_SWEEP_MINUTES = '0';
  process.env.HOLD_SWEEP_MINUTES = '0';
  process.env.SERIES_SWEEP_MINUTES = '0';
  process.env.AUDIT_PURGE_HOURS = '0';
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PUERTO}/postgres`;

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
  await app.init();
}, 120_000);

afterAll(async () => {
  await app?.close();
  await socket?.stop();
  await db?.close();
});

describe('las condiciones y la privacidad', () => {
  it('sin la aceptacion no se crea la reserva', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(RUTA)
      .send({
        ...TRABAJO,
        startsAt: await primeraFranjaLibre(),
        contact: { ...CONTACTO, email: 'sin-aceptar@example.com' },
        address: DIRECCION,
      });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.code).toBe('LEGAL_NOT_ACCEPTED');

    /*
     * EL ERROR ES PROPIO Y NO UNO DE VALIDACION, a proposito: el caso
     * realista no es un formulario mal rellenado sino una pestana abierta de
     * antes del despliegue, y a esa persona hay que decirle que recargue.
     */
    expect(respuesta.body.messageKey).toBe('booking.errorLegalNotAccepted');

    const filas = await db.query('SELECT id FROM bookings');
    expect(filas.rows).toHaveLength(0);
  });

  it('con la aceptacion se crea, y la version queda guardada', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(RUTA)
      .send({
        ...TRABAJO,
        startsAt: await primeraFranjaLibre(),
        contact: { ...CONTACTO, email: 'con-version@example.com' },
        address: DIRECCION,
        legal: { termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION },
      });

    expect(respuesta.status).toBe(201);

    const filas = await db.query<{
      termsVersion: number;
      privacyVersion: number;
      legalAcceptedAt: Date | null;
    }>(
      `SELECT "termsVersion", "privacyVersion", "legalAcceptedAt"
       FROM bookings WHERE id = '${respuesta.body.bookingId as string}'`,
    );

    expect(filas.rows[0]?.termsVersion).toBe(TERMS_VERSION);
    expect(filas.rows[0]?.privacyVersion).toBe(PRIVACY_VERSION);
    expect(filas.rows[0]?.legalAcceptedAt).not.toBeNull();
  });

  /*
   * UNA VERSION INVENTADA NO PASA. No es paranoia: el campo viaja desde el
   * navegador, y si se admitiera cualquier cosa, la fila diria «version 0» o
   * «version -1» y el registro dejaria de significar nada.
   */
  it('una version que no es un numero positivo se rechaza', async () => {
    const respuesta = await request(app.getHttpServer())
      .post(RUTA)
      .send({
        ...TRABAJO,
        startsAt: await primeraFranjaLibre(),
        contact: { ...CONTACTO, email: 'version-rara@example.com' },
        address: DIRECCION,
        legal: { termsVersion: 0, privacyVersion: PRIVACY_VERSION },
      });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.code).toBe('VALIDATION_ERROR');
  });
});
