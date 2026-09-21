import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { Prisma } from '../generated/prisma/client';
import { PaymentsService } from './payments.service';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
  type ProviderWebhookEvent,
} from './payments.types';

export type WebhookOutcome = 'processed' | 'duplicate' | 'ignored';

/** Cambio de estado que de verdad ocurrio, para avisar despues de consolidar. */
interface BookingTransition {
  bookingId: string;
  to: 'CONFIRMED' | 'CANCELLED';
}

/**
 * PROCESAMIENTO DE EVENTOS DEL PROVEEDOR DE PAGO
 * ----------------------------------------------
 * El proveedor avisa por su cuenta de que un deposito quedo autorizado, se
 * capturo o fallo. Es la unica fuente fiable: el navegador podria cerrarse
 * justo despues de confirmar la tarjeta, o mentir.
 *
 * IDEMPOTENCIA. El proveedor reenvia el mismo evento si no recibe un 2xx a
 * tiempo. Un evento se considera procesado solo cuando tiene `processedAt`:
 *
 *   - Si ya lo tiene, se responde 200 sin volver a hacer nada.
 *   - Si el procesamiento falla, la transaccion se deshace entera y el evento
 *     queda sin marcar, con el motivo del fallo anotado, para que el siguiente
 *     reintento lo vuelva a intentar de verdad.
 *
 * El bloqueo por evento serializa dos entregas simultaneas del mismo aviso,
 * que es justo lo que ocurre cuando el proveedor reintenta antes de tiempo.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly payments: PaymentsService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Verifica la firma. Lanza WebhookSignatureError si no es autentica. */
  parse(rawBody: Buffer, signature: string | undefined): ProviderWebhookEvent {
    return this.provider.parseWebhook(rawBody, signature);
  }

  async handle(event: ProviderWebhookEvent): Promise<WebhookOutcome> {
    try {
      const procesado = await this.prisma.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`webhook:${event.id}`}))`;

        const previo = await tx.webhookEvent.findUnique({
          where: { id: event.id },
          select: { processedAt: true },
        });

        if (previo?.processedAt) {
          this.logger.log(`Evento ${event.id} ya procesado: se ignora el reenvio`);
          return { outcome: 'duplicate', transicion: null } as const;
        }

        await tx.webhookEvent.upsert({
          where: { id: event.id },
          create: {
            id: event.id,
            provider: this.provider.name,
            type: event.type,
            payload: event.payload as object,
          },
          // Reintento de un evento que fallo antes: se limpia el motivo.
          update: { failureReason: null },
        });

        const resultado = event.payment
          ? await this.payments.applyProviderState(tx, event.payment)
          : null;

        const transicion = resultado
          ? await this.syncBooking(tx, resultado.bookingId, resultado.status)
          : null;

        await tx.webhookEvent.update({
          where: { id: event.id },
          data: { processedAt: new Date() },
        });

        return { outcome: resultado ? 'processed' : 'ignored', transicion } as const;
      });

      /*
       * LOS AVISOS SALEN AQUI, YA FUERA DE LA TRANSACCION, y no es un detalle
       * de estilo. Dentro, un proveedor de correo caido desharia la
       * confirmacion de una reserva cuyo deposito YA esta retenido en la
       * tarjeta del cliente: se quedaria con el dinero bloqueado y sin cita.
       *
       * El servicio de avisos no lanza nunca, asi que este `await` no puede
       * afectar a la respuesta del webhook. Se espera igualmente para que el
       * envio no quede colgando cuando el proceso termine.
       */
      if (procesado.transicion?.to === 'CONFIRMED') {
        await this.notifications.bookingConfirmed(procesado.transicion.bookingId);
      } else if (procesado.transicion?.to === 'CANCELLED') {
        await this.notifications.bookingCancelled(procesado.transicion.bookingId);
      }

      return procesado.outcome;
    } catch (error) {
      // La transaccion se deshizo, asi que el evento no quedo registrado. Se
      // anota fuera de ella para dejar rastro sin impedir el reintento.
      const motivo = error instanceof Error ? error.message : 'error desconocido';
      await this.recordFailure(event, motivo);
      throw error;
    }
  }

  /**
   * Lleva el estado de la reserva al que corresponde segun el deposito.
   *
   * Solo se avanza desde PENDING_PAYMENT: una reserva que ya empezo, se
   * completo o se cancelo a mano no debe cambiar porque llegue un aviso
   * antiguo del proveedor (los eventos pueden llegar desordenados).
   */
  private async syncBooking(
    tx: Prisma.TransactionClient,
    bookingId: string,
    paymentStatus: string,
  ): Promise<BookingTransition | null> {
    if (paymentStatus === 'REQUIRES_CAPTURE' || paymentStatus === 'SUCCEEDED') {
      const { count } = await tx.booking.updateMany({
        where: { id: bookingId, status: 'PENDING_PAYMENT' },
        data: { status: 'CONFIRMED' },
      });
      if (count > 0) {
        this.logger.log(`Reserva ${bookingId} confirmada: deposito retenido`);
        return { bookingId, to: 'CONFIRMED' };
      }
      return null;
    }

    if (paymentStatus === 'CANCELED' || paymentStatus === 'FAILED') {
      // Sin deposito no hay cita: se libera la franja para otro cliente.
      const { count } = await tx.booking.updateMany({
        where: { id: bookingId, status: 'PENDING_PAYMENT' },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledBy: 'SYSTEM',
          cancellationReason: 'El deposito no se pudo retener',
        },
      });
      if (count > 0) {
        this.logger.warn(`Reserva ${bookingId} cancelada: el deposito no se retuvo`);
        return { bookingId, to: 'CANCELLED' };
      }
    }

    return null;
  }

  private async recordFailure(event: ProviderWebhookEvent, motivo: string): Promise<void> {
    try {
      await this.prisma.db.webhookEvent.upsert({
        where: { id: event.id },
        create: {
          id: event.id,
          provider: this.provider.name,
          type: event.type,
          payload: event.payload as object,
          failureReason: motivo,
        },
        update: { failureReason: motivo },
      });
    } catch {
      // Si ni siquiera se puede anotar el fallo, la base de datos esta caida.
      // El error original ya se propaga y el proveedor reintentara.
      this.logger.error(`No se pudo registrar el fallo del evento ${event.id}`);
    }
  }
}
