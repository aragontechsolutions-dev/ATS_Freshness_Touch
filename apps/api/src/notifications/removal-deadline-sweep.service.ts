import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { removalState } from '@freshness/types';
import type { Env } from '../common/config/env';
import { SweepHeartbeatService } from '../health/sweep-heartbeat.service';
import { NotificationSettingsService } from './notification-settings.service';
import { EmailBrandingService } from './email-branding.service';
import {
  EMAIL_PROVIDER,
  TELEGRAM_PROVIDER,
  describeFailure,
  type EmailProvider,
  type TelegramProvider,
} from './notifications.types';
import {
  removalDeadlineEmail,
  removalDeadlineTelegramMessage,
  type RemovalDeadlineItem,
} from './templates/consent-emails';
import { MediaConsentsService, type RetiradaPendiente } from '../settings/media-consents.service';

/** Retraso de la primera pasada tras arrancar, para no competir con el arranque. */
const RETRASO_INICIAL_MS = 120_000;

/**
 * EL AVISO DE LOS PLAZOS DE RETIRADA
 * ==================================
 * La otra mitad de la promesa del papel firmado. El sistema ya cumplia una:
 * retirar es un boton y despublica al momento. Pero ese boton hay que
 * pulsarlo, y el hueco peligroso va desde que llega el correo del cliente
 * hasta que alguien entra al panel. Ahi es donde una promesa de cinco dias se
 * incumple sin que nadie se entere.
 *
 * ========================================================================
 * SE AVISA TODOS LOS DIAS, NO SOLO AL FINAL
 * ========================================================================
 * Lo facil habria sido avisar «cuando queden dos dias». Es peor: deja tres
 * dias de silencio en los que la peticion existe y nadie la ve, y si el aviso
 * del dia clave se pierde —correo en spam, servidor caido— ya no hay otro.
 *
 * Son pocas: un cliente que pide retirar sus fotos es raro. Y el dia que pase,
 * lo caro es olvidarla, no leer un correo de mas.
 *
 * ========================================================================
 * UNA VEZ AL DIA, Y LA CUENTA VIVE EN LA BASE
 * ========================================================================
 * El barrido pasa cada hora, pero cada ficha avisa como mucho una vez al dia,
 * y la marca de cuando se aviso esta en `media_consents` y no en memoria. Si
 * estuviera en memoria, cada despliegue a media manana volveria a avisar de
 * todo lo que ya se habia avisado — y un aviso que se repite es un aviso que
 * se deja de leer.
 *
 * ========================================================================
 * NI UN NOMBRE NI UNA DIRECCION SALEN DE AQUI
 * ========================================================================
 * El correo y el mensaje de Telegram llevan la referencia del permiso y el
 * plazo, y nada mas. Son los dos canales menos controlados del sistema: se
 * reenvian, se quedan en el movil de quien los lee y en un buzon para
 * siempre. Lo que el permiso promete no exponer es justo el nombre del
 * cliente y la direccion de su casa, y con la referencia se abre la ficha en
 * el panel, que es donde ese dato puede verse.
 *
 * ========================================================================
 * UN FALLO AL AVISAR NO MARCA LA FICHA COMO AVISADA
 * ========================================================================
 * Si el correo no sale, la ficha se queda sin marcar y vuelve a entrar en la
 * siguiente pasada. Es lo contrario de lo que hace el barrido de
 * recordatorios de reserva —alli un fallo se registra y se sigue—, y la
 * diferencia esta en lo que cuesta equivocarse: un recordatorio de cita que
 * no llega es una molestia; un plazo legal que nadie recuerda es una promesa
 * incumplida.
 */
