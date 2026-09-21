import { Injectable, Logger } from '@nestjs/common';
import {
  BusinessSettingsSchema,
  DEFAULT_BUSINESS_SETTINGS,
  type AdminBusinessSettings,
  type AuthenticatedStaff,
  type BusinessSettings,
  type WeeklyHours,
} from '@freshness/types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';

/**
 * CONFIGURACION DEL NEGOCIO
 * -------------------------
 * Lee y escribe los datos que la empresa cambia sola: telefono, correo y
 * horario.
 *
 * TODO VIVE EN UNA SOLA FILA. La tabla es de clave y valor, asi que se podria
 * repartir en varias claves; se guarda en una porque al guardar cambian a la
 * vez y una escritura de una fila no puede quedarse a medias. Con tres filas,
 * un fallo entre la segunda y la tercera dejaria el negocio con el horario
 * nuevo y el telefono viejo, y nadie se enteraria.
 */
const SETTINGS_KEY = 'business';

/**
 * Cuanto se reutiliza lo leido antes de volver a preguntar a la base.
 *
 * El horario lo consulta el motor de agenda en CADA peticion de
 * disponibilidad; sin cache, una pagina de reservas dispararia una consulta
 * por cada dia que el cliente mira. Medio minuto es el equilibrio: la carga
 * desaparece y una correccion urgente ("nos hemos equivocado de telefono")
 * llega a la web en menos de lo que se tarda en recargar dos veces.
 *
 * La cache es POR INSTANCIA. Con varias instancias, cada una puede tardar lo
 * suyo en enterarse; el limite de arriba es el retardo maximo y es aceptable
 * para un dato que cambia unas pocas veces al ano.
 */
const CACHE_TTL_MS = 30_000;

@Injectable()
export class BusinessSettingsService {
  private readonly logger = new Logger(BusinessSettingsService.name);

