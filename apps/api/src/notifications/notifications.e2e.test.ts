import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_NOTIFICATION_SETTINGS, type NotificationSettings } from '@freshness/types';
import { AppModule } from '../app.module';
import { AUTH_PROVIDER } from '../auth/auth.types';
import type { LocalAuthProvider } from '../auth/providers/local-auth.provider';
import { NotificationSettingsService } from './notification-settings.service';
import { NotificationsService } from './notifications.service';
import { EMAIL_PROVIDER } from './notifications.types';
import type { LogEmailProvider } from './providers/log-email.provider';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-de-avisos';
  process.env.EMAIL_PROVIDER = 'log';
});

/**
 * AVISOS, CONTRA UNA BASE DE DATOS REAL
 * -------------------------------------
 * Lo que se prueba, por orden de importancia:
 *
 *   1. Que un aviso NO se envie dos veces aunque el webhook se reentregue.
 *   2. Que un fallo del proveedor de correo NO tumbe nada.
 *   3. Que el correo al cliente no lleve lo que no debe llevar.
 *   4. Que solo administracion decida a donde van los avisos.
 */

const PORT = 55454;
const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');

const ADMIN_AUTH_ID = 'auth-admin-avisos';
const DISPATCHER_AUTH_ID = 'auth-dispatcher-avisos';
const AJUSTES = '/api/v1/admin/notification-settings';

const BOOKING_ID = 'dddddddd-1111-4111-8111-111111111111';
const CUSTOMER_ID = 'cccccccc-1111-4111-8111-111111111111';
const ADDRESS_ID = 'eeeeeeee-1111-4111-8111-111111111111';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;
let provider: LocalAuthProvider;
let notifications: NotificationsService;
let ajustes: NotificationSettingsService;
let correo: LogEmailProvider;

async function comoAdmin(): Promise<string> {
  return provider.issue(ADMIN_AUTH_ID, 'ada@example.com', 3600);
}

/** Deja la tabla de avisos vacia entre escenarios. */
async function limpiarAvisos(): Promise<void> {
  await db.exec(`DELETE FROM notifications`);
  correo.sent.length = 0;
}

async function guardarAjustes(valores: NotificationSettings): Promise<void> {
  await request(app.getHttpServer())
    .put(AJUSTES)
    .set('authorization', `Bearer ${await comoAdmin()}`)
    .send(valores);
  ajustes.invalidate();
}

interface FilaAviso {
  event: string;
  channel: string;
  audience: string;
  status: string;
  target: string | null;
  failureReason: string | null;
}

async function avisos(): Promise<FilaAviso[]> {
  const resultado = await db.query<FilaAviso>(
    `SELECT event, channel, audience, status, target, "failureReason"
     FROM notifications ORDER BY channel, audience`,
  );
  return resultado.rows;
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
    INSERT INTO staff (id, "authUserId", "firstName", "lastName", email, role, "isActive", "updatedAt")
    VALUES
      ('aaaaaaaa-7777-4777-8777-777777777771', '${ADMIN_AUTH_ID}', 'Ada', 'Jefa', 'ada@example.com', 'ADMIN', true, now()),
      ('bbbbbbbb-7777-4777-8777-777777777772', '${DISPATCHER_AUTH_ID}', 'Beto', 'Agenda', 'beto@example.com', 'DISPATCHER', true, now())
  `);

  // Cliente en espanol a proposito: asi se comprueba de paso que el correo
  // sale en el idioma de quien lo recibe y no en el del servidor.
  await db.exec(`
    INSERT INTO customers (id, email, "firstName", "lastName", phone, locale, "updatedAt")
    VALUES ('${CUSTOMER_ID}', 'ana.garcia@example.com', 'Ana', 'García', '+14045550100', 'es', now());

    INSERT INTO addresses (id, "customerId", line1, city, state, "postalCode", "accessNotes", "updatedAt")
    VALUES ('${ADDRESS_ID}', '${CUSTOMER_ID}', '742 Evergreen Terrace', 'Atlanta', 'GA', '30301',
            'Codigo de la puerta 4815, llave bajo la maceta', now());

    INSERT INTO bookings (
      id, reference, "customerId", "addressId", service, frequency,
      bedrooms, bathrooms, "squareFeet", "scheduledStart", "scheduledEnd",
      "distanceMiles", zone, lines, "serviceCents", "addOnsCents",
      "surchargesCents", "discountCents", "taxCents", "totalCents",
      "depositCents", "balanceDueCents", "pricingVersion", "updatedAt"
    ) VALUES (
      '${BOOKING_ID}', 'FT-2026-0042', '${CUSTOMER_ID}', '${ADDRESS_ID}',
      'STANDARD', 'ONE_TIME', 3, 2, 1800, '2026-11-10T14:00:00Z', '2026-11-10T17:00:00Z',
      8, 'B', '[]'::jsonb, 18000, 0, 0, 0, 1440, 19440, 3000, 16440, 'v1', now()
    )
  `);

  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`;

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
  await app.init();

  provider = app.get<LocalAuthProvider>(AUTH_PROVIDER);
  notifications = app.get(NotificationsService);
  ajustes = app.get(NotificationSettingsService);
  correo = app.get(EMAIL_PROVIDER);
}, 120_000);

