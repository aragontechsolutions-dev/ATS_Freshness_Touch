import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../common/config/env';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { SweepHeartbeatService } from '../health/sweep-heartbeat.service';
import { AvailabilityService } from '../scheduling/availability.service';
import { PaymentsService } from './payments.service';

/** Retraso de la primera pasada tras arrancar, para no competir con el arranque. */
const RETRASO_INICIAL_MS = 150_000;

/**
 * LAS RESERVAS QUE NADIE LLEGO A PAGAR
 * ====================================
 * Un formulario abandonado a mitad del pago deja una reserva en
 * `PENDING_PAYMENT` que no se mueve nunca mas. Esto las cierra.
 *
 * ========================================================================
 * LO QUE **NO** ARREGLA, PARA NO VENDERLO MAL
 * ========================================================================
 * NO desbloquea la agenda: eso ya funcionaba. `findOccupied` deja de contar
 * las pendientes de pago pasado el plazo, asi que el hueco vuelve a
 * ofrecerse solo. Lo que quedaba abierto es otra cosa, y son tres:
 *
 *   1. EL CLIENTE NO PODIA VOLVER A RESERVAR ESA MISMA HORA. Hay un indice
 *      unico sobre (cliente, hora) que excluye solo las CANCELADAS. Con la
 *      fila zombi viva, el mismo cliente reintentando su reserva recibia un
 *      «ya tienes una reserva a esa hora» — que es verdad en la base y
 *      mentira para el, porque la suya nunca llego a existir.
 *
 *   2. EL DINERO SE QUEDABA RETENIDO EN SU TARJETA. Si llego a autorizar y
 *      el aviso del proveedor se perdio, hay una retencion viva. Se libera
 *      aqui en vez de esperar a que caduque sola dias despues.
 *
 *   3. EL PANEL ACUMULABA FILAS que no significan nada y que ensucian
 *      cualquier recuento.
 *
 * ========================================================================
 * EL CORTE ES EL MISMO QUE EL DE LA AGENDA, Y SALE DEL MISMO SITIO
 * ========================================================================
 * Se pide a `AvailabilityService.corteDeRetencion()`. Con una cuenta propia,
 * cambiar el plazo dejaria la franja en tierra de nadie: libre para reservar
 * pero con una reserva viva encima, o cancelada mientras la agenda aun la
 * respeta.
 *
 * ========================================================================
 * PRIMERO SE LIBERA EL DINERO, DESPUES SE CANCELA LA FILA
 * ========================================================================
 * Y si liberar falla, LA FILA NO SE CANCELA. Es deliberado y va en esta
 * direccion: una fila cancelada con una retencion viva detras es dinero de
 * un cliente bloqueado en un sitio donde ya nadie va a mirar. Al reves, la
 * fila sigue pendiente y la siguiente pasada vuelve a intentarlo.
 */
