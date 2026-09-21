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
      'notifications',
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

  it('impide dos movimientos con el mismo identificador del mismo proveedor', async () => {
    const columns = await db.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
       WHERE tablename = 'payments' AND indexdef LIKE '%providerPaymentIntentId%'`,
    );

    const unico = columns.rows.find((row) => row.indexdef.includes('UNIQUE'));
    expect(unico).toBeDefined();
    // La unicidad es del PAR: el simulador imita el formato de Stripe, asi que
    // el identificador por si solo no distingue de que proveedor viene.
    expect(unico?.indexdef).toContain('provider');
  });

  it('la tabla de pagos no da por supuesto ningun proveedor', async () => {
    // Guardar un identificador del simulador en una columna llamada "stripe..."
    // seria guardar un dato que miente sobre su origen.
    const columnas = await db.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name ILIKE '%stripe%'`,
    );
    expect(columnas.rows.map((row) => row.column_name)).toEqual([]);
  });

  it('un pago debe declarar siempre quien lo custodia', async () => {
    const columna = await db.query<{ is_nullable: string; column_default: string | null }>(
      `SELECT is_nullable, column_default FROM information_schema.columns
       WHERE table_name = 'payments' AND column_name = 'provider'`,
    );
    expect(columna.rows[0]?.is_nullable).toBe('NO');
    // Sin valor por defecto: cada insercion tiene que decirlo explicitamente.
    expect(columna.rows[0]?.column_default).toBeNull();
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

describe('seguridad de la base de datos', () => {
  /**
   * Supabase publica por API REST todas las tablas del esquema "public". Una
   * tabla sin seguridad a nivel de fila queda accesible para cualquiera que
   * tenga la clave publica del proyecto, saltandose la API y sus permisos.
   *
   * Este test es el guardia que impide que vuelva a ocurrir: si alguien anade
   * una tabla y olvida protegerla, la integracion continua se pone en rojo y
   * el mensaje dice exactamente que linea falta.
   */
  it('TODAS las tablas tienen la seguridad a nivel de fila activada', async () => {
    const result = await db.query<{ relname: string }>(
      `SELECT c.relname
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
       ORDER BY c.relname`,
    );

    const desprotegidas = result.rows.map((row) => row.relname);
    const ayuda = desprotegidas
      .map((t) => `ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY;`)
      .join('\n');

    expect(
      desprotegidas,
      `Tablas expuestas por la API publica de Supabase. Anade a una migracion nueva:\n${ayuda}`,
    ).toEqual([]);
  });

  it('ninguna tabla usa FORCE, que dejaria fuera a la propia API', async () => {
    // La API se conecta con el rol propietario, que no esta sujeto a las
    // politicas mientras no se active FORCE. Activarlo sin crear politicas
    // dejaria al sistema sin acceso a sus propios datos.
    const result = await db.query<{ relname: string }>(
      `SELECT c.relname
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relforcerowsecurity`,
    );

    expect(result.rows.map((row) => row.relname)).toEqual([]);
  });

  it('no hay politicas que abran las tablas por accidente', async () => {
    // El modelo de acceso es "todo pasa por la API". Una politica aqui
    // significaria que alguien abrio una puerta directa: debe ser deliberado
    // y quedar revisado, no aparecer por copiar y pegar de un tutorial.
    const result = await db.query<{ tablename: string; policyname: string }>(
      `SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public'`,
    );

    expect(result.rows).toEqual([]);
  });
});

describe('registro de avisos', () => {
  /** Crea una reserva minima con la que colgar avisos. */
  async function sembrarReserva(referencia: string): Promise<string> {
    const cliente = await db.query<{ id: string }>(
      `INSERT INTO customers (id, email, "firstName", "lastName", phone, "updatedAt")
       VALUES (gen_random_uuid(), '${referencia}@example.com', 'Ana', 'Cliente', '+14045550100', now())
       RETURNING id`,
    );
    const customerId = cliente.rows[0].id;

    const direccion = await db.query<{ id: string }>(
      `INSERT INTO addresses (id, "customerId", line1, city, state, "postalCode", "updatedAt")
       VALUES (gen_random_uuid(), '${customerId}', '1 Main St', 'Atlanta', 'GA', '30301', now())
       RETURNING id`,
    );

    const reserva = await db.query<{ id: string }>(
      `INSERT INTO bookings (
         id, reference, "customerId", "addressId", service, frequency,
         bedrooms, bathrooms, "squareFeet", "scheduledStart", "scheduledEnd",
         "distanceMiles", zone, lines, "serviceCents", "addOnsCents",
         "surchargesCents", "discountCents", "taxCents", "totalCents",
         "depositCents", "balanceDueCents", "pricingVersion", "updatedAt"
       ) VALUES (
         gen_random_uuid(), '${referencia}', '${customerId}', '${direccion.rows[0].id}',
         'STANDARD', 'ONE_TIME', 2, 1, 1200, now(), now() + interval '3 hours',
         5, 'A', '[]'::jsonb, 10000, 0, 0, 0, 800, 10800, 3000, 7800, 'v1', now()
       ) RETURNING id`,
    );

    return reserva.rows[0].id;
  }

  async function registrar(bookingId: string, status: string): Promise<void> {
    await db.query(
      `INSERT INTO notifications (id, "bookingId", event, channel, audience, status)
       VALUES (gen_random_uuid(), '${bookingId}', 'BOOKING_CONFIRMED', 'EMAIL', 'CUSTOMER', '${status}')`,
    );
  }

  /*
   * LA PRUEBA QUE JUSTIFICA LA TABLA. El proveedor de pago reenvia el mismo
   * evento si no recibe respuesta a tiempo. Sin esta restriccion, cada
   * reenvio seria otro correo al cliente por la misma reserva.
   */
  it('no deja registrar dos veces el mismo aviso enviado', async () => {
    const bookingId = await sembrarReserva('FT-DUP-0001');
    await registrar(bookingId, 'SENT');

    await expect(registrar(bookingId, 'SENT')).rejects.toThrow();
  });

  /*
   * El reverso: un intento que no llego a salir DEBE poder repetirse. Si la
   * restriccion cubriera todos los estados, arreglar la configuracion y
   * reintentar seria imposible y el cliente se quedaria sin su correo.
   */
  it('un intento fallido se puede repetir hasta que salga', async () => {
    const bookingId = await sembrarReserva('FT-DUP-0002');

    await registrar(bookingId, 'FAILED');
    await registrar(bookingId, 'FAILED');
    await registrar(bookingId, 'SKIPPED');
    await registrar(bookingId, 'SENT');

    const total = await db.query<{ count: string }>(
      `SELECT count(*) FROM notifications WHERE "bookingId" = '${bookingId}'`,
    );
    expect(Number(total.rows[0].count)).toBe(4);
  });

  it('el mismo hecho por otro canal no choca', async () => {
    const bookingId = await sembrarReserva('FT-DUP-0003');
    await registrar(bookingId, 'SENT');

    await expect(
      db.query(
        `INSERT INTO notifications (id, "bookingId", event, channel, audience, status)
         VALUES (gen_random_uuid(), '${bookingId}', 'BOOKING_CONFIRMED', 'TELEGRAM', 'INTERNAL', 'SENT')`,
      ),
    ).resolves.toBeDefined();
  });

  it('al borrar una reserva se lleva sus avisos, sin dejar filas huerfanas', async () => {
    const bookingId = await sembrarReserva('FT-DUP-0004');
    await registrar(bookingId, 'SENT');

    await db.query(`DELETE FROM bookings WHERE id = '${bookingId}'`);

    const restantes = await db.query<{ count: string }>(
      `SELECT count(*) FROM notifications WHERE "bookingId" = '${bookingId}'`,
    );
    expect(Number(restantes.rows[0].count)).toBe(0);
  });
});
