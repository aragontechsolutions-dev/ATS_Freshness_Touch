import { Logger } from '@nestjs/common';
import {
  describeFailure,
  type DeliveryResult,
  type EmailMessage,
  type EmailProvider,
} from '../notifications.types';

const API_URL = 'https://api.resend.com/emails';

export interface ResendOptions {
  apiKey: string;
  /** Remitente, con nombre: `Freshness Touch <hola@freshnesstouch.com>`. */
  from: string;
  /** A donde responde el cliente si contesta al correo. */
  replyTo: string | null;
  timeoutMs: number;
}

/**
 * PROVEEDOR DE CORREO REAL (Resend)
 * ---------------------------------
 * Se llama a su API con `fetch`, sin libreria. El motivo: la peticion son
 * veinte lineas y una dependencia mas es superficie de ataque, actualizaciones
 * y peso en el despliegue a cambio de ahorrar muy poco.
 *
 * TRES DECISIONES QUE EVITAN PROBLEMAS REALES:
 *
 *   1. HAY TIEMPO LIMITE. Sin el, un proveedor que no responde deja la
 *      peticion colgada indefinidamente. Esto se llama justo despues de
 *      confirmar una reserva: una espera larga ahi es una peticion del webhook
 *      del proveedor de pago que se queda sin contestar y que se reintenta.
 *
 *   2. NUNCA LANZA. Devuelve el fallo como dato. Un correo que no sale no
 *      puede tumbar la confirmacion de una reserva ya pagada.
 *
 *   3. LA CLAVE NO SE ESCRIBE NUNCA. Ni en los registros ni en el motivo del
 *      fallo que se guarda en la base de datos.
 */
export class ResendEmailProvider implements EmailProvider {
  readonly name = 'resend';

  private readonly logger = new Logger('ResendEmailProvider');

  constructor(private readonly options: ResendOptions) {}

  async send(message: EmailMessage): Promise<DeliveryResult> {
    const controller = new AbortController();
    const temporizador = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const respuesta = await fetch(API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.options.from,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(this.options.replyTo === null ? {} : { reply_to: this.options.replyTo }),
        }),
        signal: controller.signal,
      });

      const cuerpo: unknown = await respuesta.json().catch(() => null);

      if (!respuesta.ok) {
        /*
         * El mensaje del proveedor se pasa tal cual porque es util ("domain
         * not verified" ahorra media hora de busqueda), pero recortado: su
         * respuesta puede incluir partes de lo que se envio.
         */
        const detalle = extraerMensaje(cuerpo) ?? `codigo ${respuesta.status}`;
        this.logger.error(`Resend rechazo el envio a ${message.to}: ${detalle}`);
        return { ok: false, providerMessageId: null, failureReason: detalle.slice(0, 200) };
      }

      return { ok: true, providerMessageId: extraerId(cuerpo), failureReason: null };
    } catch (error) {
      const motivo =
        error instanceof Error && error.name === 'AbortError'
          ? `El proveedor de correo no respondio en ${this.options.timeoutMs} ms`
          : describeFailure(error);

      this.logger.error(`No se pudo enviar el correo a ${message.to}: ${motivo}`);
      return { ok: false, providerMessageId: null, failureReason: motivo };
    } finally {
      clearTimeout(temporizador);
    }
  }
}

/** El identificador del envio, si la respuesta tiene la forma esperada. */
function extraerId(cuerpo: unknown): string | null {
  if (typeof cuerpo === 'object' && cuerpo !== null && 'id' in cuerpo) {
    const id = (cuerpo as { id: unknown }).id;
    return typeof id === 'string' ? id.slice(0, 200) : null;
  }
  return null;
}

/** El motivo del rechazo, si viene. */
function extraerMensaje(cuerpo: unknown): string | null {
  if (typeof cuerpo === 'object' && cuerpo !== null && 'message' in cuerpo) {
    const mensaje = (cuerpo as { message: unknown }).message;
    return typeof mensaje === 'string' ? mensaje : null;
  }
  return null;
}
