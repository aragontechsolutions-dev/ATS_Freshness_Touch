import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  nextRetryAt,
  maskChatId,
  maskEmail,
  telegramChatForAudience,
  type EmailNotificationEvent,
  type NotificationAudience,
  type NotificationChannel,
  type NotificationEvent,
  type Locale,
  type NotificationSettings,
} from '@freshness/types';
import { PrismaService } from '../database/prisma.service';
import { EmailBrandingService } from './email-branding.service';
import { BusinessSettingsService } from '../settings/business-settings.service';
import {
  EMAIL_PROVIDER,
  TELEGRAM_PROVIDER,
  describeFailure,
  type DeliveryResult,
  type EmailMessage,
  type EmailProvider,
  type TelegramProvider,
} from './notifications.types';
import { NotificationSettingsService } from './notification-settings.service';
import {
  bookingCancelledEmail,
  bookingConfirmedEmail,
  bookingReminderEmail,
  newBookingTelegramMessage,
  jobAssignedTelegramMessage,
  teamArrivedFarTelegramMessage,
  type BookingEmailData,
} from './templates/booking-emails';

/**
 * Lo que se lee de una reserva para poder avisar.
 *
 * Se declara a mano en vez de inferirlo de la consulta para dejar en un solo
 * sitio, y a la vista, QUE datos salen de la base con destino a un correo. Lo
 * que no esta en esta lista no puede acabar en un mensaje por descuido: las
 * instrucciones de acceso, por ejemplo, no estan.
 */
interface ReservaParaAviso {
  reference: string;
  /** Que clase de limpieza. Solo lo usa el aviso al equipo. */
  service: string;
  scheduledStart: Date;
  timezone: string;
  depositCents: number;
  balanceDueCents: number;
  totalCents: number;
  currency: string;
  customer: { email: string; firstName: string; lastName: string; locale: Locale };
  address: { line1: string; city: string; state: string };
}

