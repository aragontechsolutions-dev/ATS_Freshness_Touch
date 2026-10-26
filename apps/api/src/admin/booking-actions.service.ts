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
  chargeableBalanceCents,
  refundableCents,
  type AdminCaptureDeposit,
  type AdminRefundPayment,
  type AdminReleaseDeposit,
  type AdminStatusChange,
  type AuthenticatedStaff,
  type BookingStatus,
} from '@freshness/types';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../database/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { PaymentProviderError } from '../payments/payments.types';

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
          surface: 'PANEL',
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
          surface: 'PANEL',
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
          surface: 'PANEL',
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
   * COBRA EL SALDO FINAL DE UN TRABAJO TERMINADO (etapa 3.23)
   * =========================================================
   * El movimiento mas grande del sistema: el deposito son 35 dolares de una
   * limpieza de 185, y hasta ahora los otros 150 se cobraban FUERA del
   * sistema, sin quedar escritos en ninguna parte.
   *
   * SOLO CON EL TRABAJO TERMINADO. No es puritanismo: cobrar antes de que el
   * equipo haya acabado convierte cualquier incidencia —una casa que no se
   * pudo limpiar, un ajuste de campo a medias— en una devolucion, y una
   * devolucion es mas cara y mas lenta que no haber cobrado todavia.
   *
   * SIN IMPORTE EN LA PETICION: se cobra lo que la reserva dice que se debe.
   * Si el equipo encontro mas casa de la contratada, eso ya re-tarifico la
   * reserva por el camino de los ajustes de campo, que tiene su propia
   * aprobacion.
   */
  async chargeBalance(
    bookingId: string,
    staff: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<void> {
    const booking = await this.prisma.db.booking.findUnique({
      where: { id: bookingId },
      select: {
        reference: true,
        status: true,
        balanceDueCents: true,
        /* Solo el correo: aqui no hace falta nada mas del cliente. */
        customer: { select: { email: true } },
        payments: {
          where: { kind: { in: ['DEPOSIT_HOLD', 'FINAL_CHARGE'] } },
          orderBy: { createdAt: 'desc' },
          select: {
            kind: true,
            status: true,
            amountAuthorizedCents: true,
            providerCustomerId: true,
            providerPaymentMethodId: true,
          },
        },
      },
    });

    if (!booking) throw this.notFound();

    if (booking.status !== 'COMPLETED') {
      throw new ConflictException({
        code: API_ERROR_CODES.BALANCE_NOT_CHARGEABLE,
        messageKey: 'admin.errorBalanceNotCompleted',
      });
    }

    const cobroPrevio = booking.payments.find((fila) => fila.kind === 'FINAL_CHARGE') ?? null;
    const importe = chargeableBalanceCents(
      booking.balanceDueCents,
      cobroPrevio && { status: cobroPrevio.status, amountCents: cobroPrevio.amountAuthorizedCents },
    );

    if (importe <= 0) {
      throw new ConflictException({
        code: API_ERROR_CODES.BALANCE_NOT_CHARGEABLE,
        messageKey: 'admin.errorBalanceNothingToCharge',
      });
    }

    const deposito = booking.payments.find((fila) => fila.kind === 'DEPOSIT_HOLD') ?? null;

    if (!deposito?.providerCustomerId || !deposito.providerPaymentMethodId) {
      /*
       * Las reservas anteriores a esta etapa no tienen tarjeta guardada, y
       * las que nunca confirmaron la suya tampoco. No es un fallo del
       * sistema: es que a esa persona hay que cobrarle por otra via, y el
       * panel tiene que decirlo con esas palabras.
       */
      throw new ConflictException({
        code: API_ERROR_CODES.NO_CARD_ON_FILE,
        messageKey: 'admin.errorNoCardOnFile',
      });
    }

    const resultado = await this.cobrarEnElProveedor({
      bookingId,
      bookingReference: booking.reference,
      amountCents: importe,
      customerEmail: booking.customer.email,
      providerCustomerId: deposito.providerCustomerId,
      providerPaymentMethodId: deposito.providerPaymentMethodId,
    });

    await this.prisma.db.$transaction(async (tx) => {
      /*
       * UNA FILA NUEVA, al contrario que el cobro del deposito o una
       * devolucion. Esto no es un cambio de estado de la retencion: es otro
       * movimiento, con su propio identificador en el proveedor y su propio
       * estado, y es para lo que existe `FINAL_CHARGE` en el enumerado desde
       * la etapa 2.4.
       */
      await tx.payment.create({
        data: {
          bookingId,
          kind: 'FINAL_CHARGE',
          status: resultado.status,
          provider: this.payments.providerName,
          providerPaymentIntentId: resultado.providerPaymentIntentId,
          providerCustomerId: resultado.providerCustomerId,
          providerPaymentMethodId: resultado.providerPaymentMethodId,
          cardBrand: resultado.cardBrand,
          cardLast4: resultado.cardLast4,
          amountAuthorizedCents: resultado.amountAuthorizedCents,
          amountCapturedCents: resultado.amountCapturedCents,
          capturedAt: resultado.status === 'SUCCEEDED' ? new Date() : null,
        },
      });

      await this.audit.record(
        {
          staff,
          surface: 'PANEL',
          action: 'payment.balance_charged',
          entityType: 'booking',
          entityId: bookingId,
          // El importe si; los identificadores del proveedor no.
          metadata: { amountCents: importe },
          ipAddress,
        },
        tx,
      );
    });

    this.logger.log(
      `Reserva ${booking.reference}: cobrado el saldo de ${importe} centavos por ${staff.email}`,
    );
  }

  /**
   * Habla con el proveedor y traduce sus fallos a algo accionable.
   *
   * UN RECHAZO NO ES UN ERROR DEL SERVIDOR. Que una tarjeta no pase es un
   * desenlace normal del negocio, y devolver un 500 haria que el panel
   * dijera «algo ha fallado» cuando lo que hay que hacer es llamar al
   * cliente. Y `authentication_required` se separa del resto porque la
   * salida es distinta: ahi no sirve pedir otra tarjeta, hay que mandarle un
   * enlace para que pague el mismo.
   *
   * EL MENSAJE DEL PROVEEDOR NO SALE DE AQUI: puede traer detalles de la
   * cuenta. Se queda en el registro del servidor.
   */
  private async cobrarEnElProveedor(peticion: {
    bookingId: string;
    bookingReference: string;
    amountCents: number;
    customerEmail: string;
    providerCustomerId: string;
    providerPaymentMethodId: string;
  }): ReturnType<PaymentsService['chargeBalance']> {
    try {
      return await this.payments.chargeBalance(peticion);
    } catch (error) {
      if (!(error instanceof PaymentProviderError)) throw error;

      this.logger.error(
        `No se pudo cobrar el saldo de ${peticion.bookingReference}: ${error.message}`,
      );

      throw new ConflictException(
        error.code === 'authentication_required'
          ? {
              code: API_ERROR_CODES.CARD_NEEDS_CUSTOMER,
              messageKey: 'admin.errorCardNeedsCustomer',
            }
          : {
              code: API_ERROR_CODES.PAYMENT_UNAVAILABLE,
              messageKey: 'admin.errorChargeDeclined',
            },
      );
    }
  }

  /**
   * DEVUELVE DINERO YA COBRADO, entero o en parte.
   *
   * NO ES LO MISMO QUE LIBERAR, y la diferencia la nota el cliente en su
   * extracto: liberar quita una retención que nunca llegó a cobrarse y no
   * deja rastro; devolver hace aparecer un abono junto a un cargo que sí
   * existió. Por eso cada una mira un estado distinto y son dos botones.
   *
   * EL IMPORTE SE COMPRUEBA CONTRA LO QUE QUEDA, no contra lo cobrado: con
   * dos devoluciones parciales de 20 sobre un cobro de 35, la segunda tiene
   * que fallar aunque 20 sea menor que 35.
   *
   * DOS COBROS DISTINTOS DESDE LA ETAPA 3.24: el depósito y el saldo final.
   * Lo único que cambia entre ellos es sobre qué fila se opera y con qué
   * acción queda auditado; las reglas —lo que queda, el motivo obligatorio,
   * que un rechazo no se apunta— son las mismas para los dos, y por eso es
   * un método y no dos.
   */
  async refundPayment(
    bookingId: string,
    request: AdminRefundPayment,
    staff: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<void> {
    const esSaldo = request.target === 'BALANCE';
    const pago = await this.findRefundablePayment(
      bookingId,
      esSaldo ? 'FINAL_CHARGE' : 'DEPOSIT_HOLD',
    );
    const importe = request.amountCents ?? pago.refundableCents;

    if (importe > pago.refundableCents) {
      throw new BadRequestException({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        messageKey: 'admin.errorRefundTooLarge',
      });
    }

    /*
     * La llamada al proveedor va FUERA de la transacción, igual que el cobro
     * y la liberación: mantener filas bloqueadas mientras se espera a un
     * servidor ajeno para una operación que tarda segundos es lo que
     * convierte un día con incidencias en una base de datos atascada.
     */
    const resultado = await this.payments.refund({
      providerPaymentIntentId: pago.providerPaymentIntentId,
      bookingReference: pago.bookingReference,
      amountCents: importe,
      alreadyRefundedCents: pago.amountRefundedCents,
    });

    /*
     * UNA DEVOLUCIÓN QUE EL PROVEEDOR RECHAZA NO SE APUNTA. Apuntarla dejaría
     * a la empresa creyendo que devolvió un dinero que sigue en su cuenta, y
     * al cliente esperando un abono que no va a llegar. 409 y a mirarlo.
     */
    if (resultado.status === 'FAILED') {
      throw new ConflictException({
        code: API_ERROR_CODES.PAYMENT_NOT_REFUNDABLE,
        messageKey: 'admin.errorRefundFailed',
      });
    }

    await this.prisma.db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: pago.id },
        /*
         * `increment` y no una suma calculada aquí: dos devoluciones a la vez
         * leerían el mismo valor y la segunda pisaría a la primera. La suma
         * la hace la base de datos sobre la fila que acaba de bloquear.
         */
        data: {
          amountRefundedCents: { increment: resultado.amountCents },
          /*
           * SE LIMPIA LA MARCA DE UNA DEVOLUCION RECHAZADA ANTERIOR
           * (etapa 3.22). Sin esto, el aviso rojo del panel se quedaria para
           * siempre y acabaria sin leerse, que es como no tenerlo.
           */
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      });

      await this.audit.record(
        {
          staff,
          surface: 'PANEL',
          action: esSaldo ? 'payment.balance_refunded' : 'payment.refunded',
          entityType: 'booking',
          entityId: bookingId,
          /*
           * El importe y el motivo; NUNCA el identificador del movimiento ni
           * el de la devolución en el proveedor. `pending` se guarda porque
           * explica que el cliente aún no lo vea en su extracto.
           */
          metadata: {
            amountCents: resultado.amountCents,
            reason: request.reason,
            pending: resultado.status === 'PENDING',
          },
          ipAddress,
        },
        tx,
      );
    });

    this.logger.log(
      `Reserva ${pago.bookingReference}: devueltos ${importe} centavos por ${staff.email}`,
    );
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

  /**
   * Busca el cobro del que todavía queda algo por devolver.
   *
   * El cuánto lo decide `refundableCents`, que está en el contrato
   * compartido: el panel apaga el botón con la misma función con la que el
   * servidor rechaza la petición, así que no pueden discrepar.
   */
  private async findRefundablePayment(
    bookingId: string,
    kind: 'DEPOSIT_HOLD' | 'FINAL_CHARGE',
  ): Promise<{
    id: string;
    providerPaymentIntentId: string;
    bookingReference: string;
    amountRefundedCents: number;
    refundableCents: number;
  }> {
    const pago = await this.prisma.db.payment.findFirst({
      where: { bookingId, kind },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        providerPaymentIntentId: true,
        amountCapturedCents: true,
        amountRefundedCents: true,
        booking: { select: { reference: true } },
      },
    });

    if (!pago) throw this.notFound();

    const pendiente = refundableCents(pago);

    if (pendiente <= 0) {
      /*
       * Tres situaciones distintas con la misma respuesta: no se cobró nada
       * —la retención sigue viva, o se liberó—, ya se devolvió entero, o el
       * cobro del saldo no llegó a salir bien. El texto del panel las
       * nombra, porque quien lo lee necesita saber cuál le ha pasado.
       */
      throw new ConflictException({
        code: API_ERROR_CODES.PAYMENT_NOT_REFUNDABLE,
        messageKey: 'admin.errorPaymentNotRefundable',
      });
    }

    return {
      id: pago.id,
      providerPaymentIntentId: pago.providerPaymentIntentId,
      bookingReference: pago.booking.reference,
      amountRefundedCents: pago.amountRefundedCents,
      refundableCents: pendiente,
    };
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: API_ERROR_CODES.NOT_FOUND,
      messageKey: 'admin.errorBookingNotFound',
    });
  }
}
