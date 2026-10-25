import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { removalLinkUrl, type MediaConsent } from '@freshness/types';
import type { Env } from '../common/config/env';
import { BusinessSettingsService } from '../settings/business-settings.service';
import { EmailBrandingService } from './email-branding.service';
import { NotificationSettingsService } from './notification-settings.service';
import {
  EMAIL_PROVIDER,
  TELEGRAM_PROVIDER,
  type EmailProvider,
  type TelegramProvider,
} from './notifications.types';
import { consentReceiptEmail } from './templates/consent-emails';
import { emailHtml } from './templates/layout';

/**
 * LA CONSTANCIA QUE SE LE MANDA AL CLIENTE
 * ========================================
 * Un correo con lo que autorizo y un boton que lo retira al momento.
 *
 * ========================================================================
 * DOS COSAS QUE ESTE SERVICIO HACE Y UNA QUE NO
 * ========================================================================
 * HACE: componer el enlace y mandar el correo.
 * NO HACE: guardar el testigo en ninguna parte. Llega como argumento, entra
 * en el cuerpo del correo y se olvida. No se registra, no se cachea y no se
 * devuelve — es una credencial, y la regla de este proyecto para las
 * credenciales de un solo uso es que no se escriben en ningun sitio.
 *
 * ========================================================================
 * UN FALLO AQUI NO PUEDE TUMBAR NADA
 * ========================================================================
 * Esto se llama despues de anotar un permiso y despues de crear una reserva.
 * Si el correo no sale, lo que NO puede pasar es que se pierda la reserva o
 * la ficha. Se registra como error —con la referencia, para poder rehacerlo—
 * y se sigue.
 *
 * Es lo contrario de la invitacion al panel, donde un correo que no sale SI
 * tiene que interrumpir: alli quien invita cree estar dando un acceso que no
 * ha dado. Aqui la ficha existe y el cliente sigue pudiendo escribir; lo que
 * se pierde es la comodidad, no el derecho.
 */
@Injectable()
export class ConsentReceiptService {
  private readonly logger = new Logger(ConsentReceiptService.name);

  constructor(
    private readonly business: BusinessSettingsService,
    private readonly marca: EmailBrandingService,
    private readonly config: ConfigService<Env, true>,
    private readonly ajustes: NotificationSettingsService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @Inject(TELEGRAM_PROVIDER) private readonly telegram: TelegramProvider,
  ) {}

  /**
   * AVISA A LA EMPRESA DE QUE UN CLIENTE ACABA DE RETIRAR SUS FOTOS.
   *
   * ========================================================================
   * SIN ESTO, LA GALERIA CAMBIARIA SOLA Y NADIE SE ENTERARIA
   * ========================================================================
   * Esa es la unica pega real de dejar que el cliente retire por su cuenta:
   * la portada deja de ensenar algo y la empresa no lo sabe hasta que mira.
   * Si fue un error —un enlace reenviado, un clic equivocado— hay que poder
   * llamar al cliente y preguntarle, y para eso hay que enterarse.
   *
   * SOLO LA REFERENCIA. Ni el nombre ni la direccion, igual que en el resto
   * de los avisos de este registro: el correo y el chat son los dos canales
   * menos controlados del sistema.
   *
   * NO LANZA NUNCA. Ya se ha retirado; que el aviso falle no puede deshacer
   * eso ni devolverle un error al cliente, que no tiene culpa de nada.
   */
  async avisarRetiradaPorElCliente(reference: string): Promise<void> {
    const ajustes = await this.ajustes.get().catch(() => null);
    if (ajustes === null) return;

    const titulo = `Un cliente ha retirado sus fotos (${reference})`;
    const cuerpo =
      `El permiso ${reference} se ha retirado desde el enlace que el cliente ` +
      'recibio por correo. Sus fotos y videos ya no se publican.\n\n' +
      'Si fue un error se puede restituir en Ajustes → Permisos de imagen.';

    if (ajustes.internalEmail !== null) {
      await this.email
        .send({
          to: ajustes.internalEmail,
          subject: titulo,
          text: cuerpo,
          html: emailHtml({
            locale: 'es',
            titulo,
            parrafos: cuerpo.split('\n\n'),
            contacto: [],
            branding: { logoUrl: this.marca.logoUrl },
          }),
        })
        .catch(() => undefined);
    }

    if (ajustes.telegramChatId !== null) {
      await this.telegram
        .send(ajustes.telegramChatId, `🗑 ${titulo}\n\nAjustes → Permisos de imagen.`)
        .catch(() => undefined);
    }
  }

  /**
   * Manda la constancia, si hay a quien.
   *
   * Sin correo del cliente no hay nada que mandar: es el caso de una ficha
   * de papel en la que nadie lo apunto, y no es un error.
   */
  async enviar(consent: MediaConsent, removalToken: string | null): Promise<void> {
    if (consent.customerEmail === null) return;

    const base = this.config.get('PUBLIC_SITE_URL', { infer: true });

    /*
     * SIN DIRECCION DEL SITIO, EL CORREO SALE SIN BOTON. Un enlace roto es
     * peor que ninguno: el cliente pulsaria, no pasaria nada visible y
     * creeria que ya esta retirado.
     */
    const removalUrl =
      base === undefined || removalToken === null ? null : removalLinkUrl(base, removalToken);

    if (removalUrl === null && removalToken !== null) {
      this.logger.warn(
        'Falta PUBLIC_SITE_URL: la constancia del permiso sale sin enlace de retirada.',
      );
    }

    const negocio = await this.business.get();

    const envio = await this.email
      .send(
        consentReceiptEmail(consent.customerEmail, {
          locale: consent.customerLocale,
          reference: consent.reference,
          serviceDate: consent.serviceDate,
          coversInterior: consent.coversInterior,
          coversExterior: consent.coversExterior,
          allowsBefore: consent.allowsBefore,
          removalDays: consent.removalDays,
          removalUrl,
          companyEmail: negocio.email,
          contacto: [negocio.phone, negocio.email].filter((dato): dato is string => dato !== null),
          branding: { logoUrl: this.marca.logoUrl },
        }),
      )
      .catch((error: unknown) => ({
        ok: false as const,
        failureReason: error instanceof Error ? error.message : 'error desconocido',
        providerMessageId: null,
      }));

    if (!envio.ok) {
      /*
       * La referencia SI, el correo del cliente NO. Los registros del
       * servidor los ve mas gente y se conservan mas tiempo de lo que uno
       * cree, y con la referencia se encuentra la ficha en el panel.
       */
      this.logger.error(
        `No salio la constancia del permiso ${consent.reference}: ${envio.failureReason}. ` +
          'El cliente no tiene su enlace de retirada; se le puede mandar de nuevo editando la ficha.',
      );
    }
  }
}
