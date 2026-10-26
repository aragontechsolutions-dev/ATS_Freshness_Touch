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
 * Peticion para cobrar el saldo final de un trabajo terminado.
 *
 * SE COBRA SIN EL CLIENTE DELANTE, con la tarjeta que guardo el proveedor al
 * reservar. Eso cambia dos cosas respecto a la retencion:
 *
 *   - El banco puede exigir que el titular verifique el pago. Cuando pasa no
 *     hay a quien preguntar, y el proveedor devuelve un error propio que hay
 *     que distinguir de un rechazo normal: la salida es mandarle un enlace,
 *     no pedirle otra tarjeta.
 *   - El cobro es inmediato, no una retencion: aqui no hay nada que capturar
 *     despues.
 */
export interface BalanceChargeRequest {
  bookingId: string;
  bookingReference: string;
  amountCents: number;
  /**
   * A donde mandar el recibo.
   *
   * ES LA PARTE GRANDE DEL IMPORTE Y SE COBRA SIN EL CLIENTE DELANTE: ve el
   * cargo en su extracto dias despues del servicio, sin haber tecleado nada.
   * Un recibo del deposito de 35 dolares y ninguno de los 150 restantes es
   * justo al reves de lo que hace falta — y un cargo que no se reconoce
   * acaba en disputa.
   */
  customerEmail: string;
  /** La tarjeta guardada y su titular en el proveedor. */
  providerCustomerId: string;
  providerPaymentMethodId: string;
  /** Deriva de la reserva y del importe: un reintento no cobra dos veces. */
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

/**
 * UNA DEVOLUCION DE LA QUE EL PROVEEDOR AVISA POR SU CUENTA (etapa 3.22).
 *
 * Existe porque una devolucion puede CAER DIAS DESPUES de haberse aceptado:
 * la tarjeta caduco, la cuenta se cerro, el banco la rechaza. Cuando eso
 * pasa, el dinero se queda en la cuenta de la empresa y el cliente sigue
 * esperandolo, y nadie se entera si el aviso no se procesa.
 *
 * Es distinto de `ProviderRefund` —lo que devuelve el proveedor al pedirle
 * una devolucion— porque este llega SOLO, sin que nadie lo haya pedido, y
 * tiene que decir a que cobro pertenece.
 */
export interface ProviderRefundEvent {
  /** El cobro al que pertenece. Es por donde se encuentra nuestra fila. */
  providerPaymentIntentId: string;
  providerRefundId: string;
  amountCents: number;
  status: ProviderRefund['status'];
  /**
   * Motivo tecnico del proveedor (`expired_or_canceled_card`,
   * `lost_or_stolen_card`...). Se guarda para soporte: es lo unico que
   * explica por que no se pudo devolver por la misma via.
   */
  failureReason: string | null;
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
  /**
   * La tarjeta guardada, para cobrar el saldo final despues (etapa 3.23).
   *
   * NO es un dato de tarjeta: es una referencia del proveedor, inservible
   * sin su clave secreta. Llega cuando el cliente confirma, no al crear.
   */
  providerPaymentMethodId: string | null;
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
  /**
   * Devolucion afectada, o null si el evento no habla de una.
   *
   * VA APARTE DE `payment` y no dentro de el: son dos objetos distintos del
   * proveedor —`payment_intent` y `refund`— y un evento habla de uno o de
   * otro, nunca de los dos.
   */
  refund: ProviderRefundEvent | null;
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
   * Cobra el saldo final con la tarjeta guardada, sin el cliente delante.
   *
   * Lanza `PaymentProviderError` con `code: 'authentication_required'` cuando
   * el banco exige verificar al titular: es el unico fallo que no se arregla
   * pidiendo otra tarjeta.
   */
  chargeBalance(request: BalanceChargeRequest): Promise<ProviderPayment>;

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
