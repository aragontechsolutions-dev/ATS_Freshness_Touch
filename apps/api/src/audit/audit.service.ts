import { Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedStaff } from '@freshness/types';
import { PrismaService } from '../database/prisma.service';
import type { Prisma, PrismaClient } from '../generated/prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export interface AuditEntry {
  /** Quien lo hizo. Nulo cuando actua el propio sistema. */
  staff: AuthenticatedStaff | null;
  /** Que hizo, en pasado y en minusculas: "booking.cancelled". */
  action: string;
  entityType: string;
  entityId: string | null;
  /** Detalle util para investigar despues. NUNCA datos de tarjeta. */
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

/**
 * RASTRO DE QUIEN HIZO QUE
 * ------------------------
 * Imprescindible desde el momento en que se pueden cambiar precios, cancelar
 * citas y mover dinero desde un panel. Sin esto, ante una reclamacion no hay
 * forma de saber si un cobro lo ordeno una persona, cual, y cuando.
 *
 * Se escribe DENTRO de la misma transaccion que el cambio siempre que se
 * pueda: o quedan los dos o no queda ninguno. Un registro de auditoria que
 * puede faltar justo cuando algo salio mal no sirve de nada.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, db: Db = this.prisma.db): Promise<void> {
    try {
      await db.auditLog.create({
        data: {
          actorType: entry.staff ? 'STAFF' : 'SYSTEM',
          actorId: entry.staff?.staffId ?? null,
          action: entry.action.slice(0, 80),
          entityType: entry.entityType.slice(0, 40),
          entityId: entry.entityId,
          ...(entry.metadata === undefined ? {} : { metadata: entry.metadata }),
          ipAddress: normalizeIp(entry.ipAddress),
        },
      });
    } catch (error) {
      /*
       * Cuando se escribe dentro de una transaccion, el error sube y deshace
       * el cambio: es lo correcto, porque una accion sin rastro es peor que
       * una accion que no ocurre.
       *
       * Fuera de transaccion no hay nada que deshacer, asi que al menos queda
       * constancia en el log del servidor.
       */
      this.logger.error(
        `No se pudo registrar la auditoria de "${entry.action}": ` +
          (error instanceof Error ? error.message : 'error desconocido'),
      );
      throw error;
    }
  }
}

/**
 * La columna es de tipo `inet` y rechaza cualquier cosa que no sea una
 * direccion. Express entrega las IPv4 envueltas en formato IPv6
 * ("::ffff:127.0.0.1"), que PostgreSQL si acepta, pero una cadena vacia o un
 * valor inventado por una cabecera falsificada haria fallar la insercion y,
 * con ella, la operacion entera.
 */
function normalizeIp(value: string | null | undefined): string | null {
  if (!value) return null;
  const limpia = value.trim();
  return /^[0-9a-fA-F:.]+$/.test(limpia) && limpia.length <= 45 ? limpia : null;
}
