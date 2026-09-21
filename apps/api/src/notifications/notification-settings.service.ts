import { Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationSettingsSchema,
  type AuthenticatedStaff,
  type NotificationSettings,
} from '@freshness/types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';

/**
 * AJUSTES DE AVISOS
 * -----------------
 * Vive en `business_settings` con su propia clave, separado de los datos del
 * negocio (telefono, correo, horario).
 *
 * POR QUE OTRA CLAVE Y NO EL MISMO BLOQUE. Los datos del negocio se guardan
 * juntos porque se editan juntos y una escritura de una fila no puede quedarse
 * a medias. Esto es otra cosa: se edita en otra pantalla, en otro momento y
 * por otro motivo. Meterlo en el mismo bloque haria que cambiar el horario
 * reescribiera los avisos, y que dos personas trabajando a la vez se pisaran
 * sin tener nada que ver la una con la otra.
 */
const SETTINGS_KEY = 'notifications';

/** Mismo criterio que la configuracion del negocio: ver aquel servicio. */
const CACHE_TTL_MS = 30_000;

@Injectable()
export class NotificationSettingsService {
  private readonly logger = new Logger(NotificationSettingsService.name);

  private cached: { value: NotificationSettings; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Los ajustes vigentes. NUNCA falla: ante cualquier problema devuelve los
   * valores de partida, que dejan los correos al cliente encendidos.
   *
   * El criterio es distinto al del sitio publico pero por la misma razon: si
   * no se pueden leer los ajustes, es preferible enviar la confirmacion que el
   * cliente espera a quedarse callado porque una fila no se pudo consultar.
   */
  async get(now: number = Date.now()): Promise<NotificationSettings> {
    if (this.cached && this.cached.expiresAt > now) {
      return this.cached.value;
    }

    const value = await this.load();
    this.cached = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  }

  private async load(): Promise<NotificationSettings> {
    let stored: unknown;

    try {
      const row = await this.prisma.db.businessSetting.findUnique({
        where: { key: SETTINGS_KEY },
        select: { value: true },
      });

      if (!row) return DEFAULT_NOTIFICATION_SETTINGS;
      stored = row.value;
    } catch (error) {
      this.logger.error(
        'No se pudieron leer los ajustes de avisos; se usan los de partida: ' +
          (error instanceof Error ? error.message : 'error desconocido'),
      );
      return DEFAULT_NOTIFICATION_SETTINGS;
    }

    const parsed = NotificationSettingsSchema.safeParse(stored);

    if (!parsed.success) {
      this.logger.error(
        `La fila "${SETTINGS_KEY}" no cumple el contrato y se ignora. ` +
          'Guardala de nuevo desde el panel para corregirla.',
      );
      return DEFAULT_NOTIFICATION_SETTINGS;
    }

    return parsed.data;
  }

  /** Guarda los ajustes y deja rastro de quien los cambio. */
  async update(
    settings: NotificationSettings,
    staff: AuthenticatedStaff,
    ipAddress?: string | null,
  ): Promise<NotificationSettings> {
    const anterior = await this.get();

    await this.prisma.db.$transaction(async (tx) => {
      await tx.businessSetting.upsert({
        where: { key: SETTINGS_KEY },
        create: { key: SETTINGS_KEY, value: settings, updatedBy: staff.staffId },
        update: { value: settings, updatedBy: staff.staffId },
      });

      await this.audit.record(
        {
          staff,
          action: 'notifications.updated',
          entityType: 'BusinessSetting',
          entityId: SETTINGS_KEY,
          /*
           * Se guarda el valor completo porque aqui no hay ningun secreto: son
           * interruptores, un buzon interno y un identificador de chat. Las
           * credenciales viven en el entorno y nunca pasan por esta tabla.
           */
          metadata: { changed: changedFields(anterior, settings), value: settings },
          ipAddress,
        },
        tx,
      );
    });

    this.cached = { value: settings, expiresAt: Date.now() + CACHE_TTL_MS };
    return settings;
  }

  /** Olvida lo cacheado. Solo lo usan las pruebas, para no depender del reloj. */
  invalidate(): void {
    this.cached = null;
  }
}

/** Que cambio de verdad, para que la auditoria lo diga sin comparar volcados. */
function changedFields(
  before: NotificationSettings,
  after: NotificationSettings,
): (keyof NotificationSettings)[] {
  const campos = Object.keys(after) as (keyof NotificationSettings)[];
  return campos.filter((campo) => before[campo] !== after[campo]);
}
