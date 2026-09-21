import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, Get, Module } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AdminBookingDetailSchema, AdminBookingListSchema } from '@freshness/types';
import { AppModule } from '../app.module';
import { ADMIN_ROUTE, Roles } from './auth.decorators';
import { AUTH_PROVIDER } from './auth.types';
import type { LocalAuthProvider } from './providers/local-auth.provider';

/*
 * El entorno se fija ANTES de los imports: ConfigModule lee process.env
 * cuando se importa app.module, no cuando corre beforeAll.
 */
vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = 'http://localhost:5173';
  process.env.AUTH_PROVIDER = 'local';
  process.env.AUTH_LOCAL_SECRET = 'secreto-de-pruebas-del-panel';
});

/**
 * CONTROL DE ACCESO DEL PANEL, CONTRA UNA BASE DE DATOS REAL
 * ----------------------------------------------------------
 * Aqui se prueba lo que de verdad protege los datos de los clientes: que un
 * token valido NO basta, que hace falta figurar como personal activo, y que
 * una ruta nueva bajo /admin nace cerrada sin que nadie tenga que acordarse
 * de ponerle una guarda.
 */

const PORT = 55452;
const MIGRATIONS_DIR = join(import.meta.dirname, '../../prisma/migrations');

const ADMIN_AUTH_ID = 'auth-admin-0001';
const DISPATCHER_AUTH_ID = 'auth-dispatcher-0001';
const INACTIVO_AUTH_ID = 'auth-inactivo-0001';
const SIN_FICHA_AUTH_ID = 'auth-cliente-cualquiera';

let db: PGlite;
let socket: PGLiteSocketServer;
let app: INestApplication;
let provider: LocalAuthProvider;

/**
 * Ruta bajo /admin SIN guarda, SIN rol y SIN nada.
 *
 * Simula al programador que dentro de seis meses anade un endpoint y no sabe
 * que existe un sistema de permisos. Debe quedar protegida igualmente.
 */
@Controller(`${ADMIN_ROUTE}/ruta-nueva-sin-proteger`)
class RutaNuevaController {
  @Get()
  secretos(): { datos: string } {
    return { datos: 'informacion de clientes' };
  }
}

@Controller(`${ADMIN_ROUTE}/solo-jefes`)
class SoloAdminController {
  @Get()
  @Roles('ADMIN')
  soloAdmin(): { ok: true } {
    return { ok: true };
  }
}

/** Ruta publica cuyo nombre CONTIENE "admin" sin serlo. */
@Controller('administradores-de-fincas')
class NombreParecidoController {
  @Get()
  publico(): { ok: true } {
    return { ok: true };
  }
}

/** Ruta de administracion varios niveles mas abajo. */
@Controller(`${ADMIN_ROUTE}/informes/mensuales/detalle`)
class RutaProfundaController {
  @Get()
  profundo(): { ok: true } {
    return { ok: true };
  }
}

@Module({
  controllers: [
    RutaNuevaController,
    SoloAdminController,
    NombreParecidoController,
    RutaProfundaController,
  ],
})
class ModuloDePrueba {}

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
      ('aaaaaaaa-1111-4111-8111-111111111111', '${ADMIN_AUTH_ID}', 'Ada', 'Jefa', 'ada@example.com', 'ADMIN', true, now()),
      ('bbbbbbbb-2222-4222-8222-222222222222', '${DISPATCHER_AUTH_ID}', 'Beto', 'Agenda', 'beto@example.com', 'DISPATCHER', true, now()),
      ('cccccccc-3333-4333-8333-333333333333', '${INACTIVO_AUTH_ID}', 'Carla', 'Baja', 'carla@example.com', 'ADMIN', false, now())
  `);

  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`;

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, ModuloDePrueba],
  }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/ready'] });
  await app.init();

  provider = app.get<LocalAuthProvider>(AUTH_PROVIDER);
}, 120_000);

afterAll(async () => {
  await app?.close();
  await socket?.stop();
  await db?.close();
});

const SESION = '/api/v1/admin/session';

