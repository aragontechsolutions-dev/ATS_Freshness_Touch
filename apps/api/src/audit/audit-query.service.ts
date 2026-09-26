import { Injectable } from '@nestjs/common';
import type { AuditLogItem, AuditPage, AuditQuery, AuthenticatedStaff } from '@freshness/types';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from './audit.service';

/**
 * LEER EL REGISTRO
 * ----------------
 * Hasta ahora la auditoria se escribia y no la leia nadie: para verla habia
 * que abrir la base de datos. Un registro que solo puede consultar quien
 * tiene acceso al servidor no protege de nada en una empresa pequena, porque
 * esa persona es justo de la que menos falta hace protegerse.
 *
 * TRES COSAS QUE ESTE SERVICIO NO HACE, Y ES A PROPOSITO:
 *
 *   - No actualiza ni borra. No existe el metodo. El unico borrado del
 *     modulo es la purga por antiguedad, que va aparte y no elige filas.
 *   - No resuelve nombres con un `include` de Prisma. La auditoria NO tiene
 *     relacion declarada con `staff`, y no la tiene a proposito: una clave
 *     foranea con borrado en cascada haria desaparecer el rastro de alguien
 *     al darle de baja, que es exactamente cuando mas falta hace.
 *   - No deja consultar sin dejar rastro. Ver `AuditController`.
 */
@Injectable()
export class AuditQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async query(filtros: AuditQuery): Promise<AuditPage> {
    const where = {
      ...(filtros.actorId ? { actorId: filtros.actorId } : {}),
      ...(filtros.action ? { action: filtros.action } : {}),
      ...(filtros.surface ? { surface: filtros.surface } : {}),
      ...(filtros.entityType ? { entityType: filtros.entityType } : {}),
      ...(filtros.entityId ? { entityId: filtros.entityId } : {}),
      ...(rangoDeFechas(filtros) ?? {}),
    };

    /*
     * Se pide UNA FILA DE MAS que el limite. Es la forma barata de saber si
     * queda mas sin hacer un `count`, que en una tabla que solo crece obliga
     * a recorrerla entera.
     */
    const filas = await this.prisma.db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filtros.limit + 1,
    });

    const hayMas = filas.length > filtros.limit;
    const pagina = hayMas ? filas.slice(0, filtros.limit) : filas;

    return {
      items: await this.conNombres(pagina),
      /*
       * El cursor es el instante de la ultima fila devuelta. Con `?page=N`,
       * una entrada nueva mientras se lee empuja a las demas y se acaba
       * viendo dos veces la misma fila y saltandose otra.
       */
      nextBefore: hayMas ? (pagina.at(-1)?.createdAt.toISOString() ?? null) : null,
    };
  }

  /**
   * Pone nombre a quien actuo, con UNA sola consulta para toda la pagina.
   *
   * El nombre se resuelve al leer y no se copia en la fila: si alguien se
   * cambia el apellido, el historial entero pasa a mostrarlo bien. Queda
   * `null` cuando la ficha ya no existe, y el identificador sigue ahi, que
   * es lo que de verdad importa para investigar.
   */
  private async conNombres(
    filas: {
      id: string;
      createdAt: Date;
      surface: string;
      actorType: string;
      actorId: string | null;
      action: string;
      entityType: string;
      entityId: string | null;
      metadata: unknown;
      ipAddress: string | null;
    }[],
  ): Promise<AuditLogItem[]> {
    const ids = [...new Set(filas.map((f) => f.actorId).filter((id): id is string => id !== null))];

    const personas =
      ids.length === 0
        ? []
        : await this.prisma.db.staff.findMany({
            where: { id: { in: ids } },
            select: { id: true, firstName: true, lastName: true },
          });

    const porId = new Map(personas.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));

    return filas.map((fila) => ({
      id: fila.id,
      occurredAt: fila.createdAt.toISOString(),
      surface: fila.surface as AuditLogItem['surface'],
      actorType: fila.actorType as AuditLogItem['actorType'],
      actorId: fila.actorId,
      actorName: fila.actorId ? (porId.get(fila.actorId) ?? null) : null,
      action: fila.action,
      entityType: fila.entityType,
      entityId: fila.entityId,
      metadata: fila.metadata ?? null,
      ipAddress: fila.ipAddress,
    }));
  }

  /**
   * Deja constancia de que alguien consulto el registro.
   *
   * ES LA REGLA QUE SOSTIENE TODO LO DEMAS. Sin esto, quien tiene acceso
   * puede revisar lo que hicieron sus companeros sin que quede rastro, y el
   * modulo pasa de ser una garantia a ser una herramienta de vigilancia
   * silenciosa.
   *
   * Se guardan los filtros usados, que es lo que dice QUE se fue a buscar:
   * «consulte la auditoria» no informa de nada; «consulte todo lo que hizo
   * esta persona el mes pasado» si.
   */
  async recordQuery(
    staff: AuthenticatedStaff,
    filtros: AuditQuery,
    ip: string | null,
  ): Promise<void> {
    await this.audit.record({
      staff,
      surface: 'PANEL',
      action: 'audit.queried',
      entityType: 'audit',
      entityId: null,
      metadata: {
        actorId: filtros.actorId ?? null,
        action: filtros.action ?? null,
        surface: filtros.surface ?? null,
        entityType: filtros.entityType ?? null,
        entityId: filtros.entityId ?? null,
        from: filtros.from ?? null,
        to: filtros.to ?? null,
      },
      ipAddress: ip,
    });
  }
}

/** `from` y `to` en un solo filtro, omitido cuando no hay ninguno. */
function rangoDeFechas(filtros: AuditQuery): { createdAt: Record<string, Date> } | null {
  const limites: Record<string, Date> = {};
  if (filtros.from) limites.gte = new Date(filtros.from);
  if (filtros.to) limites.lte = new Date(filtros.to);
  // El cursor de paginacion es tambien un limite superior, y el mas estricto
  // gana: si se pide "antes de X" y ademas "hasta Y", vale el menor.
  if (filtros.before) {
    const cursor = new Date(filtros.before);
    limites.lt = limites.lt && limites.lt < cursor ? limites.lt : cursor;
  }
  return Object.keys(limites).length > 0 ? { createdAt: limites } : null;
}