afterAll(async () => {
  await app?.close();
  await socket?.stop();
  await db?.close();
});

beforeEach(async () => {
  await limpiarAvisos();
  ajustes.invalidate();
});

describe('correo de confirmacion al cliente', () => {
  it('sale al correo del cliente y queda registrado', async () => {
    await notifications.bookingConfirmed(BOOKING_ID);

    expect(correo.sent).toHaveLength(1);
    expect(correo.sent[0]?.to).toBe('ana.garcia@example.com');

    const filas = await avisos();
    expect(filas).toContainEqual(
      expect.objectContaining({ channel: 'EMAIL', audience: 'CUSTOMER', status: 'SENT' }),
    );
  });

  it('va en el idioma del cliente, no en el del servidor', async () => {
    await notifications.bookingConfirmed(BOOKING_ID);

    const mensaje = correo.sent[0];
    expect(mensaje?.subject).toContain('Limpieza confirmada');
    expect(mensaje?.text).toContain('Hola Ana');
  });

  it('lleva la referencia, la fecha y los importes', async () => {
    await notifications.bookingConfirmed(BOOKING_ID);

    const texto = correo.sent[0]?.text ?? '';
    expect(texto).toContain('FT-2026-0042');
    expect(texto).toContain('742 Evergreen Terrace');
    // Deposito retenido y resto a pagar.
    expect(texto).toContain('30');
    expect(texto).toContain('164');
  });

  /*
   * LA PRUEBA DE PRIVACIDAD. El cliente da el codigo de su puerta al reservar.
   * Devolverselo por correo no le aporta nada —ya lo sabe— y multiplica los
   * sitios donde ese codigo existe: el buzon del cliente, el del proveedor de
   * correo y cualquier servidor por el que pase.
   */
  it('NUNCA lleva las instrucciones de acceso', async () => {
    await notifications.bookingConfirmed(BOOKING_ID);

    const mensaje = correo.sent[0];
    expect(mensaje?.text).not.toContain('4815');
    expect(mensaje?.html).not.toContain('4815');
    expect(mensaje?.text.toLowerCase()).not.toContain('maceta');
  });

  it('el registro guarda el destino enmascarado, no el correo entero', async () => {
    await notifications.bookingConfirmed(BOOKING_ID);

    const fila = (await avisos()).find((f) => f.audience === 'CUSTOMER');
    expect(fila?.target).toBe('an…@example.com');
    expect(fila?.target).not.toContain('ana.garcia');
  });
});