@Injectable()
export class HoldExpirySweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HoldExpirySweepService.name);

  private temporizador: NodeJS.Timeout | null = null;
  /** Evita que dos pasadas se solapen si una tarda mas que el intervalo. */
  private enCurso = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly availability: AvailabilityService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
    private readonly latidos: SweepHeartbeatService,
  ) {}

  onModuleInit(): void {
    const minutos = this.config.get('HOLD_SWEEP_MINUTES', { infer: true });

    if (minutos === 0) {
      this.logger.log('Cierre de reservas sin pagar desactivado (HOLD_SWEEP_MINUTES=0)');
      return;
    }

    const cadaMs = minutos * 60_000;
    this.latidos.registrar('expiredHolds', cadaMs);

    this.temporizador = setInterval(() => void this.pasada(), cadaMs);
    this.temporizador.unref();

    setTimeout(() => void this.pasada(), RETRASO_INICIAL_MS).unref();
  }

  onModuleDestroy(): void {
    if (this.temporizador !== null) clearInterval(this.temporizador);
  }

  /**
   * Una pasada. Publica para que las pruebas la llamen a mano y no dependan
   * del reloj, igual que el resto de barridos del proyecto.
   */
  async pasada(ahora: Date = new Date()): Promise<void> {
    if (this.enCurso) return;
    this.enCurso = true;

    try {
      const corte = this.availability.corteDeRetencion(ahora);

      const vencidas = await this.prisma.db.booking.findMany({
        where: { status: 'PENDING_PAYMENT', createdAt: { lt: corte } },
        select: {
          id: true,
          reference: true,
          payments: {
            /*
             * Solo las retenciones VIVAS. Una ya cobrada o ya liberada no se
             * toca: cancelarla otra vez en el proveedor seria pedirle que
             * deshaga algo que no esta hecho.
             */
            where: { status: { in: ['REQUIRES_CAPTURE', 'REQUIRES_ACTION', 'PROCESSING'] } },
            select: { id: true, providerPaymentIntentId: true },
          },
        },
        /*
         * De cien en cien. Una pasada que intenta cerrar mil reservas hace
         * mil llamadas al proveedor y se come el minuto entero; las que
         * sobren entran en la siguiente, que es dentro de un rato.
         */
        take: 100,
      });

      for (const reserva of vencidas) {
        await this.cerrar(reserva, ahora);
      }

      this.latidos.anotar('expiredHolds', ahora.getTime());
    } catch (error) {
      this.logger.error(
        'No se pudo repasar las reservas sin pagar: ' +
          (error instanceof Error ? error.message : 'error desconocido'),
      );
    } finally {
      this.enCurso = false;
    }
  }

  private async cerrar(
    reserva: {
      id: string;
      reference: string;
      payments: { id: string; providerPaymentIntentId: string | null }[];
    },
    ahora: Date,
  ): Promise<void> {
    for (const pago of reserva.payments) {
      if (pago.providerPaymentIntentId === null) continue;

      try {
        await this.payments.release(
          pago.providerPaymentIntentId,
          'La reserva no se completo dentro del plazo de pago',
        );
      } catch (error) {
        /*
         * SE PARA AQUI Y NO SE CANCELA LA FILA. Una fila cancelada con una
         * retencion viva detras es dinero de un cliente bloqueado en un
         * sitio donde ya nadie va a mirar. Dejandola pendiente, la siguiente
         * pasada vuelve a intentarlo.
         */
        this.logger.warn(
          `No se pudo liberar la retencion de la reserva ${reserva.reference}: ` +
            (error instanceof Error ? error.message : 'error desconocido') +
            '. Se reintenta en la siguiente pasada.',
        );
        return;
      }
    }

    await this.prisma.db.$transaction(async (tx) => {
      /*
       * SE VUELVE A COMPROBAR EL ESTADO DENTRO DE LA TRANSACCION. Entre la
       * consulta de arriba y este momento pudo llegar el aviso del proveedor
       * confirmando el pago, y cancelar entonces seria tirar una reserva
       * pagada. `updateMany` con el estado en el `where` lo resuelve sin
       * bloqueo: si ya no esta pendiente, no toca nada.
       */
      const { count } = await tx.booking.updateMany({
        where: { id: reserva.id, status: 'PENDING_PAYMENT' },
        data: {
          status: 'CANCELLED',
          cancelledAt: ahora,
          /*
           * SYSTEM, no COMPANY ni CUSTOMER: no lo decidio nadie. Ponerlo a
           * nombre de la empresa haria creer que alguien la cancelo, y a
           * nombre del cliente, que se arrepintio.
           */
          cancelledBy: 'SYSTEM',
          cancellationReason: 'No se completo el pago dentro del plazo',
        },
      });

      if (count === 0) return;

      await this.audit.record(
        {
          /*
           * Sin ficha de personal y sin `actorType`: el servicio de
           * auditoria deduce SYSTEM de que no hay personal, que es
           * exactamente lo que es. Solo se declara el tipo para un CLIENTE.
           */
          staff: null,
          surface: 'SYSTEM',
          action: 'booking.status.cancelled',
          entityType: 'booking',
          entityId: reserva.id,
          metadata: {
            from: 'PENDING_PAYMENT',
            to: 'CANCELLED',
            reason: 'hold_expired',
            releasedHolds: reserva.payments.length,
          },
          ipAddress: null,
        },
        tx,
      );

      // La referencia y nada mas: ni el cliente ni la direccion.
      this.logger.log(`Reserva ${reserva.reference} cerrada: no se completo el pago.`);
    });
  }
}
