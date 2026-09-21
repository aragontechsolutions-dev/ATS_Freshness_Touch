import type { DeliveryResult, TelegramProvider } from '../notifications.types';

/**
 * CANAL DE TELEGRAM SIN CONFIGURAR
 * --------------------------------
 * Se usa cuando no hay `TELEGRAM_BOT_TOKEN`. No envia nada y lo dice.
 *
 * Existe para que la falta de token no sea un error de arranque: el aviso por
 * Telegram es interno y opcional, y una empresa puede querer los correos al
 * cliente sin tener bot. Devolver un fallo con motivo —en vez de fingir que
 * se envio, o no registrar nada— hace que el panel muestre exactamente por
 * que no llega el aviso, que es la pregunta que se va a hacer quien lo espere.
 */
export class NoopTelegramProvider implements TelegramProvider {
  readonly name = 'sin-configurar';

  send(): Promise<DeliveryResult> {
    return Promise.resolve({
      ok: false,
      providerMessageId: null,
      failureReason: 'No hay bot de Telegram configurado en el servidor (TELEGRAM_BOT_TOKEN)',
    });
  }
}
