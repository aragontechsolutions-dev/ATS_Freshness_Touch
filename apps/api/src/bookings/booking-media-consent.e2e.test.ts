import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DateTime } from 'luxon';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module';

/**
 * EL PERMISO DE IMAGEN QUE SE DA AL RESERVAR
 * ------------------------------------------
 * El caso NORMAL es que el dia del servicio no haya nadie en casa: en una
 * mudanza esta vacia, en una recurrente el cliente esta trabajando, y hay
 * quien contrata desde otro estado. Si el permiso solo se puede obtener en
 * persona, no se obtiene — y con el modo estricto, lo que no se obtiene no se
 * publica.
 *
 * ========================================================================
 * POR QUE ESTO NO VA EN `bookings.e2e.test.ts`
 * ========================================================================
 * Porque crear una reserva esta limitado a CINCO POR MINUTO Y POR IP, y ese
 * limite esta escrito en el controlador, no en una variable de entorno que se
 * pueda subir desde una prueba. Aquel archivo ya gasta las cinco; una sexta
 * reserva ahi no falla por lo que prueba, falla con un 429 que no menciona el
 * recuento y manda a buscar el error donde no esta.
 *
 * Con su propia aplicacion, el contador empieza de cero. Aun asi aqui se
 * reservan CUATRO veces y no mas, por el mismo limite.
 */

const PORT = 55492;
const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;

function proximoDiaLaborable(): string {
  let day = DateTime.now().setZone('America/New_York').plus({ days: 3 }).startOf('day');
  while (day.weekday === 7) {
    day = day.plus({ days: 1 });
  }
  return day.toFormat('yyyy-MM-dd');
}

const CONTACTO = {
  firstName: 'Ana',
  lastName: 'Perez',
  phone: '+1 404 555 0101',
  locale: 'es' as const,
};

const DIRECCION = {
  line1: '123 Peachtree St NE',
  city: 'Atlanta',
  state: 'GA',
  postalCode: '30303',
};

const TRABAJO = {
  service: 'STANDARD' as const,
  frequency: 'MONTHLY' as const,
  bedrooms: 3,
  bathrooms: 2,
  squareFeet: 1800,
  addOns: [],
};

const { frequency: _cadencia, ...TRABAJO_SIN_CADENCIA } = TRABAJO;

interface FilaDePermiso {
  reference: string;
  evidenceKind: string;
  customerName: string;
  propertyAddress: string;
  occupiedByOthers: boolean;
  occupantConsent: boolean;
  coversInterior: boolean;
  coversExterior: boolean;
  allowsBefore: boolean;
  channels: string[];
  removalDays: number;
  videoIds: string[];
  photoPaths: string[];
  notes: string | null;
}

/** Cada reserva con un correo distinto: si no, el indice unico la rechaza. */
let contador = 0;

async function reservar(permiso?: Record<string, boolean>) {
  contador += 1;

  const disponibilidad = await request(app.getHttpServer())
    .get('/api/v1/availability')
    .query({ date: proximoDiaLaborable(), ...TRABAJO_SIN_CADENCIA, addOns: [] })
    .expect(200);

  const franja = (disponibilidad.body.slots as { available: boolean; startsAt: string }[]).filter(
    (slot) => slot.available,
  )[contador - 1]?.startsAt;

  return request(app.getHttpServer())
    .post('/api/v1/bookings')
    .send({
      ...TRABAJO,
      startsAt: franja,
      contact: { ...CONTACTO, email: `permiso-${String(contador)}@example.com` },
      address: DIRECCION,
      ...(permiso ? { mediaConsent: permiso } : {}),
    });
}

async function permisos(): Promise<FilaDePermiso[]> {
  const filas = await db.query<FilaDePermiso>(`SELECT * FROM media_consents`);
  return filas.rows;
}

beforeAll(async () => {
  db = await PGlite.create();
  socket = new PGLiteSocketServer({ db, port: PORT, host: '127.0.0.1', maxConnections: 10 });
  await socket.start();

  const migraciones = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const migracion of migraciones) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, migracion.name, 'migration.sql'), 'utf8'));
  }

  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`;
  process.env.QUOTE_RATE_LIMIT_MAX = '100';
  process.env.RATE_LIMIT_MAX = '200';
  process.env.GEOCODING_SWEEP_MINUTES = '0';

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

describe('cuando el cliente marca el permiso al reservar', () => {
  /*
   * LA PRUEBA QUE JUSTIFICA LA ETAPA: la ficha queda anotada sola, con lo que
   * la reserva ya sabia, sin que nadie teclee nada.
   */
  it('queda anotada la ficha completa, y nace sin piezas', async () => {
    const reserva = await reservar({ granted: true, allowsBefore: true });
    expect(reserva.status).toBe(201);

    const [permiso] = await permisos();
    expect(permiso?.reference).toBe(reserva.body.reference);
    expect(permiso?.evidenceKind).toBe('WEB_FORM');
    expect(permiso?.customerName).toBe('Ana Perez');
    expect(permiso?.propertyAddress).toContain('123 Peachtree St NE');
    expect(permiso?.allowsBefore).toBe(true);

    // Los cinco dias que decidio la duena.
    expect(permiso?.removalDays).toBe(5);

    /*
     * SOLO LA WEB. El texto del formulario autoriza la pagina, no las redes:
     * publicar en Facebook con un permiso que no las nombra es publicar sin
     * permiso.
     */
    expect(permiso?.channels).toEqual(['WEBSITE']);
    expect(permiso?.coversInterior).toBe(true);
    expect(permiso?.coversExterior).toBe(true);

    /*
     * LA VERSION DEL TEXTO. Un permiso vale por lo que decia el texto que la
     * persona leyo, no por lo que diga hoy la pagina.
     */
    expect(permiso?.notes).toBe('Formulario de reserva, texto v1');

    /*
     * SIN PIEZAS: el video todavia no existe cuando se reserva. Se le atan
     * despues, desde el panel.
     */
    expect(permiso?.videoIds).toEqual([]);
    expect(permiso?.photoPaths).toEqual([]);
  });

  /*
   * QUIEN RESERVA NO PUEDE DAR EL PERMISO DE QUIEN VIVE ALLI. Y el «antes»
   * tampoco viene de regalo: es la parte sensible, su casa sucia.
   */
  it('si alli vive otra persona, queda anotado que falta su permiso', async () => {
    await reservar({ granted: true, allowsBefore: false, occupiedByOthers: true });

    const permiso = (await permisos()).find((fila) => fila.occupiedByOthers);
    expect(permiso?.occupiedByOthers).toBe(true);
    expect(permiso?.occupantConsent).toBe(false);
    expect(permiso?.allowsBefore).toBe(false);
  });
});

describe('cuando no lo marca', () => {
  it('no se anota ningun permiso', async () => {
    const antes = (await permisos()).length;
    await reservar({ granted: false, allowsBefore: true });

    expect(await permisos()).toHaveLength(antes);
  });

  /*
   * EL SITIO Y LA API SE DESPLIEGAN POR SEPARADO. Una reserva enviada por una
   * version anterior del formulario no trae el campo, y lo que tiene que
   * pasar entonces es que NO haya permiso — nunca que se suponga uno que
   * nadie dio.
   */
  it('una reserva sin el campo se acepta igual, y tampoco anota ninguno', async () => {
    const antes = (await permisos()).length;
    const reserva = await reservar();

    expect(reserva.status).toBe(201);
    expect(await permisos()).toHaveLength(antes);
  });
});
