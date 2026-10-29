import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { NOTIFICATION_MAX_ATTEMPTS } from '@freshness/types';
import { AppModule } from '../app.module';
import { NotificationRetrySweepService } from './notification-retry-sweep.service';
import { EMAIL_PROVIDER, type EmailProvider } from './notifications.types';

/**
 * EL CORREO QUE FALLO
 * -------------------
 * Lo que se prueba es la cadena entera de lo que antes no existia: que se
 * vuelve a intentar, que al conseguirlo la fila queda ENVIADA y deja de
 * reintentarse, que al agotarse se avisa a una persona, y —lo mas
 * importante— que **nunca se manda dos veces** el mismo correo.
 */

const PUERTO = 55499;
const MIGRACIONES = join(import.meta.dirname, '../../prisma/migrations');

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;
let barrido: NotificationRetrySweepService;
let correo: EmailProvider & { sent: { subject: string }[] };

const CLIENTE = '99999999-9999-4999-8999-999999999999';
const DIRECCION = '88888888-8888-4888-8888-888888888888';
const RESERVA = '77777777-7777-4777-8777-777777777777';
const AVISO = '66666666-6666-4666-8666-666666666666';

const AHORA = new Date('2026-11-10T15:00:00.000Z');

/** Un correo fallido al cliente, listo para reintentar. */
async function sembrarFallido(intentos: number, cuandoToca: Date): Promise<void> {
  await db.exec(`
    INSERT INTO notifications (id, "bookingId", event, channel, audience, status,
                               target, "failureReason", attempts, "nextAttemptAt")
    VALUES ('${AVISO}', '${RESERVA}', 'BOOKING_CONFIRMED', 'EMAIL', 'CUSTOMER', 'FAILED',
            'a***@example.com', 'El proveedor no respondio', ${String(intentos)},
            '${cuandoToca.toISOString()}');
  `);
}

