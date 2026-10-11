import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SystemHealthSchema, type SystemCheck, type SystemCheckId } from '@freshness/types';
import { AppModule } from '../app.module';
import { AUTH_PROVIDER } from '../auth/auth.types';
import type { LocalAuthProvider } from '../auth/providers/local-auth.provider';
import { PricingRatesService } from '../settings/pricing-rates.service';
import { SweepHeartbeatService } from './sweep-heartbeat.service';
import { SystemChecksService } from './system-checks.service';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-de-estado';
  process.env.EMAIL_PROVIDER = 'log';
  process.env.REMINDER_SWEEP_MINUTES = '0';
  process.env.GEOCODING_SWEEP_MINUTES = '0';
  process.env.AUDIT_PURGE_HOURS = '0';
  process.env.RATE_LIMIT_MAX = '2000';
  process.env.QUOTE_RATE_LIMIT_MAX = '2000';
});

/**
 * EL DIAGNOSTICO, CONTRA UNA BASE DE DATOS REAL
 * ==============================================
 * Estas comprobaciones existen para avisar de dos caidas que ya ocurrieron.
 * Si estuvieran mal escritas no se notaria NUNCA —una comprobacion que
 * siempre dice «todo bien» se ve igual que un sistema sano— asi que aqui
 * cada una se rompe a proposito y se mira si lo dice.
 *
 * Esa es toda la idea de este archivo: probar las comprobaciones ROMPIENDO lo
 * que vigilan, no mirando que devuelvan verde.
 */

const PUERTO = 55487;
const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');
const RUTA = '/api/v1/admin/system-health';

const ADA = 'aaa93000-0000-4000-8000-000000000001';
const DIEGO = 'ddd93000-0000-4000-8000-000000000002';
const ADA_AUTH = 'auth-ada-estado';
const DIEGO_AUTH = 'auth-diego-estado';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;
let checks: SystemChecksService;
let latidos: SweepHeartbeatService;
let provider: LocalAuthProvider;

const comoAda = (): Promise<string> => provider.issue(ADA_AUTH, 'ada@example.com', 3600);
const comoDiego = (): Promise<string> => provider.issue(DIEGO_AUTH, 'diego@example.com', 3600);

/** Los nombres de las migraciones del repositorio, en orden. */
function migracionesDelRepo(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Rellena `_prisma_migrations` como si se hubieran aplicado las que se digan.
 *
 * El arnes de PGlite ejecuta los `.sql` a mano, asi que esa tabla —que la
 * crea `prisma migrate`— no existe aqui. Se fabrica, que es justo lo que
 * permite simular el caso de la caida: el esquema aplicado y el registro
 * diciendo otra cosa.
 */
async function registrarMigraciones(nombres: string[]): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id" varchar(36) PRIMARY KEY,
      "checksum" varchar(64) NOT NULL,
      "finished_at" timestamptz,
      "migration_name" varchar(255) NOT NULL,
      "logs" text,
      "rolled_back_at" timestamptz,
      "started_at" timestamptz NOT NULL DEFAULT now(),
      "applied_steps_count" integer NOT NULL DEFAULT 0
    );
    DELETE FROM "_prisma_migrations";
  `);

  for (const [i, nombre] of nombres.entries()) {
    await db.exec(`
      INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "finished_at")
      VALUES ('id-${i}', 'suma', '${nombre}', now());
    `);
  }
}

/** La comprobacion que interese, del informe recien hecho. */
async function comprobacion(id: SystemCheckId): Promise<SystemCheck> {
  const informe = await checks.run(true);
  const encontrada = informe.checks.find((c) => c.id === id);
  if (!encontrada) throw new Error(`No hay comprobacion "${id}" en el informe`);
  return encontrada;
}

beforeAll(async () => {
  db = await PGlite.create();
  socket = new PGLiteSocketServer({ db, port: PUERTO, host: '127.0.0.1', maxConnections: 10 });
  await socket.start();

  for (const nombre of migracionesDelRepo()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, nombre, 'migration.sql'), 'utf8'));
  }

  await db.exec(`
    INSERT INTO staff (id, "authUserId", "firstName", "lastName", email, role, "isActive", "updatedAt")
    VALUES
      ('${ADA}', '${ADA_AUTH}', 'Ada', 'Jefa', 'ada@example.com', 'ADMIN', true, now()),
      ('${DIEGO}', '${DIEGO_AUTH}', 'Diego', 'Coordina', 'diego@example.com', 'DISPATCHER', true, now());
  `);

  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PUERTO}/postgres`;

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
  await app.init();

  checks = app.get(SystemChecksService);
  latidos = app.get(SweepHeartbeatService);
  provider = app.get<LocalAuthProvider>(AUTH_PROVIDER);
}, 120_000);

