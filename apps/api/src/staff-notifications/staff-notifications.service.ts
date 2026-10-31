import { Injectable, Logger } from '@nestjs/common';
import {
  NOTIFICATION_AUDIENCE,
  StaffNotificationSchema,
  type AuthenticatedStaff,
  type StaffNotification,
  type StaffNotificationKind,
  type StaffNotificationList,
  type StaffRole,
} from '@freshness/types';
import { PrismaService } from '../database/prisma.service';
import type { Prisma, PrismaClient } from '../generated/prisma/client';

/** Igual que en auditoria: vale el cliente normal o el de una transaccion. */
type Db = PrismaClient | Prisma.TransactionClient;

/** Lo que se puede meter en `params`: nada que identifique a una persona. */
export type NotificationParams = Record<string, string | number | boolean>;

/**
 * LA BANDEJA DEL EQUIPO
 * =====================
 * Lo que alguien del panel tiene que enterarse al entrar.
 *
 * ========================================================================
 * EMITIR NO PUEDE TUMBAR LO QUE LA PROVOCO
 * ========================================================================
 * Una notificacion es un aviso, no el hecho. Si al guardar «hay una reserva
 * nueva» falla algo, lo que NO puede pasar es que se caiga la reserva: ya
 * esta pagada. Por eso `emitir` traga sus propios fallos y los registra.
 *
 * La excepcion es cuando se le pasa una transaccion: ahi quien llama ha
 * decidido que el aviso va con el hecho, y entonces un fallo deshace las dos
 * cosas. Es lo correcto para un aviso que no tendria sentido sin su hecho.
 */
