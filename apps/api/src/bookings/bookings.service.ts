import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { DateTime } from 'luxon';
import { calculateQuote, type PricingConfig } from '@freshness/pricing';
import {
  API_ERROR_CODES,
  type BookingRequest,
  type BookingResponse,
  type PaymentIntent,
  type QuoteResponse,
} from '@freshness/types';
import type { Env } from '../common/config/env';
import { buildPricingConfig } from '../common/pricing-config';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { DistanceService } from '../distance/distance.service';
import { PaymentsService } from '../payments/payments.service';
import { AvailabilityService } from '../scheduling/availability.service';
import { isSlotStillAvailable } from '../scheduling/slots';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);
  private readonly pricingConfig: PricingConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly distance: DistanceService,
    private readonly availability: AvailabilityService,
    private readonly payments: PaymentsService,
    config: ConfigService<Env, true>,
  ) {
    this.pricingConfig = buildPricingConfig(config);
  }

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
  async create(request: BookingRequest, now: Date = new Date()): Promise<BookingResponse> {
    const durationMinutes = this.availability.durationFor(request);
    const startsAt = new Date(request.startsAt);
    const schedulingConfig = this.availability.config;

    const localDate = DateTime.fromJSDate(startsAt)
      .setZone(schedulingConfig.timezone)
      .toFormat('yyyy-MM-dd');
    this.availability.assertDateInRange(localDate, now);

    // --- Precio y distancia, siempre en el servidor -------------------------
    const quote = await this.buildQuote(request, now);

    if (quote.totals.totalCents === 0) {
      // Fuera del area de servicio o pendiente de propuesta manual.
      throw new BadRequestException({
        code: API_ERROR_CODES.OUT_OF_SERVICE_AREA,
        messageKey: quote.manualReview.reasonKeys[0] ?? 'booking.errorNotBookable',
      });
    }

    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
    const holdExpiresAt = new Date(now.getTime() + schedulingConfig.paymentHoldMinutes * 60_000);

    let booking: Omit<BookingResponse, 'payment'>;
    try {
      booking = await this.persist({
        request,
        quote,
        startsAt,
        endsAt,
        durationMinutes,
        now,
        holdExpiresAt,
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

    return { ...booking, payment: await this.holdDeposit(booking, request) };
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
      { quoteId: randomUUID(), now, distance, config: this.pricingConfig },
    );
  }

  private async persist(args: {
    request: BookingRequest;
    quote: QuoteResponse;
    startsAt: Date;
    endsAt: Date;
    durationMinutes: number;
    now: Date;
    holdExpiresAt: Date;
  }): Promise<Omit<BookingResponse, 'payment'>> {
    const { request, quote, startsAt, endsAt, durationMinutes, now, holdExpiresAt } = args;

    /*
     * Con la tarifa actual el deposito minimo son 30 dolares, asi que siempre
     * hay algo que retener. Si alguna vez se configura un deposito de cero,
     * pedir una tarjeta para retener nada seria un obstaculo sin sentido: la
     * reserva queda confirmada directamente.
     */
    const requierePago = quote.deposit.amountCents > 0;

    const localDate = DateTime.fromJSDate(startsAt)
      .setZone(this.availability.config.timezone)
      .toFormat('yyyy-MM-dd');

    return this.prisma.db.$transaction(async (tx) => {
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
      const libre = isSlotStillAvailable(startsAt, {
        durationMinutes,
        now,
        occupied,
        config: this.availability.config,
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

      // --- Cotizacion que origina la reserva -------------------------------
      const savedQuote = await tx.quote.create({
        data: {
          customerId: customer.id,
          source: 'WEB',
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
          pricingVersion: this.pricingConfig.version,
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
          timezone: this.availability.config.timezone,
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
          pricingVersion: this.pricingConfig.version,
          customerNotes: request.customerNotes ?? null,
        },
      });

      // Se registra la referencia y la zona, nunca el nombre ni la direccion.
      this.logger.log(`Reserva ${booking.reference} creada en zona ${quote.distance.zone}`);

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
    });
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
