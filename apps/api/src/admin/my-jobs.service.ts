import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  API_ERROR_CODES,
  allowedTransitions,
  staffFullName,
  type AuthenticatedStaff,
  type MyJob,
  type MyJobProgress,
  type MyJobs,
} from '@freshness/types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';

/**
 * Lo que se lee de la base para pintar un trabajo de limpieza.
 *
 * ES UNA LISTA EXPLICITA Y CORTA, y ahi esta la gracia: los importes no se
 * leen siquiera. No se puede filtrar al pintar algo que nunca salio de la
 * base, y asi un descuido en la plantilla no puede ensenar un precio.
 */
const JOB_SELECT = {
  id: true,
  reference: true,
  status: true,
  service: true,
  scheduledStart: true,
  scheduledEnd: true,
  timezone: true,
  bedrooms: true,
  bathrooms: true,
  customerNotes: true,
  customer: { select: { firstName: true, phone: true } },
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
  assignments: {
    select: { isLead: true, staffId: true, staff: { select: { firstName: true, lastName: true } } },
    orderBy: [{ isLead: 'desc' as const }, { assignedAt: 'asc' as const }],
  },
};

type FilaTrabajo = Prisma.BookingGetPayload<{ select: typeof JOB_SELECT }>;

/**
 * MIS TRABAJOS
 * ------------
 * La vista del equipo de limpieza. Hasta ahora esas cuentas entraban
 * correctamente y no veian absolutamente nada, porque todas las pantallas del
 * panel son de coordinacion.
 *
 * EL FILTRO POR ASIGNACION ES LA PIEZA CRITICA Y VA EN LA CONSULTA, no
 * despues. La diferencia no es de estilo:
 *
 *   - Filtrando en la consulta, los trabajos ajenos NUNCA salen de la base de
 *     datos. Un fallo en el codigo de mas arriba no puede ensenarlos.
 *   - Filtrando despues, todos viajan hasta el servidor y basta un `return`
 *     mal puesto para que acaben en un navegador. Ese fallo no se ve
 *     probando: la pantalla se ve igual de bien.
 *
 * Y el identificador por el que se filtra sale de la SESION, nunca de la
 * peticion. Si viniera en la direccion, cualquiera podria pedir los trabajos
 * de otra persona cambiando un numero.
 */
@Injectable()
export class MyJobsService {
  private readonly logger = new Logger(MyJobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Los trabajos de quien pregunta.
   *
   * Desde el principio de HOY, no desde este instante: a media limpieza, un
   * trabajo que empezo a las nueve tiene que seguir en pantalla. Cortar por
   * "ahora" lo haria desaparecer justo cuando se necesita para marcar que se
   * ha terminado.
   */
  async list(staff: AuthenticatedStaff, now: Date = new Date()): Promise<MyJobs> {
    const trabajos = await this.prisma.db.booking.findMany({
      where: {
        assignments: { some: { staffId: staff.staffId } },
        /*
         * Las canceladas no aparecen: a esas no va nadie, y dejarlas en la
         * lista del dia es la forma de que alguien se presente en una casa
         * donde ya no se le espera.
         */
        status: { notIn: ['CANCELLED', 'PENDING_PAYMENT'] },
        scheduledStart: { gte: comienzoDelDia(now) },
      },
      select: JOB_SELECT,
      orderBy: { scheduledStart: 'asc' },
      // Un mes por delante es mas de lo que nadie mira en un movil.
      take: 60,
    });

    return { jobs: trabajos.map((trabajo) => toMyJob(trabajo, staff.staffId)) };
  }

  /**
   * Marca que se ha llegado o que se ha terminado.
   *
   * DOS COMPROBACIONES, y las dos importan:
   *
   *   1. Que ese trabajo sea suyo. Sin esto, con el identificador de otra
   *      reserva se podria marcar terminado un trabajo ajeno.
   *   2. Que la transicion sea valida desde el estado actual. Es la misma
   *      tabla del contrato que usa el panel, no una lista escrita aparte:
   *      la regla de negocio vive en un sitio.
   */
  async progress(
    bookingId: string,
    cambio: MyJobProgress,
    staff: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<MyJob> {
    const asignacion = await this.prisma.db.bookingAssignment.findUnique({
      where: { bookingId_staffId: { bookingId, staffId: staff.staffId } },
      select: { booking: { select: { status: true, reference: true } } },
    });

    /*
     * Un trabajo que no es suyo responde 404, NO 403.
     *
     * Con un 403 se aprenderia que esa reserva existe y simplemente no es
     * suya; probando identificadores se podria ir dibujando la agenda de la
     * empresa. Para quien limpia, un trabajo que no tiene asignado no existe.
     */
    if (!asignacion) {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        messageKey: 'admin.errorBookingNotFound',
      });
    }

    if (!allowedTransitions(asignacion.booking.status).includes(cambio.status)) {
      throw new BadRequestException({
        code: API_ERROR_CODES.INVALID_TRANSITION,
        messageKey: 'admin.errorInvalidTransition',
      });
    }

    const actualizado = await this.prisma.db.$transaction(async (tx) => {
      const trabajo = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: cambio.status,
          ...(cambio.status === 'IN_PROGRESS' ? { startedAt: new Date() } : {}),
          ...(cambio.status === 'COMPLETED' ? { completedAt: new Date() } : {}),
        },
        select: JOB_SELECT,
      });

