import { Body, Controller, HttpCode, Ip, Post, UsePipes } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RemovalLinkRequestSchema, type RemovalLinkRequest } from '@freshness/types';
import { ConsentReceiptService } from '../notifications/consent-receipt.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RECOVERY_RATE_LIMIT } from '../common/throttling';
import { MediaConsentsService } from './media-consents.service';

/**
 * LA RETIRADA QUE HACE EL PROPIO CLIENTE
 * ======================================
 * La unica puerta publica de todo el registro de permisos, y hace una sola
 * cosa: despublicar las fotos de una ficha a quien traiga su testigo.
 *
 * ========================================================================
 * ES UN POST, Y ESA ES LA DECISION QUE HACE QUE ESTO FUNCIONE
 * ========================================================================
 * Lo natural habria sido un enlace que retira al abrirse. Habria sido un
 * desastre silencioso: Outlook Safe Links, los antivirus de correo y los
 * previsualizadores de WhatsApp o Slack ABREN AUTOMATICAMENTE los enlaces de
 * un correo para comprobar si son peligrosos.
 *
 * Con un GET, el filtro de spam del cliente le despublicaria las fotos sin
 * que el cliente hiciera nada, y nadie entenderia por que. Los escaneres
 * abren paginas; no pulsan botones ni mandan formularios. Por eso el enlace
 * lleva a una pagina y la pagina manda esto.
 *
 * ========================================================================
 * NO DEVUELVE NADA DE NADIE
 * ========================================================================
 * Ni el nombre, ni la direccion, ni de que casa era, ni cuantas fotos se
 * retiraron. Quien llegue con un testigo filtrado no puede sacar de aqui
 * ningun dato del cliente: solo puede despublicar — que es reversible desde
 * el panel.
 *
 * ========================================================================
 * UN TESTIGO FALSO Y UNO GASTADO RESPONDEN IGUAL
 * ========================================================================
 * Los dos dan 200 con `{ done: false }`. Distinguirlos convertiria esta ruta
 * en una forma de averiguar que enlaces existieron, y devolver un 404
 * convertiria los registros del servidor en un contador de intentos
 * acertados. La pagina ensena el mismo texto en los dos casos.
 */
@Controller('media-removal')
export class MediaRemovalController {
  constructor(
    private readonly consentimientos: MediaConsentsService,
    private readonly constancia: ConsentReceiptService,
  ) {}

  /**
   * MISMO LIMITE QUE LA RECUPERACION DE CONTRASENA: cinco por cuarto de hora
   * y por IP.
   *
   * No es por carga —esto se usa tres veces al ano— sino porque un testigo
   * es un secreto de 32 bytes y la unica forma de atacarlo es probar muchos.
   * Cinco intentos cada quince minutos convierten esa idea en varios miles de
   * millones de anos, y no estorban a nadie: un cliente pulsa una vez.
   */
  @Post()
  @HttpCode(200)
  @Throttle({ global: RECOVERY_RATE_LIMIT, quotes: RECOVERY_RATE_LIMIT })
  @UsePipes(new ZodValidationPipe<RemovalLinkRequest>(RemovalLinkRequestSchema))
  async retirar(@Body() cuerpo: RemovalLinkRequest, @Ip() ip: string): Promise<{ done: boolean }> {
    const resultado = await this.consentimientos.retirarConTestigo(cuerpo.token, ip || null);

    /*
     * LA EMPRESA TIENE QUE ENTERARSE. Es la unica pega real de dejar que el
     * cliente retire por su cuenta: la portada deja de ensenar algo y nadie
     * lo sabe hasta que mira. Si fue un error, hay que poder llamarle.
     *
     * Se espera a que salga el aviso, pero el servicio no lanza nunca: lo
     * que no puede pasar es que un fallo del correo le devuelva un error a
     * quien acaba de retirar sus fotos correctamente.
     */
    if (resultado.retirada !== null) {
      await this.constancia.avisarRetiradaPorElCliente(resultado.retirada);
    }

    return { done: resultado.retirada !== null };
  }
}
