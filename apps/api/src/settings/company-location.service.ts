import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  haversineMiles,
  CompanyLocationSchema,
  DEFAULT_COMPANY_LOCATION,
  type AdminCompanyLocation,
  type AuthenticatedStaff,
  type CompanyLocation,
} from '@freshness/types';
import { AuditService } from '../audit/audit.service';
import type { Env } from '../common/config/env';
import { PrismaService } from '../database/prisma.service';

/** Su propia fila en la tabla de configuracion. */
const SETTINGS_KEY = 'company_location';

/**
 * Lo mismo que el area de servicio, y por lo mismo: el cotizador resuelve la
 * distancia en CADA peticion, y sin cache una pagina de precios dispararia
 * una consulta por pulsacion.
 */
const CACHE_TTL_MS = 30_000;

/**
 * LA UBICACION DE LA EMPRESA
 * --------------------------
 * El punto desde el que se mide todo: la distancia de cada presupuesto, las
 * millas de traslado incluidas, la zona de cada reserva y el centro del
 * mapa. Vivia en variables de entorno, asi que mudarse exigia un
 * redespliegue.
 *
 * NUNCA FALLA AL LEER. Si la fila no existe, tiene basura de una version
 * anterior o la base no responde, devuelve la ubicacion de partida y lo deja
 * en el log. De esto depende que el sitio pueda dar precios: tumbar la
 * pagina que genera ingresos porque no se pudieron leer dos coordenadas
 * seria un intercambio pesimo.
 */
@Injectable()
export class CompanyLocationService {
  private readonly logger = new Logger(CompanyLocationService.name);

  private cached: { value: CompanyLocation; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * De donde se mide mientras nadie haya guardado nada.
   *
   * SON LAS VARIABLES DE ENTORNO, no una constante del codigo, y la
   * diferencia importa: hay instalaciones que ya las tienen puestas con una
   * sede que no es el centro de Atlanta. Si aqui se devolviera el valor de
   * partida del contrato, el primer despliegue de esta etapa moveria la
   * base sin que nadie tocara nada y recalcularia todos los traslados.
   *
   * Si las variables tampoco valen —alguien puso una coordenada imposible—
   * se cae al valor del contrato, que al menos esta dentro de Georgia.
   */
  private desdeElEntorno(): CompanyLocation {
    const delEntorno = CompanyLocationSchema.safeParse({
      latitude: this.config.get('COMPANY_BASE_LATITUDE', { infer: true }),
      longitude: this.config.get('COMPANY_BASE_LONGITUDE', { infer: true }),
      city: this.config.get('COMPANY_BASE_CITY', { infer: true }),
      state: this.config.get('COMPANY_BASE_STATE', { infer: true }),
      postalCode: this.config.get('COMPANY_BASE_POSTAL_CODE', { infer: true }),
    });

    if (delEntorno.success) return delEntorno.data;

    this.logger.error(
      'Las variables COMPANY_BASE_* no describen un punto valido dentro de Georgia. ' +
        'Se usa la ubicacion de partida; corrigelas o guarda una desde el panel.',
    );
    return DEFAULT_COMPANY_LOCATION;
  }

  async get(): Promise<CompanyLocation> {
    if (this.cached && this.cached.expiresAt > Date.now()) return this.cached.value;

    const value = await this.leer();
    this.cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  }

  /** Con autoria, para la pantalla de administracion. */
  async getForAdmin(): Promise<AdminCompanyLocation> {
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

  /** Guarda la ubicacion. Solo lo llama el panel, y solo administracion. */
  async save(
    settings: CompanyLocation,
    actor: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<AdminCompanyLocation> {
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
          action: 'company_location.updated',
          entityType: 'business_settings',
          entityId: SETTINGS_KEY,
          /*
           * LAS COORDENADAS DE ANTES Y LAS DE DESPUES, y ademas cuanto se
           * movio. «Se actualizo la ubicacion» no informa; «se movio 12
           * millas» explica por que los presupuestos de esta semana no
           * cuadran con los de la pasada, que es la pregunta que alguien
           * va a hacer.
           */
          metadata: {
            latitudeBefore: anterior.latitude,
            longitudeBefore: anterior.longitude,
            latitudeAfter: settings.latitude,
            longitudeAfter: settings.longitude,
            movedMiles: Number(
              haversineMiles(
                anterior.latitude,
                anterior.longitude,
                settings.latitude,
                settings.longitude,
              ).toFixed(1),
            ),
            cityAfter: settings.city,
            postalCodeAfter: settings.postalCode,
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
      `Ubicacion de la empresa actualizada por ${actor.email}: ` +
        `${guardada.latitude}, ${guardada.longitude} (${guardada.city})`,
    );

    return this.getForAdmin();
  }

  /** Olvida lo cacheado. Solo lo usan las pruebas, para no depender del reloj. */
  invalidate(): void {
    this.cached = null;
  }

  private async leer(): Promise<CompanyLocation> {
    try {
      const fila = await this.prisma.db.businessSetting.findUnique({
        where: { key: SETTINGS_KEY },
      });

      if (!fila) return this.desdeElEntorno();

      const validada = CompanyLocationSchema.safeParse(fila.value);

      if (!validada.success) {
        /*
         * La fila existe pero no cumple el contrato: version anterior, o
         * alguien la edito a mano en la base. Se ignora y se sigue con la
         * de partida, porque una coordenada a medias mediria todas las
         * distancias desde un sitio equivocado, que es peor que medirlas
         * desde uno viejo.
         */
        this.logger.error(
          `La fila "${SETTINGS_KEY}" no cumple el contrato y se ignora. ` +
            'Guardala de nuevo desde el panel para corregirla.',
        );
        return this.desdeElEntorno();
      }

      return validada.data;
    } catch (error) {
      this.logger.error(
        `No se pudo leer la ubicacion de la empresa, se usa la de partida: ` +
          (error instanceof Error ? error.message : 'error desconocido'),
      );
      return this.desdeElEntorno();
    }
  }
}
