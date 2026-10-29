import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NOTIFICATION_MAX_ATTEMPTS, type EmailNotificationEvent } from '@freshness/types';
import type { Env } from '../common/config/env';
import { PrismaService } from '../database/prisma.service';
import { SweepHeartbeatService } from '../health/sweep-heartbeat.service';
import { StaffNotificationsService } from '../staff-notifications/staff-notifications.service';
import { NotificationsService } from './notifications.service';

/** Retraso de la primera pasada tras arrancar, para no competir con el. */
const RETRASO_INICIAL_MS = 90_000;

/**
 * EL CORREO QUE FALLO Y NADIE SABIA
 * =================================
 * Hasta la etapa 3.30, un correo al cliente que fallaba se guardaba con
 * `status: 'FAILED'` y su motivo, y ahi se quedaba: sin reintento y sin
 * aviso.
 *
 * Si el proveedor estaba caido el minuto en que alguien confirmaba su
 * reserva, esa persona **habia pagado y no tenia nada por escrito**, y nadie
 * se enteraba hasta que alguien mirase el registro de envios — que no tiene
 * pantalla.
 *
 * El recordatorio de la vispera si se reintentaba, porque lo manda un barrido
 * que vuelve a pasar. La confirmacion no vuelve a pasar nunca.
 *
 * ========================================================================
 * PRIMERO INSISTE, Y SOLO CUANDO SE RINDE MOLESTA A ALGUIEN
 * ========================================================================
 * La mayoria de los fallos de un proveedor de correo duran segundos, asi que
 * el primer reintento a los cinco minutos resuelve casi todos sin que nadie
 * tenga que hacer nada.
 *
 * Avisar al primer fallo seria avisar de casi todos los hipos, y una bandeja
 * que avisa de lo que se arregla solo deja de leerse. El aviso sale AL
 * AGOTAR los intentos, que es cuando de verdad hay algo que hacer: llamar.
 */
@Injectable()
export class NotificationRetrySweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationRetrySweepService.name);

  private temporizador: NodeJS.Timeout | null = null;
  private enCurso = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly bandeja: StaffNotificationsService,
    private readonly config: ConfigService<Env, true>,
    private readonly latidos: SweepHeartbeatService,
  ) {}

  onModuleInit(): void {
    const minutos = this.config.get('NOTIFICATION_RETRY_MINUTES', { infer: true });

    if (minutos === 0) {
      this.logger.log('Reintento de avisos desactivado (NOTIFICATION_RETRY_MINUTES=0)');
      return;
    }

    const cadaMs = minutos * 60_000;
    this.latidos.registrar('notificationRetries', cadaMs);

    this.temporizador = setInterval(() => void this.pasada(), cadaMs);
    this.temporizador.unref();

    setTimeout(() => void this.pasada(), RETRASO_INICIAL_MS).unref();
  }

  onModuleDestroy(): void {
    if (this.temporizador !== null) clearInterval(this.temporizador);
  }

  /** Una pasada. Publica para que las pruebas no dependan del reloj. */
  async pasada(ahora: Date = new Date()): Promise<void> {
    if (this.enCurso) return;
    this.enCurso = true;

    try {
      const pendientes = await this.prisma.db.notification.findMany({
        where: {
          status: 'FAILED',
          /*
           * SOLO EL CORREO AL CLIENTE. Los de Telegram son nuestros y suelen
           * fallar por configuracion —un grupo que no existe—: insistir
           * cuatro veces no arregla eso y llena el registro.
           */
          channel: 'EMAIL',
          audience: 'CUSTOMER',
          nextAttemptAt: { not: null, lte: ahora },
        },
        select: { id: true, bookingId: true, event: true, attempts: true },
        /*
         * De veinte en veinte. Cada una es una llamada a un servidor ajeno, y
         * si hubo una caida larga puede haber muchas: las que sobren entran
         * en la siguiente pasada, que es dentro de unos minutos.
         */
        take: 20,
        orderBy: { nextAttemptAt: 'asc' },
      });

      for (const fila of pendientes) {
        await this.reintentar(fila, ahora);
      }

      this.latidos.anotar('notificationRetries', ahora.getTime());
    } catch (error) {
      this.logger.error(
        'No se pudieron reintentar los avisos: ' +
          (error instanceof Error ? error.message : 'error desconocido'),
      );
    } finally {
      this.enCurso = false;
    }
  }

  private async reintentar(
    fila: { id: string; bookingId: string; event: string; attempts: number },
    ahora: Date,
  ): Promise<void> {
    try {
      const salio = await this.notifications.reintentarCorreoAlCliente(
        fila.id,
        fila.bookingId,
        fila.event as EmailNotificationEvent,
        fila.attempts,
        ahora,
      );

      if (salio) return;

      /*
       * NO SALIO. Si quedan intentos, `reintentarCorreoAlCliente` ya dejo
       * programado el siguiente y aqui no hay nada que hacer. Si no quedan,
       * es cuando hay que molestar a una persona.
       */
      if (fila.attempts + 1 < NOTIFICATION_MAX_ATTEMPTS) return;

      await this.avisarDeLaRendicion(fila.bookingId, fila.event);
    } catch (error) {
      /*
       * Un fallo del propio reintento no puede parar la pasada: las demas
       * filas de la cola no tienen la culpa.
       */
      this.logger.error(
        `No se pudo reintentar el aviso ${fila.id}: ` +
          (error instanceof Error ? error.message : 'error desconocido'),
      );
    }
  }

  /**
   * Deja en la bandeja de administracion que alguien se quedo sin su correo.
   *
   * Es el unico aviso de la bandeja que significa que ALGUIEN QUE PAGO SE HA
   * QUEDADO SIN NADA POR ESCRITO, asi que dice la referencia para poder
   * abrir la reserva y llamar.
   */
  private async avisarDeLaRendicion(bookingId: string, event: string): Promise<void> {
    const reserva = await this.prisma.db.booking.findUnique({
      where: { id: bookingId },
      select: { reference: true },
    });

    await this.bandeja.emitir({
      kind: 'notification.failed',
      entityType: 'booking',
      entityId: bookingId,
      /* La referencia y que aviso era. Nunca la direccion de correo. */
      params: { reference: reserva?.reference ?? '', event },
    });

    this.logger.warn(
      `Se agotaron los reintentos de ${event} en ${reserva?.reference ?? bookingId}: avisado`,
    );
  }
}
