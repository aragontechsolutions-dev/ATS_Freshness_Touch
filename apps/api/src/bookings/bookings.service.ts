import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { calculateQuote } from '@freshness/pricing';
import { ConsentReceiptService } from '../notifications/consent-receipt.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StaffNotificationsService } from '../staff-notifications/staff-notifications.service';
import { crearTestigoDeRetirada } from '../settings/removal-token';
import {
  API_ERROR_CODES,
  CONSENT_ADDRESS_MAX,
  CONSENT_NAME_MAX,
  MediaConsentSchema,
  consentFromBooking,
  AGREED_PRICE_LINE_CODE,
  type AdminBookingOverrides,
  type AuthenticatedStaff,
  type MediaConsent,
  type BookingRequest,
  type BookingResponse,
  type PaymentIntent,
  type QuoteResponse,
} from '@freshness/types';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { DistanceService } from '../distance/distance.service';
import { PaymentsService } from '../payments/payments.service';
import { PricingConfigService } from '../settings/pricing-config.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { AuditService } from '../audit/audit.service';
import { AvailabilityService } from '../scheduling/availability.service';
import type { SchedulingConfig } from '../scheduling/scheduling.config';
import { equiposOcupadosEn, isSlotStillAvailable } from '../scheduling/slots';

/**
 * LO QUE ANADE UNA RESERVA HECHA DESDE EL PANEL.
 *
 * Nulo —el caso normal— significa que la reserva viene del sitio publico y
 * que no se salta nada. Que sea un parametro y no un servicio aparte es
 * deliberado: duplicar el camino de creacion seria duplicar el calculo del
 * precio, el bloqueo del dia, la reutilizacion del cliente y el rastro de
 * auditoria, y el dia que uno de los dos cambie, el otro no.
 */
