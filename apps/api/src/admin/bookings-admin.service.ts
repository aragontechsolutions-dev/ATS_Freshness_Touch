import { Injectable, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  API_ERROR_CODES,
  type AdminBookingDetail,
  type AdminBookingList,
  type AdminBookingListItem,
  type AdminBookingQuery,
} from '@freshness/types';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { defaultSchedulingConfig } from '../scheduling/scheduling.config';

/** Lo que el listado necesita de cada reserva, y nada mas. */
const LIST_SELECT = {
  id: true,
  reference: true,
  status: true,
  scheduledStart: true,
  scheduledEnd: true,
  timezone: true,
  service: true,
  frequency: true,
  zone: true,
  totalCents: true,
  depositCents: true,
  balanceDueCents: true,
  createdAt: true,
  customer: { select: { firstName: true, lastName: true } },
  address: { select: { city: true, postalCode: true } },
  assignments: { select: { staff: { select: { id: true, firstName: true, lastName: true } } } },
  payments: {
    where: { kind: 'DEPOSIT_HOLD' as const },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
    select: { status: true },
  },
} satisfies Prisma.BookingSelect;

@Injectable()
export class BookingsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Listado de reservas para la agenda del panel.
   *
   * DOS DECISIONES DE PRIVACIDAD:
   *
   * 1. No devuelve la calle ni las instrucciones de acceso. Un listado se
   *    puede exportar entero de un tiron; los codigos de puerta de todos los
   *    clientes no deben caber en una sola peticion.
   *
   * 2. La paginacion tiene tope duro. Sin el, `limit=999999` descargaria la
   *    base de clientes completa.
   */
  async list(query: AdminBookingQuery): Promise<AdminBookingList> {
    const where = this.buildWhere(query);

    const filas = await this.prisma.db.booking.findMany({
      where,
      select: LIST_SELECT,
      orderBy: [{ scheduledStart: 'asc' }, { id: 'asc' }],
      // Se pide uno de mas para saber si hay pagina siguiente sin tener que
      // contar el total, que en una tabla grande es una consulta cara.
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hayMas = filas.length > query.limit;
    const items = (hayMas ? filas.slice(0, query.limit) : filas).map(toListItem);

    return { items, nextCursor: hayMas ? (items.at(-1)?.bookingId ?? null) : null };
  }

  /** Detalle completo, con la direccion y las instrucciones de acceso. */
  async detail(bookingId: string): Promise<AdminBookingDetail> {
    const booking = await this.prisma.db.booking.findUnique({
      where: { id: bookingId },
      select: {
        ...LIST_SELECT,
        bedrooms: true,
        bathrooms: true,
        squareFeet: true,
        addOns: true,
        distanceMiles: true,
        lines: true,
        serviceCents: true,
        addOnsCents: true,
        surchargesCents: true,
        discountCents: true,
        taxCents: true,
        pricingVersion: true,
        customerNotes: true,
        cancelledAt: true,
        cancelledBy: true,
        cancellationReason: true,
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            locale: true,
          },
        },
        address: {
          select: {
            line1: true,
            line2: true,
            city: true,
            state: true,
            postalCode: true,
            accessNotes: true,
          },
        },
        payments: {
          where: { kind: 'DEPOSIT_HOLD' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            provider: true,
            status: true,
            amountAuthorizedCents: true,
            amountCapturedCents: true,
            amountRefundedCents: true,
            cardBrand: true,
            cardLast4: true,
            authorizedAt: true,
            capturedAt: true,
            expiresAt: true,
            // Ni providerPaymentIntentId ni nada parecido: son credenciales,
            // no informacion, y no pintan nada en una pantalla.
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        messageKey: 'admin.errorBookingNotFound',
      });
    }

    const pago = booking.payments[0] ?? null;
    const duracion = Math.round(
      (booking.scheduledEnd.getTime() - booking.scheduledStart.getTime()) / 60_000,
    );

    return {
      ...toListItem(booking),
      bedrooms: booking.bedrooms,
      bathrooms: booking.bathrooms,
      squareFeet: booking.squareFeet,
      addOns: booking.addOns as { code: string; quantity: number }[],
      durationMinutes: duracion,
      distanceMiles: booking.distanceMiles,
      customer: {
        customerId: booking.customer.id,
        firstName: booking.customer.firstName,
        lastName: booking.customer.lastName,
        email: booking.customer.email,
        phone: booking.customer.phone,
        locale: booking.customer.locale,
      },
      address: {
        line1: booking.address.line1,
        line2: booking.address.line2,
        city: booking.address.city,
        state: booking.address.state,
        postalCode: booking.address.postalCode,
        accessNotes: booking.address.accessNotes,
      },
      lines: booking.lines as AdminBookingDetail['lines'],
      serviceCents: booking.serviceCents,
      addOnsCents: booking.addOnsCents,
      surchargesCents: booking.surchargesCents,
      discountCents: booking.discountCents,
      taxCents: booking.taxCents,
      pricingVersion: booking.pricingVersion,
      customerNotes: booking.customerNotes,
      payment: pago
        ? {
            paymentId: pago.id,
            provider: pago.provider,
            status: pago.status,
            amountAuthorizedCents: pago.amountAuthorizedCents,
            amountCapturedCents: pago.amountCapturedCents,
            amountRefundedCents: pago.amountRefundedCents,
            cardBrand: pago.cardBrand,
            cardLast4: pago.cardLast4,
            authorizedAt: pago.authorizedAt?.toISOString() ?? null,
            capturedAt: pago.capturedAt?.toISOString() ?? null,
            expiresAt: pago.expiresAt?.toISOString() ?? null,
          }
        : null,
      cancelledAt: booking.cancelledAt?.toISOString() ?? null,
      cancelledBy: booking.cancelledBy,
      cancellationReason: booking.cancellationReason,
    };
  }

  /**
   * Traduce los filtros a una consulta.
   *
   * Las fechas llegan como dia local de la empresa y se convierten a un
   * intervalo en UTC: filtrar por el dia UTC mostraria las citas de la noche
   * en el dia equivocado, y en el cambio de hora fallaria ademas por una hora.
   */
  private buildWhere(query: AdminBookingQuery): Prisma.BookingWhereInput {
    const zona = defaultSchedulingConfig.timezone;
    const where: Prisma.BookingWhereInput = {};

    const desde = query.date ?? query.from;
    const hasta = query.date ?? query.to;

    if (desde || hasta) {
      where.scheduledStart = {
        ...(desde
          ? { gte: DateTime.fromISO(desde, { zone: zona }).startOf('day').toJSDate() }
          : {}),
        ...(hasta ? { lte: DateTime.fromISO(hasta, { zone: zona }).endOf('day').toJSDate() } : {}),
      };
    }

    if (query.status) where.status = query.status;

    if (query.search) {
      const texto = query.search;
      where.OR = [
        { reference: { contains: texto, mode: 'insensitive' } },
        { customer: { email: { contains: texto, mode: 'insensitive' } } },
        { customer: { firstName: { contains: texto, mode: 'insensitive' } } },
        { customer: { lastName: { contains: texto, mode: 'insensitive' } } },
      ];
    }

    return where;
  }
}

type BookingRow = Prisma.BookingGetPayload<{ select: typeof LIST_SELECT }>;

function toListItem(booking: BookingRow): AdminBookingListItem {
  return {
    bookingId: booking.id,
    reference: booking.reference,
    status: booking.status,
    scheduledStart: booking.scheduledStart.toISOString(),
    scheduledEnd: booking.scheduledEnd.toISOString(),
    timezone: booking.timezone,
    service: booking.service,
    frequency: booking.frequency,
    zone: booking.zone,
    customerName: `${booking.customer.firstName} ${booking.customer.lastName}`,
    city: booking.address.city,
    postalCode: booking.address.postalCode,
    totalCents: booking.totalCents,
    depositCents: booking.depositCents,
    balanceDueCents: booking.balanceDueCents,
    paymentStatus: booking.payments[0]?.status ?? null,
    assignedStaff: booking.assignments.map((a) => ({
      staffId: a.staff.id,
      name: `${a.staff.firstName} ${a.staff.lastName}`,
    })),
    createdAt: booking.createdAt.toISOString(),
  };
}
