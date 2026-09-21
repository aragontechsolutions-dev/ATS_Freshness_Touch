import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  API_ERROR_CODES,
  canTransition,
  type AdminCaptureDeposit,
  type AdminReleaseDeposit,
  type AdminStatusChange,
  type AuthenticatedStaff,
  type BookingStatus,
} from '@freshness/types';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../database/prisma.service';
import { PaymentsService } from '../payments/payments.service';

/** Marcas de tiempo que acompañan a cada estado. */
const TIMESTAMPS: Partial<Record<BookingStatus, 'startedAt' | 'completedAt' | 'cancelledAt'>> = {
  IN_PROGRESS: 'startedAt',
  COMPLETED: 'completedAt',
  CANCELLED: 'cancelledAt',
};

@Injectable()
export class BookingActionsService {
  private readonly logger = new Logger(BookingActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Cambia el estado de una reserva.
   *
   * El cambio Y su registro de auditoría van en la MISMA transacción: o quedan
   * los dos o no queda ninguno. Un cambio de estado sin rastro de quién lo
   * hizo es justo lo que no sirve cuando hay una reclamación.
   */
  async changeStatus(
    bookingId: string,
    change: AdminStatusChange,
    staff: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<void> {
    await this.prisma.db.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        select: { id: true, status: true, reference: true },
      });

      if (!booking) throw this.notFound();

      if (!canTransition(booking.status, change.status)) {
        /*
         * 409 y no 400: la petición está bien formada, lo que pasa es que
         * choca con el estado actual. Normalmente significa que otra persona
         * ya lo cambió desde otra pantalla.
         */
        throw new ConflictException({
          code: API_ERROR_CODES.INVALID_TRANSITION,
          messageKey: 'admin.errorInvalidTransition',
        });
      }

      const marca = TIMESTAMPS[change.status];

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: change.status,
          ...(marca ? { [marca]: new Date() } : {}),
          ...(change.status === 'CANCELLED'
            ? { cancelledBy: 'COMPANY', cancellationReason: change.reason ?? null }
            : {}),
        },
      });

      await this.audit.record(
        {
          staff,
          action: `booking.status.${change.status.toLowerCase()}`,
          entityType: 'booking',
          entityId: bookingId,
          metadata: { from: booking.status, to: change.status, reason: change.reason ?? null },
          ipAddress,
        },
        tx,
      );

      this.logger.log(
        `Reserva ${booking.reference}: ${booking.status} -> ${change.status} por ${staff.email}`,
      );
    });

    /*
     * El aviso sale DESPUES de consolidar la transaccion, igual que en el
     * webhook del proveedor de pago. Dentro, un fallo del proveedor de correo
     * desharia un cambio de estado que el equipo ya dio por hecho.
     *
     * Solo se avisa de la cancelacion: es la unica transicion que el cliente
     * necesita saber por escrito. Que el equipo haya llegado a la casa o
     * marcado el trabajo como terminado es informacion interna, y un correo
     * por cada paso convertiria las confirmaciones en ruido que se archiva
     * sin leer.
     */
    if (change.status === 'CANCELLED') {
      await this.notifications.bookingCancelled(bookingId);
    }
  }

  /** Cobra el depósito retenido. */
  async captureDeposit(
    bookingId: string,
    request: AdminCaptureDeposit,
    staff: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<void> {
    const pago = await this.findCapturablePayment(bookingId);
    const importe = request.amountCents ?? pago.amountAuthorizedCents;

    if (importe > pago.amountAuthorizedCents) {
      // Una retención no se puede ampliar: si hiciera falta cobrar más, es un
      // cobro aparte, no una captura mayor.
      throw new BadRequestException({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        messageKey: 'admin.errorCaptureTooLarge',
      });
    }

    const resultado = await this.payments.capture(pago.providerPaymentIntentId, importe);

    await this.prisma.db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: pago.id },
        data: {
          status: resultado.status,
          amountCapturedCents: resultado.amountCapturedCents,
          capturedAt: new Date(),
        },
      });

      await this.audit.record(
        {
          staff,
          action: 'payment.captured',
          entityType: 'booking',
          entityId: bookingId,
          // El importe sí; el identificador del movimiento en el proveedor no.
          metadata: { amountCents: importe, reason: request.reason },
          ipAddress,
        },
        tx,
      );
    });
  }

  /** Libera la retención sin cobrar nada. */
  async releaseDeposit(
    bookingId: string,
    request: AdminReleaseDeposit,
    staff: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<void> {
    const pago = await this.findCapturablePayment(bookingId);

    const resultado = await this.payments.release(
      pago.providerPaymentIntentId,
      'requested_by_customer',
    );

    await this.prisma.db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: pago.id },
        data: { status: resultado.status, canceledAt: new Date() },
      });

      await this.audit.record(
        {
          staff,
          action: 'payment.released',
          entityType: 'booking',
          entityId: bookingId,
          metadata: { reason: request.reason },
          ipAddress,
        },
        tx,
      );
    });
  }

  /**
   * Busca la retención sobre la que se puede actuar.
   *
   * Solo vale una que esté AUTORIZADA Y SIN COBRAR: una ya cobrada no se puede
   * cobrar dos veces, y una liberada ya no existe en el proveedor.
   */
  private async findCapturablePayment(bookingId: string): Promise<{
    id: string;
    providerPaymentIntentId: string;
    amountAuthorizedCents: number;
  }> {
    const pago = await this.prisma.db.payment.findFirst({
      where: { bookingId, kind: 'DEPOSIT_HOLD' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        providerPaymentIntentId: true,
        amountAuthorizedCents: true,
        expiresAt: true,
      },
    });

    if (!pago) throw this.notFound();

    if (pago.status !== 'REQUIRES_CAPTURE') {
      throw new ConflictException({
        code: API_ERROR_CODES.PAYMENT_NOT_CAPTURABLE,
        messageKey: 'admin.errorPaymentNotCapturable',
      });
    }

    /*
     * Una retención caduca a los 7 días. Pasada esa fecha el proveedor la
     * rechazaría igualmente, pero avisar aquí da un mensaje claro en vez de un
     * error del proveedor que nadie entiende.
     */
    if (pago.expiresAt && pago.expiresAt.getTime() < Date.now()) {
      throw new ConflictException({
        code: API_ERROR_CODES.PAYMENT_NOT_CAPTURABLE,
        messageKey: 'admin.errorHoldExpired',
      });
    }

    return {
      id: pago.id,
      providerPaymentIntentId: pago.providerPaymentIntentId,
      amountAuthorizedCents: pago.amountAuthorizedCents,
    };
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: API_ERROR_CODES.NOT_FOUND,
      messageKey: 'admin.errorBookingNotFound',
    });
  }
}