describe('no se avisa dos veces', () => {
  /*
   * EL ESCENARIO REAL. El proveedor de pago reenvia el mismo evento si no
   * recibe respuesta a tiempo. Sin la restriccion unica, cada reenvio seria
   * otro correo al cliente por la misma reserva.
   */
  it('confirmar dos veces la misma reserva solo manda un correo al cliente', async () => {
    await notifications.bookingConfirmed(BOOKING_ID);
    await notifications.bookingConfirmed(BOOKING_ID);

    const alCliente = (await avisos()).filter(
      (f) => f.channel === 'EMAIL' && f.audience === 'CUSTOMER' && f.status === 'SENT',
    );

    expect(alCliente).toHaveLength(1);
    // Lo que de verdad importa: que el CORREO no salga dos veces. Un registro
    // unico no sirve de nada si el cliente ya recibio el segundo mensaje.
    expect(correo.sent).toHaveLength(1);
  });

  it('y el segundo intento no lanza ningun error', async () => {
    await notifications.bookingConfirmed(BOOKING_ID);
    await expect(notifications.bookingConfirmed(BOOKING_ID)).resolves.toBeUndefined();
  });
});

describe('cuando algo falla, no se rompe nada', () => {
  it('una reserva que ya no existe no provoca ningun error', async () => {
    await expect(
      notifications.bookingConfirmed('00000000-0000-4000-8000-000000000000'),
    ).resolves.toBeUndefined();
  });

  /*
   * Esto es lo que protege el dinero del cliente: el despachador se llama
   * justo despues de confirmar una reserva cuyo deposito YA esta retenido. Si
   * un fallo del proveedor subiera, desharia esa confirmacion y el cliente se
   * quedaria con el importe bloqueado y sin cita.
   */
  it('un proveedor de correo que revienta no hace fallar el aviso', async () => {
    const original = correo.send.bind(correo);
    correo.send = () => Promise.reject(new Error('proveedor caido'));

    try {
      await expect(notifications.bookingConfirmed(BOOKING_ID)).resolves.toBeUndefined();

      const fila = (await avisos()).find((f) => f.audience === 'CUSTOMER');
      expect(fila?.status).toBe('FAILED');
      expect(fila?.failureReason).toContain('proveedor caido');
    } finally {
      correo.send = original;
    }
  });

  it('un envio fallido se puede repetir cuando el proveedor vuelve', async () => {
    const original = correo.send.bind(correo);
    correo.send = () => Promise.reject(new Error('proveedor caido'));
    await notifications.bookingConfirmed(BOOKING_ID);
    correo.send = original;

    await notifications.bookingConfirmed(BOOKING_ID);

    const enviados = (await avisos()).filter(
      (f) => f.audience === 'CUSTOMER' && f.status === 'SENT',
    );
    expect(enviados).toHaveLength(1);
  });
});

describe('avisos apagados', () => {
  it('con el correo desactivado no se envia, pero queda constancia del motivo', async () => {
    await guardarAjustes({ ...DEFAULT_NOTIFICATION_SETTINGS, emailBookingConfirmed: false });
    await notifications.bookingConfirmed(BOOKING_ID);

    expect(correo.sent).toHaveLength(0);

    const fila = (await avisos()).find((f) => f.channel === 'EMAIL');
    expect(fila?.status).toBe('SKIPPED');
    expect(fila?.failureReason).toContain('desactivado');

    await guardarAjustes(DEFAULT_NOTIFICATION_SETTINGS);
  });

  it('sin chat de Telegram se anota como omitido, no como averia', async () => {
    await notifications.bookingConfirmed(BOOKING_ID);

    const fila = (await avisos()).find((f) => f.channel === 'TELEGRAM');
    expect(fila?.status).toBe('SKIPPED');
    expect(fila?.failureReason).toContain('Telegram');
  });
});

describe('copia interna', () => {
  it('cuando hay buzon interno, recibe el mismo correo que el cliente', async () => {
    await guardarAjustes({
      ...DEFAULT_NOTIFICATION_SETTINGS,
      internalEmail: 'avisos@freshnesstouch.com',
    });

    await notifications.bookingConfirmed(BOOKING_ID);

    expect(correo.sent).toHaveLength(2);
    expect(correo.sent.map((m) => m.to)).toEqual([
      'ana.garcia@example.com',
      'avisos@freshnesstouch.com',
    ]);
    // Mismo contenido: el equipo ve lo que vio el cliente.
    expect(correo.sent[1]?.subject).toBe(correo.sent[0]?.subject);

    await guardarAjustes(DEFAULT_NOTIFICATION_SETTINGS);
  });
});

