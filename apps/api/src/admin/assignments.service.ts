import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  API_ERROR_CODES,
  staffFullName,
  type AdminAssignment,
  type AdminStaffList,
  type AuthenticatedStaff,
} from '@freshness/types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';

/**
 * QUIEN VA A CADA TRABAJO
 * -----------------------
 * Hasta ahora la agenda decia que hay que limpiar y cuando, pero no quien va.
 * Eso se organizaba por fuera, y lo que se organiza por fuera se olvida.
 *
 * LA GUARDIA QUE JUSTIFICA ESTE MODULO es la del solapamiento. Una lista de
 * nombres sin comprobaciones la puede llevar cualquiera en una libreta; lo que
 * una libreta no hace es avisarte de que acabas de poner a Ana en dos casas a
 * la vez. Ese error no se descubre hasta que el equipo llega a la segunda y no
 * hay nadie, con el desplazamiento ya pagado y el cliente esperando.
 */
@Injectable()
export class AssignmentsService {
  private readonly logger = new Logger(AssignmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Personal al que se puede asignar un trabajo.
   *
   * Solo activo: quien causo baja no puede ir a ninguna casa, y ofrecerlo en
   * el selector solo genera asignaciones que hay que deshacer.
   *
   * Las asignaciones ANTIGUAS de esa persona se conservan: el historial cuenta
   * lo que de verdad paso, y borrarlo dejaria trabajos sin responsable.
   */
  async listStaff(): Promise<AdminStaffList> {
    const personas = await this.prisma.db.staff.findMany({
      where: { isActive: true },
      // Nunca correo ni telefono: para elegir a quien va a una casa basta el
      // nombre y el puesto.
      select: { id: true, firstName: true, lastName: true, role: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    return {
      staff: personas.map((persona) => ({
        staffId: persona.id,
        firstName: persona.firstName,
        lastName: persona.lastName,
        role: persona.role,
      })),
    };
  }

  /**
   * Reemplaza el equipo de una reserva.
   *
   * Todo en una transaccion: se borra lo que habia y se escribe lo nuevo. Si
   * algo falla a mitad, la reserva se queda con el equipo anterior en vez de
   * con medio equipo, que es lo que provocaria que alguien no se presentara.
   */
  async setTeam(
    bookingId: string,
    assignments: AdminAssignment[],
    staff: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<void> {
    const booking = await this.prisma.db.booking.findUnique({
      where: { id: bookingId },
      select: { reference: true, status: true, scheduledStart: true, scheduledEnd: true },
    });

    if (!booking) {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        messageKey: 'admin.errorBookingNotFound',
      });
    }

    /*
     * A una reserva cancelada no va nadie. Permitir asignarla no solo es
     * inutil: deja personal "ocupado" en una franja que en realidad esta
     * libre, y la guardia de solapamiento empezaria a rechazar trabajos
     * reales por culpa de un trabajo que no existe.
     *
     * Las COMPLETADAS si se pueden tocar: corregir quien hizo un trabajo ya
     * hecho es mantenimiento legitimo del historial.
     */
    if (booking.status === 'CANCELLED') {
      throw new BadRequestException({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        messageKey: 'admin.errorAssignCancelled',
      });
    }

    await this.assertStaffExists(assignments);
    await this.assertNoOverlap(bookingId, assignments, booking);

    const anterior = await this.prisma.db.bookingAssignment.findMany({
      where: { bookingId },
      select: { staffId: true, isLead: true },
    });

    await this.prisma.db.$transaction(async (tx) => {
      await tx.bookingAssignment.deleteMany({ where: { bookingId } });

      if (assignments.length > 0) {
        await tx.bookingAssignment.createMany({
          data: assignments.map((a) => ({ bookingId, staffId: a.staffId, isLead: a.isLead })),
        });
      }

      await this.audit.record(
        {
          staff,
          action: 'booking.team_changed',
          entityType: 'Booking',
          entityId: bookingId,
          /*
           * Se guardan el antes y el despues. Ante un "nadie se presento",
           * la pregunta no es solo quien estaba asignado ahora, sino quien lo
           * estaba antes y quien lo cambio.
           */
          metadata: {
            reference: booking.reference,
            before: anterior,
            after: assignments,
          },
          ipAddress,
        },
        tx,
      );
    });

    this.logger.log(
      `Reserva ${booking.reference}: equipo de ${assignments.length} persona(s) por ${staff.email}`,
    );
  }

  /** Que nadie asignado sea un identificador inventado o alguien de baja. */
  private async assertStaffExists(assignments: AdminAssignment[]): Promise<void> {
    if (assignments.length === 0) return;

    const ids = assignments.map((a) => a.staffId);
    const encontrados = await this.prisma.db.staff.count({
      where: { id: { in: ids }, isActive: true },
    });

    if (encontrados !== ids.length) {
      throw new BadRequestException({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        messageKey: 'admin.errorStaffNotAssignable',
      });
    }
  }

  /**
   * LA COMPROBACION QUE IMPORTA: nadie puede estar en dos sitios a la vez.
   *
   * Se buscan trabajos de esas mismas personas que pisen esta franja, sin
   * contar el trabajo que se esta editando ni los cancelados.
   *
   * EL SOLAPAMIENTO SE MIDE CON DESIGUALDADES ESTRICTAS. Dos trabajos
   * consecutivos —uno termina a las 13:00 y el siguiente empieza a las
   * 13:00— NO se solapan, y rechazarlos haria imposible encadenar limpiezas,
   * que es justo como trabaja este negocio.
   */
  private async assertNoOverlap(
    bookingId: string,
    assignments: AdminAssignment[],
    booking: { scheduledStart: Date; scheduledEnd: Date },
  ): Promise<void> {
    if (assignments.length === 0) return;

    const conflictos = await this.prisma.db.bookingAssignment.findMany({
      where: {
        staffId: { in: assignments.map((a) => a.staffId) },
        bookingId: { not: bookingId },
        booking: {
          status: { notIn: ['CANCELLED'] },
          scheduledStart: { lt: booking.scheduledEnd },
          scheduledEnd: { gt: booking.scheduledStart },
        },
      },
      select: {
        staff: { select: { firstName: true, lastName: true } },
        booking: { select: { reference: true } },
      },
      take: 1,
    });

    const conflicto = conflictos[0];
    if (!conflicto) return;

    /*
     * El mensaje NOMBRA a la persona y la reserva en conflicto. Un "no se
     * puede asignar" a secas obliga a buscar el choque a mano por toda la
     * agenda; con el nombre y la referencia, quien coordina lo resuelve en
     * diez segundos.
     */
    throw new ConflictException({
      code: API_ERROR_CODES.STAFF_DOUBLE_BOOKED,
      messageKey: 'admin.errorStaffDoubleBooked',
      fields: [
        {
          path: 'assignments',
          message: `${staffFullName(conflicto.staff)} · ${conflicto.booking.reference}`,
        },
      ],
    });
  }
}