async function leerAviso() {
  const filas = await db.query<{
    status: string;
    attempts: number;
    nextAttemptAt: Date | null;
  }>(`SELECT status, attempts, "nextAttemptAt" FROM notifications WHERE id = '${AVISO}'`);
  return filas.rows[0];
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

  await db.exec(`
    INSERT INTO customers (id, email, "firstName", "lastName", phone, locale, "updatedAt")
    VALUES ('${CLIENTE}', 'ana.reintento@example.com', 'Ana', 'Perez', '+14045550101', 'en', now());

    INSERT INTO addresses (id, "customerId", line1, city, state, "postalCode", "updatedAt")
    VALUES ('${DIRECCION}', '${CLIENTE}', '1 Peachtree St', 'Atlanta', 'GA', '30301', now());

    INSERT INTO bookings (id, reference, "customerId", "addressId", status, service, frequency,
                          bedrooms, bathrooms, "squareFeet", "scheduledStart", "scheduledEnd",
                          "distanceMiles", zone, lines, "serviceCents", "addOnsCents",
                          "surchargesCents", "discountCents", "taxCents", "totalCents",
                          "depositCents", "balanceDueCents", "pricingVersion", "updatedAt")
    VALUES ('${RESERVA}', 'FT-2026-7001', '${CLIENTE}', '${DIRECCION}', 'CONFIRMED', 'STANDARD',
            'ONE_TIME', 3, 2, 1600, now(), now(), 20, 'A', '[]', 18500, 0, 0, 0, 0, 18500,
            3500, 15000, 'v1', now());
  `);

  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.EMAIL_PROVIDER = 'log';
  process.env.REMINDER_SWEEP_MINUTES = '0';
  process.env.REMOVAL_SWEEP_MINUTES = '0';
  process.env.HOLD_SWEEP_MINUTES = '0';
  process.env.SERIES_SWEEP_MINUTES = '0';
  process.env.GEOCODING_SWEEP_MINUTES = '0';
  /* El barrido del reintento, APAGADO: cada prueba lo llama a mano. */
  process.env.NOTIFICATION_RETRY_MINUTES = '0';
  process.env.AUDIT_PURGE_HOURS = '0';
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PUERTO}/postgres`;

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  barrido = app.get(NotificationRetrySweepService);
  correo = app.get(EMAIL_PROVIDER);
}, 120_000);

afterAll(async () => {
  await app?.close();
  await socket?.stop();
  await db?.close();
});

afterEach(async () => {
  vi.restoreAllMocks();
  correo.sent.length = 0;
  await db.exec(`DELETE FROM staff_notifications; DELETE FROM notifications;`);
});

describe('vuelve a intentarlo', () => {
  it('reenvia el correo y deja la fila como enviada', async () => {
    await sembrarFallido(1, new Date(AHORA.getTime() - 60_000));

    await barrido.pasada(AHORA);

    expect(correo.sent).toHaveLength(1);

    const fila = await leerAviso();
    expect(fila?.status).toBe('SENT');
    expect(fila?.attempts).toBe(2);
    /* Enviado = no hay nada programado. Si no, se reenviaria para siempre. */
    expect(fila?.nextAttemptAt).toBeNull();
  });

  /*
   * ES LA PRUEBA QUE MAS IMPORTA DE ESTE ARCHIVO. La fila se reescribe en vez
   * de duplicarse, y el indice unico de la tabla es PARCIAL (`WHERE status =
   * 'SENT'`): si el reintento insertara una fila nueva en lugar de actualizar
   * la que hay, el registro diria dos cosas a la vez y la vieja seguiria
   * pidiendo reintentos. El cliente recibiria un correo cada pasada.
   */
  it('una segunda pasada ya no manda nada', async () => {
    await sembrarFallido(1, new Date(AHORA.getTime() - 60_000));

    await barrido.pasada(AHORA);
    await barrido.pasada(new Date(AHORA.getTime() + 3_600_000));

    expect(correo.sent).toHaveLength(1);

    const filas = await db.query('SELECT id FROM notifications');
    expect(filas.rows).toHaveLength(1);
  });

  it('todavia no le toca: no se toca', async () => {
    await sembrarFallido(1, new Date(AHORA.getTime() + 600_000));

    await barrido.pasada(AHORA);

    expect(correo.sent).toHaveLength(0);
    expect((await leerAviso())?.attempts).toBe(1);
  });

  /*
   * LO ANTERIOR A ESTA ETAPA NO SE REENVIA. Mandar hoy la confirmacion de una
   * reserva de hace tres semanas no ayuda a nadie y confunde a quien la
   * reciba: esas filas tienen `nextAttemptAt` nulo y se quedan quietas.
   */
  it('una fila fallida sin fecha programada no se reintenta', async () => {
    await db.exec(`
      INSERT INTO notifications (id, "bookingId", event, channel, audience, status, attempts)
      VALUES ('${AVISO}', '${RESERVA}', 'BOOKING_CONFIRMED', 'EMAIL', 'CUSTOMER', 'FAILED', 1);
    `);

    await barrido.pasada(AHORA);

    expect(correo.sent).toHaveLength(0);
  });
});

describe('cuando vuelve a fallar', () => {
  /** Hace que el proveedor de correo falle en este envio. */
  const queFalle = (): void => {
    vi.spyOn(correo, 'send').mockRejectedValue(new Error('El proveedor sigue caido'));
  };

  it('programa el siguiente y no avisa todavia a nadie', async () => {
    await sembrarFallido(1, new Date(AHORA.getTime() - 60_000));
    queFalle();

    await barrido.pasada(AHORA);

    const fila = await leerAviso();
    expect(fila?.status).toBe('FAILED');
    expect(fila?.attempts).toBe(2);
    expect(fila?.nextAttemptAt).not.toBeNull();

    /*
     * AVISAR AL PRIMER FALLO SERIA AVISAR DE CASI TODOS LOS HIPOS de un
     * proveedor de correo, y una bandeja que avisa de lo que se arregla solo
     * deja de leerse.
     */
    const avisos = await db.query('SELECT id FROM staff_notifications');
    expect(avisos.rows).toHaveLength(0);
  });

  /*
   * AL AGOTARSE SI SE MOLESTA A UNA PERSONA: es el unico aviso de la bandeja
   * que significa que alguien que pago se ha quedado sin nada por escrito.
   */
  it('al agotar los intentos deja de insistir y avisa a administracion', async () => {
    await sembrarFallido(NOTIFICATION_MAX_ATTEMPTS - 1, new Date(AHORA.getTime() - 60_000));
    queFalle();

    await barrido.pasada(AHORA);

    const fila = await leerAviso();
    expect(fila?.attempts).toBe(NOTIFICATION_MAX_ATTEMPTS);
    /* Se deja de insistir: nulo es «no hay nada programado». */
    expect(fila?.nextAttemptAt).toBeNull();

    const avisos = await db.query<{
      kind: string;
      audience: string;
      params: { reference: string };
    }>('SELECT kind, audience, params FROM staff_notifications');

    expect(avisos.rows).toHaveLength(1);
    expect(avisos.rows[0]?.kind).toBe('notification.failed');
    expect(avisos.rows[0]?.audience).toBe('ADMIN');
    expect(avisos.rows[0]?.params.reference).toBe('FT-2026-7001');
    /* La referencia, nunca la direccion de correo. */
    expect(JSON.stringify(avisos.rows[0]?.params)).not.toContain('@');
  });
});

describe('lo que no se reintenta', () => {
  /*
   * LOS AVISOS DE TELEGRAM SON NUESTROS y suelen fallar por configuracion:
   * un grupo que no existe no se arregla insistiendo cuatro veces.
   */
  it('un aviso de Telegram fallido se queda como esta', async () => {
    await db.exec(`
      INSERT INTO notifications (id, "bookingId", event, channel, audience, status,
                                 attempts, "nextAttemptAt")
      VALUES ('${AVISO}', '${RESERVA}', 'BOOKING_CONFIRMED', 'TELEGRAM', 'INTERNAL', 'FAILED',
              1, '${new Date(AHORA.getTime() - 60_000).toISOString()}');
    `);

    await barrido.pasada(AHORA);

    expect(correo.sent).toHaveLength(0);
    expect((await leerAviso())?.attempts).toBe(1);
  });
});
