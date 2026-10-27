import { Inject, Injectable, Logger } from '@nestjs/common';
import { telegramChatForAudience, telegramChatForSystemAlerts } from '@freshness/types';
import { PrismaService } from '../database/prisma.service';
import { StaffNotificationsService } from '../staff-notifications/staff-notifications.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationSettingsService } from '../notifications/notification-settings.service';
import { TELEGRAM_PROVIDER, type TelegramProvider } from '../notifications/notifications.types';
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
  /** La referencia legible, para el aviso que se deja en la bandeja. */
  reference: string;
}

/** Una devolucion que el proveedor acabo rechazando. Ver `avisarDevolucion`. */
interface RefundFailure {
  reference: string;
  amountCents: number;
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
    private readonly ajustes: NotificationSettingsService,
    /** La bandeja del equipo: lo que hay que mirar al entrar al panel. */
    private readonly bandeja: StaffNotificationsService,
    @Inject(TELEGRAM_PROVIDER) private readonly telegram: TelegramProvider,
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

        /*
         * LA DEVOLUCION QUE EL PROVEEDOR ACABA RECHAZANDO (etapa 3.22).
         *
         * Va DENTRO de la misma transaccion y del mismo bloqueo por evento
         * que todo lo demas: es la idempotencia la que impide que un reenvio
         * —y el proveedor reenvia— reste el importe dos veces.
         */
        const devolucion = event.refund
          ? await this.payments.applyRefundState(tx, event.refund)
          : null;

        await tx.webhookEvent.update({
          where: { id: event.id },
          data: { processedAt: new Date() },
        });

        return {
          outcome: resultado || devolucion ? 'processed' : 'ignored',
          transicion,
          devolucion,
        } as const;
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

        /*
         * Y A LA BANDEJA DE COORDINACION: una reserva confirmada es una que
         * hay que asignar. Va FUERA de la transaccion, con el resto de los
         * avisos, porque un fallo al dejarla no puede deshacer una reserva
         * cuyo deposito ya esta retenido en una tarjeta.
         */
        await this.bandeja.emitir({
          kind: 'booking.confirmed',
          entityType: 'booking',
          entityId: procesado.transicion.bookingId,
          params: { reference: procesado.transicion.reference },
        });
      } else if (procesado.transicion?.to === 'CANCELLED') {
        await this.notifications.bookingCancelled(procesado.transicion.bookingId);
      }

      if (procesado.devolucion) {
        await this.avisarDevolucionFallida(procesado.devolucion);

        /*
         * El dinero sigue en la cuenta de la empresa y el cliente lo espera.
         * Es de administracion, que es quien puede volver a intentarlo.
         */
        await this.bandeja.emitir({
          kind: 'payment.refund_failed',
          params: {
            reference: procesado.devolucion.reference,
            amountCents: procesado.devolucion.amountCents,
          },
        });
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
        return { bookingId, to: 'CONFIRMED', reference: await this.referencia(tx, bookingId) };
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
        return { bookingId, to: 'CANCELLED', reference: await this.referencia(tx, bookingId) };
      }
    }

    return null;
  }

  /**
   * La referencia legible de una reserva.
   *
   * SE LEE AQUI Y NO SE ARRASTRA desde arriba porque a este metodo solo le
   * llega el identificador. Es una consulta por clave primaria dentro de una
   * transaccion que ya esta abierta: cuesta lo que cuesta no tenerla.
   */
  private async referencia(tx: Prisma.TransactionClient, bookingId: string): Promise<string> {
    const fila = await tx.booking.findUnique({
      where: { id: bookingId },
      select: { reference: true },
    });
    return fila?.reference ?? '';
  }

  /**
   * AVISA DE QUE UNA DEVOLUCION NO LLEGO A SU DESTINO (etapa 3.22)
   * ==============================================================
   * Es la pieza por la que existe esta etapa. Lo de deshacer el contador deja
   * la base de datos diciendo la verdad; esto hace que alguien SE ENTERE, que
   * es lo unico que arregla la situacion: el dinero sigue en la cuenta de la
   * empresa y el cliente lo esta esperando, y nadie va a entrar en el panel
   * de Stripe un martes por la tarde sin un motivo.
   *
   * A OPERACIONES PRIMERO, Y AL CHAT TECNICO SI NO LO HAY. Al reves que la
   * alarma de estado de la etapa 3.12: aquello es «el sistema esta roto» y lo
   * arregla quien programa; esto es «hay que devolverle 20 dolares a una
   * persona por otra via», y eso lo hace quien lleva el negocio.
   *
   * EL IMPORTE SI VA EN EL MENSAJE. Es un destino interno, y sin la cifra el
   * aviso no sirve para actuar. Lo que NO va, aqui tampoco: ni datos de la
   * tarjeta, ni el identificador del cobro, ni el de la devolucion.
   *
   * NO LANZA NUNCA. Un fallo de Telegram no puede hacer que el webhook
   * responda error: el proveedor reintentaria el evento y volveriamos a
   * restar... salvo que la idempotencia lo impide. Aun asi, el aviso es lo
   * accesorio y el apunte es lo importante.
   */
  private async avisarDevolucionFallida(fallo: RefundFailure): Promise<void> {
    try {
      const ajustes = await this.ajustes.get();
      const chat =
        telegramChatForAudience('INTERNAL', ajustes) ?? telegramChatForSystemAlerts(ajustes);
      if (chat === null) return;

      const dolares = (fallo.amountCents / 100).toFixed(2);
      const resultado = await this.telegram.send(
        chat,
        `⚠️ Devolucion rechazada — ${fallo.reference}\n` +
          `${dolares} USD no han vuelto a la tarjeta del cliente.\n` +
          'Ese dinero sigue en la cuenta de la empresa: hay que devolverlo por otra via ' +
          'y avisar al cliente.',
      );

      if (!resultado.ok) {
        this.logger.error(
          `No se pudo avisar de la devolucion rechazada: ${resultado.failureReason}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `No se pudo avisar de la devolucion rechazada: ${error instanceof Error ? error.message : 'error desconocido'}`,
      );
    }
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
