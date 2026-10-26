import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../app.module';
import { applyBodyParsers } from '../common/body-parsers';
import { AvailabilityService } from '../scheduling/availability.service';
import { HoldExpirySweepService } from './hold-expiry-sweep.service';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { PAYMENT_PROVIDER } from './payments.types';

/**
 * LAS RESERVAS QUE NADIE LLEGO A PAGAR
 * ------------------------------------
 * Un formulario abandonado a mitad del pago dejaba una reserva en
 * `PENDING_PAYMENT` que no se movia nunca mas.
 *
 * LO QUE ESTO **NO** PRUEBA, PORQUE YA FUNCIONABA: que la franja vuelva a
 * ofrecerse. La agenda deja de contar las pendientes de pago pasado el plazo
 * por su cuenta, sin esperar a ningun barrido. Lo que se prueba aqui son las
 * tres consecuencias que si quedaban abiertas: que el cliente pueda volver a
 * reservar esa misma hora, que su dinero deje de estar retenido, y que la
 * fila no se quede pendiente para siempre.
 */

const PORT = 55493;
const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');

let db: PGlite;
let socket: PGLiteSocketServer;
let app: NestExpressApplication;
let barrido: HoldExpirySweepService;
let proveedor: MockPaymentProvider;

const CLIENTE = '11111111-1111-4111-8111-111111111111';
const DIRECCION = '22222222-2222-4222-8222-222222222222';

/**
 * Una reserva pendiente de pago creada hace `minutos`, con su retencion.
 *
 * SE INSERTA A MANO Y NO POR LA API a proposito: crear una reserva esta
 * limitado a cinco por minuto, y aqui hacen falta varias con fechas de
 * creacion distintas — que ademas la API no deja elegir, porque usa el reloj.
 */
async function reservaSinPagar(opciones: {
  reference: string;
  minutosDeAntiguedad: number;
  conRetencion?: boolean;
  estadoDelPago?: string;
}): Promise<string> {
  const { reference, minutosDeAntiguedad } = opciones;
  const bookingId = crypto.randomUUID();
  const quoteId = crypto.randomUUID();
  const creada = `now() - interval '${String(minutosDeAntiguedad)} minutes'`;

  await db.exec(`
    INSERT INTO quotes (id, service, frequency, bedrooms, bathrooms, "squareFeet", "addOns",
                        "postalCode", "distanceMiles", zone, lines, "serviceCents", "addOnsCents",
                        "surchargesCents", "discountCents", "taxCents", "totalCents",
                        "depositCents", "pricingVersion", "expiresAt", "createdAt")
    VALUES ('${quoteId}', 'STANDARD', 'ONE_TIME', 2, 1, 1200, '[]'::jsonb,
            '30301', 10, 'A', '[]'::jsonb, 18000, 0, 0, 0, 0, 18000, 3500, 'v1',
            now() + interval '7 days', now());

    INSERT INTO bookings (id, reference, "customerId", "addressId", "quoteId", status, service,
                          frequency, bedrooms, bathrooms, "squareFeet", "addOns",
                          "scheduledStart", "scheduledEnd", timezone, "distanceMiles", zone,
                          lines, "serviceCents", "addOnsCents", "surchargesCents",
                          "discountCents", "taxCents", "totalCents", "depositCents",
                          "balanceDueCents", "pricingVersion", "createdAt", "updatedAt")
    VALUES ('${bookingId}', '${reference}', '${CLIENTE}', '${DIRECCION}', '${quoteId}',
            'PENDING_PAYMENT', 'STANDARD', 'ONE_TIME', 2, 1, 1200, '[]'::jsonb,
            now() + interval '3 days', now() + interval '3 days 2 hours', 'America/New_York',
            10, 'A', '[]'::jsonb, 18000, 0, 0, 0, 0, 18000, 3500, 14500, 'v1',
            ${creada}, now());
  `);

  if (opciones.conRetencion !== false) {
    const retencion = await proveedor.createDepositHold({
      bookingId,
      bookingReference: reference,
      amountCents: 3500,
      customerEmail: 'ana@example.com',
      customerName: 'Ana Perez',
    });

    await db.exec(`
      INSERT INTO payments (id, "bookingId", kind, provider, "providerPaymentIntentId", status,
                            "amountAuthorizedCents", "amountCapturedCents", "currency",
                            "createdAt", "updatedAt")
      VALUES ('${crypto.randomUUID()}', '${bookingId}', 'DEPOSIT_HOLD', 'mock',
              '${retencion.providerPaymentIntentId}',
              '${opciones.estadoDelPago ?? 'REQUIRES_CAPTURE'}', 3500, 0, 'USD', now(), now());
    `);
  }

  return bookingId;
}

