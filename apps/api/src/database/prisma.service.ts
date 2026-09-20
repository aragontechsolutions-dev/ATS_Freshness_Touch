import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { API_ERROR_CODES } from '@freshness/types';
import type { Env } from '../common/config/env';
import { PrismaClient } from '../generated/prisma/client';

/**
 * ACCESO A LA BASE DE DATOS
 * -------------------------
 * Decision de diseno: la base de datos es OPCIONAL.
 *
 * El cotizador publico no necesita base de datos para funcionar y es la parte
 * que genera negocio. Si la base de datos no esta configurada, o se cae, el
 * sitio debe poder seguir dando precios; solo dejan de estar disponibles las
 * funciones que de verdad necesitan guardar algo.
 *
 * Por eso no se hereda de PrismaClient: la instancia puede no existir.
 *
 * Se usa el adaptador de PostgreSQL con la conexion AGRUPADA de Supabase
 * (puerto 6543). Las migraciones usan la conexion directa y no pasan por aqui.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private client: PrismaClient | null = null;

  /** true cuando hay cadena de conexion configurada. */
  readonly configured: boolean;

  private readonly connectionString: string | undefined;

  constructor(config: ConfigService<Env, true>) {
    this.connectionString = config.get('DATABASE_URL', { infer: true });
    this.configured = Boolean(this.connectionString);
  }

  async onModuleInit(): Promise<void> {
    if (!this.connectionString) {
      this.logger.warn(
        'DATABASE_URL no configurada: la API arranca sin base de datos. ' +
          'El cotizador funciona; las reservas no estaran disponibles.',
      );
      return;
    }

    this.client = await this.createClient();
  }

  /**
   * Crea el cliente y COMPRUEBA de verdad que la base de datos responde.
   *
   * `$connect()` con adaptador no abre la conexion de inmediato: es perezoso,
   * asi que por si solo devolveria exito aunque el servidor este caido. Por eso
   * se lanza una consulta trivial: es la unica forma de saber que hay alguien
   * al otro lado.
   *
   * Devuelve null si no se puede conectar. Un fallo NO impide que la API
   * levante: el cotizador sigue respondiendo y lo que necesite base de datos
   * devolvera un 503 claro.
   */
  private async createClient(): Promise<PrismaClient | null> {
    if (!this.connectionString) return null;

    const client = new PrismaClient({
      adapter: new PrismaPg({ connectionString: this.connectionString }),
    });

    try {
      await client.$queryRaw`SELECT 1`;
      this.logger.log('Conectado a la base de datos');
      return client;
    } catch (error) {
      this.logger.error(`No se pudo conectar a la base de datos: ${describeError(error)}`);
      await client.$disconnect().catch(() => undefined);
      return null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.$disconnect().catch(() => undefined);
  }

  /** true si hay conexion viva. */
  get isConnected(): boolean {
    return this.client !== null;
  }

  /**
   * Cliente de base de datos. Lanza 503 si no hay conexion, en lugar de
   * dejar que el error aflore como un 500 sin explicacion.
   */
  get db(): PrismaClient {
    if (!this.client) {
      throw new ServiceUnavailableException({
        code: API_ERROR_CODES.DATABASE_UNAVAILABLE,
        messageKey: 'calculator.errorGeneric',
      });
    }
    return this.client;
  }

  /**
   * Comprobacion para la sonda de disponibilidad.
   *
   * Si la base de datos estaba caida al arrancar, aqui se vuelve a intentar:
   * asi el servicio se recupera solo cuando la base de datos vuelve, sin
   * necesidad de reiniciar la API.
   */
  async ping(): Promise<boolean> {
    if (!this.client && this.connectionString) {
      this.client = await this.createClient();
    }
    if (!this.client) return false;

    try {
      await this.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      // La conexion se perdio: se descarta para que el proximo intento
      // reconstruya el cliente en vez de reutilizar uno muerto.
      await this.client.$disconnect().catch(() => undefined);
      this.client = null;
      return false;
    }
  }
}

/**
 * Primera linea util del error. Los mensajes de Prisma empiezan con saltos de
 * linea y adornos, y quedarse con el primer trozo dejaria el log vacio.
 */
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return 'error desconocido';

  const firstLine = error.message
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstLine ?? error.name;
}