@Injectable()
export class StaffNotificationsService {
  private readonly logger = new Logger(StaffNotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Deja un aviso en la bandeja del puesto que le toca.
   *
   * EL PUESTO SALE DEL CATALOGO, no de quien llama: que «una devolucion
   * rechazada» sea cosa de administracion es una regla del negocio y vive en
   * un sitio. Se puede forzar otro, pero hay que escribirlo.
   */
  async emitir(
    entrada: {
      kind: StaffNotificationKind;
      /** Para estrechar el aviso a una persona. Sin esto lo ve todo el puesto. */
      staffId?: string;
      audience?: StaffRole;
      entityType?: string;
      entityId?: string;
      params?: NotificationParams;
    },
    tx?: Db,
  ): Promise<void> {
    const db = tx ?? this.prisma.db;

    const datos = {
      kind: entrada.kind,
      audience: entrada.audience ?? NOTIFICATION_AUDIENCE[entrada.kind],
      staffId: entrada.staffId ?? null,
      entityType: entrada.entityType ?? null,
      entityId: entrada.entityId ?? null,
      params: entrada.params ?? {},
    };

    if (tx) {
      // Dentro de una transaccion ajena: un fallo deshace tambien el hecho,
      // que es lo que quiso quien la paso.
      await db.staffNotification.create({ data: datos });
      return;
    }

    try {
      await db.staffNotification.create({ data: datos });
    } catch (error) {
      /*
       * Se registra el TIPO, nunca los parametros: pueden llevar importes y
       * referencias, y los registros del servidor los ve mas gente y se
       * conservan mas tiempo de lo que uno cree.
       */
      this.logger.error(
        `No se pudo dejar el aviso "${entrada.kind}" en la bandeja: ` +
          (error instanceof Error ? error.message : 'error desconocido'),
      );
    }
  }

  /**
   * La bandeja de quien pregunta.
   *
   * LO DE SU PUESTO MAS LO SUYO. Una notificacion con `staffId` es de esa
   * persona y de nadie mas; sin el, la ve todo el puesto.
   */
  /**
   * ¿HAY YA UN AVISO DE ESTA CLASE DESDE ESA HORA?
   *
   * Es el antirrebote de los avisos que nacen de un BARRIDO y no de un
   * hecho. Una reserva nueva ocurre una vez; «hay fotos sin permiso» es un
   * estado que sigue siendo verdad en cada pasada, y sin esto la bandeja se
   * llenaria del mismo aviso una vez por pasada hasta que alguien lo
   * arreglara. Una bandeja asi se deja de leer, que es el unico modo de
   * fallo que estos avisos tienen.
   *
   * SE PREGUNTA A LA TABLA Y NO A LA MEMORIA: un reinicio del servidor no
   * puede hacer que vuelva a avisarse de todo.
   *
   * No se mira si esta LEIDO, y es deliberado: leer no es arreglar. Si el
   * problema sigue ahi manana, volver a decirlo es lo correcto.
   */
  async hayRecientes(kind: StaffNotificationKind, desde: Date): Promise<boolean> {
    const cuantos = await this.prisma.db.staffNotification.count({
      where: { kind, createdAt: { gte: desde } },
    });

    return cuantos > 0;
  }

  async listar(staff: AuthenticatedStaff, limite: number): Promise<StaffNotificationList> {
    const suyas = {
      audience: staff.role,
      OR: [{ staffId: null }, { staffId: staff.staffId }],
    };

    const [filas, unreadCount] = await Promise.all([
      this.prisma.db.staffNotification.findMany({
        where: suyas,
        orderBy: { createdAt: 'desc' },
        take: limite,
        include: { reads: { where: { staffId: staff.staffId }, select: { readAt: true } } },
      }),
      /*
       * EL CONTADOR CUENTA TODAS, no las de esta pagina. Un globo que dice
       * «5» porque solo se pidieron cinco es un globo que miente en cuanto
       * hay una sexta.
       */
      this.prisma.db.staffNotification.count({
        where: { ...suyas, reads: { none: { staffId: staff.staffId } } },
      }),
    ]);

    return { notifications: filas.map((fila) => aNotificacion(fila)), unreadCount };
  }

  /**
   * Marca como leida. Para esta persona, no para su puesto entero.
   *
   * `createMany` con `skipDuplicates` y no un `create`: volver a marcar algo
   * ya leido —dos pestanas abiertas, un doble clic— no es un error que haya
   * que ensenar, es la misma intencion dos veces.
   */
  async marcarLeidas(ids: readonly string[], staff: AuthenticatedStaff): Promise<void> {
    if (ids.length === 0) return;

    /*
     * SOLO LAS QUE LE TOCAN. Sin esto, cualquiera podria marcar como leida la
     * notificacion de otro puesto mandando su identificador — no es grave,
     * pero es escribir en algo que no es suyo.
     */
    const suyas = await this.prisma.db.staffNotification.findMany({
      where: {
        id: { in: [...ids] },
        audience: staff.role,
        OR: [{ staffId: null }, { staffId: staff.staffId }],
      },
      select: { id: true },
    });

    await this.prisma.db.staffNotificationRead.createMany({
      data: suyas.map((fila) => ({ notificationId: fila.id, staffId: staff.staffId })),
      skipDuplicates: true,
    });
  }

  /** Todas las suyas de golpe, que es lo que hace el boton de la bandeja. */
  async marcarTodasLeidas(staff: AuthenticatedStaff): Promise<void> {
    const pendientes = await this.prisma.db.staffNotification.findMany({
      where: {
        audience: staff.role,
        OR: [{ staffId: null }, { staffId: staff.staffId }],
        reads: { none: { staffId: staff.staffId } },
      },
      select: { id: true },
    });

    await this.marcarLeidas(
      pendientes.map((fila) => fila.id),
      staff,
    );
  }
}

/* ------------------------------------------------------------------------ */

interface FilaConLecturas {
  id: string;
  kind: string;
  entityType: string | null;
  entityId: string | null;
  params: unknown;
  createdAt: Date;
  reads: { readAt: Date }[];
}

/**
 * De la fila a lo que lee el panel.
 *
 * Se valida LO QUE SALE, no solo lo que entra: una fila escrita a mano desde
 * una consola no paso por el contrato, y aqui se nota antes de que el panel
 * intente pintarla.
 */
function aNotificacion(fila: FilaConLecturas): StaffNotification {
  return StaffNotificationSchema.parse({
    id: fila.id,
    kind: fila.kind,
    entityType: fila.entityType,
    entityId: fila.entityId,
    params: fila.params ?? {},
    createdAt: fila.createdAt.toISOString(),
    read: fila.reads.length > 0,
  });
}
