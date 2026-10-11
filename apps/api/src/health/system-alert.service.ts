import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  requiereAtencion,
  telegramChatForSystemAlerts,
  type SystemCheck,
  type SystemCheckId,
} from '@freshness/types';
import type { Env } from '../common/config/env';
import { NotificationSettingsService } from '../notifications/notification-settings.service';
import { TELEGRAM_PROVIDER, type TelegramProvider } from '../notifications/notifications.types';
import { SystemChecksService } from './system-checks.service';

/**
 * LA ALARMA
 * =========
 * La pieza por la que existe toda la etapa. Lo demas —el contrato, las
 * comprobaciones, la pantalla— son el andamio de esto: QUE ALGUIEN SE ENTERE
 * SIN TENER QUE MIRAR.
 *
 * ========================================================================
 * EL PROBLEMA QUE RESUELVE NO ERA LA FALTA DE INFORMACION
 * ========================================================================
 * Cuando se escribio esto la API ya tenia treinta y ocho registradores y dos
 * sondas de salud. Las dos caidas de la semana estaban las dos escritas, en
 * castellano claro, con el nombre de la columna que faltaba. Una llevaba
 * horas en el log; la otra, diez dias.
 *
 * Nadie entra a Render a leer logs un martes por la tarde sin un motivo. El
 * motivo tiene que venir a buscarte.
 *
 * ========================================================================
 * LAS TRES REGLAS QUE EVITAN QUE ESTO SE CONVIERTA EN RUIDO
 * ========================================================================
 * Una alarma mal calibrada es peor que ninguna: ensena a la gente a ignorar
 * los avisos, y entonces el dia que suene de verdad tampoco lo leera nadie.
 *
 *   1. SOLO CUANDO ALGO CAMBIA. Se avisa en la transicion, no en cada
 *      pasada. El estado permanente no es noticia.
 *   2. SILENCIO MINIMO POR PROBLEMA. Un fallo que persiste se recuerda cada
 *      seis horas, no cada cinco minutos. Sin esto, el fallo del pin habria
 *      mandado casi cien mensajes en dos dias.
 *   3. SE AVISA TAMBIEN AL RECUPERARSE. Sin el «ya esta bien», nadie sabe si
 *      lo que hizo funciono, y la unica forma de averiguarlo es entrar a
 *      mirar: justo lo que esto viene a evitar.
 *
 * ========================================================================
 * QUE NO VA NUNCA EN UN MENSAJE
 * ========================================================================
 * Ni un dato de cliente, ni un nombre de tabla, ni una cadena de conexion.
 * Lo que se manda es la clave del contrato y, como mucho, una cifra. Telegram
 * es un servicio de terceros y el historial de ese chat queda en sus
 * servidores para siempre: lo que se manda ahi, se publica ahi.
 */

/** Retraso de la primera pasada. El arranque ya tiene bastante que hacer. */
const RETRASO_INICIAL_MS = 120_000;

/** Lo que se recuerda de cada comprobacion entre pasada y pasada. */
interface Memoria {
  /** Si la ultima vez estaba mal. */
  enFallo: boolean;
  /** Cuando se mando el ultimo aviso de ESTE problema. */
  avisadoMs: number;
}

