import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  peorEstado,
  type SystemCheck,
  type SystemCheckId,
  type SystemHealth,
} from '@freshness/types';
import type { Env } from '../common/config/env';
import { PrismaService } from '../database/prisma.service';
import { PricingRatesService } from '../settings/pricing-rates.service';
import { SweepHeartbeatService } from './sweep-heartbeat.service';

/**
 * LAS CINCO PREGUNTAS
 * ===================
 * Cada una de estas comprobaciones existe porque algo se rompio de verdad, o
 * porque puede romperse sin dar la cara. No hay ninguna «por completitud».
 *
 * ========================================================================
 * NINGUNA LANZA. NUNCA.
 * ========================================================================
 * Este servicio lo llaman dos cosas: una pantalla de estado y un
 * temporizador que manda alarmas. Si una comprobacion lanzara, tumbaria
 * justo aquello que existe para avisar de los fallos. El diagnostico que se
 * rompe al diagnosticar no sirve de nada.
 *
 * Por eso cada comprobacion esta envuelta y, si revienta, el resultado es
 * `unknown`: «no se pudo saber». Que es informacion, y de la buena.
 *
 * ========================================================================
 * EL DETALLE COMPLETO SE QUEDA EN EL LOG
 * ========================================================================
 * Hacia fuera solo salen claves de una lista cerrada (ver el contrato en
 * `@freshness/types`). El mensaje de verdad —con el nombre del servidor, de
 * la tabla o de la cuenta dentro— se escribe aqui con `logger.error` y no
 * sale de la maquina.
 */

/**
 * Cuanto vale un informe antes de volver a mirarlo.
 *
 * La pantalla del panel se refresca sola y la alarma corre cada pocos
 * minutos; sin cache, abrir el panel dispararia una consulta a la base y una
 * lectura de disco por cada pulsacion de refresco. Treinta segundos es corto
 * para que la pantalla sea util y largo para que no pese.
 */
const CACHE_MS = 30_000;

@Injectable()
export class SystemChecksService {
  private readonly logger = new Logger(SystemChecksService.name);

