import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_NOTIFICATION_SETTINGS } from '@freshness/types';
import { AppModule } from '../app.module';
import { NotificationSettingsService } from './notification-settings.service';
import { EMAIL_PROVIDER } from './notifications.types';
import type { LogEmailProvider } from './providers/log-email.provider';
import { ReminderSweepService } from './reminder-sweep.service';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-del-barrido';
  process.env.EMAIL_PROVIDER = 'log';
  // El barrido se llama a mano: depender del reloj haria las pruebas lentas
  // y fragiles.
  process.env.REMINDER_SWEEP_MINUTES = '0';
});

/**
 * BARRIDO DEL RECORDATORIO, CONTRA UNA BASE DE DATOS REAL
 * -------------------------------------------------------
 * Lo que se prueba, por orden de importancia:
 *
 *   1. Que el recordatorio NO se repita en cada pasada. El barrido ve la misma
 *      reserva cada pocos minutos: sin proteccion serian decenas de correos.
 *   2. Que no se avise de lo que no toca (canceladas, pasadas, lejanas).
 *   3. Que una caida larga se recupere sola sin avisar de citas ya ocurridas.
 */

const PORT = 55455;
const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');

const CUSTOMER_ID = 'cccccccc-8888-4888-8888-888888888888';
const ADDRESS_ID = 'eeeeeeee-8888-4888-8888-888888888888';

/** Momento fijo desde el que se calcula todo. */
const AHORA = new Date('2026-11-10T12:00:00Z');

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;
let barrido: ReminderSweepService;
let ajustes: NotificationSettingsService;
let correo: LogEmailProvider;

/** Crea una reserva que empieza dentro de `horas` a partir de AHORA. */
async function sembrar(
  referencia: string,
  horasDesdeAhora: number,
  status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'PENDING_PAYMENT' = 'CONFIRMED',
): Promise<string> {
  const inicio = new Date(AHORA.getTime() + horasDesdeAhora * 3_600_000);
  const fin = new Date(inicio.getTime() + 3 * 3_600_000);
  const id = crypto.randomUUID();

  await db.query(
    `INSERT INTO bookings (
       id, reference, "customerId", "addressId", service, frequency,
       bedrooms, bathrooms, "squareFeet", "scheduledStart", "scheduledEnd",
       "distanceMiles", zone, lines, "serviceCents", "addOnsCents",
       "surchargesCents", "discountCents", "taxCents", "totalCents",
       "depositCents", "balanceDueCents", "pricingVersion", status, "updatedAt"
     ) VALUES (
       '${id}', '${referencia}', '${CUSTOMER_ID}', '${ADDRESS_ID}',
       'STANDARD', 'ONE_TIME', 2, 1, 1200, '${inicio.toISOString()}', '${fin.toISOString()}',
       5, 'A', '[]'::jsonb, 12000, 0, 0, 0, 960, 12960, 3000, 9960, 'v1', '${status}', now()
     )`,
  );

  return id;
}

async function limpiar(): Promise<void> {
  await db.exec(`DELETE FROM notifications; DELETE FROM bookings;`);
  correo.sent.length = 0;
  ajustes.invalidate();
}

