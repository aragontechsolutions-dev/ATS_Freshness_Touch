import { Injectable, Logger } from '@nestjs/common';
import { DEFAULT_GALLERY, GallerySchema, type Gallery } from '@freshness/types';
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

  constructor(private readonly prisma: PrismaService) {}

  /** La galeria vigente. */
  async get(now: number = Date.now()): Promise<Gallery> {
    if (this.cached && this.cached.expiresAt > now) {
      return this.cached.value;
    }

    const value = await this.load();
    this.cached = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  }

  /** Se llamara al guardar, para que el cambio se vea sin esperar a la cache. */
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
}
