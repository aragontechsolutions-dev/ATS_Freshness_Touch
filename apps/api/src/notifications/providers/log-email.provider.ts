import { Logger } from '@nestjs/common';
import type { DeliveryResult, EmailMessage, EmailProvider } from '../notifications.types';

/**
 * PROVEEDOR DE CORREO SIMULADO
 * ----------------------------
 * No envia nada: escribe el correo en el registro del servidor y da el envio
 * por bueno.
 *
 * Existe para que todo el sistema de avisos se pueda desarrollar y probar sin
 * cuenta de ningun proveedor y sin mandar correo real a nadie. Es el mismo
 * papel que cumple el simulador de pagos.
 *
 * SE GUARDAN LOS ENVIOS EN MEMORIA para que las pruebas comprueben que se
 * envio lo que se tenia que enviar, a quien tocaba. Sin eso, una prueba solo
 * podria verificar que "no fallo", que no es lo mismo.
 */
export class LogEmailProvider implements EmailProvider {
  readonly name = 'log';

  private readonly logger = new Logger('LogEmailProvider');

  /** Lo enviado en esta ejecucion. Solo lo leen las pruebas. */
  readonly sent: EmailMessage[] = [];

  send(message: EmailMessage): Promise<DeliveryResult> {
    this.sent.push(message);

    /*
     * Se registra el asunto y el destinatario, NUNCA el cuerpo. El cuerpo
     * lleva la direccion del cliente y la hora a la que no habra nadie en
     * casa; los registros del servidor los ve mas gente y se conservan mas
     * tiempo de lo que uno cree.
     */
    this.logger.log(`[simulado] Correo a ${message.to}: "${message.subject}"`);

    return Promise.resolve({
      ok: true,
      providerMessageId: `log-${Date.now()}`,
      failureReason: null,
    });
  }
}