@Injectable()
export class RemovalDeadlineSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemovalDeadlineSweepService.name);

  private temporizador: NodeJS.Timeout | null = null;
  /** Evita que dos pasadas se solapen si una tarda mas que el intervalo. */
  private enCurso = false;

  constructor(
    private readonly consentimientos: MediaConsentsService,
    private readonly settings: NotificationSettingsService,
    private readonly marca: EmailBrandingService,
    private readonly config: ConfigService<Env, true>,
    private readonly latidos: SweepHeartbeatService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @Inject(TELEGRAM_PROVIDER) private readonly telegram: TelegramProvider,
  ) {}

  onModuleInit(): void {
    const minutos = this.config.get('REMOVAL_SWEEP_MINUTES', { infer: true });

    if (minutos === 0) {
      this.logger.log('Aviso de plazos de retirada desactivado (REMOVAL_SWEEP_MINUTES=0)');
      return;
    }

    const cadaMs = minutos * 60_000;
    this.latidos.registrar('removalDeadlines', cadaMs);

    this.temporizador = setInterval(() => void this.pasada(), cadaMs);
    this.temporizador.unref();

    setTimeout(() => void this.pasada(), RETRASO_INICIAL_MS).unref();
  }

  onModuleDestroy(): void {
    if (this.temporizador !== null) clearInterval(this.temporizador);
  }

  /**
   * Una pasada. Publica para que las pruebas la llamen a mano y no dependan
   * del reloj, igual que el resto de barridos del proyecto.
   */
  async pasada(ahora: Date = new Date()): Promise<void> {
    if (this.enCurso) return;
    this.enCurso = true;

    try {
      const pendientes = await this.consentimientos.retiradasPendientes();
      const porAvisar = pendientes.filter((ficha) => this.tocaAvisar(ficha, ahora));

      if (porAvisar.length > 0) {
        const enviado = await this.avisar(porAvisar, ahora);
        if (enviado) {
          await this.consentimientos.marcarAvisadas(
            porAvisar.map((ficha) => ficha.id),
            ahora,
          );
        }
      }

      this.latidos.anotar('removalDeadlines', ahora.getTime());
    } catch (error) {
      this.logger.error(
        'No se pudo repasar los plazos de retirada: ' +
          (error instanceof Error ? error.message : 'error desconocido'),
      );
    } finally {
      this.enCurso = false;
    }
  }

  /**
   * Si esta ficha merece aviso hoy.
   *
   * SE COMPARA POR DIA, no por horas transcurridas. Con «24 horas desde el
   * ultimo aviso», el correo se iria desplazando una hora cada dia hasta
   * acabar llegando de madrugada.
   */
  private tocaAvisar(ficha: RetiradaPendiente, ahora: Date): boolean {
    const ultimo = ficha.reminderSentAt;
    if (ultimo === null) return true;

    return ultimo.slice(0, 10) < ahora.toISOString().slice(0, 10);
  }

  /** Manda el aviso. Devuelve si salio por algun canal. */
  private async avisar(fichas: RetiradaPendiente[], ahora: Date): Promise<boolean> {
    const hoy = ahora.toISOString().slice(0, 10);

    const items: RemovalDeadlineItem[] = fichas
      .map((ficha) => {
        const estado = removalState(
          { requestedAt: ficha.requestedAt, removalDays: ficha.removalDays, revoked: false },
          hoy,
        );
        return {
          reference: ficha.reference,
          daysLeft: estado.daysLeft ?? 0,
          deadline: estado.deadline ?? hoy,
        };
      })
      // Lo mas urgente arriba: lo vencido primero, y dentro de eso lo que mas.
      .sort((a, b) => a.daysLeft - b.daysLeft);

    const ajustes = await this.settings.get();

    const porCorreo = await this.porCorreo(ajustes.internalEmail, items);
    const porTelegram = await this.porTelegram(ajustes.telegramChatId, items);

    if (!porCorreo && !porTelegram) {
      /*
       * NI UN CANAL CONFIGURADO ES UN PROBLEMA, no una configuracion valida:
       * significa que el sistema sabe que hay una promesa venciendo y no
       * tiene a quien decirselo. Se registra como aviso y las fichas NO se
       * marcan, para que el dia que se configure un canal salga el aviso.
       */
      this.logger.warn(
        `Hay ${String(items.length)} retirada(s) pendiente(s) y ningun canal de aviso ` +
          'configurado. Pon un correo interno o un chat de Telegram en Ajustes → Avisos.',
      );
      return false;
    }

    return true;
  }

  private async porCorreo(destino: string | null, items: RemovalDeadlineItem[]): Promise<boolean> {
    if (destino === null) return false;

    const mensaje = removalDeadlineEmail(destino, {
      /*
       * El aviso interno va en espanol: es para la empresa, no para un
       * cliente, y el idioma del cliente no pinta nada aqui.
       */
      locale: 'es',
      items,
      contacto: [],
      branding: { logoUrl: this.marca.logoUrl },
    });

    const resultado = await this.email.send(mensaje).catch((error: unknown) => ({
      ok: false as const,
      failureReason: describeFailure(error),
      providerMessageId: null,
    }));

    if (!resultado.ok) {
      this.logger.error(`No salio el aviso de retiradas por correo: ${resultado.failureReason}`);
      return false;
    }

    return true;
  }

  private async porTelegram(chatId: string | null, items: RemovalDeadlineItem[]): Promise<boolean> {
    if (chatId === null) return false;

    const resultado = await this.telegram
      .send(chatId, removalDeadlineTelegramMessage(items))
      .catch((error: unknown) => ({
        ok: false as const,
        failureReason: describeFailure(error),
        providerMessageId: null,
      }));

    if (!resultado.ok) {
      this.logger.error(`No salio el aviso de retiradas por Telegram: ${resultado.failureReason}`);
      return false;
    }

    return true;
  }
}
