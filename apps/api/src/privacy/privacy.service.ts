import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ANONYMIZED_NAME,
  ANONYMIZED_SURNAME,
  API_ERROR_CODES,
  PrivacyExportSchema,
  type AuthenticatedStaff,
  type PrivacyCorrection,
  type PrivacyErasure,
  type PrivacyErasureResult,
  type PrivacyExport,
  type PrivacySearchResult,
} from '@freshness/types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';

/** Un correo que no enruta a ninguna parte y que no choca con otro. */
function correoRetirado(customerId: string): string {
  return `retirado+${customerId}@invalid`;
}

/**
 * LOS DERECHOS QUE LA POLITICA PROMETE
 * ====================================
 * Copia, correccion y borrado. La politica dice que se responde en 30 dias y
 * hasta esta etapa no habia con que: ni pantalla, ni endpoint, ni proceso.
 *
 * ========================================================================
 * BORRAR ES ANONIMIZAR, Y LA POLITICA YA LO DECIA
 * ========================================================================
 * «Lo haremos salvo en lo que estemos obligados a conservar: registros
 * fiscales y contables, y lo necesario para una reclamacion abierta.»
 *
 * Una reserva sin cliente no significa nada y una contabilidad con huecos no
 * es una contabilidad. Se va LO QUE IDENTIFICA A LA PERSONA; se queda que el
 * 4 de marzo se limpio una casa de 1.600 pies cuadrados en el 30132 por 185
 * dolares. Que campos exactamente, en `ANONYMIZED_FIELDS`.
 *
 * ========================================================================
 * TODO LO DE AQUI SE AUDITA, INCLUIDA LA LECTURA
 * ========================================================================
 * Es lo contrario de la regla general —las lecturas no se auditan porque
 * llenarian el registro— y por el mismo motivo que la ficha de una reserva si
 * se audita: descargarse el expediente completo de una persona no es
 * consultar una pantalla. Si alguien lo hace, tiene que quedar escrito.
 */