beforeAll(async () => {
  db = await PGlite.create();
  socket = new PGLiteSocketServer({ db, port: PORT, host: '127.0.0.1', maxConnections: 10 });
  await socket.start();

  for (const migracion of readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, migracion.name, 'migration.sql'), 'utf8'));
  }

  await db.exec(`
    INSERT INTO customers (id, email, "firstName", "lastName", phone, locale, "updatedAt")
    VALUES ('${CUSTOMER_ID}', 'cliente@example.com', 'Ana', 'Garcia', '+14045550100', 'en', now());

    INSERT INTO addresses (id, "customerId", line1, city, state, "postalCode", "updatedAt")
    VALUES ('${ADDRESS_ID}', '${CUSTOMER_ID}', '1 Peachtree St', 'Atlanta', 'GA', '30301', now());
  `);

  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`;

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();

  barrido = app.get(ReminderSweepService);
  ajustes = app.get(NotificationSettingsService);
  correo = app.get(EMAIL_PROVIDER);
}, 120_000);

afterAll(async () => {
  await app?.close();
  await socket?.stop();
  await db?.close();
});

beforeEach(limpiar);

describe('a quien se avisa', () => {
  it('a una reserva confirmada que empieza manana', async () => {
    await sembrar('FT-R-0001', 20);

    expect(await barrido.ejecutar(AHORA)).toBe(1);
    expect(correo.sent).toHaveLength(1);
    expect(correo.sent[0]?.subject).toContain('Reminder');
    expect(correo.sent[0]?.subject).toContain('FT-R-0001');
  });

  it('el correo dice cuando, donde y cuanto queda por pagar', async () => {
    await sembrar('FT-R-0002', 20);
    await barrido.ejecutar(AHORA);

    const texto = correo.sent[0]?.text ?? '';
    expect(texto).toContain('FT-R-0002');
    expect(texto).toContain('1 Peachtree St');
    // Resto a pagar el dia del servicio: 99,60 dolares.
    expect(texto).toContain('99.60');
  });

  it('NO a una que empieza dentro de tres dias', async () => {
    await sembrar('FT-R-0003', 72);

    expect(await barrido.ejecutar(AHORA)).toBe(0);
    expect(correo.sent).toHaveLength(0);
  });

  it('NO a una cancelada', async () => {
    await sembrar('FT-R-0004', 20, 'CANCELLED');
    expect(await barrido.ejecutar(AHORA)).toBe(0);
  });

  it('NO a una que sigue pendiente de pago', async () => {
    await sembrar('FT-R-0005', 20, 'PENDING_PAYMENT');
    expect(await barrido.ejecutar(AHORA)).toBe(0);
  });

  /*
   * El caso que motiva la condicion "empieza despues de ahora". Sin ella,
   * arrancar tras una caida larga mandaria recordatorios de limpiezas que ya
   * se hicieron, que es la forma mas rapida de que un cliente pierda la
   * confianza en los avisos.
   */
  it('NO a una que ya paso', async () => {
    await sembrar('FT-R-0006', -5);

    expect(await barrido.ejecutar(AHORA)).toBe(0);
    expect(correo.sent).toHaveLength(0);
  });
});

describe('no se repite', () => {
  /*
   * LA PRUEBA CENTRAL DE ESTA ETAPA. El barrido pasa cada 15 minutos y vuelve
   * a ver la misma reserva hasta que llega la cita. Sin proteccion, un cliente
   * con la limpieza a 20 horas vista recibiria unos ochenta correos identicos.
   */
  it('cuatro pasadas seguidas mandan UN solo correo', async () => {
    await sembrar('FT-R-0007', 20);

    await barrido.ejecutar(AHORA);
    await barrido.ejecutar(new Date(AHORA.getTime() + 15 * 60_000));
    await barrido.ejecutar(new Date(AHORA.getTime() + 30 * 60_000));
    await barrido.ejecutar(new Date(AHORA.getTime() + 45 * 60_000));

    expect(correo.sent).toHaveLength(1);

    const enviados = await db.query<{ count: string }>(
      `SELECT count(*) FROM notifications WHERE event = 'BOOKING_REMINDER' AND status = 'SENT'`,
    );
    expect(Number(enviados.rows[0].count)).toBe(1);
  });

  it('la segunda pasada ni siquiera considera la reserva', async () => {
    await sembrar('FT-R-0008', 20);
    await barrido.ejecutar(AHORA);

    // Cero significa que la consulta ya la descarto, no que se cargara y se
    // tirara: es lo que evita trabajo inutil durante todo el dia anterior.
    expect(await barrido.ejecutar(AHORA)).toBe(0);
  });
});

describe('recuperacion tras una caida', () => {
  /*
   * Escenario real: el servidor estuvo parado seis horas. Al volver, las
   * reservas que debieron avisarse siguen en la ventana y sin registro, asi
   * que entran solas en el siguiente barrido. No hace falta nada que
   * "reintente": el barrido no recuerda, recalcula.
   */
  it('las reservas que quedaron sin avisar entran en la siguiente pasada', async () => {
    await sembrar('FT-R-0009', 20);
    await sembrar('FT-R-0010', 22);

    // Nadie barrio durante seis horas. La primera pasada al volver las coge.
    const seisHorasDespues = new Date(AHORA.getTime() + 6 * 3_600_000);
    expect(await barrido.ejecutar(seisHorasDespues)).toBe(2);
    expect(correo.sent).toHaveLength(2);
  });

  it('pero no avisa de las que ya ocurrieron durante la caida', async () => {
    await sembrar('FT-R-0011', 2); // ocurre a las 14:00
    await sembrar('FT-R-0012', 20); // ocurre al dia siguiente

    // Vuelve a estar en pie ocho horas despues: la primera ya paso.
    const ochoHorasDespues = new Date(AHORA.getTime() + 8 * 3_600_000);

    expect(await barrido.ejecutar(ochoHorasDespues)).toBe(1);
    expect(correo.sent[0]?.subject).toContain('FT-R-0012');
  });
});

describe('interruptores', () => {
  it('con el recordatorio apagado no se barre nada', async () => {
    await sembrar('FT-R-0013', 20);
    await guardar({ ...DEFAULT_NOTIFICATION_SETTINGS, emailBookingReminder: false });

    expect(await barrido.ejecutar(AHORA)).toBe(0);
    expect(correo.sent).toHaveLength(0);
  });

  it('la ventana configurable decide a quien alcanza', async () => {
    await sembrar('FT-R-0014', 40);

    // Con la ventana por defecto de 24 horas, una cita a 40 no entra.
    expect(await barrido.ejecutar(AHORA)).toBe(0);

    await guardar({ ...DEFAULT_NOTIFICATION_SETTINGS, reminderHoursBefore: 48 });
    expect(await barrido.ejecutar(AHORA)).toBe(1);
  });

  /** Guarda ajustes directamente y vacia la cache. */
  async function guardar(valores: typeof DEFAULT_NOTIFICATION_SETTINGS): Promise<void> {
    await db.query(
      `INSERT INTO business_settings (key, value, "updatedAt")
       VALUES ('notifications', '${JSON.stringify(valores)}'::jsonb, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    );
    ajustes.invalidate();
  }
});

