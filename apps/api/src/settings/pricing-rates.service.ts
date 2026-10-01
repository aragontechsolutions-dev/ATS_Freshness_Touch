import { Injectable, Logger } from '@nestjs/common';
import {
  OFFERED_ADD_ON_CODES,
  PricingRatesSchema,
  nextPricingVersion,
  type AdminPricingRates,
  type AuthenticatedStaff,
  type PricingRates,
} from '@freshness/types';
import { defaultPricingConfig, defaultPricingRates } from '@freshness/pricing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';

/**
 * Las tarifas del codigo, ya en forma de tabla editable. Se calcula una vez:
 * es una constante derivada de otra constante.
 */
const TARIFAS_DE_PARTIDA: PricingRates = defaultPricingRates(defaultPricingConfig);

/**
 * La version con la que se siembra la primera fila.
 *
 * ES LA DEL CODIGO, no una nueva, y eso es lo que hace que la historia
 * empiece sin un agujero: todas las cotizaciones y reservas que ya existen
 * llevan guardada esta misma cadena, asi que desde el primer momento se
 * pueden resolver.
 */
const VERSION_SEMILLA = defaultPricingConfig.version;

/**
 * Lo mismo que el area de servicio, y por lo mismo: el cotizador resuelve
 * precios en CADA peticion, y sin cache una pagina de precios dispararia una
 * consulta por pulsacion.
 */
const CACHE_TTL_MS = 30_000;

/** Las cadencias, en el orden en que se leen. */
/**
 * LAS TARIFAS VIGENTES, Y TODAS LAS QUE LO FUERON
 * -----------------------------------------------
 * Hasta esta etapa los precios vivian en `packages/pricing/src/config.ts`,
 * asi que subir una tarifa exigia un despliegue. Ahora se editan desde el
 * panel, que es donde esa decision se toma.
 *
 * POR QUE UNA TABLA DE SOLO ANADIR Y NO UNA FILA QUE SE SOBRESCRIBE, que es
 * como funcionan los otros ajustes. Por esto, que lleva en el esquema desde
 * el primer dia:
 *
 *     /// Version de la configuracion de precios usada. Sin esto, un
 *     /// presupuesto antiguo no se puede reproducir despues de cambiar
 *     /// las tarifas.
 *     pricingVersion String
 *
 * Esa promesa no se cumplia: la version apuntaba a un archivo del codigo del
 * que solo existe su version actual. Mientras los precios se cambiaran con
 * un despliegue era tolerable. En cuanto se editan desde el panel deja de
 * serlo: cambias un precio un martes y el presupuesto del lunes ya no se
 * puede recalcular. Y eso es facturacion.
 *
 * NUNCA FALLA AL LEER. Si la tabla esta vacia, la fila tiene basura de una
 * version anterior o la base no responde, devuelve las tarifas del codigo y
 * lo deja en el log. De esto depende que el sitio pueda dar precios: tumbar
 * la pagina que genera ingresos porque no se pudo leer una tabla seria un
 * intercambio pesimo.
 */
@Injectable()
export class PricingRatesService {
  private readonly logger = new Logger(PricingRatesService.name);

  private cached: { value: { version: string; rates: PricingRates }; expiresAt: number } | null =
    null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Las tarifas vigentes, con su version. */
  async current(): Promise<{ version: string; rates: PricingRates }> {
    if (this.cached && this.cached.expiresAt > Date.now()) return this.cached.value;

    const value = await this.leerVigente();
    this.cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  }

  /**
   * Las tarifas de UNA version concreta, para reproducir un presupuesto
   * antiguo. `null` si esa version no esta guardada.
   *
   * NO SE CACHEA: se consulta al revisar una factura, no en cada cotizacion,
   * y guardar en memoria filas que quiza no se vuelvan a pedir en meses es
   * gastar memoria por nada.
   */
  async atVersion(version: string): Promise<PricingRates | null> {
    try {
      const fila = await this.prisma.db.pricingTable.findUnique({ where: { version } });
      if (!fila) return null;

      const parsed = PricingRatesSchema.safeParse(fila.rates);
      if (!parsed.success) {
        this.logger.error(`La tabla de tarifas ${version} no cumple el contrato`);
        return null;
      }

      return parsed.data;
    } catch (error) {
      this.logger.error(`No se pudo leer la tabla de tarifas ${version}: ${describir(error)}`);
      return null;
    }
  }

