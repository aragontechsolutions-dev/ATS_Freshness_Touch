import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

/**
 * PRUEBA DE LAS MIGRACIONES
 * -------------------------
 * Aplica las migraciones sobre un PostgreSQL real compilado a WebAssembly.
 * No hace falta ningun servidor ni credencial, asi que se ejecuta tambien en
 * la integracion continua.
 *
 * Sirve para dos cosas:
 *   1. Detectar SQL invalido antes de tocar la base de datos de produccion.
 *   2. Congelar las reglas de integridad del modelo: si alguien quita una
 *      clave unica o una clave foranea, un test se pone en rojo.
 */

const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');

function loadMigrations(): { name: string; sql: string }[] {
  return (
    readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      // El nombre de las carpetas empieza por la marca de tiempo: orden alfabetico = orden cronologico.
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) => ({
        name: entry.name,
        sql: readFileSync(join(MIGRATIONS_DIR, entry.name, 'migration.sql'), 'utf8'),
      }))
  );
}

let db: PGlite;

beforeAll(async () => {
  db = await PGlite.create();
  for (const migration of loadMigrations()) {
    await db.exec(migration.sql);
  }
}, 60_000);

afterAll(async () => {
  await db?.close();
});

describe('migraciones', () => {
  it('hay al menos una migracion y todas se aplican sin error', () => {
    expect(loadMigrations().length).toBeGreaterThan(0);
  });

  it('crea todas las tablas del modelo', async () => {
    const result = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    );
    const tables = result.rows.map((row) => row.table_name).sort();

    expect(tables).toEqual([
      'addresses',
      'audit_logs',
      'booking_assignments',
      'bookings',
      'business_settings',
      'customers',
      'payments',
      'quotes',
      'recurring_series',
      'staff',
      'webhook_events',
    ]);
  });

  it('todos los importes son enteros de centavos, nunca decimales', async () => {
    const result = await db.query<{ table_name: string; column_name: string; data_type: string }>(
      `SELECT table_name, column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name LIKE '%Cents'`,
    );

    expect(result.rows.length).toBeGreaterThan(10);
    const noEnteros = result.rows.filter((row) => row.data_type !== 'integer');
    expect(noEnteros, 'columnas de dinero que no son enteras').toEqual([]);
  });

  it('las fechas llevan zona horaria', async () => {
    const result = await db.query<{ table_name: string; column_name: string; data_type: string }>(
      `SELECT table_name, column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public'
         AND data_type = 'timestamp without time zone'`,
    );

    // Un horario sin zona provoca citas desplazadas al cambiar la hora.
    expect(result.rows).toEqual([]);
  });
});

describe('reglas de integridad', () => {
  it('permite un cliente invitado, sin cuenta de usuario', async () => {
    await db.exec(`INSERT INTO customers (id, email, "firstName", "lastName", phone, "updatedAt")
      VALUES ('11111111-1111-4111-8111-111111111111', 'invitado@example.com', 'Ana', 'Perez', '+14045550101', now())`);

    const result = await db.query<{ authUserId: string | null }>(
      `SELECT "authUserId" FROM customers WHERE email = 'invitado@example.com'`,
    );
    expect(result.rows[0]?.authUserId).toBeNull();
  });

  it('impide dos clientes con el mismo correo', async () => {
    await expect(
      db.exec(`INSERT INTO customers (id, email, "firstName", "lastName", phone, "updatedAt")
        VALUES ('22222222-2222-4222-8222-222222222222', 'invitado@example.com', 'Otra', 'Persona', '+17705550102', now())`),
    ).rejects.toThrow();
  });

  it('impide una direccion sin cliente valido', async () => {
    await expect(
      db.exec(`INSERT INTO addresses (id, "customerId", line1, city, "postalCode", "updatedAt")
        VALUES ('33333333-3333-4333-8333-333333333333', '99999999-9999-4999-8999-999999999999',
                '1 Peachtree St', 'Atlanta', '30303', now())`),
    ).rejects.toThrow();
  });

  it('impide procesar dos veces el mismo evento de Stripe', async () => {
    await db.exec(
      `INSERT INTO webhook_events (id, type, payload) VALUES ('evt_test_1', 'payment_intent.amount_capturable_updated', '{}')`,
    );

    // Sin esto, un reintento de Stripe podria capturar dos veces el deposito.
    await expect(
      db.exec(
        `INSERT INTO webhook_events (id, type, payload) VALUES ('evt_test_1', 'payment_intent.amount_capturable_updated', '{}')`,
      ),
    ).rejects.toThrow();
  });

  it('impide dos intentos de pago con el mismo identificador de Stripe', async () => {
    const columns = await db.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
       WHERE tablename = 'payments' AND indexdef LIKE '%stripePaymentIntentId%'`,
    );
    expect(columns.rows.some((row) => row.indexdef.includes('UNIQUE'))).toBe(true);
  });

  it('no permite borrar un cliente que conserva historial de reservas', async () => {
    const rule = await db.query<{ delete_rule: string }>(
      `SELECT rc.delete_rule
       FROM information_schema.referential_constraints rc
       JOIN information_schema.table_constraints tc ON tc.constraint_name = rc.constraint_name
       WHERE tc.table_name = 'bookings' AND rc.constraint_name LIKE '%customerId%'`,
    );
    expect(rule.rows[0]?.delete_rule).toBe('RESTRICT');
  });
});