      await this.audit.record(
        {
          staff,
          action: 'booking.status_changed',
          entityType: 'Booking',
          entityId: bookingId,
          /*
           * Se deja constancia de que lo marco limpieza desde su propia
           * pantalla y no coordinacion desde el panel. Ante un "esto se
           * cerro sin hacerse", saber quien lo marco y desde donde es la
           * primera pregunta.
           */
          metadata: {
            reference: trabajo.reference,
            from: asignacion.booking.status,
            to: cambio.status,
            source: 'my-jobs',
          },
          ipAddress,
        },
        tx,
      );

      return trabajo;
    });

    this.logger.log(`${actualizado.reference}: ${cambio.status} marcado por ${staff.email}`);
    return toMyJob(actualizado, staff.staffId);
  }
}

/** Medianoche de hoy, en la zona de la empresa. */
function comienzoDelDia(now: Date): Date {
  return DateTime.fromJSDate(now).setZone('America/New_York').startOf('day').toJSDate();
}

/**
 * Traduce la fila a lo que ve limpieza.
 *
 * Aqui es donde el apellido del cliente se queda fuera y donde los demas del
 * equipo se reducen a un nombre.
 */
function toMyJob(trabajo: FilaTrabajo, staffId: string): MyJob {
  const mia = trabajo.assignments.find((a) => a.staffId === staffId);

  return {
    bookingId: trabajo.id,
    reference: trabajo.reference,
    status: trabajo.status,
    service: trabajo.service,
    scheduledStart: trabajo.scheduledStart.toISOString(),
    scheduledEnd: trabajo.scheduledEnd.toISOString(),
    timezone: trabajo.timezone,
    durationMinutes: Math.round(
      (trabajo.scheduledEnd.getTime() - trabajo.scheduledStart.getTime()) / 60_000,
    ),
    bedrooms: trabajo.bedrooms,
    bathrooms: trabajo.bathrooms,
    customerFirstName: trabajo.customer.firstName,
    customerPhone: trabajo.customer.phone,
    addressLine1: trabajo.address.line1,
    addressLine2: trabajo.address.line2,
    city: trabajo.address.city,
    state: trabajo.address.state,
    postalCode: trabajo.address.postalCode,
    accessNotes: trabajo.address.accessNotes,
    customerNotes: trabajo.customerNotes,
    // Los demas del equipo, sin quien esta mirando: ya sabe que va.
    teammates: trabajo.assignments
      .filter((a) => a.staffId !== staffId)
      .map((a) => ({ name: staffFullName(a.staff), isLead: a.isLead })),
    iAmLead: mia?.isLead ?? false,
  };
}
