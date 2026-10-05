import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import {
  API_ERROR_CODES,
  QuoteLineSchema,
  differsFromBooked,
  type AuthenticatedStaff,
  type FieldAdjustment,
  type FieldAdjustmentDecision,
  type FieldAdjustmentInput,
  type FieldAdjustmentValues,
  type QuoteAddOnInput,
  type QuoteLine,
  type QuoteResponse,
} from '@freshness/types';
import { calculateQuote } from '@freshness/pricing';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { PricingConfigService } from '../settings/pricing-config.service';
import {
  AJUSTE_SELECT,
  ExtrasGuardadosSchema,
  ajusteAContrato,
  type FilaAjuste,
} from './field-adjustment.helper';
import type { Prisma } from '../generated/prisma/client';

/**
 * AJUSTES DE CAMPO
 * ================
 * Lo que el equipo encuentra al llegar no siempre es lo que el cliente
 * reservó: una casa de «900 pies» que son 1.300, un «limpiar la nevera» que
 * son tres neveras.
 *
 * ========================================================================
 * EL LIDER PROPONE. LA RESERVA NO SE TOCA HASTA QUE COORDINACION APRUEBA.
 * ========================================================================
 * Este servicio es el PRIMER sitio del sistema capaz de mover un precio ya
 * pactado, y por eso lo hace en dos tiempos. El porqué completo está en
 * `docs/28-ajustes-de-campo.md`; el resumen es que un cero de más tecleado de
 * pie en una puerta no puede convertirse en la factura de un cliente con el
 * que nadie ha hablado.
 */

/** Lo que hace falta leer de la reserva para proponer o aprobar. */
const RESERVA_SELECT = {
  id: true,
  reference: true,
  status: true,
  service: true,
  frequency: true,
  bedrooms: true,
  bathrooms: true,
  squareFeet: true,
  addOns: true,
  distanceMiles: true,
  lines: true,
  surchargesCents: true,
  totalCents: true,
  depositCents: true,
  pricingVersion: true,
  address: { select: { postalCode: true, state: true } },
} satisfies Prisma.BookingSelect;

type FilaReserva = Prisma.BookingGetPayload<{ select: typeof RESERVA_SELECT }>;

/**
 * Las lineas del presupuesto guardadas, releidas con el contrato.
 *
 * El JSON de la base lo escribio alguna version del codigo, puede que no la
 * de hoy. `catch([])` porque un desglose ilegible es «sin desglose», no una
 * pantalla rota: el total manda, y la linea del ajuste se anade igual.
 */
const LineasGuardadasSchema = z.array(QuoteLineSchema).catch([]);

@Injectable()
export class FieldAdjustmentsService {
  private readonly logger = new Logger(FieldAdjustmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly pricing: PricingConfigService,
  ) {}

  /** Los ajustes de un trabajo, el más reciente primero. */
  async listFor(bookingId: string): Promise<FieldAdjustment[]> {
    const filas = await this.prisma.db.bookingFieldAdjustment.findMany({
      where: { bookingId },
      select: AJUSTE_SELECT,
      orderBy: { proposedAt: 'desc' },
      // Más de unos pocos por trabajo no es un caso real; es un tope de cordura.
      take: 20,
    });

    return filas.map(ajusteAContrato);
  }

  /**
   * El líder propone lo que encontró.
   *
   * ======================================================================
   * CUATRO COMPROBACIONES, Y LAS CUATRO IMPORTAN
   * ======================================================================
   *   1. QUE EL TRABAJO SEA SUYO. 404 y no 403, igual que en el resto de la
   *      pantalla de limpieza: un 403 enseñaría que esa reserva existe.
   *   2. QUE SEA EL RESPONSABLE. Lo decidió el negocio: quien responde por
   *      el trabajo es quien puede decir que lo contratado no se parece a la
   *      realidad.
   *   3. QUE HAYA FICHADO LA LLEGADA. **Solo se ajusta lo que se ha visto.**
   *      Cada propuesta queda con un fichaje detrás, con su hora y su
   *      distancia a la casa, así que ante un «esto no era así» hay prueba
   *      de que alguien estuvo allí.
   *   4. QUE DE VERDAD CAMBIE ALGO. Abrir la pantalla, mirar y ver que está
   *      todo bien no es un ajuste.
   */
  async propose(
    bookingId: string,
    entrada: FieldAdjustmentInput,
    staff: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<FieldAdjustment> {
    const asignacion = await this.prisma.db.bookingAssignment.findUnique({
      where: { bookingId_staffId: { bookingId, staffId: staff.staffId } },
      select: { isLead: true },
    });

    if (!asignacion) {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        messageKey: 'admin.errorBookingNotFound',
      });
    }

