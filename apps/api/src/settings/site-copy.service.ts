import { Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_SITE_COPY,
  SITE_COPY_KEYS,
  SiteCopySchema,
  type AdminSiteCopy,
  type AuthenticatedStaff,
  type SiteCopy,
  type SiteCopyKey,
} from '@freshness/types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';

/**
 * TEXTOS DEL SITIO
 * ----------------
 * Lee y escribe las promesas y las preguntas frecuentes que la empresa
 * publica en la web.
 *
 * Igual que el resto de la configuracion, TODO VIVE EN UNA SOLA FILA de la
 * tabla de clave y valor. Aqui importa mas que en ningun otro sitio: las
 * promesas se reescriben en tandas ("ahora la garantia es de 48 horas, y hay
 * que ajustar la pregunta frecuente que la menciona"). Con una fila por
 * texto, un fallo a mitad dejaria la web prometiendo 48 horas en la tarjeta
 * y 24 en el FAQ, que es peor que no haber cambiado nada.
 */
const SETTINGS_KEY = 'site_copy';

/**
 * Los textos los pide el sitio publico en cada visita, asi que se cachean
 * como el resto. Medio minuto: una correccion urgente de una promesa llega a
 * la web en lo que se tarda en recargar dos veces.
 */
const CACHE_TTL_MS = 30_000;

@Injectable()
export class SiteCopyService {
  private readonly logger = new Logger(SiteCopyService.name);