@Injectable()
export class SystemAlertService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SystemAlertService.name);

  private readonly memoria = new Map<SystemCheckId, Memoria>();

  private arranque: NodeJS.Timeout | null = null;
  private temporizador: NodeJS.Timeout | null = null;
  private enCurso = false;

  constructor(
    private readonly checks: SystemChecksService,
    private readonly ajustes: NotificationSettingsService,
    @Inject(TELEGRAM_PROVIDER) private readonly telegram: TelegramProvider,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    const minutos = this.config.get('SYSTEM_ALERT_MINUTES', { infer: true });

    if (minutos === 0) {
      // Cero lo apaga. Es lo que usan las pruebas, que llaman a `pasada()`
      // a mano para no depender del reloj.
      this.logger.log('Alarma de estado desactivada (SYSTEM_ALERT_MINUTES=0)');
      return;
    }

    this.arranque = setTimeout(() => {
      void this.pasada();
      this.temporizador = setInterval(() => void this.pasada(), minutos * 60_000);
      this.temporizador.unref?.();
    }, RETRASO_INICIAL_MS);
    this.arranque.unref?.();

    this.logger.log(`Alarma de estado cada ${minutos} min`);
  }

  onModuleDestroy(): void {
    if (this.arranque) clearTimeout(this.arranque);
    if (this.temporizador) clearInterval(this.temporizador);
  }

  /**
   * Una pasada. Publica para que las pruebas la llamen sin esperar al reloj.
   *
   * Devuelve los mensajes que mando, que es lo que permite comprobar el
   * antirrebote sin tener que espiar al proveedor de Telegram.
   */
  async pasada(ahoraMs: number = Date.now()): Promise<string[]> {
    if (this.enCurso) return [];
    this.enCurso = true;

    try {
      const informe = await this.checks.run(true);
      const mensajes = this.decidir(informe.checks, ahoraMs);

      for (const mensaje of mensajes) {
        await this.enviar(mensaje);
      }

      return mensajes;
    } catch (error) {
      /*
       * NO SE PROPAGA, y aqui importa mas que en ningun otro sitio: esto
       * corre en un temporizador, sin nadie esperando, y una excepcion
       * tumbaria el proceso entero de la API por no haber podido mandar un
       * aviso. El vigilante que mata a lo que vigila.
       */
      this.logger.error(
        `La alarma de estado fallo: ${error instanceof Error ? error.message : 'error desconocido'}`,
      );
      return [];
    } finally {
      this.enCurso = false;
    }
  }

  /** Olvida lo avisado. Solo las pruebas. */
  reset(): void {
    this.memoria.clear();
  }

  /* ---------------------------------------------------------------------- */

  /**
   * Que hay que contar, mirando lo de ahora contra lo de la pasada anterior.
   *
   * Aqui vive el antirrebote entero, y esta separado del envio a proposito:
   * asi se puede probar la regla sin mandar nada a ninguna parte.
   */
  private decidir(checks: readonly SystemCheck[], ahoraMs: number): string[] {
    const silencioMs = this.config.get('SYSTEM_ALERT_SILENCE_HOURS', { infer: true }) * 3_600_000;

    const mensajes: string[] = [];

    for (const check of checks) {
      const previo = this.memoria.get(check.id);
      const mal = requiereAtencion(check.state);

      if (!mal) {
        /*
         * Se recupero. Solo se cuenta si antes se habia avisado del fallo:
         * si no, seria un «ya esta bien» de algo que nadie sabia que estaba
         * mal, que es una forma estupenda de desconcertar a quien lo lee.
         */
        if (previo?.enFallo) {
          mensajes.push(`[OK] ${check.id}: resuelto`);
        }
        this.memoria.delete(check.id);
        continue;
      }

      const esNuevo = !previo?.enFallo;
      const tocaRecordar = previo !== undefined && ahoraMs - previo.avisadoMs >= silencioMs;

      if (esNuevo || tocaRecordar) {
        mensajes.push(this.redactar(check, esNuevo));
        this.memoria.set(check.id, { enFallo: true, avisadoMs: ahoraMs });
      } else {
        // Sigue mal pero todavia no toca repetirlo. Se conserva CUANDO se
        // aviso, no cuando se miro: si no, el silencio no se cumpliria nunca.
        this.memoria.set(check.id, { enFallo: true, avisadoMs: previo?.avisadoMs ?? ahoraMs });
      }
    }

    return mensajes;
  }

  /**
   * El texto del aviso.
   *
   * Corto y en claves, no en prosa. Quien lo lee lo lee en el movil, muchas
   * veces conduciendo entre dos casas: tiene que saber en dos segundos si
   * hay que parar el coche. La explicacion larga esta en la pantalla de
   * estado del panel y en la documentacion.
   */
  private redactar(check: SystemCheck, esNuevo: boolean): string {
    const cabecera = esNuevo ? 'FALLO' : 'SIGUE MAL';
    const cifra = check.count === null ? '' : ` (${check.count})`;
    const detalle = check.detailKey === null ? check.state : check.detailKey;

    return `[${cabecera}] ${check.id}: ${detalle}${cifra}`;
  }

  /**
   * Manda el aviso, si hay a donde.
   *
   * SIEMPRE SE ESCRIBE EN EL LOG, se pueda mandar o no. Si el unico rastro
   * del aviso fuera el mensaje de Telegram, un chat mal configurado dejaria
   * el fallo sin registrar en ningun sitio, y es justo cuando mas falta hace.
   */
  private async enviar(mensaje: string): Promise<void> {
    this.logger.warn(`Aviso de estado: ${mensaje}`);

    const ajustes = await this.ajustes.get();

    /*
     * EL CHAT TECNICO, NO EL DE OPERACIONES (etapa 3.13).
     *
     * Quien lleva el negocio no puede hacer nada con «faltan migraciones», y
     * mezclar esos mensajes con los de reservas nuevas ensena a no leer
     * ninguno de los dos. Si no hay chat tecnico configurado se cae al de
     * operaciones: molestar a quien no puede arreglarlo es mucho menos grave
     * que un sistema roto del que no se entera nadie.
     */
    const chat = telegramChatForSystemAlerts(ajustes);
    if (chat === null) return;

    /*
     * NO se mira `telegramOnNewBooking`. Ese ajuste dice si se quieren avisos
     * de reservas nuevas, que es una preferencia comercial. Esto es otra
     * cosa: que el sistema esta roto. Apagarlo se hace con
     * SYSTEM_ALERT_MINUTES=0, que es una decision del entorno y no una
     * casilla que se pueda desmarcar sin querer una tarde.
     */
    const resultado = await this.telegram.send(chat, mensaje);

    if (!resultado.ok) {
      this.logger.error(`No se pudo mandar el aviso de estado: ${resultado.failureReason}`);
    }
  }
}
