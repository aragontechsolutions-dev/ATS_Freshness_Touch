import { Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_SERVICE_AREA,
  ServiceAreaSettingsSchema,
  instantQuoteRadiusMiles,
  serviceRadiusMiles,
  type AdminServiceArea,
  type AuthenticatedStaff,
  type ServiceAreaSettings,
} from '@freshness/types';
import type { ZoneRule } from '@freshness/pricing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';

/** Su propia fila en la tabla de configuracion. */
const SETTINGS_KEY = 'service_area';

/**
 * Lo mismo que en la configuracion del negocio, y por lo mismo: el cotizador
 * resuelve la zona en CADA peticion, y sin cache una pagina de precios
 * dispararia una consulta por pulsacion.
 */
const CACHE_TTL_MS = 30_000;

/**
 * EL AREA DE SERVICIO
 * -------------------
 * Hasta donde se va y donde el precio sale solo. Antes vivia en un archivo
 * del codigo, asi que ampliar la cobertura exigia un despliegue; ahora se
 * edita desde el panel, que es donde esa decision se toma.
 *
 * NUNCA FALLA AL LEER. Si la fila no existe, tiene basura de una version
 * anterior o la base no responde, devuelve el area de partida y lo deja en
 * el log. De esto depende que el sitio pueda dar precios: tumbar la pagina
 * que genera ingresos porque no se pudieron leer unas millas seria un
 * intercambio pesimo.
 */
@Injectable()
export class ServiceAreaService {
  private readonly logger = new Logger(ServiceAreaService.name);

  private cached: { value: ServiceAreaSettings; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(): Promise<ServiceAreaSettings> {
    if (this.cached && this.cached.expiresAt > Date.now()) return this.cached.value;

    const value = await this.leer();
    this.cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  }

  /** Con autoria, para la pantalla de administracion. */
  async getForAdmin(): Promise<AdminServiceArea> {
    const fila = await this.prisma.db.businessSetting
      .findUnique({ where: { key: SETTINGS_KEY } })
      .catch(() => null);

    const nombre =
      fila?.updatedBy === null || fila?.updatedBy === undefined
        ? null
        : await this.prisma.db.staff
            .findUnique({
              where: { id: fila.updatedBy },
              select: { firstName: true, lastName: true },
            })
            .then((p) => (p ? `${p.firstName} ${p.lastName}` : null))
            .catch(() => null);

    return {
      settings: await this.get(),
      updatedAt: fila?.updatedAt?.toISOString() ?? null,
      updatedBy: nombre,
    };
  }

  /**
   * Las zonas en el formato que entiende el motor de precios.
   *
   * AQUI SE ANADE `OUT_OF_RANGE`, y no se configura desde el panel a
   * proposito: no es una zona, es lo que hay MAS ALLA de la ultima.
   * Ofrecerla para editar invitaria a marcarla como atendida, que es una
   * contradiccion con nombre propio.
   */
  async zoneRules(): Promise<ZoneRule[]> {
    const area = await this.get();

    return [
      ...area.zones.map((zona): ZoneRule => ({
        code: zona.code,
        maxMiles: zona.maxMiles,
        serviceable: true,
        instantQuote: zona.instantQuote,
      })),
      {
        code: 'OUT_OF_RANGE',
        maxMiles: null,
        serviceable: false,
        instantQuote: false,
      },
    ];
  }

  /** Guarda el area entera. Solo lo llama el panel, y solo administracion. */
  async save(
    settings: ServiceAreaSettings,
    actor: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<AdminServiceArea> {
    const anterior = await this.get();

    await this.prisma.db.$transaction(async (tx) => {
      await tx.businessSetting.upsert({
        where: { key: SETTINGS_KEY },
        create: { key: SETTINGS_KEY, value: settings, updatedBy: actor.staffId },
        update: { value: settings, updatedBy: actor.staffId },
      });

      await this.audit.record(
        {
          staff: actor,
          surface: 'PANEL',
          action: 'service_area.updated',
          entityType: 'business_settings',
          entityId: SETTINGS_KEY,
          /*
           * Se guardan las CIFRAS que resumen el cambio, no el objeto
           * entero. «Se actualizo el area» no informa; «paso de 60 a 325
           * millas y el precio automatico se quedo en 60» si, y cabe de un
           * vistazo en el registro.
           */
          metadata: {
            radiusMilesBefore: serviceRadiusMiles(anterior),
            radiusMilesAfter: serviceRadiusMiles(settings),
            instantRadiusMilesBefore: instantQuoteRadiusMiles(anterior),
            instantRadiusMilesAfter: instantQuoteRadiusMiles(settings),
            zones: settings.zones.length,
          },
          ipAddress,
        },
        tx,
      );
    });

    // Se refresca con lo que de verdad quedo guardado, no con lo que se pidio.
    this.cached = null;
    const guardada = await this.get();

    this.logger.log(
      `Area de servicio actualizada por ${actor.email}: ${serviceRadiusMiles(guardada)} millas`,
    );

    return this.getForAdmin();
  }

  /** Olvida lo cacheado. Solo lo usan las pruebas, para no depender del reloj. */
  invalidate(): void {
    this.cached = null;
  }

  private async leer(): Promise<ServiceAreaSettings> {
    try {
      const fila = await this.prisma.db.businessSetting.findUnique({
        where: { key: SETTINGS_KEY },
      });

      if (!fila) return DEFAULT_SERVICE_AREA;

      const validada = ServiceAreaSettingsSchema.safeParse(sinCamposRetirados(fila.value));

      if (!validada.success) {
        /*
         * La fila existe pero no cumple el contrato: version anterior, o
         * alguien la edito a mano en la base. Se ignora y se sigue con el
         * area de partida, porque unas zonas a medias darian precios
         * equivocados, que es peor que unos precios viejos.
         */
        this.logger.error(
          `La fila "${SETTINGS_KEY}" no cumple el contrato y se ignora. ` +
            'Guardala de nuevo desde el panel para corregirla.',
        );
        return DEFAULT_SERVICE_AREA;
      }

      return validada.data;
    } catch (error) {
      this.logger.error(
        `No se pudo leer el area de servicio, se usa la de partida: ` +
          (error instanceof Error ? error.message : 'error desconocido'),
      );
      return DEFAULT_SERVICE_AREA;
    }
  }
}

/**
 * LIMPIA LOS CAMPOS QUE YA NO EXISTEN antes de validar.
 *
 * Hay filas guardadas con `surchargeCents` en cada zona: el recargo fijo por
 * franja que se retiro cuando el traslado paso a cobrarse por milla. El
 * contrato es estricto —un campo de mas se rechaza, no se ignora— asi que
 * sin esto una fila perfectamente buena caeria entera y la empresa
 * volveria a las zonas de partida sin enterarse: sus 60 millas configuradas
 * se convertirian en las 35 del codigo, y con ellas el precio de cada
 * reserva posterior.
 *
 * Se limpia al LEER y no con una migracion de datos porque el valor es un
 * JSON opaco para la base: en SQL habria que reescribirlo a ciegas. Al
 * guardar de nuevo desde el panel la fila queda ya sin el campo.
 */
function sinCamposRetirados(valor: unknown): unknown {
  if (valor === null || typeof valor !== 'object') return valor;

  const { zones } = valor as { zones?: unknown };
  if (!Array.isArray(zones)) return valor;

  return {
    ...valor,
    zones: zones.map((zona) => {
      if (zona === null || typeof zona !== 'object') return zona;
      const { surchargeCents: _retirado, ...resto } = zona as Record<string, unknown>;
      return resto;
    }),
  };
}