  private cached: { value: BusinessSettings; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * La configuracion vigente.
   *
   * NUNCA FALLA. Si la fila no existe, si tiene basura de una version
   * anterior o si la base no responde, devuelve los valores de partida y
   * deja constancia en el log. El motivo es duro pero claro: de esto depende
   * que el sitio publico pueda ensenar precios y aceptar reservas. Tumbar la
   * pagina que genera ingresos porque el horario no se pudo leer seria un
   * intercambio pesimo.
   */
  async get(now: number = Date.now()): Promise<BusinessSettings> {
    if (this.cached && this.cached.expiresAt > now) {
      return this.cached.value;
    }

    const value = await this.load();
    this.cached = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  }

  /** Solo el horario, que es lo unico que necesita el motor de agenda. */
  async hours(now?: number): Promise<WeeklyHours> {
    return (await this.get(now)).hours;
  }

  private async load(): Promise<BusinessSettings> {
    let stored: unknown;

    try {
      const row = await this.prisma.db.businessSetting.findUnique({
        where: { key: SETTINGS_KEY },
        select: { value: true },
      });

      if (!row) return DEFAULT_BUSINESS_SETTINGS;
      stored = row.value;
    } catch (error) {
      this.logger.error(
        'No se pudo leer la configuracion del negocio; se usan los valores por defecto: ' +
          (error instanceof Error ? error.message : 'error desconocido'),
      );
      return DEFAULT_BUSINESS_SETTINGS;
    }

    const parsed = BusinessSettingsSchema.safeParse(stored);

    if (!parsed.success) {
      /*
       * Lo guardado no cumple el contrato. Pasa si se cambia el contrato y
       * queda una fila de la version anterior. Se avisa alto y claro, porque
       * significa que el panel ensena una cosa y el sitio otra, pero se sigue
       * sirviendo con los valores de partida.
       */
      this.logger.error(
        `La fila "${SETTINGS_KEY}" no cumple el contrato y se ignora. ` +
          'Guardala de nuevo desde el panel para corregirla.',
      );
      return DEFAULT_BUSINESS_SETTINGS;
    }

    return parsed.data;
  }

  /**
   * Lo mismo, mas quien lo cambio por ultima vez y cuando.
   *
   * Va sin cache a proposito: son tres lecturas al abrir una pantalla que se
   * usa unas pocas veces al mes, y a cambio quien edita ve SIEMPRE el estado
   * real. Servirle datos de hace medio minuto en la pantalla desde la que va
   * a escribir es como se pisan cambios entre dos personas.
   */
  async getForAdmin(): Promise<AdminBusinessSettings> {
    this.invalidate();

    const row = await this.prisma.db.businessSetting.findUnique({
      where: { key: SETTINGS_KEY },
      select: { updatedAt: true, updatedBy: true },
    });

    return {
      settings: await this.get(),
      updatedAt: row?.updatedAt.toISOString() ?? null,
      updatedBy: await this.staffName(row?.updatedBy ?? null),
    };
  }

  /**
   * Nombre de quien guardo el cambio.
   *
   * Devuelve `null` en vez de fallar si esa persona ya no esta: el historial
   * de la empresa no puede depender de que nadie cause baja nunca.
   */
  private async staffName(staffId: string | null): Promise<string | null> {
    if (staffId === null) return null;

    const persona = await this.prisma.db.staff.findUnique({
      where: { id: staffId },
      select: { firstName: true, lastName: true },
    });

    return persona ? `${persona.firstName} ${persona.lastName}`.trim() : null;
  }

  /**
   * Guarda la configuracion completa y deja rastro de quien la cambio.
   *
   * El cambio y su auditoria van en la MISMA transaccion. Cambiar el telefono
   * publico de la empresa es exactamente la clase de accion sobre la que
   * alguien preguntara despues "¿quien hizo esto?".
   */
  async update(
    settings: BusinessSettings,
    staff: AuthenticatedStaff,
    ipAddress?: string | null,
  ): Promise<BusinessSettings> {
    const anterior = await this.get();

    const saved = await this.prisma.db.$transaction(async (tx) => {
      const row = await tx.businessSetting.upsert({
        where: { key: SETTINGS_KEY },
        create: { key: SETTINGS_KEY, value: settings, updatedBy: staff.staffId },
        update: { value: settings, updatedBy: staff.staffId },
        select: { value: true },
      });

      await this.audit.record(
        {
          staff,
          action: 'settings.updated',
          entityType: 'BusinessSetting',
          entityId: SETTINGS_KEY,
          /*
           * Se guarda QUE CAMPOS cambiaron y sus valores. Aqui no hay nada
           * secreto: el telefono y el correo son justamente los datos que la
           * empresa publica. Saber a que numero se cambio, y no solo que
           * "se cambio algo", es lo que convierte el registro en util.
           */
          metadata: { changed: changedFields(anterior, settings), value: settings },
          ipAddress,
        },
        tx,
      );

      return row.value;
    });

    const parsed = BusinessSettingsSchema.safeParse(saved);

    /*
     * Se refresca la cache con lo que de verdad quedo escrito, no con lo que
     * se pidio escribir. Si por lo que sea no coincide, se vacia la cache
     * para que la siguiente lectura vaya a la base en vez de servir algo que
     * quiza no esta guardado.
     */
    this.cached = parsed.success
      ? { value: parsed.data, expiresAt: Date.now() + CACHE_TTL_MS }
      : null;

    return parsed.success ? parsed.data : settings;
  }

  /** Olvida lo cacheado. Solo lo usan las pruebas, para no depender del reloj. */
  invalidate(): void {
    this.cached = null;
  }
}

/**
 * Que cambio de verdad.
 *
 * Sirve para que la auditoria diga "cambio el telefono" en vez de "se guardo
 * la configuracion": ante una reclamacion, lo primero responde y lo segundo
 * obliga a comparar dos volcados a mano.
 */
function changedFields(before: BusinessSettings, after: BusinessSettings): string[] {
  const campos = ['phone', 'email', 'hours'] as const satisfies readonly (keyof BusinessSettings)[];

  return campos.filter((campo) => JSON.stringify(before[campo]) !== JSON.stringify(after[campo]));
}