  private cache: { informe: SystemHealth; expiraMs: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rates: PricingRatesService,
    private readonly latidos: SweepHeartbeatService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** El informe, cacheado. `forzar` lo salta: lo usan las pruebas. */
  async run(forzar = false): Promise<SystemHealth> {
    if (!forzar && this.cache && this.cache.expiraMs > Date.now()) {
      return this.cache.informe;
    }

    const baseViva = await this.comprobar('database', () => this.database());

    const checks: SystemCheck[] = [
      baseViva,
      /*
       * LAS DOS QUE DEPENDEN DE LA BASE SOLO SE MIRAN SI LA BASE RESPONDE.
       *
       * Si no, una caida de Supabase pintaria tres cosas en rojo cuando el
       * fallo es uno solo, y el mensaje de alarma diria tres problemas donde
       * hay uno. Un diagnostico que multiplica el ruido estorba mas que
       * ayuda justo cuando hay que leerlo deprisa.
       */
      ...(baseViva.state === 'ok'
        ? [
            await this.comprobar('migrations', () => this.migrations()),
            await this.comprobar('pricingRates', () => this.pricingRates()),
          ]
        : [desconocido('migrations'), desconocido('pricingRates')]),
      await this.comprobar('paymentProvider', () => Promise.resolve(this.paymentProvider())),
      await this.comprobar('sweeps', () => Promise.resolve(this.sweeps())),
    ];

    const informe: SystemHealth = {
      state: peorEstado(checks),
      checks,
      checkedAt: new Date().toISOString(),
    };

    this.cache = { informe, expiraMs: Date.now() + CACHE_MS };
    return informe;
  }

  /** Olvida lo cacheado. Solo las pruebas, para no depender del reloj. */
  invalidate(): void {
    this.cache = null;
  }

  /* ---------------------------------------------------------------------- */
  /*  Las comprobaciones                                                     */
  /* ---------------------------------------------------------------------- */

  /** ¿Responde la base de datos? */
  private async database(): Promise<SystemCheck> {
    if (!this.prisma.configured) {
      /*
       * Sin cadena de conexion es `degraded`, no `down`, y la diferencia es
       * real: el cotizador publico funciona sin base de datos —esta pensado
       * asi— y es la parte que trae clientes. Lo que no hay es reservas.
       */
      return {
        id: 'database',
        state: 'degraded',
        detailKey: 'database.notConfigured',
        count: null,
      };
    }

    // `ping` reconstruye el cliente si la base volvio: la API se cura sola
    // sin reiniciar, y esta comprobacion es la que lo dispara.
    const viva = await this.prisma.ping();

    return viva
      ? ok('database')
      : { id: 'database', state: 'down', detailKey: 'database.unreachable', count: null };
  }

  /**
   * ¿Estan aplicadas todas las migraciones del repositorio?
   *
   * ======================================================================
   * ESTA ES LA COMPROBACION QUE HABRIA EVITADO LA CAIDA DEL 10 DE OCTUBRE
   * ======================================================================
   * Se desplego codigo que pedia dos columnas que nadie habia creado. Durante
   * horas: la base respondia perfectamente al ping, el panel abria, el
   * cotizador cotizaba, y NINGUNA reserva se podia crear. Una sonda que solo
   * pregunta «¿hay alguien ahi?» da verde en esa situacion.
   *
   * Se comparan los directorios de `prisma/migrations` con las filas de
   * `_prisma_migrations` que terminaron bien.
   *
   * SI NO SE PUEDE LEER EL DIRECTORIO, LA RESPUESTA ES «NO SE SABE», no «esta
   * bien». La ruta depende de desde donde se arranque el proceso, y dar por
   * buena una comprobacion que no se ejecuto es como tener la luz verde
   * desconectada del interruptor.
   */
  private async migrations(): Promise<SystemCheck> {
    const enDisco = migracionesEnDisco();

    if (enDisco === null) {
      return {
        id: 'migrations',
        state: 'unknown',
        detailKey: 'migrations.unverifiable',
        count: null,
      };
    }

    const filas = await this.prisma.db.$queryRaw<{ migration_name: string }[]>`
      SELECT "migration_name" FROM "_prisma_migrations"
       WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL
    `;

    const aplicadas = new Set(filas.map((f) => f.migration_name));
    const pendientes = enDisco.filter((nombre) => !aplicadas.has(nombre));

    if (pendientes.length === 0) return ok('migrations');

    /*
     * El nombre de la migracion que falta va al LOG, no a la respuesta: es lo
     * primero que quiere saber quien lo arregla, y no tiene por que viajar a
     * un navegador. Hacia fuera solo sale cuantas son.
     */
    this.logger.error(
      `Migraciones sin aplicar (${pendientes.length}): ${pendientes.join(', ')}. ` +
        'Ejecutar `pnpm --filter @freshness/api db:deploy` con DIRECT_URL.',
    );

    return {
      id: 'migrations',
      state: 'down',
      detailKey: 'migrations.pending',
      count: pendientes.length,
    };
  }

  /**
   * ¿Las tarifas vigentes salen de la tabla, o del respaldo del codigo?
   *
   * ======================================================================
   * ESTA ES LA OTRA CAIDA, LA QUE LLEVABA DIEZ DIAS SIN QUE NADIE LA VIERA
   * ======================================================================
   * Al cambiar al modelo de precios por tramos, la fila guardada dejo de
   * cumplir el contrato. El servicio hace lo correcto —cotiza con las
   * tarifas del codigo en vez de caerse— y por eso NO SE NOTA: los precios
   * que ve el cliente son los buenos.
   *
   * Lo que se rompe es otra cosa: cada reserva se sella con una version cuya
   * fila ya no se puede leer, asi que su presupuesto no se puede reproducir.
   * Eso es facturacion, y el dia que importe sera meses despues.
   */
  private async pricingRates(): Promise<SystemCheck> {
    const { source } = await this.rates.current();

    if (source === 'table') return ok('pricingRates');

    return {
      id: 'pricingRates',
      state: 'degraded',
      detailKey: source === 'fallback' ? 'pricingRates.fallback' : 'pricingRates.unreadable',
      count: null,
    };
  }

  /**
   * ¿Se esta reteniendo dinero de verdad?
   *
   * Con `mock` el sistema acepta reservas, las confirma y NO RETIENE NADA.
   * No hay error, no hay log, no hay nada raro que mirar: simplemente cada
   * cita entra sin deposito. Es el fallo mas silencioso de todos los que
   * vigila este archivo, y el unico que cuesta dinero desde el primer
   * minuto.
   */
  private paymentProvider(): SystemCheck {
    const proveedor = this.config.get('PAYMENT_PROVIDER', { infer: true });
    const entorno = this.config.get('NODE_ENV', { infer: true });

    // En desarrollo y en las pruebas `mock` es lo correcto: es como se
    // trabaja sin una cuenta de Stripe. Solo molesta fuera de ahi.
    if (proveedor !== 'mock' || entorno !== 'production') return ok('paymentProvider');

    return {
      id: 'paymentProvider',
      state: 'degraded',
      detailKey: 'paymentProvider.simulated',
      count: null,
    };
  }

  /** ¿Siguen pasando los barridos? Ver `sweep-heartbeat.service.ts`. */
  private sweeps(): SystemCheck {
    const atrasados = this.latidos.atrasados();

    if (atrasados.length === 0) return ok('sweeps');

    for (const { barrido, minutosSinPasar } of atrasados) {
      this.logger.error(`El barrido "${barrido}" lleva ${minutosSinPasar} min sin pasar`);
    }

    return {
      id: 'sweeps',
      state: 'degraded',
      detailKey: 'sweeps.stalled',
      count: atrasados.length,
    };
  }

  /* ---------------------------------------------------------------------- */

  /**
   * Ejecuta una comprobacion sin dejar que su fallo se propague.
   *
   * Es la pieza que hace cierta la promesa de la cabecera. Lo que devuelve
   * ante una excepcion es `unknown`, no `down`: que la comprobacion se rompa
   * no demuestra que lo comprobado este roto.
   */
  private async comprobar(id: SystemCheckId, fn: () => Promise<SystemCheck>): Promise<SystemCheck> {
    try {
      return await fn();
    } catch (error) {
      this.logger.error(
        `La comprobacion "${id}" fallo: ${error instanceof Error ? error.message : 'error desconocido'}`,
      );
      return desconocido(id);
    }
  }
}

/* -------------------------------------------------------------------------- */

function ok(id: SystemCheckId): SystemCheck {
  return { id, state: 'ok', detailKey: null, count: null };
}

function desconocido(id: SystemCheckId): SystemCheck {
  return { id, state: 'unknown', detailKey: null, count: null };
}

/**
 * Los nombres de las migraciones que hay en el repositorio, o `null` si no se
 * encuentra el directorio.
 *
 * ========================================================================
 * SE PRUEBAN VARIAS RUTAS, Y NO ES PEREZA
 * ========================================================================
 * La misma aplicacion arranca desde sitios distintos: en Render el comando es
 * `node apps/api/dist/main.js` desde la raiz del repositorio, en desarrollo
 * se arranca desde `apps/api`, y las pruebas corren desde donde las lance
 * vitest. Fijar una sola ruta haria que la comprobacion funcionara en un
 * sitio y devolviera «no se sabe» en otro.
 *
 * Se prueba tambien desde la ubicacion de ESTE archivo compilado, que es la
 * unica referencia que no depende de quien arranque el proceso.
 */
function migracionesEnDisco(): string[] | null {
  const candidatas = [
    join(process.cwd(), 'apps/api/prisma/migrations'),
    join(process.cwd(), 'prisma/migrations'),
    // Desde `dist/health/` hacia arriba: dist -> api -> prisma/migrations.
    resolve(__dirname, '../../prisma/migrations'),
  ];

  for (const ruta of candidatas) {
    if (!existsSync(ruta)) continue;

    return readdirSync(ruta, { withFileTypes: true })
      .filter((entrada) => entrada.isDirectory())
      .map((entrada) => entrada.name);
  }

  return null;
}