  /** Con autoria y numero de versiones, para la pantalla de administracion. */
  async getForAdmin(): Promise<AdminPricingRates> {
    const vigente = await this.current();

    try {
      const [fila, versionCount] = await Promise.all([
        this.prisma.db.pricingTable.findUnique({ where: { version: vigente.version } }),
        this.prisma.db.pricingTable.count(),
      ]);

      return {
        version: vigente.version,
        rates: vigente.rates,
        updatedAt: fila?.createdAt.toISOString() ?? null,
        updatedBy: fila?.createdByName ?? null,
        versionCount,
      };
    } catch {
      /*
       * Si no se pudo leer la autoria, se devuelven las tarifas igualmente
       * y sin firma. La pantalla tiene que poder abrirse: sin ella no hay
       * forma de corregir un precio mal puesto.
       */
      return {
        version: vigente.version,
        rates: vigente.rates,
        updatedAt: null,
        updatedBy: null,
        versionCount: 0,
      };
    }
  }

  /**
   * Guarda una tabla nueva. NO sobrescribe la anterior.
   *
   * Devuelve lo mismo que `getForAdmin` para que la pantalla se refresque
   * con la version recien creada sin una segunda vuelta.
   */
  async save(
    rates: PricingRates,
    actor: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<AdminPricingRates> {
    const anterior = await this.current();

    /*
     * LA VERSION LA PONE EL SERVIDOR, contando las que ya existen de hoy.
     * Si viniera en la peticion, dos pestanas abiertas podrian mandar la
     * misma y la segunda machacaria a la primera, que es exactamente lo que
     * una tabla de solo anadir existe para impedir.
     */
    const delDia = await this.prisma.db.pricingTable.findMany({ select: { version: true } });
    const version = nextPricingVersion(
      new Date(),
      delDia.map((f) => f.version),
    );

    await this.prisma.db.$transaction(async (tx) => {
      await tx.pricingTable.create({
        data: {
          version,
          rates,
          createdBy: actor.staffId,
          /*
           * El nombre COMO TEXTO, no como referencia: quien subio un precio
           * el ano pasado puede haber causado baja, y «lo cambio alguien que
           * ya no esta» no sirve al revisar una factura.
           */
          createdByName: `${actor.firstName} ${actor.lastName}`.trim().slice(0, 160),
        },
      });

      await this.audit.record(
        {
          staff: actor,
          surface: 'PANEL',
          action: 'pricing.updated',
          entityType: 'business_settings',
          entityId: version,
          /*
           * LAS CIFRAS QUE CAMBIARON, NO UN VOLCADO de las tarifas enteras.
           * Un volcado de cuarenta numeros en cada fila no se lee, y la
           * pregunta real es siempre «que subio y cuanto».
           */
          metadata: {
            version,
            previousVersion: anterior.version,
            changes: diferencias(anterior.rates, rates),
          },
          ipAddress,
        },
        tx,
      );
    });

    // La cache tiene que morir AQUI y no esperar sus treinta segundos: quien
    // acaba de guardar va a comprobar el precio en el sitio ahora mismo.
    this.cached = null;

    return this.getForAdmin();
  }

  /** Olvida lo cacheado. Solo lo usan las pruebas, para no depender del reloj. */
  invalidate(): void {
    this.cached = null;
  }

  /* ---------------------------------------------------------------------- */

  private async leerVigente(): Promise<{ version: string; rates: PricingRates }> {
    try {
      const fila = await this.prisma.db.pricingTable.findFirst({
        orderBy: { createdAt: 'desc' },
      });

      if (!fila) return await this.sembrar();

      const parsed = PricingRatesSchema.safeParse(fila.rates);
      if (!parsed.success) {
        this.logger.error(
          `La tabla de tarifas ${fila.version} no cumple el contrato y se ignora. ` +
            'Se usan las tarifas del codigo.',
        );
        return { version: defaultPricingConfig.version, rates: TARIFAS_DE_PARTIDA };
      }

      return { version: fila.version, rates: parsed.data };
    } catch (error) {
      this.logger.error(`No se pudieron leer las tarifas: ${describir(error)}`);
      return { version: defaultPricingConfig.version, rates: TARIFAS_DE_PARTIDA };
    }
  }

  /**
   * La primera fila, con las tarifas del codigo.
   *
   * SE SIEMBRA AL PRIMER USO Y NO EN UNA MIGRACION. Ponerla en SQL obligaria
   * a repetir cada importe en un archivo `.sql`, y esa copia quedaria
   * desfasada en cuanto alguien tocara la configuracion del codigo: dos
   * fuentes para el mismo precio es justo el fallo que esta etapa cierra.
   *
   * SI LA ESCRITURA FALLA, NO PASA NADA: se devuelven las tarifas del codigo
   * igualmente y se reintentara en la siguiente lectura. Una base de solo
   * lectura o un despliegue sin permisos no puede dejar al sitio sin
   * precios.
   */
  private async sembrar(): Promise<{ version: string; rates: PricingRates }> {
    try {
      await this.prisma.db.pricingTable.create({
        data: { version: VERSION_SEMILLA, rates: TARIFAS_DE_PARTIDA },
      });
      this.logger.log(`Tarifas iniciales guardadas con la version ${VERSION_SEMILLA}`);
    } catch (error) {
      /*
       * Lo normal aqui es una colision: dos peticiones simultaneas sembrando
       * a la vez. La clave primaria lo resuelve sola y la perdedora sigue
       * con las mismas tarifas, que son identicas.
       */
      this.logger.warn(`No se pudieron sembrar las tarifas iniciales: ${describir(error)}`);
    }

    return { version: VERSION_SEMILLA, rates: TARIFAS_DE_PARTIDA };
  }
}

/* -------------------------------------------------------------------------- */

/**
 * Que cambio, en lenguaje de cifras.
 *
 * Solo lo que se movio. Quien investigue una factura quiere leer «la base
 * del servicio profundo paso de 95 a 110 dolares», no cuarenta numeros de
 * los que treinta y nueve son iguales.
 */
function diferencias(antes: PricingRates, despues: PricingRates): Record<string, string> {
  const cambios: Record<string, string> = {};

  const anotar = (clave: string, a: unknown, b: unknown): void => {
    if (a !== b) cambios[clave] = `${etiqueta(a)} → ${etiqueta(b)}`;
  };

  /*
   * LOS TRAMOS SE COMPARAN POR SU TOPE, NO POR SU POSICION.
   *
   * Si se compararan por indice, insertar un tramo en medio diria que
   * cambiaron TODOS los de abajo: veinte lineas de ruido donde el cambio
   * real fue uno. Con el tope como clave, un tramo nuevo se lee como lo que
   * es —uno nuevo— y los demas quedan en silencio.
   */
  const porTope = (
    bandas: PricingRates['sizeBands'],
  ): Map<number, PricingRates['sizeBands'][number]> =>
    new Map(bandas.map((banda) => [banda.maxSquareFeet, banda]));

  const bandasAntes = porTope(antes.sizeBands);
  const bandasDespues = porTope(despues.sizeBands);

  const COLUMNAS = [
    ['profunda', 'deepCents'],
    ['mensual', 'standardMonthlyCents'],
    ['quincenal', 'standardBiweeklyCents'],
    ['semanal', 'standardWeeklyCents'],
    ['ventanas', 'windowsAndCabinetsCents'],
  ] as const;

  for (const [tope, banda] of bandasDespues) {
    const previa = bandasAntes.get(tope);

    if (!previa) {
      // Un tramo nuevo. Decirlo con palabras, no con cinco flechas desde la
      // nada: quien lee una auditoria quiere el hecho, no el detalle.
      cambios[`tramo.${tope}`] = 'tramo nuevo';
      continue;
    }

    for (const [nombre, campo] of COLUMNAS) {
      anotar(`tramo.${tope}.${nombre}`, previa[campo], banda[campo]);
    }
  }

  for (const tope of bandasAntes.keys()) {
    if (!bandasDespues.has(tope)) cambios[`tramo.${tope}`] = 'tramo retirado';
  }

  for (const codigo of OFFERED_ADD_ON_CODES) {
    const a = antes.addOns[codigo];
    const b = despues.addOns[codigo];
    if (!a || !b) continue;
    anotar(`extra.${codigo}.importe`, a.unitAmountCents, b.unitAmountCents);
    anotar(`extra.${codigo}.maximo`, a.maxQuantity, b.maxQuantity);
  }

  anotar('deposito', antes.depositCents, despues.depositCents);
  anotar('traslado.radioLibre', antes.travel.freeRadiusMiles, despues.travel.freeRadiusMiles);
  anotar('traslado.porMilla', antes.travel.centsPerMile, despues.travel.centsPerMile);
  anotar('traslado.idaYVuelta', antes.travel.roundTrip, despues.travel.roundTrip);

  return cambios;
}

/** `null` se lee mejor como «la del IRS» que como la palabra null. */
function etiqueta(valor: unknown): string {
  return valor === null ? 'por defecto' : String(valor);
}

function describir(error: unknown): string {
  return error instanceof Error ? error.message : 'error desconocido';
}
