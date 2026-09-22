import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../common/config/env';
import { PrismaService } from '../database/prisma.service';
import { NotificationSettingsService } from './notification-settings.service';
import { NotificationsService } from './notifications.service';
import { describeFailure } from './notifications.types';

/**
 * BARRIDO DEL RECORDATORIO
 * ------------------------
 * Cada pocos minutos pregunta lo mismo: ¿que reservas confirmadas empiezan
 * dentro de la ventana y todavia no tienen recordatorio? Y las avisa.
 *
 * POR QUE UN BARRIDO Y NO UN TEMPORIZADOR POR RESERVA. Programar un aviso
 * para dentro de tres dias exige que el proceso siga vivo tres dias. No lo
 * esta: cada despliegue lo reinicia, y una caida se lleva por delante todos
 * los temporizadores pendientes sin dejar rastro.
 *
 * El barrido no guarda estado en memoria. Recalcula desde la base en cada
 * pasada, asi que un reinicio no pierde nada y una caida de dos horas se
 * recupera sola en la siguiente: las reservas que debieron avisarse siguen
 * en la ventana y sin registro, asi que entran en el siguiente barrido.
 *
 * POR QUE VA DENTRO DE LA API Y NO EN UN SERVICIO APARTE. La API corre en el
 * plan `starter` de Render, que NO se suspende por inactividad (ver el
 * comentario de `render.yaml`). Un servicio de cron separado seria una pieza
 * mas que desplegar, vigilar y pagar a cambio de nada.
 *
 * SI ALGUN DIA HAY VARIAS INSTANCIAS, no pasa nada: la comprobacion previa al
 * envio y el indice unico de la tabla impiden el correo repetido.
 */
@Injectable()
export class ReminderSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReminderSweepService.name);

  private temporizador: NodeJS.Timeout | null = null;
  /** Evita que dos pasadas se solapen si una tarda mas que el intervalo. */
  private enCurso = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: NotificationSettingsService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    const minutos = this.config.get('REMINDER_SWEEP_MINUTES', { infer: true });

    if (minutos === 0) {
      // Cero lo apaga. Es lo que usan las pruebas, que llaman al barrido a
      // mano para no depender del reloj.
      this.logger.log('Barrido de recordatorios desactivado (REMINDER_SWEEP_MINUTES=0)');
      return;
    }

    /*
     * `unref` para que el temporizador no impida que el proceso termine. Sin
     * el, cerrar la aplicacion se queda esperando al siguiente disparo, y las
     * pruebas se cuelgan hasta agotar su tiempo limite.
     */
    this.temporizador = setInterval(() => void this.ejecutar(), minutos * 60_000);
    this.temporizador.unref();

    this.logger.log(`Barrido de recordatorios cada ${minutos} min`);
  }

  onModuleDestroy(): void {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = null;
  }

  /**
   * Una pasada. Devuelve a cuantas reservas se aviso.
   *
   * Es publico porque las pruebas lo llaman directamente: depender del reloj
   * para comprobar la logica haria las pruebas lentas y fragiles.
   *
   * NUNCA LANZA, igual que el despachador. Este metodo lo invoca un
   * temporizador sin nadie escuchando: una excepcion aqui seria un rechazo de
   * promesa sin capturar, que en Node puede tumbar el proceso entero. La API
   * se caeria por un fallo al mandar un recordatorio.
   */
  async ejecutar(now: Date = new Date()): Promise<number> {
    if (this.enCurso) {
      this.logger.warn('El barrido anterior sigue en curso: se salta esta pasada');
      return 0;
    }

    this.enCurso = true;

    try {
      const ajustes = await this.settings.get();
      if (!ajustes.emailBookingReminder) return 0;

      const pendientes = await this.pendientes(ajustes.reminderHoursBefore, now);

      for (const bookingId of pendientes) {
        await this.notifications.bookingReminder(bookingId);
      }

      if (pendientes.length > 0) {
        this.logger.log(`Recordatorio enviado a ${pendientes.length} reserva(s)`);
      }

      return pendientes.length;
    } catch (error) {
      this.logger.error(`El barrido de recordatorios fallo: ${describeFailure(error)}`);
      return 0;
    } finally {
      this.enCurso = false;
    }
  }

  /**
   * Reservas que toca recordar ahora.
   *
   * Cuatro condiciones, y cada una evita un problema concreto:
   *
   *   1. CONFIRMADA. Una cancelada o ya completada no necesita recordatorio.
   *
   *   2. EMPIEZA DESPUES DE AHORA. Sin esto, tras una caida larga se mandarian
   *      recordatorios de limpiezas que ya ocurrieron.
   *
   *   3. EMPIEZA DENTRO DE LA VENTANA. Es la definicion de "la vispera".
   *
   *   4. SIN RECORDATORIO ENVIADO. Se filtra aqui, en la consulta, y no solo
   *      antes de enviar: el barrido ve las mismas reservas cada pocos minutos
   *      y sin este filtro cargaria y descartaria las mismas una y otra vez
   *      durante todo el dia anterior a cada cita.
   *
   * No hace falta excluir las recien creadas. La antelacion minima para
   * reservar son 24 horas y la ventana por defecto es de 24, asi que una
   * reserva nueva entra justo en el limite; si alguien baja la antelacion
   * minima por debajo de la ventana, el contrato obliga a un minimo de 2 horas
   * de recordatorio, que sigue separandolo de la confirmacion.
   */
  private async pendientes(horasAntes: number, now: Date): Promise<string[]> {
    const limite = new Date(now.getTime() + horasAntes * 3_600_000);

    const reservas = await this.prisma.db.booking.findMany({
      where: {
        status: 'CONFIRMED',
        scheduledStart: { gt: now, lte: limite },
        notifications: {
          none: {
            event: 'BOOKING_REMINDER',
            channel: 'EMAIL',
            audience: 'CUSTOMER',
            status: 'SENT',
          },
        },
      },
      select: { id: true },
      /*
       * Tope por pasada. Sin el, un arranque despues de mucho tiempo parado
       * intentaria enviarlo todo de golpe y agotaria la cuota del proveedor de
       * correo. Lo que no entre se recoge en la siguiente pasada.
       */
      take: 100,
      orderBy: { scheduledStart: 'asc' },
    });

    return reservas.map((reserva) => reserva.id);
  }
}