async function estadoDe(bookingId: string) {
  const filas = await db.query<{
    status: string;
    cancelledBy: string | null;
    reason: string | null;
  }>(`SELECT status, "cancelledBy", "cancellationReason" AS reason FROM bookings WHERE id = $1`, [
    bookingId,
  ]);
  return filas.rows[0];
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
    INSERT INTO customers (id, "firstName", "lastName", email, phone, locale, "updatedAt")
    VALUES ('${CLIENTE}', 'Ana', 'Perez', 'ana@example.com', '+14045550199', 'en', now());

    INSERT INTO addresses (id, "customerId", line1, city, state, "postalCode", "updatedAt")
    VALUES ('${DIRECCION}', '${CLIENTE}', '1 Peachtree St', 'Atlanta', 'GA', '30301', now());
  `);

  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`;
  /* A mano: una prueba no puede depender del reloj. */
  process.env.HOLD_SWEEP_MINUTES = '0';
  process.env.REMINDER_SWEEP_MINUTES = '0';
  process.env.REMOVAL_SWEEP_MINUTES = '0';
  process.env.GEOCODING_SWEEP_MINUTES = '0';

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication<NestExpressApplication>({ rawBody: true });
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
  applyBodyParsers(app, 'api/v1');
  await app.init();

  barrido = app.get(HoldExpirySweepService);
  proveedor = app.get<MockPaymentProvider>(PAYMENT_PROVIDER);
}, 120_000);

afterAll(async () => {
  await app?.close();
  await socket?.stop();
  await db?.close();
});

beforeEach(async () => {
  await db.exec(`DELETE FROM audit_logs; DELETE FROM payments; DELETE FROM bookings;
                 DELETE FROM quotes;`);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a que reservas alcanza', () => {
  /*
   * EL PLAZO LO PONE LA AGENDA, no este barrido. El corte sale de
   * `corteDeRetencion`, la misma funcion que decide cuando la franja vuelve
   * a ofrecerse: con dos cuentas separadas, una franja podria quedar libre
   * para reservar y con una reserva viva encima.
   */
  it('a una que paso de plazo', async () => {
    const minutos = app.get(AvailabilityService).config.paymentHoldMinutes;
    const id = await reservaSinPagar({
      reference: 'FT-2026-0001',
      minutosDeAntiguedad: minutos + 5,
    });

    await barrido.pasada();

    expect((await estadoDe(id))?.status).toBe('CANCELLED');
  });

  it('y NO a una recien creada, que todavia esta pagando', async () => {
    const id = await reservaSinPagar({ reference: 'FT-2026-0002', minutosDeAntiguedad: 0 });

    await barrido.pasada();

    expect((await estadoDe(id))?.status).toBe('PENDING_PAYMENT');
  });

  /*
   * NI A LAS QUE YA NO ESTAN PENDIENTES. Una confirmada, una en curso o una
   * ya cancelada no se tocan aunque sean viejas.
   */
  it('ni a una que ya se confirmo', async () => {
    const id = await reservaSinPagar({ reference: 'FT-2026-0003', minutosDeAntiguedad: 999 });
    await db.exec(`UPDATE bookings SET status = 'CONFIRMED' WHERE id = '${id}'`);

    await barrido.pasada();

    expect((await estadoDe(id))?.status).toBe('CONFIRMED');
  });
});

describe('que deja escrito', () => {
  it('queda como cancelada por el SISTEMA, con su motivo', async () => {
    const id = await reservaSinPagar({ reference: 'FT-2026-0004', minutosDeAntiguedad: 999 });

    await barrido.pasada();

    const estado = await estadoDe(id);
    /*
     * SYSTEM y no COMPANY ni CUSTOMER: no lo decidio nadie. A nombre de la
     * empresa pareceria que alguien la cancelo; a nombre del cliente, que se
     * arrepintio.
     */
    expect(estado?.cancelledBy).toBe('SYSTEM');
    expect(estado?.reason).toContain('pago');
  });

  it('y deja rastro en la auditoria, sin actor y desde el sistema', async () => {
    await reservaSinPagar({ reference: 'FT-2026-0005', minutosDeAntiguedad: 999 });

    await barrido.pasada();

    const filas = await db.query<{
      actorId: string | null;
      actorType: string;
      surface: string;
      metadata: Record<string, unknown>;
    }>(`SELECT "actorId", "actorType", surface, metadata FROM audit_logs
         WHERE action = 'booking.status.cancelled'`);

    expect(filas.rows[0]?.actorId).toBeNull();
    expect(filas.rows[0]?.actorType).toBe('SYSTEM');
    expect(filas.rows[0]?.surface).toBe('SYSTEM');
    expect(JSON.stringify(filas.rows[0]?.metadata)).toContain('hold_expired');
  });
});

