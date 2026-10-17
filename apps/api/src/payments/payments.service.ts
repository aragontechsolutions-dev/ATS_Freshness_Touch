import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PaymentIntent } from '@freshness/types';
import { PrismaService } from '../database/prisma.service';
import type { Prisma, PrismaClient } from '../generated/prisma/client';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
  type ProviderPayment,
  type ProviderRefund,
  type ProviderRefundEvent,
} from './payments.types';

/** Cliente de base de datos, sea el normal o el de dentro de una transaccion. */
type Db = PrismaClient | Prisma.TransactionClient;

export interface DepositHoldInput {
  bookingId: string;
  bookingReference: string;
  amountCents: number;
  customerEmail: string;
  customerName: string;
}

/**
 * RETENCION DEL DEPOSITO
 * ----------------------
 * Traduce entre el proveedor de pago y nuestra tabla `payments`, que es el
 * registro con el que trabaja el resto del sistema (y el panel de
 * administracion cuando exista).
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly prisma: PrismaService,
  ) {}

  get providerName(): PaymentProvider['name'] {
    return this.provider.name;
  }

  get webhookSignatureHeader(): string {
    return this.provider.webhookSignatureHeader;
  }

  /**
   * Crea la retencion del deposito y la guarda.
   *
   * Se llama DESPUES de que la reserva este confirmada en la base de datos, y
   * nunca dentro de la transaccion que la crea: una llamada de red dentro de
   * una transaccion mantendria abierto el bloqueo del dia de la agenda
   * mientras se espera a un servidor ajeno, y bloquearia al resto de clientes.
   *
   * La contrapartida es que la retencion puede fallar con la reserva ya
   * creada. Es el orden correcto de todas formas: perder una reserva ya
   * aceptada es peor que tener que reclamar el pago despues.
   */
  async createDepositHold(input: DepositHoldInput): Promise<PaymentIntent> {
    const resultado = await this.provider.createDepositHold({
      bookingId: input.bookingId,
      bookingReference: input.bookingReference,
      amountCents: input.amountCents,
      customer: { email: input.customerEmail, name: input.customerName },
      /*
       * La clave de idempotencia se deriva de la reserva y del importe, no de
       * un valor aleatorio: si la peticion se reintenta tras un fallo de red,
       * el proveedor reconoce que es la misma y devuelve la retencion que ya
       * creo en vez de bloquear los fondos dos veces.
       */
      idempotencyKey: idempotencyKey(input.bookingId, input.amountCents),
    });

    const payment = await this.prisma.db.payment.create({
      data: {
        bookingId: input.bookingId,
        kind: 'DEPOSIT_HOLD',
        status: resultado.status,
        provider: this.provider.name,
        providerPaymentIntentId: resultado.providerPaymentIntentId,
        providerCustomerId: resultado.providerCustomerId,
        cardBrand: resultado.cardBrand,
        cardLast4: resultado.cardLast4,
        amountAuthorizedCents: resultado.amountAuthorizedCents,
        amountCapturedCents: resultado.amountCapturedCents,
        expiresAt: resultado.expiresAt,
      },
    });

    // Se registra la referencia y el importe, nunca el identificador de pago
    // ni el client_secret: ambos son credenciales.
    this.logger.log(
      `Deposito de ${input.amountCents} centavos retenido para ${input.bookingReference} ` +
        `(proveedor: ${this.provider.name})`,
    );

    return {
      paymentId: payment.id,
      provider: this.provider.name,
      status: resultado.status,
      amountCents: resultado.amountAuthorizedCents,
      currency: 'USD',
      clientSecret: resultado.clientSecret,
      expiresAt: resultado.expiresAt?.toISOString() ?? null,
    };
  }

  /**
   * Cobra el deposito retenido, entero o en parte.
   *
   * Se llama cuando el cliente cancela con el equipo ya en camino o no esta en
   * casa. NO se hace dentro de una transaccion de base de datos: es una
   * llamada de red a un servidor ajeno, y mantener una transaccion abierta
   * mientras se espera bloquearia filas durante segundos.
   */
  async capture(providerPaymentIntentId: string, amountCents: number): Promise<ProviderPayment> {
    const resultado = await this.provider.capture(providerPaymentIntentId, amountCents);

    // Se registra el importe, nunca el identificador del movimiento: es una
    // credencial, no informacion.
    this.logger.log(`Deposito cobrado: ${amountCents} centavos (${this.provider.name})`);
    return resultado;
  }

  /**
   * COBRA EL SALDO FINAL con la tarjeta guardada (etapa 3.23).
   *
   * La clave de idempotencia sale de la reserva y del importe: si la
   * peticion se reintenta tras un fallo de red —y aqui se reintenta pulsando
   * el boton otra vez, porque la pantalla no sabe si llego— el proveedor
   * devuelve el mismo cobro en vez de hacer uno segundo. Cobrarle dos veces
   * 150 dolares a una persona es el peor fallo que puede tener este sistema.
   */
  async chargeBalance(input: {
    bookingId: string;
    bookingReference: string;
    amountCents: number;
    providerCustomerId: string;
    providerPaymentMethodId: string;
  }): Promise<ProviderPayment> {
    const resultado = await this.provider.chargeBalance({
      ...input,
      idempotencyKey: createHash('sha256')
        .update(`balance:${input.bookingId}:${input.amountCents}`)
        .digest('hex'),
    });

    this.logger.log(
      `Saldo cobrado: ${input.amountCents} centavos de ${input.bookingReference} ` +
        `(proveedor: ${this.provider.name}, estado: ${resultado.status})`,
    );

    return resultado;
  }

  /**
   * DEVUELVE DINERO YA COBRADO, entero o en parte.
   *
   * LA CLAVE DE IDEMPOTENCIA ES LA PIEZA DELICADA, y por eso se construye
   * aqui y no en el proveedor. Tiene que cumplir dos cosas que tiran en
   * direcciones opuestas:
   *
   *   - UN REINTENTO NO PUEDE DEVOLVER DOS VECES. Si la peticion llego al
   *     proveedor y la respuesta se perdio por un fallo de red, el segundo
   *     intento tiene que recibir la MISMA devolucion, no crear otra.
   *   - DOS DEVOLUCIONES PARCIALES DISTINTAS SI SON DOS. Devolver 10 dolares
   *     hoy y otros 10 manana son dos operaciones legitimas del mismo cobro,
   *     y con una clave que solo mirase (pago, importe) la segunda se
   *     convertiria en silencio en la primera: el cliente recibiria 10 y
   *     nuestra tabla diria 20.
   *
   * Lo que las distingue es CUANTO SE HABIA DEVUELTO YA. El reintento de una
   * misma operacion ve el mismo valor —su propia escritura aun no ha
   * ocurrido—, y la segunda devolucion ve el acumulado de la primera. Por eso
   * entra en la clave.
   */
  async refund(input: {
    providerPaymentIntentId: string;
    bookingReference: string;
    amountCents: number;
    alreadyRefundedCents: number;
  }): Promise<ProviderRefund> {
    const resultado = await this.provider.refund({
      providerPaymentIntentId: input.providerPaymentIntentId,
      bookingReference: input.bookingReference,
      amountCents: input.amountCents,
      idempotencyKey: refundKey(
        input.providerPaymentIntentId,
        input.amountCents,
        input.alreadyRefundedCents,
      ),
    });

    // El importe y la referencia si; el identificador del movimiento no.
    this.logger.log(
      `Devueltos ${input.amountCents} centavos de ${input.bookingReference} ` +
        `(proveedor: ${this.provider.name}, estado: ${resultado.status})`,
    );

    return resultado;
  }

  /** Libera la retencion sin cobrar nada: el caso normal al terminar bien. */
  async release(providerPaymentIntentId: string, reason: string): Promise<ProviderPayment> {
    const resultado = await this.provider.cancel(providerPaymentIntentId, reason);
    this.logger.log(`Retencion liberada (${this.provider.name})`);
    return resultado;
  }

  /**
   * UNA DEVOLUCION QUE EL PROVEEDOR ACABA RECHAZANDO (etapa 3.22)
   * ============================================================
   * Una devolucion aceptada puede caer DIAS DESPUES: tarjeta caducada,
   * cuenta cerrada, el banco que la rechaza. Cuando pasa, el dinero se queda
   * en la cuenta de la empresa y el cliente sigue esperandolo.
   *
   * SE DESHACE EL CONTADOR, y no es un detalle contable: `amountRefundedCents`
   * significa «dinero que de verdad salio». Dejarlo como estaba haria que el
   * panel dijera «devuelto 20 $» de un dinero que no se devolvio, y ademas
   * impediria volver a intentarlo, porque de ahi sale lo que queda por
   * devolver.
   *
   * SE HACE EN UNA SOLA SENTENCIA, con `GREATEST` para no bajar de cero. Leer
   * el valor y escribir la resta serian dos pasos, y dos avisos del proveedor
   * a la vez —que es justo cuando esto ocurre— podrian leer los dos el mismo
   * numero y restar solo una vez.
   *
   * Devuelve lo que hace falta para avisar DESPUES de consolidar, o `null` si
   * el movimiento no es nuestro o si la devolucion no fallo (un aviso de una
   * que fue bien no cambia nada: ya estaba apuntada).
   */
  async applyRefundState(
    db: Db,
    estado: ProviderRefundEvent,
  ): Promise<{ bookingId: string; reference: string; amountCents: number } | null> {
    const existente = await db.payment.findUnique({
      where: {
        provider_providerPaymentIntentId: {
          provider: this.provider.name,
          providerPaymentIntentId: estado.providerPaymentIntentId,
        },
      },
      select: { id: true, bookingId: true, booking: { select: { reference: true } } },
    });

    if (!existente) return null;
    if (estado.status !== 'FAILED') return null;

    await db.$executeRaw`
      UPDATE payments
      SET "amountRefundedCents" = GREATEST(0, "amountRefundedCents" - ${estado.amountCents}),
          "lastErrorCode" = 'refund_failed',
          "lastErrorMessage" = ${estado.failureReason ?? 'El proveedor rechazo la devolucion'},
          "updatedAt" = now()
      WHERE id = ${existente.id}::uuid
    `;

    /*
     * El importe y la referencia si; el identificador de la devolucion no,
     * igual que en el resto del modulo: es una credencial, no informacion.
     */
    this.logger.error(
      `Devolucion rechazada por el proveedor en ${existente.booking.reference}: ` +
        `${estado.amountCents} centavos siguen en la cuenta de la empresa`,
    );

    return {
      bookingId: existente.bookingId,
      reference: existente.booking.reference,
      amountCents: estado.amountCents,
    };
  }

  /**
   * Actualiza la fila de pago con lo que dice el proveedor y devuelve la
   * reserva afectada. Devuelve null si el movimiento no es nuestro: un evento
   * de una cuenta de pruebas, o de otro sistema que comparte la cuenta.
   */
  async applyProviderState(
    db: Db,
    estado: ProviderPayment,
  ): Promise<{ bookingId: string; status: string } | null> {
    const existente = await db.payment.findUnique({
      where: {
        provider_providerPaymentIntentId: {
          provider: this.provider.name,
          providerPaymentIntentId: estado.providerPaymentIntentId,
        },
      },
      select: { id: true, bookingId: true },
    });

    if (!existente) return null;

    await db.payment.update({
      where: { id: existente.id },
      data: {
        status: estado.status,
        // Solo se sobrescriben los datos de tarjeta cuando el evento los trae:
        // un evento posterior sin ellos no debe borrar los que ya teniamos.
        ...(estado.cardBrand ? { cardBrand: estado.cardBrand } : {}),
        ...(estado.cardLast4 ? { cardLast4: estado.cardLast4 } : {}),
        /*
         * LA TARJETA GUARDADA Y SU TITULAR (etapa 3.23). Llegan al confirmar,
         * no al crear la retencion, y son lo que permite cobrar el saldo al
         * terminar sin volver a pedirle la tarjeta al cliente. Mismo criterio
         * que arriba: un evento posterior que no los traiga no los borra.
         */
        ...(estado.providerCustomerId ? { providerCustomerId: estado.providerCustomerId } : {}),
        ...(estado.providerPaymentMethodId
          ? { providerPaymentMethodId: estado.providerPaymentMethodId }
          : {}),
        ...(estado.amountCapturedCents > 0
          ? { amountCapturedCents: estado.amountCapturedCents }
          : {}),
        ...(estado.status === 'REQUIRES_CAPTURE' ? { authorizedAt: new Date() } : {}),
        ...(estado.status === 'SUCCEEDED' ? { capturedAt: new Date() } : {}),
        ...(estado.status === 'CANCELED' ? { canceledAt: new Date() } : {}),
        lastErrorCode: estado.lastError?.code ?? null,
        lastErrorMessage: estado.lastError?.message ?? null,
      },
    });

    return { bookingId: existente.bookingId, status: estado.status };
  }
}

/**
 * Clave de idempotencia estable: mismo par (reserva, importe) = misma clave.
 *
 * Se aplica un resumen para no enviar identificadores internos al proveedor
 * en texto claro, y porque el limite de longitud de la clave es de 255
 * caracteres.
 */
function idempotencyKey(bookingId: string, amountCents: number): string {
  return createHash('sha256').update(`deposit:${bookingId}:${amountCents}`).digest('hex');
}

/** La clave de una devolucion concreta. El porque, en `refund`. */
function refundKey(
  providerPaymentIntentId: string,
  amountCents: number,
  alreadyRefundedCents: number,
): string {
  return createHash('sha256')
    .update(`refund:${providerPaymentIntentId}:${amountCents}:${alreadyRefundedCents}`)
    .digest('hex');
}