    /*
     * AQUI SI ES UN 403 Y NO UN 404, y la diferencia es deliberada: esta
     * persona YA SABE que el trabajo existe —lo tiene en su pantalla—, así
     * que esconderlo no protege nada y en cambio la dejaría sin entender por
     * qué no puede. Lo que se le dice es que esto lo hace el responsable.
     */
    if (!asignacion.isLead) {
      throw new ForbiddenException({
        code: API_ERROR_CODES.FORBIDDEN,
        messageKey: 'admin.errorAdjustmentNotLead',
      });
    }

    const reserva = await this.prisma.db.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: RESERVA_SELECT,
    });

    if (!ESTADOS_AJUSTABLES.includes(reserva.status)) {
      throw new BadRequestException({
        code: API_ERROR_CODES.INVALID_TRANSITION,
        messageKey: 'admin.errorAdjustmentClosed',
      });
    }

    /*
     * SOLO SE AJUSTA LO QUE SE HA VISTO. Se exige un fichaje de llegada DE
     * ESTA PERSONA, no de cualquiera del equipo: lo que respalda la
     * propuesta es que quien la firma estuvo en la casa.
     */
    const llegada = await this.prisma.db.bookingClockIn.findFirst({
      where: { bookingId, staffId: staff.staffId, kind: 'ARRIVAL' },
      select: { id: true },
    });

    if (!llegada) {
      throw new BadRequestException({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        messageKey: 'admin.errorAdjustmentNoArrival',
      });
    }

    const contratado = valoresDeLaReserva(reserva);
    const encontrado: FieldAdjustmentValues = {
      squareFeet: entrada.squareFeet ?? contratado.squareFeet,
      bedrooms: entrada.bedrooms ?? contratado.bedrooms,
      bathrooms: entrada.bathrooms ?? contratado.bathrooms,
      addOns: entrada.addOns ?? contratado.addOns,
    };

    if (!differsFromBooked(contratado, encontrado)) {
      throw new BadRequestException({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        messageKey: 'admin.errorAdjustmentEmpty',
      });
    }

    const nuevo = await this.tarificar(reserva, encontrado);

    const creado = await this.prisma.db.$transaction(async (tx) => {
      /*
       * LAS PROPUESTAS ABIERTAS ANTERIORES QUEDAN SUSTITUIDAS, NO BORRADAS.
       *
       * El líder puede corregirse —mide otra vez, cuenta otra nevera— y lo
       * que creyó ver la primera vez también es información. Borrarla
       * dejaría un hueco donde antes había una cifra, que es justo lo que no
       * se quiere al revisar algo.
       *
       * Va dentro de la transacción porque es lo que garantiza «como mucho
       * una abierta»: sin ella, dos envíos casi simultáneos dejarían dos
       * propuestas vivas y coordinación tendría que adivinar cuál vale.
       */
      await tx.bookingFieldAdjustment.updateMany({
        where: { bookingId, state: 'PROPOSED' },
        data: { state: 'SUPERSEDED' },
      });

      const fila = await tx.bookingFieldAdjustment.create({
        data: {
          bookingId,
          state: 'PROPOSED',
          bookedSquareFeet: contratado.squareFeet,
          bookedBedrooms: contratado.bedrooms,
          bookedBathrooms: contratado.bathrooms,
          bookedAddOns: contratado.addOns,
          foundSquareFeet: encontrado.squareFeet,
          foundBedrooms: encontrado.bedrooms,
          foundBathrooms: encontrado.bathrooms,
          foundAddOns: encontrado.addOns,
          note: entrada.note,
          differenceCents: nuevo.differenceCents,
          newTotalCents: nuevo.newTotalCents,
          noPriceReasonKey: nuevo.noPriceReason,
          pricingVersion: reserva.pricingVersion,
          proposedByStaffId: staff.staffId,
        },
        select: AJUSTE_SELECT,
      });

      await this.audit.record(
        {
          staff,
          surface: 'PANEL',
          action: 'booking.adjustment.proposed',
          entityType: 'booking',
          entityId: bookingId,
          /*
           * LAS CIFRAS QUE CAMBIAN Y NADA MAS, como el resto de la auditoría
           * de este proyecto. No hay datos del cliente aquí: ni nombre, ni
           * dirección, ni nada de tarjeta.
           */
          metadata: {
            reference: reserva.reference,
            source: 'my-jobs',
            squareFeet: `${contratado.squareFeet} → ${encontrado.squareFeet}`,
            addOns: `${resumenExtras(contratado.addOns)} → ${resumenExtras(encontrado.addOns)}`,
            differenceCents: nuevo.differenceCents,
          },
          ipAddress,
        },
        tx,
      );

      return fila;
    });

    this.logger.log(
      `${reserva.reference}: ajuste de campo propuesto por ${staff.email} ` +
        `(${contratado.squareFeet} → ${encontrado.squareFeet} pies, ` +
        `${nuevo.differenceCents === null ? 'sin precio automatico' : `${nuevo.differenceCents} centavos`})`,
    );
    return ajusteAContrato(creado);
  }

  /**
   * Coordinación aprueba o rechaza.
   *
   * ======================================================================
   * SE RECALCULA Y SE COMPARA ANTES DE APLICAR
   * ======================================================================
   * Lo que se aplica tiene que ser EXACTAMENTE lo que coordinación vio al
   * aprobar. Se vuelve a tarificar con la misma versión de tarifas y los
   * mismos valores encontrados, y si el total no coincide con el propuesto
   * **no se aplica nada**: significa que algo cambió por debajo —el motor,
   * la fila de tarifas— y aplicar un importe distinto del aprobado es
   * precisamente lo que no puede pasar con el dinero de un cliente.
   */
  async resolve(
    bookingId: string,
    adjustmentId: string,
    decision: FieldAdjustmentDecision,
    staff: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<FieldAdjustment> {
    const ajuste = await this.prisma.db.bookingFieldAdjustment.findFirst({
      where: { id: adjustmentId, bookingId },
      select: { ...AJUSTE_SELECT, pricingVersion: true },
    });

    if (!ajuste) {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        messageKey: 'admin.errorAdjustmentNotFound',
      });
    }

    if (ajuste.state !== 'PROPOSED') {
      throw new BadRequestException({
        code: API_ERROR_CODES.INVALID_TRANSITION,
        messageKey: 'admin.errorAdjustmentResolved',
      });
    }

    if (!decision.approve) {
      return this.rechazar(bookingId, ajuste, decision, staff, ipAddress);
    }

    return this.aprobar(bookingId, ajuste, decision, staff, ipAddress);
  }

  /* -------------------------------------------------------------------- */

  private async rechazar(
    bookingId: string,
    ajuste: FilaAjuste,
    decision: FieldAdjustmentDecision,
    staff: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<FieldAdjustment> {
    /*
     * EL MOTIVO ES OBLIGATORIO AL RECHAZAR, y no es burocracia: un rechazo
     * sin explicación deja al equipo sin saber si se equivocó al medir o si
     * la empresa decidió comerse la diferencia. La próxima vez no lo
     * reportará, y entonces se pierde el dato de verdad.
     */
    const motivo = decision.note?.trim();
    if (!motivo) {
      throw new BadRequestException({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        messageKey: 'admin.errorAdjustmentRejectNeedsNote',
      });
    }

    const fila = await this.prisma.db.$transaction(async (tx) => {
      const actualizado = await tx.bookingFieldAdjustment.update({
        where: { id: ajuste.id },
        data: {
          state: 'REJECTED',
          resolvedByStaffId: staff.staffId,
          resolvedAt: new Date(),
          resolutionNote: motivo,
        },
        select: AJUSTE_SELECT,
      });

      await this.audit.record(
        {
          staff,
          surface: 'PANEL',
          action: 'booking.adjustment.rejected',
          entityType: 'booking',
          entityId: bookingId,
          metadata: { differenceCents: ajuste.differenceCents, reason: motivo },
          ipAddress,
        },
        tx,
      );

      return actualizado;
    });

    return ajusteAContrato(fila);
  }

  private async aprobar(
    bookingId: string,
    ajuste: FilaAjuste & { pricingVersion: string },
    decision: FieldAdjustmentDecision,
    staff: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<FieldAdjustment> {
    const reserva = await this.prisma.db.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: RESERVA_SELECT,
    });

    const encontrado: FieldAdjustmentValues = {
      squareFeet: ajuste.foundSquareFeet,
      bedrooms: ajuste.foundBedrooms,
      bathrooms: ajuste.foundBathrooms,
      addOns: ExtrasGuardadosSchema.parse(ajuste.foundAddOns),
    };

    const recalculado = await this.tarificar(
      { ...reserva, pricingVersion: ajuste.pricingVersion },
      encontrado,
    );

    /*
     * ======================================================================
     * SIN PRECIO AUTOMATICO, LO TECLEA ADMINISTRACION
     * ======================================================================
     * Hay trabajos que NUNCA van a tener precio automatico: todo lo que esta
     * fuera de las 35 millas del area metropolitana —o sea, casi toda
     * Georgia— se atiende sin cotizacion automatica por diseno. Sin esta
     * salida, un ajuste en una casa de Gainesville se queda sin poder
     * resolverse para siempre.
     *
     * SOLO ADMINISTRACION, y no coordinacion como el resto de la aprobacion.
     * La linea es esta: el numero que calcula el motor lo aprueba quien
     * lleva la agenda; un numero que sale de la cabeza de una persona lo
     * pone quien responde del dinero. Es la misma frontera que separa mover
     * una cita de cobrar una tarjeta.
     */
    if (recalculado.newTotalCents === null || recalculado.quote === null) {
      return this.aprobarConImporteAMano(bookingId, ajuste, reserva, decision, staff, ipAddress);
    }

    /*
     * Y AL REVES: si el motor SI puede dar precio, no se admite uno tecleado.
     * Dejar sobreescribir el calculo convertiria la tabla de precios en una
     * sugerencia, y entonces dos casas iguales costarian cosas distintas
     * segun quien aprobara el ajuste.
     */
    if (decision.newTotalCents !== undefined) {
      throw new BadRequestException({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        messageKey: 'admin.errorAdjustmentPriceIsAutomatic',
      });
    }

    /*
     * LO QUE SE APLICA ES LO QUE SE APROBO. Si el recálculo no da lo mismo
     * que se propuso, algo cambió por debajo y hay que volver a proponerlo
     * para que alguien vuelva a mirar la cifra. Aplicar en silencio un
     * importe distinto del aprobado es justo lo que no puede pasar.
     */
    if (recalculado.newTotalCents !== ajuste.newTotalCents) {
      this.logger.error(
        `${reserva.reference}: el ajuste ${ajuste.id} se recalculo en ` +
          `${recalculado.newTotalCents} y se habia propuesto ${ajuste.newTotalCents}`,
      );
      throw new BadRequestException({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        messageKey: 'admin.errorAdjustmentStale',
      });
    }

    const quote = recalculado.quote;

    /*
     * EL DEPOSITO NO SE TOCA: ya está retenido en el proveedor de pago con un
     * importe concreto, y cambiar aquí el número no mueve esa retención. Lo
     * que se recalcula es lo que queda por cobrar.
     *
     * Y SE ACOTA A CERO. Si el ajuste baja el precio por debajo del depósito
     * ya retenido, lo que queda por cobrar es cero y además se le debe dinero
     * al cliente. Las devoluciones son el hueco conocido de la Etapa 2
     * (`docs/00` §Etapa 2), así que aquí se deja la cifra honesta —cero— y se
     * anota en el registro para que alguien lo vea.
     */
    const porCobrar = quote.totals.totalCents - reserva.depositCents;
    if (porCobrar < 0) {
      this.logger.warn(
        `${reserva.reference}: el ajuste deja el total (${quote.totals.totalCents}) por debajo ` +
          `del deposito retenido (${reserva.depositCents}). Hay que devolver la diferencia a mano.`,
      );
    }

    const fila = await this.prisma.db.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          squareFeet: encontrado.squareFeet,
          bedrooms: encontrado.bedrooms,
          bathrooms: encontrado.bathrooms,
          addOns: encontrado.addOns,
          lines: quote.lines,
          serviceCents: quote.totals.serviceCents,
          addOnsCents: quote.totals.addOnsCents,
          surchargesCents: quote.totals.surchargesCents,
          discountCents: quote.totals.discountCents,
          taxCents: quote.totals.taxCents,
          totalCents: quote.totals.totalCents,
          balanceDueCents: Math.max(0, porCobrar),
          /*
           * NI `pricingVersion` NI LA AGENDA SE TOCAN.
           *
           * La versión, porque el trabajo se sigue tarifando con la tabla que
           * tenía al contratarse; aprobar un ajuste no puede colar los
           * precios de hoy en un trabajo del mes pasado.
           *
           * La agenda, porque el equipo YA ESTA en la casa: alargar la cita
           * no puede desreservar el trabajo siguiente, y la guardia de
           * solapamiento solo conseguiría bloquear la aprobación. Si hace
           * falta mover la agenda, lo hace coordinación a mano.
           */
        },
      });

      const actualizado = await tx.bookingFieldAdjustment.update({
        where: { id: ajuste.id },
        data: {
          state: 'APPLIED',
          resolvedByStaffId: staff.staffId,
          resolvedAt: new Date(),
        },
        select: AJUSTE_SELECT,
      });

      await this.audit.record(
        {
          staff,
          surface: 'PANEL',
          action: 'booking.adjustment.applied',
          entityType: 'booking',
          entityId: bookingId,
          metadata: {
            reference: reserva.reference,
            squareFeet: `${ajuste.bookedSquareFeet} → ${encontrado.squareFeet}`,
            totalCents: `${reserva.totalCents} → ${quote.totals.totalCents}`,
            differenceCents: quote.totals.totalCents - reserva.totalCents,
            pricingVersion: ajuste.pricingVersion,
          },
          ipAddress,
        },
        tx,
      );

      return actualizado;
    });

    this.logger.log(
      `${reserva.reference}: ajuste aplicado por ${staff.email}, ` +
        `total ${reserva.totalCents} → ${quote.totals.totalCents}`,
    );
    return ajusteAContrato(fila);
  }

  /**
   * Aprueba con un importe TECLEADO por una persona.
   *
   * ======================================================================
   * SOLO ADMINISTRACION, Y QUEDA MARCADO COMO TAL
   * ======================================================================
   * Esta cifra no la ha comprobado nadie: no sale de la tabla de tarifas ni
   * del motor, sale de la cabeza de quien la escribe. Vale lo mismo que una
   * calculada en la factura y NO vale lo mismo al revisar las cuentas de un
   * mes, asi que la fila lo dice (`manualPrice`) y la auditoria tambien.
   */
  private async aprobarConImporteAMano(
    bookingId: string,
    ajuste: FilaAjuste & { pricingVersion: string },
    reserva: FilaReserva,
    decision: FieldAdjustmentDecision,
    staff: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<FieldAdjustment> {
    if (staff.role !== 'ADMIN') {
      /*
       * La linea es esta: el numero que calcula el motor lo aprueba quien
       * lleva la agenda; un numero que sale de la cabeza de una persona lo
       * pone quien responde del dinero. Es la misma frontera que ya separa
       * mover una cita de cobrar una tarjeta.
       */
      throw new ForbiddenException({
        code: API_ERROR_CODES.FORBIDDEN,
        messageKey: 'admin.errorAdjustmentManualNeedsAdmin',
      });
    }

    const nuevoTotal = decision.newTotalCents;
    if (nuevoTotal === undefined) {
      throw new BadRequestException({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        messageKey: 'admin.errorAdjustmentNeedsAmount',
      });
    }

    const diferencia = nuevoTotal - reserva.totalCents;
    const porCobrar = Math.max(0, nuevoTotal - reserva.depositCents);

    const fila = await this.prisma.db.$transaction(async (tx) => {
      /*
       * EL DESGLOSE SIGUE CUADRANDO.
       *
       * No se puede recalcular `lines` —no hay precio automatico, que es todo
       * el motivo de estar aqui— asi que se CONSERVA el desglose que tenia la
       * reserva y se le anade una linea con la diferencia. Sin ella, el
       * desglose sumaria una cosa y el total diria otra, que es justo lo que
       * nadie sabe explicar al revisar una factura.
       *
       * Va como SURCHARGE incluso cuando es negativa: el tipo DISCOUNT tiene
       * un significado comercial —una rebaja que se concede— y esto no lo es.
       * Es una correccion de lo que se contrato.
       */
      const lineas: QuoteLine[] = [
        // Lo que ya tenia la reserva, releido con el contrato.
        ...LineasGuardadasSchema.parse(reserva.lines),
        {
          code: 'FIELD_ADJUSTMENT',
          kind: 'SURCHARGE',
          labelKey: 'quote.line.fieldAdjustment',
          quantity: 1,
          unitAmountCents: diferencia,
          amountCents: diferencia,
        },
      ];

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          squareFeet: ajuste.foundSquareFeet,
          bedrooms: ajuste.foundBedrooms,
          bathrooms: ajuste.foundBathrooms,
          addOns: ExtrasGuardadosSchema.parse(ajuste.foundAddOns),
          lines: lineas,
          surchargesCents: reserva.surchargesCents + diferencia,
          totalCents: nuevoTotal,
          balanceDueCents: porCobrar,
          /*
           * Ni `serviceCents` ni la version de tarifas se tocan: el importe
           * tecleado no es una tarifa, es una correccion encima de la que
           * habia. Dejar `serviceCents` como estaba es lo que permite ver
           * despues cuanto se puso a mano.
           */
        },
      });

      const actualizado = await tx.bookingFieldAdjustment.update({
        where: { id: ajuste.id },
        data: {
          state: 'APPLIED',
          manualPrice: true,
          differenceCents: diferencia,
          newTotalCents: nuevoTotal,
          resolvedByStaffId: staff.staffId,
          resolvedAt: new Date(),
          resolutionNote: decision.note?.trim() || null,
        },
        select: AJUSTE_SELECT,
      });

      await this.audit.record(
        {
          staff,
          surface: 'PANEL',
          action: 'booking.adjustment.applied',
          entityType: 'booking',
          entityId: bookingId,
          metadata: {
            reference: reserva.reference,
            squareFeet: `${ajuste.bookedSquareFeet} → ${ajuste.foundSquareFeet}`,
            totalCents: `${reserva.totalCents} → ${nuevoTotal}`,
            differenceCents: diferencia,
            /*
             * LO MAS IMPORTANTE DE ESTA ENTRADA. Ante un importe raro en las
             * cuentas de un mes, la primera pregunta es si lo puso el sistema
             * o alguien, y esta linea la contesta.
             */
            manualPrice: true,
            noPriceReason: ajuste.noPriceReasonKey,
          },
          ipAddress,
        },
        tx,
      );

      return actualizado;
    });

    this.logger.log(
      `${reserva.reference}: ajuste aplicado A MANO por ${staff.email}, ` +
        `total ${reserva.totalCents} → ${nuevoTotal}`,
    );
    return ajusteAContrato(fila);
  }

  /**
   * Vuelve a tarificar con LA TABLA DE LA RESERVA, no con la vigente.
   *
   * ======================================================================
   * ESTA ES LA LINEA QUE EVITA UN FALLO CARO Y SILENCIOSO
   * ======================================================================
   * Si se usara la tabla vigente, aprobar el ajuste de un trabajo contratado
   * en marzo le aplicaría los precios de hoy —no solo a los 400 pies de más,
   * sino **a todo el trabajo**—. El cliente vería subir una cifra que nadie
   * tocó y nadie sabría explicar de dónde salió.
   *
   * LA DISTANCIA TAMPOCO SE VUELVE A RESOLVER: la casa no se ha movido. Se
   * reutiliza la que quedó guardada en la reserva, que además evita una
   * llamada al proveedor de distancias dentro de una aprobación.
   */
  private async tarificar(
    reserva: FilaReserva,
    encontrado: FieldAdjustmentValues,
  ): Promise<{
    differenceCents: number | null;
    newTotalCents: number | null;
    quote: QuoteResponse | null;
    /** Por que no hay precio, cuando no lo hay. Clave de traduccion. */
    noPriceReason: string | null;
  }> {
    const config = await this.pricing.atVersion(reserva.pricingVersion);

    if (!config) {
      /*
       * La versión de la reserva no está guardada. Pasa con las reservas
       * anteriores a la tabla de tarifas. No se cae y NO se usa la vigente:
       * se deja sin importe, que es lo honesto, y coordinación lo calcula.
       */
      this.logger.warn(
        `No existe la tabla de tarifas ${reserva.pricingVersion}: el ajuste va sin importe.`,
      );
      return {
        differenceCents: null,
        newTotalCents: null,
        quote: null,
        noPriceReason: 'quote.review.ratesUnavailable',
      };
    }

    const quote = calculateQuote(
      {
        service: reserva.service,
        frequency: reserva.frequency,
        bedrooms: encontrado.bedrooms,
        bathrooms: encontrado.bathrooms,
        squareFeet: encontrado.squareFeet,
        addOns: encontrado.addOns,
        destination: {
          postalCode: reserva.address.postalCode,
          state: reserva.address.state,
        },
        locale: 'en',
      },
      {
        quoteId: randomUUID(),
        now: new Date(),
        distance: {
          miles: reserva.distanceMiles,
          durationMinutes: null,
          provider: 'mock',
          estimated: true,
          cached: false,
        },
        config,
      },
    );

    /*
     * «A consultar» no es un precio. Si el motor pide revisión humana —casa
     * por encima del último tramo, zona lejana— la cifra que saldría no
     * significa nada, y enseñarla sería peor que no enseñar ninguna.
     */
    if (quote.manualReview.required) {
      /*
       * SE GUARDA EL MOTIVO, no solo el hecho de que no hay precio.
       *
       * El motor da siete razones distintas y casi nunca es el tamano: la mas
       * frecuente es la zona, porque fuera de las 35 millas Georgia entera se
       * atiende sin precio automatico por diseno. Se queda el primero: cuando
       * hay varios, el primero es el que de verdad bloquea.
       */
      return {
        differenceCents: null,
        newTotalCents: null,
        quote: null,
        noPriceReason: quote.manualReview.reasonKeys[0] ?? 'quote.review.farZone',
      };
    }

    return {
      differenceCents: quote.totals.totalCents - reserva.totalCents,
      newTotalCents: quote.totals.totalCents,
      quote,
      noPriceReason: null,
    };
  }
}

/* ------------------------------------------------------------------------ */

/**
 * Los estados en los que se puede ajustar.
 *
 * Quedan fuera `CANCELLED` —a esa casa no fue nadie—, `NO_SHOW` —el cliente
 * no estaba— y `PENDING_PAYMENT`, que es una reserva que todavía no existe de
 * verdad. `COMPLETED` entra: lo normal es darse cuenta del tamaño real
 * mientras se limpia, y a veces al acabar.
 */
const ESTADOS_AJUSTABLES: readonly string[] = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];

function valoresDeLaReserva(reserva: FilaReserva): FieldAdjustmentValues {
  return {
    squareFeet: reserva.squareFeet,
    bedrooms: reserva.bedrooms,
    bathrooms: reserva.bathrooms,
    addOns: ExtrasGuardadosSchema.parse(reserva.addOns),
  };
}

/** «INSIDE_FRIDGE x3, INSIDE_OVEN», para la auditoría. */
function resumenExtras(extras: readonly QuoteAddOnInput[]): string {
  if (extras.length === 0) return 'ninguno';

  return extras
    .map((extra) => (extra.quantity > 1 ? `${extra.code} x${extra.quantity}` : extra.code))
    .join(', ');
}