describe('el dinero retenido en la tarjeta', () => {
  /*
   * ES LA RAZON DE QUE ESTO NO PUEDA ESPERAR. Si el cliente llego a
   * autorizar y el aviso del proveedor se perdio, su saldo sigue bloqueado
   * por una reserva que no existe.
   */
  it('se libera en el proveedor antes de cerrar la reserva', async () => {
    await reservaSinPagar({ reference: 'FT-2026-0006', minutosDeAntiguedad: 999 });

    const antes = await db.query<{ providerPaymentIntentId: string }>(
      `SELECT "providerPaymentIntentId" FROM payments`,
    );
    const intent = antes.rows[0]?.providerPaymentIntentId ?? '';

    /*
     * SE ESPIA AL PROVEEDOR. El simulador no guarda estado —cancelar le sale
     * bien siempre— asi que lo unico que se puede comprobar es que SE LE
     * PIDIO, con el identificador correcto. Que lo cumpla es asunto suyo, y
     * contra Stripe lo comprueba la sesion de pruebas con credenciales.
     */
    const cancelar = vi.spyOn(proveedor, 'cancel');

    await barrido.pasada();

    expect(cancelar).toHaveBeenCalledTimes(1);
    expect(cancelar.mock.calls[0]?.[0]).toBe(intent);
  });

  /*
   * NO SE LE PIDE NADA AL PROVEEDOR POR UNA RETENCION QUE YA NO ESTA VIVA.
   * Cancelar una cobrada seria pedirle que deshaga algo que no esta hecho.
   */
  it('no se toca una retencion ya cobrada', async () => {
    const id = await reservaSinPagar({
      reference: 'FT-2026-0010',
      minutosDeAntiguedad: 999,
      estadoDelPago: 'SUCCEEDED',
    });

    const cancelar = vi.spyOn(proveedor, 'cancel');

    await barrido.pasada();

    expect(cancelar).not.toHaveBeenCalled();
    expect((await estadoDe(id))?.status).toBe('CANCELLED');
  });

  /*
   * SI LIBERAR FALLA, LA RESERVA NO SE CANCELA. Una fila cancelada con una
   * retencion viva detras es dinero de un cliente bloqueado en un sitio
   * donde ya nadie va a mirar; dejandola pendiente, la siguiente pasada
   * vuelve a intentarlo.
   */
  it('si el proveedor falla al liberar, la reserva se queda pendiente', async () => {
    const id = await reservaSinPagar({ reference: 'FT-2026-0007', minutosDeAntiguedad: 999 });

    vi.spyOn(proveedor, 'cancel').mockRejectedValueOnce(new Error('el proveedor no responde'));

    await barrido.pasada();
    expect((await estadoDe(id))?.status).toBe('PENDING_PAYMENT');

    // Y la siguiente pasada, con el proveedor ya sano, la cierra.
    await barrido.pasada();
    expect((await estadoDe(id))?.status).toBe('CANCELLED');
  });

  it('una reserva sin retencion se cierra igual', async () => {
    const id = await reservaSinPagar({
      reference: 'FT-2026-0008',
      minutosDeAntiguedad: 999,
      conRetencion: false,
    });

    await barrido.pasada();

    expect((await estadoDe(id))?.status).toBe('CANCELLED');
  });
});

describe('volver a reservar la misma hora', () => {
  /*
   * ESTA ES LA CONSECUENCIA QUE DE VERDAD VEIA EL CLIENTE.
   *
   * Hay un indice unico sobre (cliente, hora) que excluye solo las
   * CANCELADAS. Con la fila zombi viva, el mismo cliente reintentando su
   * reserva recibia un «ya tienes una reserva a esa hora» — verdad en la
   * base y mentira para el, porque la suya nunca llego a existir.
   */
  it('deja de chocar con el indice unico en cuanto se cierra', async () => {
    const id = await reservaSinPagar({ reference: 'FT-2026-0009', minutosDeAntiguedad: 999 });
    const hora = await db.query<{ scheduledStart: Date }>(
      `SELECT "scheduledStart" FROM bookings WHERE id = '${id}'`,
    );

    const mismaHora = async () =>
      db.exec(`
        INSERT INTO quotes (id, service, frequency, bedrooms, bathrooms, "squareFeet", "addOns",
                            "postalCode", "distanceMiles", zone, lines, "serviceCents",
                            "addOnsCents", "surchargesCents", "discountCents", "taxCents",
                            "totalCents", "depositCents", "pricingVersion", "expiresAt",
                            "createdAt")
        VALUES ('${crypto.randomUUID()}', 'STANDARD', 'ONE_TIME', 2, 1, 1200, '[]'::jsonb,
                '30301', 10, 'A', '[]'::jsonb, 18000, 0, 0, 0, 0, 18000, 3500, 'v1',
                now() + interval '7 days', now());
      `);

    // Antes del barrido, la fila zombi sigue ocupando el par (cliente, hora).
    const ocupadoAntes = await db.query<{ total: string }>(
      `SELECT count(*) AS total FROM bookings
        WHERE "customerId" = '${CLIENTE}'
          AND "scheduledStart" = $1 AND status <> 'CANCELLED'`,
      [hora.rows[0]?.scheduledStart],
    );
    expect(Number(ocupadoAntes.rows[0]?.total)).toBe(1);

    await barrido.pasada();
    await mismaHora();

    const ocupadoDespues = await db.query<{ total: string }>(
      `SELECT count(*) AS total FROM bookings
        WHERE "customerId" = '${CLIENTE}'
          AND "scheduledStart" = $1 AND status <> 'CANCELLED'`,
      [hora.rows[0]?.scheduledStart],
    );
    expect(Number(ocupadoDespues.rows[0]?.total)).toBe(0);
  });
});