afterAll(async () => {
  await app?.close();
  await socket?.stop();
  await db?.close();
});

beforeEach(async () => {
  await db.exec('DELETE FROM pricing_tables;');
  await registrarMigraciones(migracionesDelRepo());
  app.get(PricingRatesService).invalidate();
  checks.invalidate();
});

/* -------------------------------------------------------------------------- */

describe('el diagnostico del sistema', () => {
  describe('migraciones sin aplicar', () => {
    it('con todas aplicadas, dice que esta bien', async () => {
      expect((await comprobacion('migrations')).state).toBe('ok');
    });

    it('CAZA LA CAIDA DEL 10 DE OCTUBRE: falta una y lo dice', async () => {
      /*
       * Esto es exactamente lo que paso. Se desplego codigo que pedia dos
       * columnas nuevas y la migracion que las creaba no se habia aplicado.
       * Durante horas:
       *
       *   - la base respondia perfectamente al ping,
       *   - el panel abria y el cotizador cotizaba,
       *   - y NINGUNA reserva se podia crear.
       *
       * La sonda de disponibilidad que habia entonces solo hacia ping, asi
       * que daba verde. Esta prueba fija que eso ya no pasa.
       */
      const todas = migracionesDelRepo();
      await registrarMigraciones(todas.slice(0, -1));
      checks.invalidate();

      const resultado = await comprobacion('migrations');

      expect(resultado.state).toBe('down');
      expect(resultado.detailKey).toBe('migrations.pending');
      expect(resultado.count).toBe(1);
    });

    it('cuenta cuantas faltan, no solo que faltan', async () => {
      await registrarMigraciones(migracionesDelRepo().slice(0, -3));
      checks.invalidate();

      expect((await comprobacion('migrations')).count).toBe(3);
    });

    it('una marcada como revertida cuenta como pendiente', async () => {
      const todas = migracionesDelRepo();
      await registrarMigraciones(todas);
      await db.exec(`
        UPDATE "_prisma_migrations" SET "rolled_back_at" = now()
         WHERE "migration_name" = '${todas[todas.length - 1]}';
      `);
      checks.invalidate();

      expect((await comprobacion('migrations')).state).toBe('down');
    });

    it('NO FILTRA el nombre de la migracion que falta', async () => {
      /*
       * El nombre va al log del servidor, que es donde sirve. Por la API solo
       * sale la cifra: un nombre de migracion dice que tablas y columnas hay
       * y como se llaman, y eso es un plano del esquema.
       */
      await registrarMigraciones(migracionesDelRepo().slice(0, -1));
      checks.invalidate();

      const serializado = JSON.stringify(await checks.run(true));

      for (const nombre of migracionesDelRepo()) {
        expect(serializado).not.toContain(nombre);
      }
    });
  });

  describe('las tarifas vigentes', () => {
    it('recien sembradas salen de la tabla', async () => {
      // La primera lectura siembra la fila con las tarifas del codigo.
      await app.get(PricingRatesService).current();
      checks.invalidate();

      expect((await comprobacion('pricingRates')).state).toBe('ok');
    });

    it('CAZA LA OTRA CAIDA: la fila guardada no cumple el contrato', async () => {
      /*
       * Es literalmente la fila que hay en produccion desde el 1 de octubre:
       * se guardo con el modelo de precios anterior (`services`) y el
       * contrato de hoy espera `sizeBands`.
       *
       * El sistema hace lo correcto y cotiza con las tarifas del codigo, por
       * eso NADIE LO NOTO en diez dias: los precios que ve el cliente son
       * los buenos. Lo que se rompe es que cada reserva queda sellada con
       * una version que ya no se puede volver a leer.
       */
      await db.exec(`
        INSERT INTO pricing_tables (version, rates, "createdAt")
        VALUES ('2026.09.1', '{"services":{"STANDARD":{"flatCents":12000}}}'::jsonb, now());
      `);
      app.get(PricingRatesService).invalidate();
      checks.invalidate();

      const resultado = await comprobacion('pricingRates');

      expect(resultado.state).toBe('degraded');
      expect(resultado.detailKey).toBe('pricingRates.fallback');
    });

    it('es «a medias» y no «caido», porque el sitio sigue cotizando', async () => {
      /*
       * La diferencia importa para quien recibe el aviso. Con la tabla rota
       * el negocio sigue funcionando: hay que arreglarlo, pero no a las tres
       * de la manana. Marcarlo `down` seria pedir que alguien se levante por
       * algo que puede esperar, y asi es como se aprende a ignorar avisos.
       */
      await db.exec(`
        INSERT INTO pricing_tables (version, rates, "createdAt")
        VALUES ('2026.09.9', '{"basura":true}'::jsonb, now());
      `);
      app.get(PricingRatesService).invalidate();
      checks.invalidate();

      expect((await comprobacion('pricingRates')).state).not.toBe('down');
    });
  });

  describe('los barridos', () => {
    it('sin ninguno registrado no hay nada que avisar', async () => {
      // En las pruebas los barridos van apagados, asi que no se registran.
      expect((await comprobacion('sweeps')).state).toBe('ok');
    });

    it('uno que deja de latir sale como atrasado', async () => {
      const haceMucho = Date.now() - 10 * 3_600_000;
      latidos.registrar('doorPin', 30 * 60_000, haceMucho);
      checks.invalidate();

      const resultado = await comprobacion('sweeps');

      expect(resultado.state).toBe('degraded');
      expect(resultado.detailKey).toBe('sweeps.stalled');
      expect(resultado.count).toBe(1);
    });

    it('un latido reciente lo devuelve a la normalidad', async () => {
      latidos.registrar('doorPin', 30 * 60_000, Date.now() - 10 * 3_600_000);
      latidos.anotar('doorPin');
      checks.invalidate();

      expect((await comprobacion('sweeps')).state).toBe('ok');
    });
  });

  describe('el conjunto', () => {
    it('cumple el contrato que se publica', async () => {
      const informe = await checks.run(true);
      expect(SystemHealthSchema.safeParse(informe).success).toBe(true);
    });

    it('un fallo de uno arrastra el estado general', async () => {
      await registrarMigraciones(migracionesDelRepo().slice(0, -1));
      checks.invalidate();

      expect((await checks.run(true)).state).toBe('down');
    });

    it('EL DETALLE QUE SALE ES SIEMPRE UNA CLAVE DEL CONTRATO', async () => {
      /*
       * La guardia de verdad de todo esto. Lo que viaja no puede ser un
       * mensaje de error: los de Postgres traen el nombre del servidor y de
       * la tabla dentro. El contrato lo impide con una lista cerrada, y esto
       * comprueba que lo que se produce de verdad cabe en ella.
       */
      await registrarMigraciones(migracionesDelRepo().slice(0, -1));
      await db.exec(`
        INSERT INTO pricing_tables (version, rates, "createdAt")
        VALUES ('2026.09.8', '{"roto":1}'::jsonb, now());
      `);
      app.get(PricingRatesService).invalidate();
      latidos.registrar('doorPin', 60_000, Date.now() - 3_600_000);
      checks.invalidate();

      const informe = await checks.run(true);

      // Si algo no cupiera en la lista cerrada, el esquema lo rechazaria.
      expect(SystemHealthSchema.safeParse(informe).success).toBe(true);
      expect(informe.checks.filter((c) => c.state !== 'ok').length).toBeGreaterThanOrEqual(3);
    });

    it('se cachea, para que abrir el panel no consulte la base cada vez', async () => {
      const primero = await checks.run(true);
      const segundo = await checks.run();

      expect(segundo.checkedAt).toBe(primero.checkedAt);
    });
  });

  describe('quien puede verlo', () => {
    it('administracion si', async () => {
      const respuesta = await request(app.getHttpServer())
        .get(RUTA)
        .set('authorization', `Bearer ${await comoAda()}`);

      expect(respuesta.status).toBe(200);
      expect(SystemHealthSchema.safeParse(respuesta.body).success).toBe(true);
    });

    it('COORDINACION NO', async () => {
      /*
       * No es una restriccion de comodidad. Que haya migraciones pendientes
       * dice que el esquema de la base no coincide con el codigo desplegado,
       * y que el pago esta en modo simulado dice que AHORA MISMO se pueden
       * hacer reservas sin retener dinero. Eso es informacion de operacion, y
       * coordinacion mueve citas.
       */
      const respuesta = await request(app.getHttpServer())
        .get(RUTA)
        .set('authorization', `Bearer ${await comoDiego()}`);

      expect(respuesta.status).toBe(403);
    });

    it('sin sesion tampoco', async () => {
      expect((await request(app.getHttpServer()).get(RUTA)).status).toBe(401);
    });

    it('las sondas publicas siguen funcionando y NO cuentan nada de esto', async () => {
      /*
       * Render consulta `/health` cada pocos segundos y no se autentica. Esa
       * sonda tiene que seguir siendo publica, y por eso no puede llevar el
       * diagnostico dentro: lo que se le cuenta a Render se le cuenta a
       * cualquiera.
       */
      const vida = await request(app.getHttpServer()).get('/health');
      const lista = await request(app.getHttpServer()).get('/health/ready');

      expect(vida.status).toBe(200);
      expect(lista.status).toBe(200);

      const publico = JSON.stringify([vida.body, lista.body]);
      for (const filtrado of ['migrations', 'pricingRates', 'paymentProvider', 'sweeps']) {
        expect(publico).not.toContain(filtrado);
      }
    });
  });
});