  private cached: { value: SiteCopy; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Los textos vigentes.
   *
   * NUNCA FALLA. Si la fila no existe, tiene basura o la base no responde,
   * devuelve el conjunto vacio y el sitio ensena los textos del codigo, que
   * es exactamente lo que ensenaba antes de que esto existiera. Tumbar la
   * portada porque no se pudo leer una frase seria un intercambio pesimo.
   */
  async get(now: number = Date.now()): Promise<SiteCopy> {
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

  private async load(): Promise<SiteCopy> {
    let stored: unknown;

    try {
      const row = await this.prisma.db.businessSetting.findUnique({
        where: { key: SETTINGS_KEY },
        select: { value: true },
      });

      if (!row) return DEFAULT_SITE_COPY;
      stored = row.value;
    } catch (error) {
      this.logger.error(
        'No se pudieron leer los textos del sitio; se usan los del codigo: ' +
          (error instanceof Error ? error.message : 'error desconocido'),
      );
      return DEFAULT_SITE_COPY;
    }

    const parsed = SiteCopySchema.safeParse(sinClavesRetiradas(stored));

    if (!parsed.success) {
      this.logger.error(
        `La fila "${SETTINGS_KEY}" no cumple el contrato y se ignora. ` +
          'Guardala de nuevo desde el panel para corregirla.',
      );
      return DEFAULT_SITE_COPY;
    }

    return parsed.data;
  }

  /**
   * Los textos mas quien los cambio.
   *
   * Sin cache, y ademas la invalida: quien va a escribir tiene que ver el
   * estado real, no el de hace medio minuto. Servir datos viejos en la
   * pantalla desde la que se edita es como dos personas se pisan los
   * cambios.
   */
  async getForAdmin(): Promise<AdminSiteCopy> {
    this.invalidate();

    const row = await this.prisma.db.businessSetting.findUnique({
      where: { key: SETTINGS_KEY },
      select: { updatedAt: true, updatedBy: true },
    });

    return {
      copy: await this.get(),
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
   * Guarda los textos completos y deja rastro de quien los cambio.
   *
   * El cambio y su auditoria van en la MISMA transaccion. Lo que se edita
   * aqui son compromisos con el cliente: ante una reclamacion la pregunta es
   * «que prometia la web cuando este cliente reservo», y esa pregunta se
   * responde con el registro o no se responde.
   */
  async save(
    copy: SiteCopy,
    staff: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<AdminSiteCopy> {
    const anterior = await this.get();
    const limpio = sinTextosVacios(copy);
    const cambiadas = clavesCambiadas(anterior, limpio);

    await this.prisma.db.$transaction(async (tx) => {
      await tx.businessSetting.upsert({
        where: { key: SETTINGS_KEY },
        create: { key: SETTINGS_KEY, value: limpio, updatedBy: staff.staffId },
        update: { value: limpio, updatedBy: staff.staffId },
      });

      await this.audit.record(
        {
          staff,
          surface: 'PANEL',
          action: 'site_copy.updated',
          /*
           * `business_settings` como el resto de la configuracion, no una
           * entidad propia: lo que distingue este cambio de un cambio de
           * telefono es la ACCION. El catalogo de entidades existe
           * precisamente para que nadie invente una grafia nueva; ya paso
           * una vez con `booking`, `Booking` y `Staff`, y filtrar devolvia
           * la mitad de las filas sin que se notara.
           */
          entityType: 'business_settings',
          entityId: SETTINGS_KEY,
          /*
           * Se guardan las claves que cambiaron Y el texto nuevo de cada una.
           * Aqui no hay nada secreto: es texto escrito para publicarse. Y sin
           * el texto, el registro solo diria «se cambio la garantia», que no
           * responde a la unica pregunta que importa: a que se cambio.
           */
          metadata: {
            changed: cambiadas,
            value: Object.fromEntries(cambiadas.map((key) => [key, limpio[key] ?? null])),
          },
          ipAddress,
        },
        tx,
      );
    });

    /*
     * Se devuelve la vista completa, no solo los textos: quien acaba de
     * guardar ve al momento su propio nombre y la hora en la pantalla, sin
     * tener que recargar para comprobar que el cambio entro.
     */
    this.invalidate();
    return this.getForAdmin();
  }
}

/**
 * Quita las claves que ya no estan en el contrato.
 *
 * El contrato RECHAZA las claves desconocidas a proposito, para que una mal
 * escrita no se quede guardada sin salir nunca en la web. El efecto
 * secundario es que retirar un texto editable —por ejemplo, si se elimina una
 * pregunta frecuente— invalidaria de golpe la fila entera y la empresa
 * perderia TODO lo que hubiera escrito.
 *
 * Limpiando antes de validar, retirar una clave solo hace desaparecer esa.
 * Es la misma solucion que se uso al retirar `surchargeCents` del area de
 * servicio.
 */
function sinClavesRetiradas(valor: unknown): unknown {
  if (valor === null || typeof valor !== 'object' || Array.isArray(valor)) return valor;

  const conocidas = new Set<string>(SITE_COPY_KEYS);
  return Object.fromEntries(
    Object.entries(valor as Record<string, unknown>).filter(([key]) => conocidas.has(key)),
  );
}

/**
 * Quita las claves en las que no queda nada escrito.
 *
 * Sin esto, borrar un texto dejaria `{ en: null, es: null }` guardado para
 * siempre. Funciona igual —el sitio usa el texto del codigo— pero la fila
 * iria acumulando restos de cada edicion, y quien la mirase no podria
 * distinguir lo que la empresa cambio de lo que borro hace un ano.
 */
function sinTextosVacios(copy: SiteCopy): SiteCopy {
  const limpio: SiteCopy = {};

  for (const key of SITE_COPY_KEYS) {
    const valor = copy[key];
    if (valor && (valor.en !== null || valor.es !== null)) {
      limpio[key] = valor;
    }
  }

  return limpio;
}

/** Que claves quedaron distintas, en el orden del contrato. */
function clavesCambiadas(antes: SiteCopy, despues: SiteCopy): SiteCopyKey[] {
  return SITE_COPY_KEYS.filter((key) => {
    const a = antes[key];
    const b = despues[key];
    return (a?.en ?? null) !== (b?.en ?? null) || (a?.es ?? null) !== (b?.es ?? null);
  });
}