describe('sin credenciales validas', () => {
  it('sin cabecera de autorizacion devuelve 401', async () => {
    const respuesta = await request(app.getHttpServer()).get(SESION);

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.code).toBe('UNAUTHORIZED');
  });

  it('con un token inventado devuelve 401', async () => {
    const respuesta = await request(app.getHttpServer())
      .get(SESION)
      .set('authorization', 'Bearer esto.no.es.un.token');

    expect(respuesta.status).toBe(401);
  });

  it('con una cabecera mal formada devuelve 401', async () => {
    for (const cabecera of ['Bearer', 'Basic abc', 'token-suelto', 'Bearer    ']) {
      const respuesta = await request(app.getHttpServer())
        .get(SESION)
        .set('authorization', cabecera);
      expect(respuesta.status, cabecera).toBe(401);
    }
  });

  it('con un token caducado devuelve 401', async () => {
    const caducado = await provider.issue(ADMIN_AUTH_ID, 'ada@example.com', -60);
    const respuesta = await request(app.getHttpServer())
      .get(SESION)
      .set('authorization', `Bearer ${caducado}`);

    expect(respuesta.status).toBe(401);
  });

  it('la respuesta NO dice por que fallo', async () => {
    // Distinguir "ha caducado" de "la firma no cuadra" le ahorra trabajo a
    // quien esta probando tokens a ver cual cuela.
    const caducado = await provider.issue(ADMIN_AUTH_ID, 'ada@example.com', -60);
    const uno = await request(app.getHttpServer())
      .get(SESION)
      .set('authorization', `Bearer ${caducado}`);
    const otro = await request(app.getHttpServer())
      .get(SESION)
      .set('authorization', 'Bearer basura.basura.basura');

    expect(uno.body).toEqual(otro.body);
  });
});

