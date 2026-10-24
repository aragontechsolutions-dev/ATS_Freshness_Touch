import { Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_GALLERY,
  GallerySchema,
  type AdminGallery,
  type AuthenticatedStaff,
  type Gallery,
} from '@freshness/types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';

/**
 * LA GALERIA DE ANTES Y DESPUES
 * -----------------------------
 * Los videos que la empresa publica en la portada. Vive en una sola fila de
 * la tabla de clave y valor, como el resto de la configuracion.
 *
 * UNA FILA Y NO UNA POR VIDEO, por el mismo motivo que los textos del sitio:
 * la galeria se reordena en tandas, y un fallo a mitad dejaria la portada con
 * dos videos repetidos y uno perdido.
 *
 * NUNCA FALLA AL LEER. Si la fila no existe, tiene basura de una version
 * anterior o la base no responde, devuelve la galeria vacia y lo deja en el
 * log. La seccion no se pinta y la portada sale entera: esta es la pagina que
 * genera los ingresos, y tumbarla por no poder leer una lista de videos seria
 * un intercambio pesimo.
 */
const SETTINGS_KEY = 'gallery';

/**
 * Lo pide el sitio publico en cada visita, asi que se cachea como el resto.
 * Medio minuto: retirar un video a peticion de un cliente llega a la web en
 * lo que se tarda en recargar dos veces, y eso importa — el consentimiento se
 * puede revocar.
 */
const CACHE_TTL_MS = 30_000;

@Injectable()
export class GalleryService {
  private readonly logger = new Logger(GalleryService.name);

  private cached: { value: Gallery; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** La galeria vigente. */
  async get(now: number = Date.now()): Promise<Gallery> {
    if (this.cached && this.cached.expiresAt > now) {
      return this.cached.value;
    }

    const value = await this.load();
    this.cached = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  }

  /** Se llama al guardar, para que el cambio se vea sin esperar a la cache. */
  invalidate(): void {
    this.cached = null;
  }

  private async load(): Promise<Gallery> {
    let stored: unknown;

    try {
      const row = await this.prisma.db.businessSetting.findUnique({
        where: { key: SETTINGS_KEY },
        select: { value: true },
      });

      if (!row) return DEFAULT_GALLERY;
      stored = row.value;
    } catch (error) {
      this.logger.error(
        'No se pudo leer la galeria; la seccion no se pinta: ' +
          (error instanceof Error ? error.message : 'error desconocido'),
      );
      return DEFAULT_GALLERY;
    }

    const parsed = GallerySchema.safeParse(stored);

    if (!parsed.success) {
      this.logger.error(
        `La fila "${SETTINGS_KEY}" no cumple el contrato y se ignora. ` +
          'Guardala de nuevo desde el panel para corregirla.',
      );
      return DEFAULT_GALLERY;
    }

    return parsed.data;
  }

  /**
   * La galeria mas quien la cambio, para la pantalla de administracion.
   *
   * Sin cache, y ademas la invalida: quien va a editar tiene que ver el
   * estado real, no el de hace medio minuto. Servir datos viejos en la
   * pantalla desde la que se edita es como dos personas se pisan los
   * cambios — y aqui pisarse significa volver a publicar un video que la
   * otra acababa de retirar porque un cliente lo pidio.
   */
  async getForAdmin(): Promise<AdminGallery> {
    this.invalidate();

    const row = await this.prisma.db.businessSetting.findUnique({
      where: { key: SETTINGS_KEY },
      select: { updatedAt: true, updatedBy: true },
    });

    return {
      gallery: await this.get(),
      updatedAt: row?.updatedAt.toISOString() ?? null,
      updatedBy: await this.staffName(row?.updatedBy ?? null),
    };
  }

  /** Nombre de quien guardo. `null` si esa persona ya no esta en la tabla. */
  private async staffName(staffId: string | null): Promise<string | null> {
    if (staffId === null) return null;

    const persona = await this.prisma.db.staff.findUnique({
      where: { id: staffId },
      select: { firstName: true, lastName: true },
    });

    return persona ? `${persona.firstName} ${persona.lastName}`.trim() : null;
  }

  /**
   * Guarda la galeria entera y deja rastro de quien la cambio.
   *
   * EL CAMBIO Y SU AUDITORIA VAN EN LA MISMA TRANSACCION, y aqui eso no es
   * ceremonia: lo que se publica es el interior de la casa de un cliente con
   * su permiso firmado. Si el cliente revoca ese permiso o reclama, la
   * pregunta es «quien lo publico, cuando, y cuando se retiro». Un cambio
   * guardado sin su registro deja esa pregunta sin respuesta.
   */
  async save(
    gallery: Gallery,
    staff: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<AdminGallery> {
    const anterior = await this.get();

    const antes = anterior.videos.map((v) => v.videoId);
    const despues = gallery.videos.map((v) => v.videoId);

    await this.prisma.db.$transaction(async (tx) => {
      await tx.businessSetting.upsert({
        where: { key: SETTINGS_KEY },
        create: { key: SETTINGS_KEY, value: gallery, updatedBy: staff.staffId },
        update: { value: gallery, updatedBy: staff.staffId },
      });

      await this.audit.record(
        {
          staff,
          surface: 'PANEL',
          action: 'gallery.updated',
          /*
           * `business_settings` como el resto de la configuracion, no una
           * entidad propia: lo que distingue este cambio de un cambio de
           * telefono es la ACCION. El catalogo de entidades existe para que
           * nadie invente una grafia nueva.
           */
          entityType: 'business_settings',
          entityId: SETTINGS_KEY,
          /*
           * QUE ENTRO Y QUE SALIO, no la lista entera. La lista entera no
           * responde a «cuando se retiro el video de esta casa», que es la
           * unica pregunta que llega tarde; la diferencia si.
           *
           * Son identificadores de videos ya publicos en YouTube: no hay
           * nada secreto. Lo que NO entra aqui es ninguna direccion ni
           * ningun dato del cliente, que es de donde vendria el problema.
           */
          metadata: {
            added: despues.filter((id) => !antes.includes(id)),
            removed: antes.filter((id) => !despues.includes(id)),
          },
          ipAddress,
        },
        tx,
      );
    });

    this.invalidate();
    return this.getForAdmin();
  }
}
