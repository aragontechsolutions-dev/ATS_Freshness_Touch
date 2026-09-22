import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  maskChatId,
  maskEmail,
  type NotificationAudience,
  type NotificationChannel,
  type NotificationEvent,
  type Locale,
  type NotificationSettings,
} from '@freshness/types';
import { PrismaService } from '../database/prisma.service';
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

  private async despachar(bookingId: string, event: NotificationEvent): Promise<void> {
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

  /** Confirmacion o cancelacion, al correo del cliente. */
  private async correoAlCliente(
    bookingId: string,
    event: NotificationEvent,
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
    event: NotificationEvent,
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
