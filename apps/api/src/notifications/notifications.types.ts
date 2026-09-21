/**
 * CONTRATO DE LOS CANALES DE AVISO
 * --------------------------------
 * Mismo patron que el pago y la distancia: el resto del sistema no sabe si el
 * correo sale por Resend o por un simulador que solo lo escribe en el registro.
 * Cambiar de proveedor es cambiar una variable de entorno.
 *
 * UN ENVIO NUNCA LANZA. Los metodos devuelven como fue, no explotan. Es una
 * decision deliberada: quien llama a esto lo hace justo despues de confirmar
 * una reserva ya pagada, y una excepcion que suba por ahi podria deshacer algo
 * que no tiene nada que ver con un correo. El resultado se registra y se sigue.
 */

/** Lo que devuelve cualquier intento de envio. */
export interface DeliveryResult {
  ok: boolean;
  /** Identificador del proveedor, para buscar el envio en su panel. */
  providerMessageId: string | null;
  /** Motivo del fallo en lenguaje llano. `null` si salio bien. */
  failureReason: string | null;
}

/** Un correo listo para salir. */
export interface EmailMessage {
  to: string;
  subject: string;
  /**
   * Las dos versiones van siempre juntas. El texto plano no es un adorno: hay
   * clientes de correo que no pintan HTML, y un mensaje que llega vacio es
   * peor que uno feo.
   */
  html: string;
  text: string;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<DeliveryResult>;
}

export const TELEGRAM_PROVIDER = Symbol('TELEGRAM_PROVIDER');

export interface TelegramProvider {
  readonly name: string;
  /** `chatId` ya viene validado como numero por el contrato compartido. */
  send(chatId: string, text: string): Promise<DeliveryResult>;
}

/** Fallo que se puede contar al equipo sin filtrar detalles internos. */
export function describeFailure(error: unknown): string {
  if (error instanceof Error) {
    // Se recorta: un volcado entero en la base de datos no ayuda a nadie y
    // puede arrastrar fragmentos de la peticion, credenciales incluidas.
    return error.message.slice(0, 200);
  }
  return 'Error desconocido al enviar';
}
