import type { PaymentProviderName, PaymentStatus } from '@freshness/types';

/**
 * CONTRATO DE CUALQUIER PROVEEDOR DE PAGO
 * ---------------------------------------
 * Mismo patron que la distancia: el resto del sistema no sabe si el dinero lo
 * mueve Stripe o un simulador local. Cambiar de proveedor es cambiar una
 * variable de entorno, no reescribir la logica de reservas.
 *
 * Todo el modulo trabaja con AUTORIZACIONES, no con cobros. El deposito de
 * traslado se retiene en la tarjeta y se captura (o se libera) mas tarde:
 * por eso las operaciones son crear / capturar / cancelar y no "cobrar".
 */

/** Peticion para retener el deposito de una reserva. */
export interface DepositHoldRequest {
  bookingId: string;
  /** Referencia legible (FT-2026-0001). Aparece en el extracto del cliente. */
  bookingReference: string;
  amountCents: number;
  customer: {
    email: string;
    name: string;
  };
  /**
   * Clave de idempotencia. Si la misma peticion se reintenta (un fallo de red
   * al que no sabemos si llego), el proveedor devuelve la retencion que ya
   * creo en vez de crear una segunda. Sin esto, un reintento duplicaria el
   * bloqueo de fondos en la tarjeta del cliente.
   */
  idempotencyKey: string;
}

/**
 * Peticion para devolver dinero ya cobrado.
 *
 * NO LLEVA EL MOTIVO QUE ESCRIBIO ADMINISTRACION, y es deliberado: ese texto
 * es libre y puede nombrar al cliente o contar lo que paso en su casa. Se
 * queda en nuestra auditoria. Al proveedor se le manda su motivo enlatado,
 * que es lo unico que entiende.
 */
export interface RefundRequest {
  providerPaymentIntentId: string;
  amountCents: number;
  /** Referencia legible de la reserva, para reconciliar desde el proveedor. */
  bookingReference: string;
  /**
   * Clave de idempotencia. Protege del reintento de una MISMA devolucion
   * —un fallo de red del que no se sabe si llego— sin impedir dos
   * devoluciones parciales distintas del mismo cobro: ver como se construye
   * en `PaymentsService.refund`.
   */
  idempotencyKey: string;
}

/**
 * Una devolucion, tal y como la deja el proveedor.
 *
 * `PENDING` no es un fallo: con algunas tarjetas el abono tarda dias en
 * aparecer en el extracto, pero el proveedor YA SE HA COMPROMETIDO a el. Por
 * eso cuenta igual que `SUCCEEDED` para nuestro registro, y solo `FAILED`
 * deja las cosas como estaban.
 */
export interface ProviderRefund {
  providerRefundId: string;
  amountCents: number;
  status: 'SUCCEEDED' | 'PENDING' | 'FAILED';
}

/** Estado de un movimiento tal y como lo devuelve el proveedor. */
export interface ProviderPayment {
  providerPaymentIntentId: string;
  status: PaymentStatus;
  /**
   * Credencial de un solo uso para que el navegador confirme la tarjeta.
   * Solo viene al crear; en capturas y cancelaciones es null.
   */
  clientSecret: string | null;
  amountAuthorizedCents: number;
  amountCapturedCents: number;
  providerCustomerId: string | null;
  /** Marca y ultimos cuatro digitos, solo para mostrarlos. */
  cardBrand: string | null;
  cardLast4: string | null;
  /** Cuando caduca la autorizacion. Pasada esa fecha ya no se puede capturar. */
  expiresAt: Date | null;
  lastError: { code: string | null; message: string } | null;
}

/** Evento recibido del proveedor, ya verificado y traducido. */
export interface ProviderWebhookEvent {
  /** Identificador del evento. Es la clave de idempotencia del webhook. */
  id: string;
  type: string;
  /** Movimiento afectado, o null si el evento no habla de un pago nuestro. */
  payment: ProviderPayment | null;
  /** Cuerpo original, que se archiva para poder investigar despues. */
  payload: unknown;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  /** Cabecera HTTP donde viaja la firma del webhook de este proveedor. */
  readonly webhookSignatureHeader: string;

  createDepositHold(request: DepositHoldRequest): Promise<ProviderPayment>;

  /** Cobra (total o parcialmente) una retencion ya autorizada. */
  capture(providerPaymentIntentId: string, amountCents: number): Promise<ProviderPayment>;

  /** Libera una retencion sin cobrar nada. */
  cancel(providerPaymentIntentId: string, reason: string): Promise<ProviderPayment>;

  /**
   * Devuelve dinero YA COBRADO, entero o en parte.
   *
   * Es la operacion inversa de `capture`, no de `cancel`: lo que no se ha
   * cobrado no se devuelve, se libera.
   */
  refund(request: RefundRequest): Promise<ProviderRefund>;

  /**
   * Verifica la firma del webhook y traduce el evento.
   *
   * Recibe el cuerpo CRUDO, no el JSON ya interpretado: la firma se calcula
   * sobre los bytes exactos que envio el proveedor y cualquier reserializacion
   * (orden de claves, espacios, escapes) la invalidaria.
   *
   * Lanza WebhookSignatureError si la firma no cuadra.
   */
  parseWebhook(rawBody: Buffer, signature: string | undefined): ProviderWebhookEvent;
}

/** Token de inyeccion de dependencias del proveedor activo. */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

/**
 * Firma invalida o ausente.
 *
 * Se trata como un intento de suplantacion, no como un error del sistema: sin
 * firma valida cualquiera podria enviarnos "el deposito se autorizo" y
 * confirmar reservas que nadie ha pagado.
 */
export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookSignatureError';
  }
}

/** Fallo al hablar con el proveedor (red, credenciales, tarjeta rechazada). */
export class PaymentProviderError extends Error {
  constructor(
    message: string,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}