describe('un token valido NO basta', () => {
  it('quien no figura como personal recibe 403', async () => {
    /*
     * EL CASO QUE MAS IMPORTA. Cualquiera puede registrarse en Supabase y
     * obtener un token impecablemente firmado. Si eso diera acceso, el panel
     * estaria abierto a todo internet.
     */
    const token = await provider.issue(SIN_FICHA_AUTH_ID, 'cliente@example.com');
    const respuesta = await request(app.getHttpServer())
      .get(SESION)
      .set('authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.code).toBe('FORBIDDEN');
  });

  it('quien esta dado de baja recibe 403 aunque su token siga vigente', async () => {
    // Es el interruptor para cerrar la puerta a alguien sin esperar a que
    // caduque su token ni tener que revocarlo en el proveedor.
    const token = await provider.issue(INACTIVO_AUTH_ID, 'carla@example.com');
    const respuesta = await request(app.getHttpServer())
      .get(SESION)
      .set('authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(403);
  });
});

describe('personal activo', () => {
  it('entra y recibe su ficha y su rol', async () => {
    const token = await provider.issue(ADMIN_AUTH_ID, 'ada@example.com');
    const respuesta = await request(app.getHttpServer())
      .get(SESION)
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(respuesta.body.role).toBe('ADMIN');
    expect(respuesta.body.email).toBe('ada@example.com');
    expect(respuesta.body.staffId).toBe('aaaaaaaa-1111-4111-8111-111111111111');
    expect(new Date(respuesta.body.sessionExpiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('el correo sale de la ficha, no del token', async () => {
    // Si viniera del token, quien pudiera cambiarlo en el proveedor
    // suplantaria a otra persona en los registros de auditoria.
    const token = await provider.issue(ADMIN_AUTH_ID, 'inventado@example.com');
    const respuesta = await request(app.getHttpServer())
      .get(SESION)
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(respuesta.body.email).toBe('ada@example.com');
  });
});

describe('permisos por rol', () => {
  it('un rol distinto del exigido recibe 403', async () => {
    const token = await provider.issue(DISPATCHER_AUTH_ID, 'beto@example.com');
    const respuesta = await request(app.getHttpServer())
      .get('/api/v1/admin/solo-jefes')
      .set('authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(403);
  });

  it('el rol exigido entra', async () => {
    const token = await provider.issue(ADMIN_AUTH_ID, 'ada@example.com');
    await request(app.getHttpServer())
      .get('/api/v1/admin/solo-jefes')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
  });
});

describe('la zona de administracion esta cerrada POR DEFECTO', () => {
  it('una ruta nueva sin ninguna guarda tambien exige sesion', async () => {
    /*
     * El guardia contra el olvido. Si hiciera falta poner @UseGuards() en
     * cada controlador nuevo, olvidarlo dejaria datos de clientes al
     * descubierto EN SILENCIO: nada fallaria y nadie se enteraria.
     *
     * Este controlador no tiene guarda, ni rol, ni decorador alguno.
     */
    const respuesta = await request(app.getHttpServer()).get(
      '/api/v1/admin/ruta-nueva-sin-proteger',
    );

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.datos).toBeUndefined();
  });

  it('tambien protege las rutas varios niveles mas abajo', async () => {
    const respuesta = await request(app.getHttpServer()).get(
      '/api/v1/admin/informes/mensuales/detalle',
    );
    expect(respuesta.status).toBe(401);
  });

  it('NO cierra una ruta publica cuyo nombre solo se parece', async () => {
    /*
     * El limite es un segmento de ruta completo, no un trozo de palabra. Si
     * se comparase por "contiene admin", una ruta publica como esta quedaria
     * cerrada por accidente y el fallo se descubriria en produccion.
     */
    await request(app.getHttpServer()).get('/api/v1/administradores-de-fincas').expect(200);
  });

  it('y con sesion valida si responde', async () => {
    const token = await provider.issue(DISPATCHER_AUTH_ID, 'beto@example.com');
    const respuesta = await request(app.getHttpServer())
      .get('/api/v1/admin/ruta-nueva-sin-proteger')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(respuesta.body.datos).toBe('informacion de clientes');
  });
});

describe('el sitio publico sigue abierto', () => {
  it('el catalogo de precios no pide sesion', async () => {
    // La guarda solo actua bajo /admin: si se aplicara a toda la API,
    // romperia el cotizador en cuanto alguien anadiera una ruta.
    await request(app.getHttpServer()).get('/api/v1/pricing/catalog').expect(200);
  });

  it('la sonda de salud no pide sesion', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });
});

describe('listado y detalle de reservas', () => {
  let bookingId: string;
  let token: string;

  beforeAll(async () => {
    token = await provider.issue(ADMIN_AUTH_ID, 'ada@example.com');

    // Una reserva completa, creada por el camino normal para que los datos
    // sean los que de verdad genera el sistema.
    const dia = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    const disponibilidad = await request(app.getHttpServer())
      .get('/api/v1/availability')
      .query({ date: dia, service: 'STANDARD', bedrooms: 2, bathrooms: 1, squareFeet: 1200 });

    const franja = disponibilidad.body.slots?.find((s: { available: boolean }) => s.available);
    if (!franja) throw new Error('el dia elegido no tiene franjas libres');

    const creada = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        service: 'STANDARD',
        bedrooms: 2,
        bathrooms: 1,
        squareFeet: 1200,
        startsAt: franja.startsAt,
        address: {
          line1: '123 Peachtree St NE',
          city: 'Atlanta',
          state: 'GA',
          postalCode: '30303',
          accessNotes: 'Codigo del porton 4477',
        },
        contact: {
          firstName: 'Ana',
          lastName: 'Perez',
          email: 'ana.panel@example.com',
          phone: '+1 404 555 0101',
        },
      })
      .expect(201);

    bookingId = creada.body.bookingId;
  }, 60_000);

  it('el listado devuelve la reserva con lo justo para la agenda', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/v1/admin/bookings')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    const fila = respuesta.body.items.find(
      (item: { bookingId: string }) => item.bookingId === bookingId,
    );

    expect(fila).toBeDefined();
    expect(fila.customerName).toBe('Ana Perez');
    expect(fila.city).toBe('Atlanta');
    expect(fila.reference).toMatch(/^FT-\d{4}-\d{4}$/);
  });

  it('el LISTADO no lleva instrucciones de acceso ni la calle', async () => {
    /*
     * Un listado se puede exportar entero de un tiron. Los codigos de puerta
     * de todos los clientes no deben caber en una sola peticion.
     */
    const respuesta = await request(app.getHttpServer())
      .get('/api/v1/admin/bookings')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    const crudo = JSON.stringify(respuesta.body);
    expect(crudo).not.toContain('4477');
    expect(crudo).not.toContain('Peachtree');
  });

  it('el DETALLE si las lleva, que para eso existe', async () => {
    const respuesta = await request(app.getHttpServer())
      .get(`/api/v1/admin/bookings/${bookingId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    expect(respuesta.body.address.accessNotes).toBe('Codigo del porton 4477');
    expect(respuesta.body.address.line1).toBe('123 Peachtree St NE');
    expect(respuesta.body.customer.phone).toBe('+1 404 555 0101');
  });

  it('el detalle NUNCA devuelve credenciales del proveedor de pago', async () => {
    // El identificador del pago y el client_secret son credenciales, no
    // informacion: no pintan nada en una pantalla.
    const respuesta = await request(app.getHttpServer())
      .get(`/api/v1/admin/bookings/${bookingId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    const crudo = JSON.stringify(respuesta.body);
    expect(crudo).not.toContain('pi_mock');
    expect(crudo).not.toContain('_secret_');
    expect(respuesta.body.payment.status).toBeTruthy();
  });

  it('la respuesta CUMPLE el contrato que valida el panel', async () => {
    /*
     * El panel valida cada respuesta contra estos mismos esquemas, que son
     * estrictos: un campo de mas la tumba entera y el usuario solo ve "algo
     * salio mal".
     *
     * Paso de verdad: el contrato del panel declaraba una copia recortada de
     * la linea de precio, y como la reserva guarda la linea COMPLETA, el
     * detalle no se podia abrir. Los tests de la API pasaban porque miraban
     * campo a campo en vez de validar la respuesta entera.
     */
    const listado = await request(app.getHttpServer())
      .get('/api/v1/admin/bookings')
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    const listaOk = AdminBookingListSchema.safeParse(listado.body);
    expect(listaOk.success ? [] : listaOk.error.issues).toEqual([]);

    const detalle = await request(app.getHttpServer())
      .get(`/api/v1/admin/bookings/${bookingId}`)
      .set('authorization', `Bearer ${token}`)
      .expect(200);

    const detalleOk = AdminBookingDetailSchema.safeParse(detalle.body);
    expect(detalleOk.success ? [] : detalleOk.error.issues).toEqual([]);
  });

  it('el limite de pagina tiene tope duro', async () => {
    // Sin tope, una sola peticion descargaria la base de clientes entera.
    const respuesta = await request(app.getHttpServer())
      .get('/api/v1/admin/bookings')
      .query({ limit: 999999 })
      .set('authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.code).toBe('VALIDATION_ERROR');
  });

  it('el personal de limpieza no ve la agenda completa', async () => {
    await db.exec(`
      INSERT INTO staff (id, "authUserId", "firstName", "lastName", email, role, "isActive", "updatedAt")
      VALUES ('dddddddd-4444-4444-8444-444444444444', 'auth-limpieza-0001', 'Dora', 'Limpia',
              'dora@example.com', 'CLEANER', true, now())
    `);
    const limpieza = await provider.issue('auth-limpieza-0001', 'dora@example.com');

    const respuesta = await request(app.getHttpServer())
      .get('/api/v1/admin/bookings')
      .set('authorization', `Bearer ${limpieza}`);

    expect(respuesta.status).toBe(403);
  });

  it('un identificador con formato invalido se rechaza con 400, no con un error interno', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/v1/admin/bookings/no-es-un-uuid')
      .set('authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(400);
  });

  it('una reserva que no existe devuelve 404', async () => {
    const respuesta = await request(app.getHttpServer())
      .get('/api/v1/admin/bookings/99999999-9999-4999-8999-999999999999')
      .set('authorization', `Bearer ${token}`);

    expect(respuesta.status).toBe(404);
  });
});

describe('acciones sobre la reserva', () => {
  let bookingId: string;
  let admin: string;
  let coordinacion: string;

  /** Deja una reserva en el estado indicado para probar desde ahi. */
  const ponerEstado = (id: string, estado: string): Promise<unknown> =>
    db.exec(`UPDATE bookings SET status = '${estado}' WHERE id = '${id}'`);

  beforeAll(async () => {
    admin = await provider.issue(ADMIN_AUTH_ID, 'ada@example.com');
    coordinacion = await provider.issue(DISPATCHER_AUTH_ID, 'beto@example.com');

    const dia = new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10);
    const disponibilidad = await request(app.getHttpServer())
      .get('/api/v1/availability')
      .query({ date: dia, service: 'STANDARD', bedrooms: 2, bathrooms: 1, squareFeet: 1100 });

    const franja = disponibilidad.body.slots?.find((s: { available: boolean }) => s.available);
    if (!franja) throw new Error('el dia elegido no tiene franjas libres');

    const creada = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .send({
        service: 'STANDARD',
        bedrooms: 2,
        bathrooms: 1,
        squareFeet: 1100,
        startsAt: franja.startsAt,
        address: { line1: '5 Auburn Ave', city: 'Atlanta', state: 'GA', postalCode: '30303' },
        contact: {
          firstName: 'Luis',
          lastName: 'Ramos',
          email: 'luis.acciones@example.com',
          phone: '+1 404 555 0155',
        },
      })
      .expect(201);

    bookingId = creada.body.bookingId;
  }, 60_000);

  describe('cambio de estado', () => {
    it('rechaza una transicion imposible con 409', async () => {
      // De "pendiente de pago" a "completada" sin pasar por el trabajo.
      const respuesta = await request(app.getHttpServer())
        .patch(`/api/v1/admin/bookings/${bookingId}/status`)
        .set('authorization', `Bearer ${admin}`)
        .send({ status: 'COMPLETED' });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.code).toBe('INVALID_TRANSITION');
    });

    it('exige motivo al cancelar', async () => {
      /*
       * Cancelar es de los dos casos que el cliente puede discutir despues.
       * Sin nota de quien y por que, la reclamacion se resuelve de memoria.
       */
      const respuesta = await request(app.getHttpServer())
        .patch(`/api/v1/admin/bookings/${bookingId}/status`)
        .set('authorization', `Bearer ${admin}`)
        .send({ status: 'CANCELLED' });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.code).toBe('VALIDATION_ERROR');
    });

    it('confirma la reserva y devuelve el detalle ya actualizado', async () => {
      const respuesta = await request(app.getHttpServer())
        .patch(`/api/v1/admin/bookings/${bookingId}/status`)
        .set('authorization', `Bearer ${admin}`)
        .send({ status: 'CONFIRMED' })
        .expect(200);

      // Sin segunda peticion: el panel no tiene que adivinar el nuevo estado.
      expect(respuesta.body.status).toBe('CONFIRMED');
    });

    it('deja rastro de quien lo hizo', async () => {
      const fila = await db.query<{ action: string; actorId: string; metadata: unknown }>(
        `SELECT action, "actorId", metadata FROM audit_logs
         WHERE "entityId" = $1 AND action LIKE 'booking.status%' ORDER BY "createdAt" DESC LIMIT 1`,
        [bookingId],
      );

      expect(fila.rows[0]?.action).toBe('booking.status.confirmed');
      expect(fila.rows[0]?.actorId).toBe('aaaaaaaa-1111-4111-8111-111111111111');
      expect(fila.rows[0]?.metadata).toMatchObject({ from: 'PENDING_PAYMENT', to: 'CONFIRMED' });
    });

    it('coordinacion tambien puede mover la agenda', async () => {
      const respuesta = await request(app.getHttpServer())
        .patch(`/api/v1/admin/bookings/${bookingId}/status`)
        .set('authorization', `Bearer ${coordinacion}`)
        .send({ status: 'IN_PROGRESS' })
        .expect(200);

      expect(respuesta.body.status).toBe('IN_PROGRESS');
    });

    it('anota la marca de tiempo del estado', async () => {
      const fila = await db.query<{ startedAt: Date | null }>(
        `SELECT "startedAt" FROM bookings WHERE id = $1`,
        [bookingId],
      );
      expect(fila.rows[0]?.startedAt).not.toBeNull();
    });
  });

  describe('dinero: solo administracion', () => {
    it('coordinacion NO puede cobrar el deposito', async () => {
      /*
       * Quien puede mover una cita no tiene por que poder cobrarle a un
       * cliente. Es la separacion que evita que un error de agenda se
       * convierta en un cargo indebido.
       */
      const respuesta = await request(app.getHttpServer())
        .post(`/api/v1/admin/bookings/${bookingId}/payment/capture`)
        .set('authorization', `Bearer ${coordinacion}`)
        .send({ reason: 'el cliente no estaba' });

      expect(respuesta.status).toBe(403);
    });

    it('coordinacion NO puede liberar la retencion', async () => {
      const respuesta = await request(app.getHttpServer())
        .post(`/api/v1/admin/bookings/${bookingId}/payment/release`)
        .set('authorization', `Bearer ${coordinacion}`)
        .send({ reason: 'servicio prestado' });

      expect(respuesta.status).toBe(403);
    });

    it('exige un motivo para mover dinero', async () => {
      const respuesta = await request(app.getHttpServer())
        .post(`/api/v1/admin/bookings/${bookingId}/payment/capture`)
        .set('authorization', `Bearer ${admin}`)
        .send({});

      expect(respuesta.status).toBe(400);
    });

    it('no se puede cobrar una retencion que aun no esta autorizada', async () => {
      // La reserva de esta prueba nunca llego a confirmar la tarjeta: su
      // deposito sigue en "falta confirmar", no en "autorizado".
      const respuesta = await request(app.getHttpServer())
        .post(`/api/v1/admin/bookings/${bookingId}/payment/capture`)
        .set('authorization', `Bearer ${admin}`)
        .send({ reason: 'el cliente no estaba' });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.code).toBe('PAYMENT_NOT_CAPTURABLE');
    });

    it('cobra el deposito cuando si esta autorizado, y deja rastro', async () => {
      await db.exec(
        `UPDATE payments SET status = 'REQUIRES_CAPTURE' WHERE "bookingId" = '${bookingId}'`,
      );

      const respuesta = await request(app.getHttpServer())
        .post(`/api/v1/admin/bookings/${bookingId}/payment/capture`)
        .set('authorization', `Bearer ${admin}`)
        .send({ reason: 'el cliente no estaba en casa' })
        .expect(200);

      expect(respuesta.body.payment.status).toBe('SUCCEEDED');
      expect(respuesta.body.payment.amountCapturedCents).toBe(
        respuesta.body.payment.amountAuthorizedCents,
      );

      const auditoria = await db.query<{ action: string; metadata: { reason: string } }>(
        `SELECT action, metadata FROM audit_logs
         WHERE "entityId" = $1 AND action = 'payment.captured' LIMIT 1`,
        [bookingId],
      );
      expect(auditoria.rows[0]?.metadata.reason).toBe('el cliente no estaba en casa');
    });

    it('la auditoria del cobro NO guarda credenciales del proveedor', async () => {
      const auditoria = await db.query<{ metadata: unknown }>(
        `SELECT metadata FROM audit_logs WHERE action = 'payment.captured' LIMIT 1`,
      );
      expect(JSON.stringify(auditoria.rows[0]?.metadata)).not.toContain('pi_mock');
    });

    it('no se puede cobrar dos veces el mismo deposito', async () => {
      const respuesta = await request(app.getHttpServer())
        .post(`/api/v1/admin/bookings/${bookingId}/payment/capture`)
        .set('authorization', `Bearer ${admin}`)
        .send({ reason: 'otra vez' });

      // Ya esta cobrado: su estado ya no admite accion.
      expect(respuesta.status).toBe(409);
    });

    it('no se puede cobrar mas de lo retenido', async () => {
      await db.exec(
        `UPDATE payments SET status = 'REQUIRES_CAPTURE' WHERE "bookingId" = '${bookingId}'`,
      );

      const respuesta = await request(app.getHttpServer())
        .post(`/api/v1/admin/bookings/${bookingId}/payment/capture`)
        .set('authorization', `Bearer ${admin}`)
        .send({ amountCents: 999_999, reason: 'intento de cobrar de mas' });

      expect(respuesta.status).toBe(400);
      expect(respuesta.body.code).toBe('VALIDATION_ERROR');
    });

    it('no se puede cobrar una retencion caducada', async () => {
      /*
       * Una retencion dura 7 dias. Pasada esa fecha el proveedor la
       * rechazaria igualmente, pero avisar aqui da un mensaje que se entiende.
       */
      await db.exec(`UPDATE payments SET status = 'REQUIRES_CAPTURE',
        "expiresAt" = now() - interval '1 day' WHERE "bookingId" = '${bookingId}'`);

      const respuesta = await request(app.getHttpServer())
        .post(`/api/v1/admin/bookings/${bookingId}/payment/capture`)
        .set('authorization', `Bearer ${admin}`)
        .send({ reason: 'tarde' });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.code).toBe('PAYMENT_NOT_CAPTURABLE');
    });

    it('libera la retencion cuando el servicio se presta con normalidad', async () => {
      await db.exec(`UPDATE payments SET status = 'REQUIRES_CAPTURE',
        "expiresAt" = now() + interval '5 days' WHERE "bookingId" = '${bookingId}'`);
      await ponerEstado(bookingId, 'IN_PROGRESS');

      const respuesta = await request(app.getHttpServer())
        .post(`/api/v1/admin/bookings/${bookingId}/payment/release`)
        .set('authorization', `Bearer ${admin}`)
        .send({ reason: 'servicio prestado sin incidencias' })
        .expect(200);

      expect(respuesta.body.payment.status).toBe('CANCELED');
    });
  });

  describe('la zona sigue cerrada por defecto', () => {
    it('las acciones tambien exigen sesion', async () => {
      const respuesta = await request(app.getHttpServer())
        .patch(`/api/v1/admin/bookings/${bookingId}/status`)
        .send({ status: 'CANCELLED', reason: 'sin sesion' });

      expect(respuesta.status).toBe(401);
    });
  });
});
