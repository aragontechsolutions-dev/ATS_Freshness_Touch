import { Logger } from '@nestjs/common';
import {
  describeFailure,
  type DeliveryResult,
  type TelegramProvider,
} from '../notifications.types';

/**
 * AVISO INTERNO POR TELEGRAM
 * --------------------------
 * Manda un mensaje al chat de la empresa cuando entra una reserva confirmada.
 * El bot se crea con BotFather y su token vive en una variable de entorno.
 *
 * POR QUE EL TOKEN NO SE EDITA DESDE EL PANEL. El token ES el bot: quien lo
 * tiene puede leer y escribir todo lo que el bot alcance. Guardarlo en la base
 * de datos lo mete en cada copia de seguridad y lo pone al alcance de
 * cualquiera con acceso a ella. Va donde van la clave de Stripe y la de
 * Google: en el entorno del servidor. Lo que si se edita desde el panel es el
 * chat de destino, que sin el token no sirve para enviar nada.
 *
 * EL TOKEN VIAJA EN LA DIRECCION, no en una cabecera: lo decide la API de
 * Telegram, no nosotros. Por eso aqui NUNCA se registra la direccion completa
 * de la peticion; un registro con la direccion entera seria un registro con la
 * credencial dentro.
 */
export class TelegramBotProvider implements TelegramProvider {
  readonly name = 'telegram';

  private readonly logger = new Logger('TelegramBotProvider');

  constructor(
    private readonly token: string,
    private readonly timeoutMs: number,
    /**
     * Direccion base de la API.
     *
     * Se puede cambiar porque Telegram permite levantar un servidor propio de
     * su API (util para limites mas altos), y porque asi las pruebas de punta
     * a punta pueden apuntar a un servidor local y comprobar que el aviso sale
     * de verdad y con que contenido, en vez de dar por bueno que "no fallo".
     */
    private readonly apiBaseUrl = 'https://api.telegram.org',
  ) {}

  async send(chatId: string, text: string): Promise<DeliveryResult> {
    const controller = new AbortController();
    const temporizador = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const respuesta = await fetch(`${this.apiBaseUrl}/bot${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          /*
           * Se envia como texto plano a proposito. Con formato, un dato del
           * cliente que contenga un guion bajo o un asterisco —un apellido, una
           * direccion— rompe el mensaje entero y Telegram lo rechaza. El aviso
           * tiene que llegar siempre; que llegue bonito es secundario.
           */
          disable_web_page_preview: true,
        }),
        signal: controller.signal,
      });

      const cuerpo: unknown = await respuesta.json().catch(() => null);

      if (!respuesta.ok || !esCorrecto(cuerpo)) {
        const detalle = descripcionTelegram(cuerpo) ?? `codigo ${respuesta.status}`;
        this.logger.error(`Telegram rechazo el aviso: ${detalle}`);
        return { ok: false, providerMessageId: null, failureReason: detalle.slice(0, 200) };
      }

      return { ok: true, providerMessageId: identificador(cuerpo), failureReason: null };
    } catch (error) {
      const motivo =
        error instanceof Error && error.name === 'AbortError'
          ? `Telegram no respondio en ${this.timeoutMs} ms`
          : describeFailure(error);

      this.logger.error(`No se pudo enviar el aviso por Telegram: ${motivo}`);
      return { ok: false, providerMessageId: null, failureReason: motivo };
    } finally {
      clearTimeout(temporizador);
    }
  }
}

/**
 * Telegram responde 200 con `ok: false` cuando rechaza algo.
 *
 * Fiarse solo del codigo HTTP daria por bueno un mensaje que nunca llego: es
 * justo lo que pasa con un chat mal configurado, que es el fallo mas probable.
 */
function esCorrecto(cuerpo: unknown): boolean {
  return typeof cuerpo === 'object' && cuerpo !== null && (cuerpo as { ok?: unknown }).ok === true;
}

function descripcionTelegram(cuerpo: unknown): string | null {
  if (typeof cuerpo === 'object' && cuerpo !== null && 'description' in cuerpo) {
    const descripcion = (cuerpo as { description: unknown }).description;
    return typeof descripcion === 'string' ? descripcion : null;
  }
  return null;
}

function identificador(cuerpo: unknown): string | null {
  if (typeof cuerpo === 'object' && cuerpo !== null && 'result' in cuerpo) {
    const resultado = (cuerpo as { result: unknown }).result;
    if (typeof resultado === 'object' && resultado !== null && 'message_id' in resultado) {
      return String((resultado as { message_id: unknown }).message_id);
    }
  }
  return null;
}