@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Busca por correo.
   *
   * POR CORREO Y NO POR NOMBRE: una peticion de privacidad llega desde una
   * direccion, y es lo unico que identifica sin ambiguedad. Buscar por nombre
   * convertiria esta pantalla en un listado de clientes, que es justo lo que
   * no debe ser.
   */
  async buscar(email: string): Promise<PrivacySearchResult> {
    const limpio = email.trim().toLowerCase();

    /*
     * COINCIDENCIA EXACTA. Con una busqueda parcial, escribir «@gmail» sacaria
     * media cartera de clientes en una pantalla que exporta y borra.
     */
    const fila = await this.prisma.db.customer.findUnique({
      where: { email: limpio },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        locale: true,
        marketingOptIn: true,
        createdAt: true,
        _count: { select: { bookings: true } },
      },
    });

    if (!fila) return { customers: [] };

    return {
      customers: [
        {
          customerId: fila.id,
          firstName: fila.firstName,
          lastName: fila.lastName,
          email: fila.email,
          phone: fila.phone,
          locale: fila.locale,
          marketingOptIn: fila.marketingOptIn,
          createdAt: fila.createdAt.toISOString(),
          bookingCount: fila._count.bookings,
          anonymized: fila.email.endsWith('@invalid'),
        },
      ],
    };
  }

  /** La copia de todo lo que tenemos. Ver `PrivacyExportSchema`. */
  async exportar(
    customerId: string,
    staff: AuthenticatedStaff,
    ip: string | null,
  ): Promise<PrivacyExport> {
    const cliente = await this.prisma.db.customer.findUnique({
      where: { id: customerId },
      include: {
        addresses: true,
        bookings: {
          orderBy: { scheduledStart: 'asc' },
          include: { payments: { orderBy: { createdAt: 'asc' } }, notifications: true },
        },
      },
    });

    if (!cliente) throw this.noExiste();

    /*
     * LOS PERMISOS DE IMAGEN SE BUSCAN POR CORREO y no por relacion: la tabla
     * no cuelga del cliente, porque un permiso lo puede firmar quien vive en
     * la casa sin ser quien contrato. Ver `docs/38`.
     */
    const permisos = await this.prisma.db.mediaConsent.findMany({
      where: { customerEmail: cliente.email },
      orderBy: { signedAt: 'asc' },
    });

    const copia = PrivacyExportSchema.parse({
      generatedAt: new Date().toISOString(),
      customer: {
        firstName: cliente.firstName,
        lastName: cliente.lastName,
        email: cliente.email,
        phone: cliente.phone,
        locale: cliente.locale,
        marketingOptIn: cliente.marketingOptIn,
        createdAt: cliente.createdAt.toISOString(),
      },
      addresses: cliente.addresses.map((fila) => ({
        line1: fila.line1,
        line2: fila.line2,
        city: fila.city,
        state: fila.state,
        postalCode: fila.postalCode,
        accessNotes: fila.accessNotes,
      })),
      bookings: cliente.bookings.map((fila) => ({
        reference: fila.reference,
        status: fila.status,
        service: fila.service,
        scheduledStart: fila.scheduledStart.toISOString(),
        totalCents: fila.totalCents,
        customerNotes: fila.customerNotes,
        createdAt: fila.createdAt.toISOString(),
      })),
      payments: cliente.bookings.flatMap((reserva) =>
        reserva.payments.map((pago) => ({
          bookingReference: reserva.reference,
          kind: pago.kind,
          status: pago.status,
          cardBrand: pago.cardBrand,
          cardLast4: pago.cardLast4,
          amountAuthorizedCents: pago.amountAuthorizedCents,
          amountCapturedCents: pago.amountCapturedCents,
          amountRefundedCents: pago.amountRefundedCents,
          createdAt: pago.createdAt.toISOString(),
        })),
      ),
      messages: cliente.bookings.flatMap((reserva) =>
        reserva.notifications.map((aviso) => ({
          event: aviso.event,
          channel: aviso.channel,
          status: aviso.status,
          sentTo: aviso.target,
          createdAt: aviso.createdAt.toISOString(),
        })),
      ),
      mediaConsents: permisos.map((fila) => ({
        reference: fila.reference,
        signedAt: fila.signedAt.toISOString().slice(0, 10),
        serviceDate: fila.serviceDate.toISOString().slice(0, 10),
        coversInterior: fila.coversInterior,
        coversExterior: fila.coversExterior,
        allowsBefore: fila.allowsBefore,
        channels: fila.channels,
        revokedAt: fila.revokedAt?.toISOString() ?? null,
      })),
    });

    /*
     * SE AUDITA LA LECTURA, con el recuento y nunca con el contenido. Que
     * alguien se llevo el expediente de una persona es el hecho; que decia,
     * no se vuelve a escribir en otro sitio.
     */
    await this.audit.record({
      staff,
      surface: 'PANEL',
      action: 'customer.exported',
      entityType: 'customer',
      entityId: customerId,
      metadata: {
        bookings: copia.bookings.length,
        payments: copia.payments.length,
        mediaConsents: copia.mediaConsents.length,
      },
      ipAddress: ip,
    });

    return copia;
  }

  /** Corrige lo que la persona puede pedir que se corrija. */
  async corregir(
    customerId: string,
    cambio: PrivacyCorrection,
    staff: AuthenticatedStaff,
    ip: string | null,
  ): Promise<void> {
    const actual = await this.prisma.db.customer.findUnique({
      where: { id: customerId },
      select: { email: true },
    });

    if (!actual) throw this.noExiste();

    await this.prisma.db.$transaction(async (tx) => {
      await tx.customer.update({
        where: { id: customerId },
        data: {
          firstName: cambio.firstName,
          lastName: cambio.lastName,
          email: cambio.email,
          phone: cambio.phone,
          marketingOptIn: cambio.marketingOptIn,
        },
      });

      await this.audit.record(
        {
          staff,
          surface: 'PANEL',
          action: 'customer.updated',
          entityType: 'customer',
          entityId: customerId,
          /*
           * QUE CAMBIO EL CORREO, NO CUAL ERA NI CUAL ES. El registro de
           * auditoria no lleva datos personales: si los llevara, borrar a
           * una persona dejaria su correo escrito justo en la tabla que no
           * se borra.
           */
          metadata: { emailChanged: actual.email !== cambio.email, reason: cambio.reason },
          ipAddress: ip,
        },
        tx,
      );
    });
  }

  /**
   * El borrado: anonimiza.
   *
   * TODO EN UNA TRANSACCION. A medias es el peor resultado posible: el nombre
   * fuera de la ficha del cliente y dentro del permiso de imagen, o al reves.
   */
  async anonimizar(
    customerId: string,
    peticion: PrivacyErasure,
    staff: AuthenticatedStaff,
    ip: string | null,
  ): Promise<PrivacyErasureResult> {
    const cliente = await this.prisma.db.customer.findUnique({
      where: { id: customerId },
      select: { email: true },
    });

    if (!cliente) throw this.noExiste();

    /*
     * EL CORREO ESCRITO A MANO TIENE QUE COINCIDIR. Es irreversible y no hay
     * deshacer: un «¿seguro?» se pulsa dos veces seguidas sin leer, y el
     * error que hay que evitar es el de la fila de al lado.
     */
    if (cliente.email !== peticion.confirmEmail) {
      throw new ConflictException({
        code: API_ERROR_CODES.PRIVACY_CONFIRM_MISMATCH,
        messageKey: 'admin.privacy.errorConfirmMismatch',
      });
    }

    const ahora = new Date();

    const resultado = await this.prisma.db.$transaction(async (tx) => {
      const direcciones = await tx.address.updateMany({
        where: { customerId },
        data: {
          line1: '—',
          line2: null,
          accessNotes: null,
          /*
           * Las coordenadas se van con la calle: un punto en el mapa ES la
           * casa, con o sin el nombre de la via delante.
           */
          latitude: null,
          longitude: null,
          geocodeMatchedAddress: null,
        },
      });

      const reservas = await tx.booking.updateMany({
        where: { customerId },
        data: { customerNotes: null, doorPinLatitude: null, doorPinLongitude: null },
      });

      /*
       * LOS AVISOS: se borra A QUIEN se mandaron, no QUE se mando. Que el 4
       * de marzo salio una confirmacion es un hecho de la reserva; la
       * direccion a la que salio es de la persona.
       */
      const avisos = await tx.notification.updateMany({
        where: { booking: { customerId } },
        data: { target: null },
      });

      /*
       * LA COTIZACION SE DESATA DEL CLIENTE en vez de vaciarse: ya solo
       * guarda codigo postal y precios, que es exactamente lo que vale
       * conservar y lo que no identifica a nadie.
       */
      const cotizaciones = await tx.quote.updateMany({
        where: { customerId },
        data: { customerId: null },
      });

      /*
       * ====================================================================
       * LOS PERMISOS DE IMAGEN SE REVOCAN ANTES DE BORRAR EL NOMBRE
       * ====================================================================
       * Si solo se anonimizaran, las fotos seguirian publicadas y el permiso
       * que las ampara se quedaria sin nombre: lo peor de los dos mundos —se
       * sigue ensenando su casa y ya no se puede demostrar que lo autorizo—.
       *
       * Quien pide que se borren sus datos esta pidiendo tambien esto,
       * aunque no lo diga.
       */
      const vivos = await tx.mediaConsent.findMany({
        where: { customerEmail: cliente.email, revokedAt: null },
        select: { id: true },
      });

      if (vivos.length > 0) {
        await tx.mediaConsent.updateMany({
          where: { id: { in: vivos.map((fila) => fila.id) } },
          data: { revokedAt: ahora, removalTokenHash: null },
        });
      }

      const permisos = await tx.mediaConsent.updateMany({
        where: { customerEmail: cliente.email },
        data: {
          customerName: `${ANONYMIZED_NAME} ${ANONYMIZED_SURNAME}`,
          customerEmail: null,
          propertyAddress: '—',
          notes: null,
        },
      });

      await tx.customer.update({
        where: { id: customerId },
        data: {
          firstName: ANONYMIZED_NAME,
          lastName: ANONYMIZED_SURNAME,
          /*
           * El correo no se puede vaciar —es unico y obligatorio— asi que se
           * sustituye por uno que no enruta a ninguna parte y que no puede
           * chocar con el de otra persona.
           */
          email: correoRetirado(customerId),
          phone: '',
          marketingOptIn: false,
        },
      });

      await this.audit.record(
        {
          staff,
          surface: 'PANEL',
          action: 'customer.anonymized',
          entityType: 'customer',
          entityId: customerId,
          /* Cuantas filas se tocaron. Ni el correo ni el nombre que habia. */
          metadata: {
            addresses: direcciones.count,
            bookings: reservas.count,
            quotes: cotizaciones.count,
            notifications: avisos.count,
            mediaConsents: permisos.count,
            mediaRevoked: vivos.length,
            reason: peticion.reason,
          },
          ipAddress: ip,
        },
        tx,
      );

      return {
        addresses: direcciones.count,
        bookings: reservas.count,
        quotes: cotizaciones.count,
        notifications: avisos.count,
        mediaConsents: permisos.count,
        mediaRevoked: vivos.length,
      };
    });

    // La referencia no: aqui ya no hay nada que referenciar sin identificar.
    this.logger.log(`Cliente anonimizado: ${String(resultado.bookings)} reservas conservadas`);

    return resultado;
  }

  private noExiste(): NotFoundException {
    return new NotFoundException({
      code: API_ERROR_CODES.NOT_FOUND,
      messageKey: 'admin.privacy.errorNotFound',
    });
  }
}