export interface OpcionesDeAdministracion {
  /** Quien la crea. Va a la auditoria; sin esto no hay a quien preguntar. */
  staff: AuthenticatedStaff;
  overrides: AdminBookingOverrides;
}

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly distance: DistanceService,
    private readonly availability: AvailabilityService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    /*
     * La configuracion se pide EN CADA RESERVA, no una vez al arrancar: el
     * area de servicio se edita desde el panel. Ver `PricingConfigService`.
     */
    private readonly pricing: PricingConfigService,
    /*
     * Para convertir la direccion en un punto del mapa. Se usa FUERA de la
     * transaccion y sin esperarla: ver el final de `create`.
     */
    private readonly geocoding: GeocodingService,
    /**
     * Para mandarle al cliente constancia de lo que autorizo y el enlace que
     * lo retira. Se usa FUERA de la transaccion: ver el final de `create`.
     */
    private readonly constancia: ConsentReceiptService,
    /**
     * Para avisar de una reserva creada desde el panel. La del sitio publico
     * NO avisa desde aqui: nace pendiente de pago y quien avisa es el webhook
     * cuando el deposito queda retenido, que es cuando hay algo que contar.
     */
    private readonly notifications: NotificationsService,
    private readonly bandeja: StaffNotificationsService,
  ) {}

  /**
   * Crea una reserva a partir del formulario publico.
   *
   * Reglas que se respetan aqui:
   *
   * 1. EL PRECIO SE RECALCULA EN EL SERVIDOR. No se acepta ningun importe que
   *    venga del navegador: lo que llega son las caracteristicas del trabajo,
   *    y el precio sale del motor. Confiar en el cliente seria regalar dinero.
   *
   * 2. LA DISTANCIA SE RECALCULA CON LA DIRECCION COMPLETA. El cotizador solo
   *    conocia el codigo postal; ahora hay calle, asi que el deposito se
   *    ajusta a la distancia real y puede diferir de lo que vio el visitante.
   *
   * 3. LA FRANJA SE VUELVE A COMPROBAR. Entre que el cliente ve los huecos y
   *    pulsa "reservar" pueden pasar minutos y otra persona ocuparlo.
   *
   * 4. LA RESERVA NACE PENDIENTE DE PAGO. Solo queda en firme cuando el
   *    proveedor confirma que el deposito quedo retenido, y eso llega por
   *    webhook: el navegador no puede confirmarlo por si mismo porque podria
   *    cerrarse a mitad, o mentir.
   */
  async create(
    request: BookingRequest,
    now: Date = new Date(),
    ip: string | null = null,
    /** Presente solo cuando la crea el panel. Ver `OpcionesDeAdministracion`. */
    admin: OpcionesDeAdministracion | null = null,
  ): Promise<BookingResponse> {
    const durationMinutes = this.availability.durationFor(request);
    const startsAt = new Date(request.startsAt);
    const schedulingConfig = await this.availability.schedulingConfig();

    const localDate = DateTime.fromJSDate(startsAt)
      .setZone(schedulingConfig.timezone)
      .toFormat('yyyy-MM-dd');
    this.availability.assertDateInRange(localDate, now);

    // --- Precio y distancia, siempre en el servidor -------------------------
    const quote = await this.buildQuote(request, now);

    /*
     * TOTAL CERO = fuera del area de servicio o pendiente de propuesta
     * manual. Para el sitio publico es un muro, y debe serlo.
     *
     * Desde el panel NO, siempre que se escriba un precio: hay clientas de
     * siempre que viven mas lejos de lo que el cotizador atiende solo, y
     * negarse a agendarlas porque el motor no sabe ponerles precio seria
     * dejar fuera del sistema justo los trabajos que mas cuesta recordar.
     */
    const precioPactado = admin?.overrides.priceOverrideCents ?? null;

    if (quote.totals.totalCents === 0 && precioPactado === null) {
      throw new BadRequestException({
        code: API_ERROR_CODES.OUT_OF_SERVICE_AREA,
        messageKey: quote.manualReview.reasonKeys[0] ?? 'booking.errorNotBookable',
      });
    }

    const quoteFinal = admin ? ajustarParaElPanel(quote, precioPactado) : quote;

    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
    const holdExpiresAt = new Date(now.getTime() + schedulingConfig.paymentHoldMinutes * 60_000);

    let booking: Omit<BookingResponse, 'payment'>;
    try {
      booking = await this.persist({
        request,
        quote: quoteFinal,
        admin,
        startsAt,
        endsAt,
        durationMinutes,
        now,
        holdExpiresAt,
        ip,
        schedulingConfig,
      });
    } catch (error) {
      /*
       * El indice unico parcial (cliente + hora, salvo canceladas) protege
       * contra el doble envio del formulario: doble clic, reintento del
       * navegador o pulsar "atras" y reenviar.
       *
       * Sin esta traduccion el cliente veria un error interno por hacer doble
       * clic, que es un fallo nuestro, no suyo.
       */
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: API_ERROR_CODES.DUPLICATE_BOOKING,
          messageKey: 'booking.errorAlreadyBooked',
        });
      }
      throw error;
    }

    if (admin) await this.avisarDeLaReservaManual(booking, admin);

    return { ...booking, payment: await this.holdDeposit(booking, request) };
  }

  /**
   * AVISA DE UNA RESERVA QUE NACIO YA CONFIRMADA.
   *
   * La del sitio publico no pasa por aqui: nace pendiente de pago y quien
   * avisa es el webhook cuando el deposito queda retenido. Esta no tiene
   * webhook que la confirme —no hay pago— asi que el aviso sale aqui o no
   * sale.
   *
   * FUERA DE LA TRANSACCION y sin tumbar nada si falla: la cita ya esta
   * guardada, y perderla porque un servidor de correo no responde seria
   * exactamente lo que no debe pasar.
   */
  private async avisarDeLaReservaManual(
    booking: Omit<BookingResponse, 'payment'>,
    admin: OpcionesDeAdministracion,
  ): Promise<void> {
    /*
     * AL CLIENTE, SALVO QUE SE DIGA QUE NO. Una clienta que acaba de colgar
     * el telefono ya sabe que viene el martes; pero el caso normal es que
     * tener la cita por escrito evita la mitad de las llamadas despues.
     */
    if (admin.overrides.notifyCustomer) {
      try {
        await this.notifications.bookingConfirmed(booking.bookingId);
      } catch (error) {
        this.logger.error(
          `No se pudo avisar de la reserva manual ${booking.reference}: ` +
            (error instanceof Error ? error.message : 'error desconocido'),
        );
      }
    }

    /*
     * Y A LA BANDEJA DE COORDINACION, siempre: una reserva confirmada sigue
     * siendo una reserva sin equipo asignado, la haya metido quien la haya
     * metido. `emitir` se traga sus propios fallos.
     */
    await this.bandeja.emitir({
      kind: 'booking.confirmed',
      entityType: 'booking',
      entityId: booking.bookingId,
      params: { reference: booking.reference },
    });
  }

  /**
   * Retiene el deposito, ya con la reserva guardada.
   *
   * Se hace FUERA de la transaccion a proposito: una llamada de red dentro de
   * ella mantendria bloqueada la agenda del dia mientras se espera a un
   * servidor ajeno.
   *
   * Si el proveedor falla, la reserva NO se pierde: se devuelve con
   * `payment: null` y queda pendiente de que alguien la gestione. Perder una
   * reserva ya aceptada seria peor que tener que pedir la tarjeta despues.
   */
  private async holdDeposit(
    booking: Omit<BookingResponse, 'payment'>,
    request: BookingRequest,
  ): Promise<PaymentIntent | null> {
    if (booking.nextStep !== 'PAYMENT') return null;

    try {
      return await this.payments.createDepositHold({
        bookingId: booking.bookingId,
        bookingReference: booking.reference,
        amountCents: booking.deposit.amountCents,
        customerEmail: request.contact.email,
        customerName: `${request.contact.firstName} ${request.contact.lastName}`,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo retener el deposito de la reserva ${booking.reference}: ` +
          (error instanceof Error ? error.message : 'error desconocido'),
      );
      return null;
    }
  }

  /**
   * Deja anotado el permiso de imagen que el cliente dio al reservar.
   *
   * ========================================================================
   * UN FALLO AQUI NO PUEDE TUMBAR LA RESERVA
   * ========================================================================
   * Los campos del permiso son mas cortos que los de una reserva: un nombre
   * compuesto largo o una direccion con dos lineas pueden no caber. Se
   * recortan, y aun asi, si algo no encajara, se registra un ERROR con la
   * referencia y la reserva sigue adelante.
   *
   * Es deliberado y va en esta direccion y no en la otra: la reserva es el
   * dinero del cliente y no se pierde por un permiso que se puede volver a
   * anotar a mano desde el panel. Al reves —dejar pasar la reserva en
   * silencio sin el permiso que si marco— seria perder la unica senal de que
   * hay que anotarlo, y por eso el fallo se registra como error y no como
   * aviso.
   */
  private async anotarPermisoDeImagen(
    tx: Prisma.TransactionClient,
    datos: {
      request: BookingRequest;
      reference: string;
      serviceDate: string;
      signedAt: string;
      ip: string | null;
    },
  ): Promise<{ consent: MediaConsent; token: string | null } | null> {
    const { contact, address } = datos.request;

    const permiso = MediaConsentSchema.safeParse(
      consentFromBooking({
        marcado: datos.request.mediaConsent,
        reference: datos.reference,
        customerName: recortar(`${contact.firstName} ${contact.lastName}`, CONSENT_NAME_MAX),
        customerEmail: contact.email,
        customerLocale: contact.locale,
        /*
         * La direccion aqui sirve para VOLVER A ENCONTRAR la casa cuando un
         * cliente pida retirar sus fotos, no para mandarle nada: la postal
         * completa, con su segunda linea, ya esta en la reserva, que es su
         * sitio. Por eso cabe recortarla sin perder nada util.
         */
        propertyAddress: recortar(
          `${address.line1}, ${address.city}, ${address.state} ${address.postalCode}`,
          CONSENT_ADDRESS_MAX,
        ),
        serviceDate: datos.serviceDate,
        signedAt: datos.signedAt,
      }),
    );

    if (!permiso.success) {
      this.logger.error(
        `La reserva ${datos.reference} marco el permiso de imagen y no se pudo anotar: ` +
          `${permiso.error.issues[0]?.message ?? 'contrato invalido'}. Hay que anotarlo a mano.`,
      );
      return null;
    }

    /*
     * EL TESTIGO CON EL QUE EL CLIENTE RETIRARA SUS FOTOS. Se fabrica aqui,
     * de el solo queda el resumen en la fila, y el valor en claro sale por
     * la devolucion para entrar en el correo de constancia y olvidarse.
     */
    const testigo = crearTestigoDeRetirada();

    const fila = await tx.mediaConsent.create({
      data: {
        removalTokenHash: testigo.hash,
        reference: permiso.data.reference,
        evidenceKind: permiso.data.evidenceKind,
        customerName: permiso.data.customerName,
        customerEmail: permiso.data.customerEmail,
        customerLocale: permiso.data.customerLocale,
        propertyAddress: permiso.data.propertyAddress,
        occupiedByOthers: permiso.data.occupiedByOthers,
        occupantConsent: permiso.data.occupantConsent,
        serviceDate: new Date(`${permiso.data.serviceDate}T00:00:00Z`),
        signedAt: new Date(`${permiso.data.signedAt}T00:00:00Z`),
        coversInterior: permiso.data.coversInterior,
        coversExterior: permiso.data.coversExterior,
        allowsBefore: permiso.data.allowsBefore,
        channels: permiso.data.channels,
        removalDays: permiso.data.removalDays,
        videoIds: permiso.data.videoIds,
        photoPaths: permiso.data.photoPaths,
        notes: permiso.data.notes,
      },
    });

    /*
     * NI EL NOMBRE NI LA DIRECCION, igual que en el resto del registro: lo
     * que se guarda aqui se consulta, se exporta y se ensena.
     */
    await this.audit.record(
      {
        staff: null,
        actorType: 'CUSTOMER',
        surface: 'SITE',
        action: 'media_consent.created',
        entityType: 'media_consent',
        entityId: fila.id,
        metadata: {
          reference: permiso.data.reference,
          evidenceKind: permiso.data.evidenceKind,
          videos: 0,
          photos: 0,
          allowsBefore: permiso.data.allowsBefore,
        },
        ipAddress: datos.ip,
      },
      tx,
    );

    return { consent: permiso.data, token: testigo.token };
  }

  /** Recalcula el presupuesto con la direccion completa. */
  private async buildQuote(request: BookingRequest, now: Date): Promise<QuoteResponse> {
    const distance = await this.distance.resolve(
      request.address.postalCode,
      request.address.state,
      { line1: request.address.line1, city: request.address.city },
    );

    return calculateQuote(
      {
        service: request.service,
        frequency: request.frequency,
        bedrooms: request.bedrooms,
        bathrooms: request.bathrooms,
        squareFeet: request.squareFeet,
        addOns: request.addOns,
        destination: {
          postalCode: request.address.postalCode,
          city: request.address.city,
          state: request.address.state,
        },
        locale: request.contact.locale,
      },
      { quoteId: randomUUID(), now, distance, config: await this.pricing.current() },
    );
  }

  private async persist(args: {
    request: BookingRequest;
    quote: QuoteResponse;
    /** Nulo cuando la reserva viene del sitio publico, que es lo normal. */
    admin: OpcionesDeAdministracion | null;
    startsAt: Date;
    endsAt: Date;
    durationMinutes: number;
    now: Date;
    holdExpiresAt: Date;
    /** Para el registro de auditoria. Ver la llamada al final de la transaccion. */
    ip: string | null;
    /**
     * Las reglas de agenda YA RESUELTAS, con el horario vigente.
     *
     * Se pasan en vez de volver a leerlas aqui para que la comprobacion final
     * de la franja use exactamente el mismo horario que la primera. Si se
     * leyeran otra vez, un cambio de horario hecho en ese instante podria
     * tumbar una reserva que acababa de darse por buena.
     */
    schedulingConfig: SchedulingConfig;
  }): Promise<Omit<BookingResponse, 'payment'>> {
    const { request, quote, startsAt, endsAt, durationMinutes, now, holdExpiresAt, ip } = args;
    const { schedulingConfig, admin } = args;

    /*
     * La version de tarifas QUEDA CONGELADA con la reserva: es lo que permite
     * reconstruir meses despues con que precios se calculo. Se lee de la
     * configuracion vigente, la misma con la que se acaba de cotizar.
     */
    const { version } = await this.pricing.current();

    /*
     * Con la tarifa actual el deposito minimo son 30 dolares, asi que siempre
     * hay algo que retener. Si alguna vez se configura un deposito de cero,
     * pedir una tarjeta para retener nada seria un obstaculo sin sentido: la
     * reserva queda confirmada directamente.
     */
    /*
     * UNA RESERVA DEL PANEL NO RETIENE NADA, y por eso nace CONFIRMED.
     *
     * La retencion existe para que un desconocido no bloquee la agenda y
     * desaparezca. La clienta que lleva dos anos llamando no es ese riesgo, y
     * pedirle la tarjeta por telefono para retener 35 dolares que se le van a
     * descontar igual es poner un obstaculo donde no hay problema. Paga como
     * siempre el dia del servicio.
     */
    const requierePago = admin === null && quote.deposit.amountCents > 0;

    const localDate = DateTime.fromJSDate(startsAt)
      .setZone(schedulingConfig.timezone)
      .toFormat('yyyy-MM-dd');

    /*
     * El identificador de la direccion, para geocodificarla DESPUES de que
     * la transaccion confirme. Ver el comentario del final de este metodo.
     */
    let direccionAGeocodificar: string | null = null;

    /*
     * La constancia del permiso de imagen, para mandarla DESPUES de que la
     * transaccion confirme. Un correo es una llamada de red, y dentro de la
     * transaccion mantendria bloqueada la agenda del dia mientras se espera
     * a un servidor ajeno — el mismo motivo por el que la retencion del
     * deposito tampoco va dentro.
     */
    let constanciaPorMandar: { consent: MediaConsent; token: string | null } | null = null;

    /*
     * El tipo se anota a mano porque, al guardar el resultado en una
     * variable en vez de devolverlo directamente, TypeScript ensancha
     * `status` de sus valores literales a `string` y deja de encajar con el
     * contrato. Anotarlo tambien hace que un campo mal puesto se vea aqui y
     * no tres capas mas arriba.
     */
    const respuesta: Omit<BookingResponse, 'payment'> = await this.prisma.db.$transaction(
      async (tx) => {
        /*
         * Bloqueo por dia durante toda la transaccion.
         *
         * Sin el, dos clientes que reservan a la vez pueden pasar los dos la
         * comprobacion de disponibilidad y quedarse con el mismo hueco: entre
         * consultar y escribir hay una ventana. El bloqueo serializa las
         * reservas del mismo dia, que son pocas, sin afectar al resto.
         */
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`booking:${localDate}`}))`;

        const occupied = await this.availability.findOccupied(localDate, now, tx);

        /*
         * DOS COMPROBACIONES DISTINTAS, NO UNA CON EXCEPCIONES.
         *
         * Para el sitio publico la hora tiene que ser una de las franjas que
         * se ofrecieron: dentro del horario, con la antelacion minima y en la
         * rejilla. Es lo unico que impide que alguien mande a mano las tres
         * de la madrugada.
         *
         * Desde el panel lo unico que importa de verdad es si hay equipo
         * libre, porque el resto son suposiciones sobre un desconocido que no
         * aplican a quien mira su propia agenda. Y aun eso avisa antes: la
         * primera peticion falla con el choque y solo la segunda, ya marcada,
         * lo pasa por alto.
         */
        const libre = admin
          ? admin.overrides.allowOverlap ||
            equiposOcupadosEn(startsAt, endsAt, occupied) < schedulingConfig.crews
          : isSlotStillAvailable(startsAt, {
              durationMinutes,
              now,
              occupied,
              config: schedulingConfig,
            });

        if (!libre) {
          throw new ConflictException({
            code: API_ERROR_CODES.SLOT_UNAVAILABLE,
            messageKey: 'booking.errorSlotTaken',
          });
        }

        // --- Cliente: se reutiliza si ya existe ese correo -------------------
        const customer = await tx.customer.upsert({
          where: { email: request.contact.email },
          create: {
            email: request.contact.email,
            firstName: request.contact.firstName,
            lastName: request.contact.lastName,
            phone: request.contact.phone,
            locale: request.contact.locale,
            marketingOptIn: request.contact.marketingOptIn,
          },
          update: {
            firstName: request.contact.firstName,
            lastName: request.contact.lastName,
            phone: request.contact.phone,
            locale: request.contact.locale,
            // El consentimiento comercial solo se concede, nunca se revoca
            // silenciosamente por rellenar otro formulario.
            ...(request.contact.marketingOptIn ? { marketingOptIn: true } : {}),
          },
        });

        // --- Direccion: se reutiliza la misma calle del mismo cliente --------
        const existing = await tx.address.findFirst({
          where: {
            customerId: customer.id,
            line1: request.address.line1,
            postalCode: request.address.postalCode,
          },
        });

        const addressData = {
          line1: request.address.line1,
          line2: request.address.line2 ?? null,
          city: request.address.city,
          state: request.address.state,
          postalCode: request.address.postalCode,
          accessNotes: request.address.accessNotes ?? null,
          distanceMiles: quote.distance.miles,
          zone: quote.distance.zone,
          distanceProvider: quote.distance.provider,
          distanceComputedAt: now,
        };

        const address = existing
          ? await tx.address.update({ where: { id: existing.id }, data: addressData })
          : await tx.address.create({
              data: { ...addressData, customerId: customer.id, isPrimary: true },
            });

        direccionAGeocodificar = address.id;

        // --- Cotizacion que origina la reserva -------------------------------
        const savedQuote = await tx.quote.create({
          data: {
            customerId: customer.id,
            source: admin ? admin.overrides.source : 'WEB',
            locale: request.contact.locale,
            service: request.service,
            frequency: request.frequency,
            bedrooms: request.bedrooms,
            bathrooms: request.bathrooms,
            squareFeet: request.squareFeet,
            addOns: request.addOns,
            postalCode: request.address.postalCode,
            state: request.address.state,
            distanceMiles: quote.distance.miles,
            zone: quote.distance.zone,
            lines: quote.lines,
            serviceCents: quote.totals.serviceCents,
            addOnsCents: quote.totals.addOnsCents,
            surchargesCents: quote.totals.surchargesCents,
            discountCents: quote.totals.discountCents,
            taxCents: quote.totals.taxCents,
            totalCents: quote.totals.totalCents,
            depositCents: quote.deposit.amountCents,
            pricingVersion: version,
            manualReviewReasons: quote.manualReview.reasonKeys,
            expiresAt: new Date(quote.expiresAt),
          },
        });

        const reference = await this.nextReference(tx, now);

        const booking = await tx.booking.create({
          data: {
            reference,
            customerId: customer.id,
            addressId: address.id,
            quoteId: savedQuote.id,
            status: requierePago ? 'PENDING_PAYMENT' : 'CONFIRMED',
            service: request.service,
            frequency: request.frequency,
            bedrooms: request.bedrooms,
            bathrooms: request.bathrooms,
            squareFeet: request.squareFeet,
            addOns: request.addOns,
            scheduledStart: startsAt,
            scheduledEnd: endsAt,
            timezone: schedulingConfig.timezone,
            distanceMiles: quote.distance.miles,
            zone: quote.distance.zone,
            lines: quote.lines,
            serviceCents: quote.totals.serviceCents,
            addOnsCents: quote.totals.addOnsCents,
            surchargesCents: quote.totals.surchargesCents,
            discountCents: quote.totals.discountCents,
            taxCents: quote.totals.taxCents,
            totalCents: quote.totals.totalCents,
            depositCents: quote.deposit.amountCents,
            balanceDueCents: quote.balanceDueAtServiceCents,
            pricingVersion: version,
            customerNotes: request.customerNotes ?? null,
            /*
             * EL PIN DE LA PUERTA, si el cliente se molesto en marcarlo.
             *
             * Entra aqui y NO toca nada mas: no se mezcla con la cotizacion
             * —que ya esta hecha y calculada desde el codigo postal— ni con
             * la distancia ni con la zona. Si alguna vez tocara el precio,
             * el cliente podria arrastrarlo hacia Atlanta y cobrarse un
             * descuento (`packages/types/src/door-pin.ts`).
             */
            doorPinLatitude: request.doorPin?.latitude ?? null,
            doorPinLongitude: request.doorPin?.longitude ?? null,
          },
        });

        // Se registra la referencia y la zona, nunca el nombre ni la direccion.
        this.logger.log(`Reserva ${booking.reference} creada en zona ${quote.distance.zone}`);

        /*
         * RASTRO DE LA RESERVA, dentro de la misma transaccion: o queda la
         * reserva y su registro, o no queda ninguna de las dos.
         *
         * El actor es CUSTOMER y no hay identificador: quien reserva no tiene
         * ficha de personal. Lo que identifica la fila es la reserva en si.
         *
         * En la metadata va lo que sirve para investigar un patron raro —diez
         * reservas seguidas, todas canceladas— y NADA MAS. Ni nombre, ni
         * correo, ni telefono, ni direccion: todo eso ya esta en la reserva,
         * que es su sitio, y duplicarlo aqui solo multiplica por dos los
         * lugares donde hay datos personales que borrar el dia que un cliente
         * lo pida.
         */
        await this.audit.record(
          admin
            ? {
                /*
                 * LA DEL PANEL ES OTRA ACCION, no la misma con otro actor.
                 * Responde a una pregunta distinta —quien metio a mano este
                 * trabajo y por que se salto lo que se salto— y es la que se
                 * mira cuando una franja aparece doblada o un precio no
                 * cuadra con la tarifa.
                 */
                staff: admin.staff,
                surface: 'PANEL',
                action: 'booking.created_manually',
                entityType: 'booking',
                entityId: booking.id,
                metadata: {
                  reference: booking.reference,
                  service: request.service,
                  zone: quote.distance.zone,
                  totalCents: quote.totals.totalCents,
                  scheduledStart: startsAt.toISOString(),
                  source: admin.overrides.source,
                  /* Los saltos, uno a uno: es lo que hay que poder auditar. */
                  outsideHours: admin.overrides.allowOutsideHours,
                  overlapped: admin.overrides.allowOverlap,
                  agreedPrice: admin.overrides.priceOverrideCents !== null,
                  ...(admin.overrides.reason ? { reason: admin.overrides.reason } : {}),
                },
                ipAddress: ip,
              }
            : {
                staff: null,
                actorType: 'CUSTOMER',
                surface: 'SITE',
                action: 'booking.created',
                entityType: 'booking',
                entityId: booking.id,
                metadata: {
                  reference: booking.reference,
                  service: request.service,
                  zone: quote.distance.zone,
                  totalCents: quote.totals.totalCents,
                  scheduledStart: startsAt.toISOString(),
                },
                ipAddress: ip,
              },
          tx,
        );

        /*
         * EL PERMISO DE IMAGEN, si el cliente lo marco.
         *
         * DENTRO DE LA MISMA TRANSACCION: o queda la reserva con su permiso,
         * o no queda ninguna de las dos cosas. Un permiso anotado para una
         * reserva que no llego a existir seria un papel sin casa.
         *
         * NACE SIN PIEZAS, y por eso no hace falta invalidar la cache de la
         * galeria: la lista blanca que decide lo que se publica se construye
         * con los videos y las fotos que ampara cada ficha, y esta no ampara
         * ninguna todavia.
         *
         * SE ESCRIBE AQUI Y NO LLAMANDO AL SERVICIO DE PERMISOS porque aquel
         * registra al autor como PERSONAL del panel, y aqui quien da el
         * permiso es el cliente. Es el mismo motivo por el que la auditoria
         * de abajo dice CUSTOMER y SITE.
         */
        if (request.mediaConsent.granted) {
          constanciaPorMandar = await this.anotarPermisoDeImagen(tx, {
            request,
            reference: booking.reference,
            serviceDate: localDate,
            signedAt: DateTime.fromJSDate(now)
              .setZone(schedulingConfig.timezone)
              .toFormat('yyyy-MM-dd'),
            ip,
          });
        }

        return {
          bookingId: booking.id,
          reference: booking.reference,
          status: requierePago ? 'PENDING_PAYMENT' : 'CONFIRMED',
          scheduledStart: startsAt.toISOString(),
          scheduledEnd: endsAt.toISOString(),
          timezone: booking.timezone,
          durationMinutes,
          currency: 'USD',
          totals: quote.totals,
          deposit: quote.deposit,
          balanceDueAtServiceCents: quote.balanceDueAtServiceCents,
          nextStep: requierePago ? 'PAYMENT' : 'NONE',
          holdExpiresAt: requierePago ? holdExpiresAt.toISOString() : null,
        };
      },
    );

    /*
     * ========================================================================
     * LA GEOCODIFICACION VA AQUI: FUERA DE LA TRANSACCION Y SIN ESPERARLA
     * ========================================================================
     * Convertir la direccion en un punto del mapa hace falta para el fichaje
     * con ubicacion, pero NO para reservar. Por eso no entra en ninguna de
     * las dos cosas de las que depende una reserva:
     *
     *   - NO dentro de la transaccion. Una llamada de red dentro de una
     *     transaccion la mantiene abierta —con el bloqueo del dia tomado—
     *     durante segundos, y si el servicio tarda, bloquea las reservas del
     *     resto de clientes de ese dia.
     *
     *   - NO con `await`. Quien acaba de reservar no tiene por que esperar a
     *     un servicio del gobierno federal para ver su confirmacion.
     *
     * `void` es deliberado, no un olvido: se lanza y se sigue. El servicio
     * de geocodificacion no lanza nunca hacia arriba, asi que no puede dejar
     * una promesa rechazada sin capturar; y si falla, el barrido periodico
     * recoge la direccion mas tarde. Peor caso: esa casa tarda unos minutos
     * en tener coordenadas.
     */
    if (direccionAGeocodificar !== null) {
      void this.geocoding.resolveAndStore(direccionAGeocodificar);
    }

    /*
     * LA CONSTANCIA DEL PERMISO, tambien fuera de la transaccion y sin
     * esperarla. El servicio no lanza nunca hacia arriba: registra el fallo
     * y sigue. Lo que no puede pasar es que una reserva ya pagada se caiga
     * porque un servidor de correo ajeno tardo en responder.
     */
    if (constanciaPorMandar !== null) {
      const { consent, token } = constanciaPorMandar;
      void this.constancia.enviar(consent, token);
    }

    return respuesta;
  }

  /**
   * Referencia legible: FT-2026-0001.
   *
   * Sale de una secuencia de PostgreSQL y no de "contar reservas + 1", porque
   * contar es una condicion de carrera: dos reservas simultaneas obtendrian
   * el mismo numero.
   */
  private async nextReference(
    tx: { $queryRaw: <T>(query: TemplateStringsArray, ...values: unknown[]) => Promise<T> },
    now: Date,
  ): Promise<string> {
    const rows = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('booking_reference_seq')`;
    const numero = Number(rows[0]?.nextval ?? 0);
    return `FT-${now.getUTCFullYear()}-${String(numero).padStart(4, '0')}`;
  }
}

/**
 * Recorta un texto al tamano que admite el registro de permisos.
 *
 * SIN PUNTOS SUSPENSIVOS: lo que se guarda tiene que poder compararse con lo
 * que hay escrito en otro sitio, y tres puntos al final convierten una
 * comparacion exacta en una aproximada.
 */
function recortar(texto: string, max: number): string {
  return texto.length <= max ? texto : texto.slice(0, max).trimEnd();
}

/**
 * AJUSTA LA COTIZACION A LO QUE ES UNA RESERVA DEL PANEL.
 *
 * Dos cosas, y las dos dejan el desglose cuadrando:
 *
 * 1. EL DEPOSITO A CERO. No se retiene nada, asi que el dia del servicio
 *    queda por cobrar el total entero y no el total menos treinta y cinco.
 *    Si no se pusiera a cero, la factura diria que ya se adelanto un dinero
 *    que nadie adelanto.
 *
 * 2. EL PRECIO PACTADO, COMO UNA LINEA MAS. La diferencia con lo que dice el
 *    motor entra en el desglose como descuento o como recargo, en vez de
 *    sobrescribir el total a secas. Asi `lines` sigue sumando `totalCents`
 *    —que es lo que la factura y el correo dan por hecho— y ademas se ve de
 *    donde sale la diferencia, que es justo lo que alguien querra entender
 *    dentro de un ano.
 */
function ajustarParaElPanel(quote: QuoteResponse, precioPactado: number | null): QuoteResponse {
  const sinDeposito: QuoteResponse = {
    ...quote,
    deposit: { amountCents: 0, capped: false, appliedToTotal: true },
    balanceDueAtServiceCents: quote.totals.totalCents,
  };

  if (precioPactado === null) return sinDeposito;

  const diferencia = precioPactado - quote.totals.totalCents;

  if (diferencia === 0) return sinDeposito;

  const esDescuento = diferencia < 0;
  const magnitud = Math.abs(diferencia);

  return {
    ...sinDeposito,
    lines: [
      ...quote.lines,
      {
        code: AGREED_PRICE_LINE_CODE,
        kind: esDescuento ? 'DISCOUNT' : 'SURCHARGE',
        labelKey: 'quote.line.agreedPrice',
        quantity: 1,
        unitAmountCents: diferencia,
        amountCents: diferencia,
      },
    ],
    totals: {
      ...quote.totals,
      discountCents: quote.totals.discountCents + (esDescuento ? magnitud : 0),
      surchargesCents: quote.totals.surchargesCents + (esDescuento ? 0 : magnitud),
      totalCents: precioPactado,
    },
    balanceDueAtServiceCents: precioPactado,
  };
}