describe('quien decide a donde van los avisos', () => {
  it('sin sesion no se leen los ajustes', async () => {
    const respuesta = await request(app.getHttpServer()).get(AJUSTES);
    expect(respuesta.status).toBe(401);
  });

  /*
   * Quien controla esto se entera de todo lo que entra, o deja a la empresa
   * sin enterarse de nada apagandolo. Coordinacion mueve la agenda; no decide
   * a que telefono llegan los avisos.
   */
  it('coordinacion no puede cambiarlos aunque tenga sesion valida', async () => {
    const token = await provider.issue(DISPATCHER_AUTH_ID, 'beto@example.com', 3600);
    const respuesta = await request(app.getHttpServer())
      .put(AJUSTES)
      .set('authorization', `Bearer ${token}`)
      .send({ ...DEFAULT_NOTIFICATION_SETTINGS, telegramChatId: '999999999' });

    expect(respuesta.status).toBe(403);
  });

  it('administracion si puede', async () => {
    const respuesta = await request(app.getHttpServer())
      .put(AJUSTES)
      .set('authorization', `Bearer ${await comoAdmin()}`)
      .send({ ...DEFAULT_NOTIFICATION_SETTINGS, telegramChatId: '123456789' });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.telegramChatId).toBe('123456789');

    await guardarAjustes(DEFAULT_NOTIFICATION_SETTINGS);
  });

  /*
   * El esquema es estricto justo para esto: aqui NO deben poder guardarse
   * credenciales. Si alguien anade un campo de token al formulario, la API lo
   * rechaza en vez de escribirlo en una tabla que acaba en cada respaldo.
   */
  it('rechaza guardar un token junto a los ajustes', async () => {
    const respuesta = await request(app.getHttpServer())
      .put(AJUSTES)
      .set('authorization', `Bearer ${await comoAdmin()}`)
      .send({ ...DEFAULT_NOTIFICATION_SETTINGS, telegramBotToken: '123456:ABC-DEF' });

    expect(respuesta.status).toBe(400);
  });

  it('rechaza un identificador de chat que no es un numero', async () => {
    const respuesta = await request(app.getHttpServer())
      .put(AJUSTES)
      .set('authorization', `Bearer ${await comoAdmin()}`)
      .send({ ...DEFAULT_NOTIFICATION_SETTINGS, telegramChatId: '123/sendDocument' });

    expect(respuesta.status).toBe(400);
  });

  it('el cambio queda en la auditoria con quien lo hizo', async () => {
    await request(app.getHttpServer())
      .put(AJUSTES)
      .set('authorization', `Bearer ${await comoAdmin()}`)
      .send({ ...DEFAULT_NOTIFICATION_SETTINGS, telegramChatId: '555555555' });

    const registro = await db.query<{ action: string; metadata: { changed: string[] } }>(
      `SELECT action, metadata FROM audit_logs
       WHERE action = 'notifications.updated' ORDER BY "createdAt" DESC LIMIT 1`,
    );

    expect(registro.rows[0]?.metadata.changed).toContain('telegramChatId');

    await guardarAjustes(DEFAULT_NOTIFICATION_SETTINGS);
  });
});

describe('correo de cancelacion', () => {
  it('avisa al cliente sin contarle el motivo interno', async () => {
    await db.exec(
      `UPDATE bookings SET "cancellationReason" = 'El cliente discutio el precio'
       WHERE id = '${BOOKING_ID}'`,
    );

    await notifications.bookingCancelled(BOOKING_ID);

    const mensaje = correo.sent[0];
    expect(mensaje?.subject).toContain('Limpieza cancelada');
    // El motivo lo escribe el equipo en el panel: es una nota interna.
    expect(mensaje?.text).not.toContain('discutio');
    expect(mensaje?.html).not.toContain('discutio');
  });

  it('no manda aviso de Telegram: ese canal es solo para reservas nuevas', async () => {
    await notifications.bookingCancelled(BOOKING_ID);

    const porTelegram = (await avisos()).filter((f) => f.channel === 'TELEGRAM');
    expect(porTelegram).toHaveLength(0);
  });
});