describe('cuando algo falla', () => {
  /*
   * El barrido lo dispara un temporizador sin nadie escuchando. Una excepcion
   * que suba desde aqui seria un rechazo de promesa sin capturar, y en Node
   * eso puede tumbar el proceso: la API entera caida por un fallo al mandar un
   * recordatorio.
   */
  it('un proveedor de correo caido no rompe el barrido', async () => {
    await sembrar('FT-R-0015', 20);

    const original = correo.send.bind(correo);
    correo.send = () => Promise.reject(new Error('proveedor caido'));

    try {
      await expect(barrido.ejecutar(AHORA)).resolves.toBe(1);
    } finally {
      correo.send = original;
    }

    const fallidos = await db.query<{ count: string }>(
      `SELECT count(*) FROM notifications WHERE event = 'BOOKING_REMINDER' AND status = 'FAILED'`,
    );
    expect(Number(fallidos.rows[0].count)).toBe(1);
  });

  it('y ese recordatorio se reintenta en la siguiente pasada', async () => {
    await sembrar('FT-R-0016', 20);

    const original = correo.send.bind(correo);
    correo.send = () => Promise.reject(new Error('proveedor caido'));
    await barrido.ejecutar(AHORA);
    correo.send = original;

    expect(await barrido.ejecutar(AHORA)).toBe(1);
    expect(correo.sent).toHaveLength(1);
  });
});