/**
 * DESPACHADOR DE AVISOS
 * ---------------------
 * Aqui esta el riesgo real de toda esta etapa, y merece la pena decirlo claro:
 *
 *   ESTO SE LLAMA JUSTO DESPUES DE CONFIRMAR UNA RESERVA YA PAGADA.
 *
 * De ahi salen tres reglas que no se negocian:
 *
 *   1. SE LLAMA FUERA DE LA TRANSACCION. Nunca dentro. Si estuviera dentro, un
 *      proveedor de correo caido desharia la confirmacion de una reserva cuyo
 *      deposito YA esta retenido en la tarjeta del cliente. El cliente tendria
 *      el dinero bloqueado y ninguna cita.
 *
 *   2. NINGUN METODO PUBLICO LANZA. Pase lo que pase. Quien llama no tiene que
 *      acordarse de envolverlo en un try: el compromiso lo cumple esta clase.
 *
 *   3. TODO INTENTO QUEDA REGISTRADO, tambien los que no se envian. "Estaba
 *      apagado" es la respuesta correcta a la mitad de los "no me ha llegado
 *      nada", y sin registro es indistinguible de una averia.
 *
 * NO SE ENVIA DOS VECES: un indice unico parcial sobre (reserva, hecho, canal,
 * destinatario) limitado a los envios que salieron convierte el reenvio de un
 * webhook en un error de clave duplicada, que aqui se traga en silencio.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: NotificationSettingsService,
    private readonly business: BusinessSettingsService,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @Inject(TELEGRAM_PROVIDER) private readonly telegram: TelegramProvider,
    private readonly marca: EmailBrandingService,
  ) {}

  /**
   * Una reserva acaba de quedar en firme.
   *
   * Manda la confirmacion al cliente, la copia interna si esta configurada y
   * el aviso por Telegram.
   */
  async bookingConfirmed(bookingId: string): Promise<void> {
    await this.despachar(bookingId, 'BOOKING_CONFIRMED');
  }

  /** Una reserva se ha cancelado, la cancele quien la cancele. */
  async bookingCancelled(bookingId: string): Promise<void> {
    await this.despachar(bookingId, 'BOOKING_CANCELLED');
  }

  /** Recordatorio la vispera. Lo dispara el barrido, no un hecho puntual. */
  async bookingReminder(bookingId: string): Promise<void> {
    await this.despachar(bookingId, 'BOOKING_REMINDER');
  }

  /* ---------------------------------------------------------------------- */
  /*  Los dos avisos de la etapa 3.13                                        */
  /* ---------------------------------------------------------------------- */

  /**
   * AL GRUPO DEL EQUIPO: se te asigno un trabajo, o cambio el equipo.
   *
   * ======================================================================
   * SE PUEDE REPETIR, Y ES OBLIGATORIO QUE SE PUEDA
   * ======================================================================
   * Los demas avisos pasan por `yaEnviado` para que una reentrega no mande
   * dos correos. Este no, y la migracion `20261011120100` saca este evento
   * del indice unico a proposito:
   *
   *   coordinacion asigna a Ana -> el grupo lo lee
   *   coordinacion reasigna a Pedro -> SIN segundo aviso, el grupo sigue
   *   creyendo que va Ana
   *
   * Un mensaje antiguo que nadie contradice se lee como vigente, y acaba
   * yendo a la casa quien no toca, o nadie. Peor que no avisar.
   *
   * Y no hay nada que deduplicar: esto no lo dispara un barrido, lo dispara
   * una persona pulsando un boton.
   */
  async jobAssigned(bookingId: string, teamFirstNames: string[]): Promise<void> {
    try {
      const reserva = await this.cargar(bookingId);
      if (!reserva) return;

      const ajustes = await this.settings.get();
      const chat = telegramChatForAudience('CLEANING', ajustes);

      if (!ajustes.telegramOnJobAssigned || chat === null) {
        await this.registrar({
          bookingId,
          event: 'JOB_ASSIGNED',
          channel: 'TELEGRAM',
          audience: 'CLEANING',
          status: 'SKIPPED',
          target: chat === null ? null : maskChatId(chat),
          failureReason: !ajustes.telegramOnJobAssigned
            ? 'El aviso esta desactivado en la configuracion'
            : 'No hay grupo de limpieza configurado',
          providerMessageId: null,
        });
        return;
      }

      const texto = jobAssignedTelegramMessage({
        reference: reserva.reference,
        scheduledStart: reserva.scheduledStart,
        timezone: reserva.timezone,
        addressLine: reserva.address.line1,
        city: reserva.address.city,
        teamFirstNames,
        serviceLabel: reserva.service,
      });

      const resultado = await this.enviarSinLanzar(() => this.telegram.send(chat, texto));

      await this.registrar({
        bookingId,
        event: 'JOB_ASSIGNED',
        channel: 'TELEGRAM',
        audience: 'CLEANING',
        status: resultado.ok ? 'SENT' : 'FAILED',
        target: maskChatId(chat),
        failureReason: resultado.failureReason,
        providerMessageId: resultado.providerMessageId,
      });
    } catch (error) {
      /*
       * NO SE PROPAGA. Esto se llama DESPUES de que la asignacion ya este
       * guardada: dejar que un fallo de Telegram deshaga el trabajo de
       * coordinacion seria cambiar un aviso perdido por una asignacion
       * perdida.
       */
      this.logger.error(`No se pudo avisar de la asignacion: ${describeFailure(error)}`);
    }
  }

  /**
   * A OPERACIONES: alguien ficho la entrada lejos de la casa.
   *
   * SOLO LOS QUE NO CUADRAN. Quien decide que es «lejos» es `isFarFromHouse`,
   * que descuenta el margen de error del propio GPS antes de comparar: solo
   * salta cuando el movil mismo dice que la persona no puede estar alli.
   *
   * Un aviso por cada fichaje normal serian varios al dia de pura rutina, y
   * lo que se lee todos los dias sin que pase nada se deja de leer. La misma
   * regla que la alarma de estado.
   */
  async teamArrivedFar(
    bookingId: string,
    staffName: string,
    distanceMeters: number,
  ): Promise<void> {
    try {
      const reserva = await this.cargar(bookingId);
      if (!reserva) return;

      const ajustes = await this.settings.get();
      const chat = telegramChatForAudience('INTERNAL', ajustes);

      if (!ajustes.telegramOnTeamArrivedFar || chat === null) {
        await this.registrar({
          bookingId,
          event: 'TEAM_ARRIVED_FAR',
          channel: 'TELEGRAM',
          audience: 'INTERNAL',
          status: 'SKIPPED',
          target: chat === null ? null : maskChatId(chat),
          failureReason: !ajustes.telegramOnTeamArrivedFar
            ? 'El aviso esta desactivado en la configuracion'
            : 'No hay chat de Telegram configurado',
          providerMessageId: null,
        });
        return;
      }

      // Este si pasa por la guardia: un reintento no debe avisar dos veces
      // del mismo fichaje.
      if (await this.yaEnviado(bookingId, 'TEAM_ARRIVED_FAR', 'TELEGRAM', 'INTERNAL')) return;

      const texto = teamArrivedFarTelegramMessage({
        reference: reserva.reference,
        staffName,
        distanceMeters,
        addressLine: reserva.address.line1,
        city: reserva.address.city,
      });

      const resultado = await this.enviarSinLanzar(() => this.telegram.send(chat, texto));

      await this.registrar({
        bookingId,
        event: 'TEAM_ARRIVED_FAR',
        channel: 'TELEGRAM',
        audience: 'INTERNAL',
        status: resultado.ok ? 'SENT' : 'FAILED',
        target: maskChatId(chat),
        failureReason: resultado.failureReason,
        providerMessageId: resultado.providerMessageId,
      });
    } catch (error) {
      // Igual que arriba: el fichaje ya esta guardado y vale mas que el aviso.
      this.logger.error(`No se pudo avisar del fichaje lejano: ${describeFailure(error)}`);
    }
  }

  private async despachar(bookingId: string, event: EmailNotificationEvent): Promise<void> {
    try {
      const reserva = await this.cargar(bookingId);
      if (!reserva) {
        this.logger.warn(`No se avisa de ${event}: la reserva ${bookingId} ya no existe`);
        return;
      }

      const ajustes = await this.settings.get();
      const negocio = await this.business.get();

      const datos: BookingEmailData = {
        locale: reserva.customer.locale,
        customerFirstName: reserva.customer.firstName,
        reference: reserva.reference,
        scheduledStart: reserva.scheduledStart,
        timezone: reserva.timezone,
        addressLine: reserva.address.line1,
        city: reserva.address.city,
        state: reserva.address.state,
        depositCents: reserva.depositCents,
        balanceDueCents: reserva.balanceDueCents,
        currency: reserva.currency,
        companyPhone: negocio.phone,
        companyEmail: negocio.email,
        logoUrl: this.marca.logoUrl,
      };

      await this.correoAlCliente(bookingId, event, ajustes, reserva.customer.email, datos);

      if (event === 'BOOKING_CONFIRMED') {
        await this.avisoInterno(bookingId, ajustes, reserva, datos);
      }
    } catch (error) {
      /*
       * Ultimo cinturon de seguridad. Si algo inesperado revienta aqui —una
       * consulta, un dato que falta— NO puede subir: quien llama acaba de
       * confirmar una reserva pagada y no debe enterarse siquiera.
       */
      this.logger.error(
        `Fallo inesperado al avisar de ${event} en la reserva ${bookingId}: ${describeFailure(error)}`,
      );
    }
  }

  /**
   * VUELVE A INTENTAR UN CORREO AL CLIENTE QUE FALLO.
   *
   * ======================================================================
   * REENVIA SOLO ESE CORREO, NO VUELVE A DESPACHAR EL AVISO ENTERO
   * ======================================================================
   * Llamar otra vez a `despachar` reharia tambien la copia interna y el
   * aviso de Telegram, que casi siempre SI salieron. Aqui se reintenta la
   * pieza que fallo y nada mas.
   *
   * ======================================================================
   * EL DESTINATARIO SE VUELVE A LEER DE LA RESERVA
   * ======================================================================
   * No se puede usar el `target` guardado: se guarda ENMASCARADO a
   * proposito, para que el registro de envios no sea una lista de correos.
   * Y hay un efecto util: si entre el fallo y el reintento alguien corrigio
   * la direccion del cliente, el reintento va a la buena.
   *
   * Devuelve si salio, para que el barrido decida si programa otro.
   */
  async reintentarCorreoAlCliente(
    notificationId: string,
    bookingId: string,
    event: EmailNotificationEvent,
    intentosPrevios: number,
    ahora: Date = new Date(),
  ): Promise<boolean> {
    const reserva = await this.cargar(bookingId);

    if (!reserva) {
      /*
       * La reserva ya no esta. No es un fallo del envio: no hay a quien
       * avisar. Se cierra el reintento para que el barrido no vuelva.
       */
      await this.cerrarReintento(notificationId, 'La reserva ya no existe');
      return false;
    }

    const negocio = await this.business.get();

    const mensaje = this.componer(event, reserva.customer.email, {
      locale: reserva.customer.locale,
      customerFirstName: reserva.customer.firstName,
      reference: reserva.reference,
      scheduledStart: reserva.scheduledStart,
      timezone: reserva.timezone,
      addressLine: reserva.address.line1,
      city: reserva.address.city,
      state: reserva.address.state,
      depositCents: reserva.depositCents,
      balanceDueCents: reserva.balanceDueCents,
      currency: reserva.currency,
      companyPhone: negocio.phone,
      companyEmail: negocio.email,
      logoUrl: this.marca.logoUrl,
    });

    const resultado = await this.enviarSinLanzar(() => this.email.send(mensaje));
    const intentos = intentosPrevios + 1;

    await this.prisma.db.notification.update({
      where: { id: notificationId },
      data: {
        status: resultado.ok ? 'SENT' : 'FAILED',
        target: maskEmail(reserva.customer.email),
        failureReason: resultado.failureReason,
        providerMessageId: resultado.providerMessageId,
        attempts: intentos,
        /*
         * LA FILA SE REESCRIBE, no se duplica. El registro contesta «salio o
         * no salio, y cuanto costo», no «aqui tienes cuatro filas casi
         * iguales». La contrapartida esta dicha en el esquema: el motivo que
         * queda es el del ultimo intento.
         */
        nextAttemptAt: resultado.ok ? null : nextRetryAt(intentos, ahora),
      },
    });

    this.logger.log(
      `Reintento ${String(intentos)} de ${event} en ${reserva.reference}: ` +
        (resultado.ok ? 'entregado' : 'vuelve a fallar'),
    );

    return resultado.ok;
  }

  /** Deja de reintentar, con el motivo. Sin tocar el estado de envio. */
  private async cerrarReintento(notificationId: string, motivo: string): Promise<void> {
    await this.prisma.db.notification.update({
      where: { id: notificationId },
      data: { nextAttemptAt: null, failureReason: motivo },
    });
  }

  /** Confirmacion o cancelacion, al correo del cliente. */
  private async correoAlCliente(
    bookingId: string,
    event: EmailNotificationEvent,
    ajustes: NotificationSettings,
    destinatario: string,
    datos: BookingEmailData,
  ): Promise<void> {
    const encendido = {
      BOOKING_CONFIRMED: ajustes.emailBookingConfirmed,
      BOOKING_CANCELLED: ajustes.emailBookingCancelled,
      BOOKING_REMINDER: ajustes.emailBookingReminder,
    }[event];

    if (!encendido) {
      await this.registrar({
        bookingId,
        event,
        channel: 'EMAIL',
        audience: 'CUSTOMER',
        status: 'SKIPPED',
        target: maskEmail(destinatario),
        failureReason: 'El aviso esta desactivado en la configuracion',
        providerMessageId: null,
      });
      return;
    }

    if (await this.yaEnviado(bookingId, event, 'EMAIL', 'CUSTOMER')) return;

    const mensaje = this.componer(event, destinatario, datos);

    const resultado = await this.enviarSinLanzar(() => this.email.send(mensaje));

    await this.registrar({
      bookingId,
      event,
      channel: 'EMAIL',
      audience: 'CUSTOMER',
      status: resultado.ok ? 'SENT' : 'FAILED',
      target: maskEmail(destinatario),
      failureReason: resultado.failureReason,
      providerMessageId: resultado.providerMessageId,
      /*
       * SI FALLA, SE PROGRAMA EL REINTENTO AQUI MISMO.
       *
       * Es el unico aviso que se reintenta, y el motivo es que es el unico
       * donde alguien que acaba de pagar se queda sin nada por escrito. Los
       * de Telegram son nuestros y suelen fallar por configuracion: insistir
       * cuatro veces no arregla un grupo que no existe.
       */
      attempts: 1,
      nextAttemptAt: resultado.ok ? null : nextRetryAt(1, new Date()),
    });

    /*
     * La copia interna es el MISMO correo a otro buzon: el equipo ve
     * exactamente lo que recibio el cliente, que es lo util cuando llama.
     *
     * El RECORDATORIO se queda fuera a proposito. Un aviso por cada reserva
     * del dia siguiente convierte el buzon interno en ruido diario, y el
     * equipo ya tiene la agenda del panel para saber que hay manana. Se copia
     * lo excepcional (una reserva nueva, una cancelacion), no lo rutinario.
     */
    if (
      event !== 'BOOKING_REMINDER' &&
      ajustes.internalEmail !== null &&
      !(await this.yaEnviado(bookingId, event, 'EMAIL', 'INTERNAL'))
    ) {
      const copia = await this.enviarSinLanzar(() =>
        this.email.send({ ...mensaje, to: ajustes.internalEmail as string }),
      );

      await this.registrar({
        bookingId,
        event,
        channel: 'EMAIL',
        audience: 'INTERNAL',
        status: copia.ok ? 'SENT' : 'FAILED',
        target: maskEmail(ajustes.internalEmail),
        failureReason: copia.failureReason,
        providerMessageId: copia.providerMessageId,
      });
    }
  }

  /** Mensaje de Telegram al entrar una reserva confirmada. */
  private async avisoInterno(
    bookingId: string,
    ajustes: NotificationSettings,
    reserva: ReservaParaAviso,
    datos: BookingEmailData,
  ): Promise<void> {
    if (!ajustes.telegramOnNewBooking || ajustes.telegramChatId === null) {
      await this.registrar({
        bookingId,
        event: 'BOOKING_CONFIRMED',
        channel: 'TELEGRAM',
        audience: 'INTERNAL',
        status: 'SKIPPED',
        target: ajustes.telegramChatId === null ? null : maskChatId(ajustes.telegramChatId),
        failureReason: !ajustes.telegramOnNewBooking
          ? 'El aviso esta desactivado en la configuracion'
          : 'No hay chat de Telegram configurado',
        providerMessageId: null,
      });
      return;
    }

    const texto = newBookingTelegramMessage({
      reference: reserva.reference,
      customerName: `${reserva.customer.firstName} ${reserva.customer.lastName}`.trim(),
      scheduledStart: reserva.scheduledStart,
      timezone: reserva.timezone,
      addressLine: datos.addressLine,
      city: datos.city,
      totalCents: reserva.totalCents,
      currency: reserva.currency,
    });

    if (await this.yaEnviado(bookingId, 'BOOKING_CONFIRMED', 'TELEGRAM', 'INTERNAL')) return;

    const resultado = await this.enviarSinLanzar(() =>
      this.telegram.send(ajustes.telegramChatId as string, texto),
    );

    await this.registrar({
      bookingId,
      event: 'BOOKING_CONFIRMED',
      channel: 'TELEGRAM',
      audience: 'INTERNAL',
      status: resultado.ok ? 'SENT' : 'FAILED',
      target: maskChatId(ajustes.telegramChatId),
      failureReason: resultado.failureReason,
      providerMessageId: resultado.providerMessageId,
    });
  }

  /** Elige la plantilla que toca. */
  private componer(
    event: EmailNotificationEvent,
    destinatario: string,
    datos: BookingEmailData,
  ): EmailMessage {
    const plantilla = {
      BOOKING_CONFIRMED: bookingConfirmedEmail,
      BOOKING_CANCELLED: bookingCancelledEmail,
      BOOKING_REMINDER: bookingReminderEmail,
    }[event];

    return plantilla(destinatario, datos);
  }

  /**
   * ¿Este aviso ya salio?
   *
   * SE COMPRUEBA ANTES DE ENVIAR, Y ESO ES EL PUNTO. El indice unico de la
   * tabla impide registrar dos veces el mismo envio, pero el registro ocurre
   * DESPUES del envio: sin esta comprobacion, el segundo intento manda el
   * correo y solo entonces choca con la restriccion. El cliente ya lo habria
   * recibido dos veces.
   *
   * No es un caso raro. El barrido del recordatorio pasa cada pocos minutos y
   * ve la misma reserva una y otra vez hasta que llega la cita: sin esto,
   * serian decenas de correos identicos.
   *
   * QUEDA UNA CARRERA ABIERTA, pequena y asumida: dos instancias que entren en
   * el mismo milisegundo pueden enviar las dos. El indice unico limita el dano
   * a un unico duplicado y el registro lo deja a la vista. La alternativa
   * —reservar la fila antes de enviar— cambia ese duplicado improbable por
   * algo peor: una fila que dice "enviado" de un correo que nunca salio si el
   * proceso muere entre las dos operaciones.
   */
  private async yaEnviado(
    bookingId: string,
    event: NotificationEvent,
    channel: NotificationChannel,
    audience: NotificationAudience,
  ): Promise<boolean> {
    try {
      const previo = await this.prisma.db.notification.findFirst({
        where: { bookingId, event, channel, audience, status: 'SENT' },
        select: { id: true },
      });
      return previo !== null;
    } catch (error) {
      /*
       * Si no se puede consultar, se ARRIESGA EL DUPLICADO y se envia. Para un
       * aviso al cliente es la eleccion menos mala: recibir dos veces la
       * confirmacion molesta, no recibirla deja a alguien que acaba de pagar
       * sin nada por escrito.
       */
      this.logger.error(
        `No se pudo comprobar si ${event}/${channel} ya salio: ${describeFailure(error)}`,
      );
      return false;
    }
  }

  /**
   * Un proveedor mal implementado podria lanzar pese al contrato. Esto lo
   * convierte en un resultado, porque el compromiso de "no lanzar nunca" es
   * de esta clase y no puede depender de que todos los adaptadores se porten.
   */
  private async enviarSinLanzar(envio: () => Promise<DeliveryResult>): Promise<DeliveryResult> {
    try {
      return await envio();
    } catch (error) {
      return { ok: false, providerMessageId: null, failureReason: describeFailure(error) };
    }
  }

  /**
   * Anota el intento.
   *
   * Un choque con el indice unico significa que ese aviso YA se envio: es el
   * reenvio de un webhook haciendo su trabajo. Se traga sin ruido, porque no
   * es un error sino exactamente lo que la restriccion existe para provocar.
   */
  private async registrar(entrada: {
    bookingId: string;
    event: NotificationEvent;
    channel: NotificationChannel;
    audience: NotificationAudience;
    status: 'SENT' | 'FAILED' | 'SKIPPED';
    target: string | null;
    failureReason: string | null;
    providerMessageId: string | null;
    /**
     * Cuantos envios van y cuando toca el siguiente.
     *
     * Solo lo pone el correo al cliente: es el unico aviso que se reintenta,
     * porque es el unico con alguien esperando que no seamos nosotros.
     */
    attempts?: number;
    nextAttemptAt?: Date | null;
  }): Promise<void> {
    try {
      await this.prisma.db.notification.create({ data: entrada });
    } catch (error) {
      if (esClaveDuplicada(error)) {
        this.logger.log(
          `Aviso ${entrada.event}/${entrada.channel} ya enviado para ${entrada.bookingId}: no se repite`,
        );
        return;
      }

      // No poder anotar el envio no justifica romper nada: el aviso ya salio.
      this.logger.error(`No se pudo registrar el aviso: ${describeFailure(error)}`);
    }
  }

  private async cargar(bookingId: string): Promise<ReservaParaAviso | null> {
    return this.prisma.db.booking.findUnique({
      where: { id: bookingId },
      select: {
        reference: true,
        // Para el aviso al equipo: que clase de limpieza es.
        service: true,
        scheduledStart: true,
        timezone: true,
        depositCents: true,
        balanceDueCents: true,
        totalCents: true,
        currency: true,
        customer: { select: { email: true, firstName: true, lastName: true, locale: true } },
        // Calle y ciudad, NUNCA las instrucciones de acceso: no se reenvian
        // por correo codigos de puerta. Ver la nota de las plantillas.
        address: { select: { line1: true, city: true, state: true } },
      },
    });
  }
}

/** Violacion de restriccion unica en PostgreSQL, vista a traves de Prisma. */
function esClaveDuplicada(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}
