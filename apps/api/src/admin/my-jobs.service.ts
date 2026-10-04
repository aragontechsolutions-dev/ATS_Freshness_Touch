import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  API_ERROR_CODES,
  allowedTransitions,
  canEditChecklist,
  clockInDistanceMeters,
  staffFullName,
  toMyJobAdjustment,
  type AuthenticatedStaff,
  type ChecklistItem,
  type ChecklistProgress,
  type ClockInKind,
  type ClockInLocationState,
  type ClockInRecord,
  type MyJob,
  type MyJobProgress,
  type MyJobs,
} from '@freshness/types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { AJUSTE_SELECT, ExtrasGuardadosSchema, ajusteAContrato } from './field-adjustment.helper';
import {
  JOB_CHECKLIST_CATALOG_TOKEN,
  esTareaDelTrabajo,
  montarChecklist,
} from './job-checklist.helper';
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
  squareFeet: true,
  addOns: true,
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
  /*
   * LOS FICHAJES, CON EL NOMBRE DE PILA DE QUIEN FICHO.
   *
   * Sin apellido, igual que en el resto de esta pantalla: para saber a quien
   * esperar en la puerta sobra el nombre.
   *
   * Y OJO CON LO QUE NO ESTA AQUI: no se lee la latitud ni la longitud de
   * nadie, porque no existen en la tabla. Esta consulta no puede filtrarlas
   * por descuido, porque no hay nada que filtrar.
   */
  clockIns: {
    select: {
      staffId: true,
      kind: true,
      occurredAt: true,
      locationState: true,
      distanceMeters: true,
      accuracyMeters: true,
      staff: { select: { firstName: true } },
    },
    orderBy: { occurredAt: 'asc' as const },
  },
  /*
   * LAS TAREAS YA MARCADAS. Solo las marcadas: la lista completa sale del
   * catalogo del codigo, y esta tabla guarda unicamente lo que se hizo.
   *
   * Con el nombre de pila de quien la marco, sin apellido, igual que el
   * resto de esta pantalla: en una casa con dos personas sirve para no hacer
   * dos veces lo mismo, que es el problema que esta lista resuelve.
   */
  checklistItems: {
    select: { itemCode: true, doneAt: true, doneBy: { select: { firstName: true } } },
    orderBy: { doneAt: 'asc' as const },
  },
  /*
   * LOS AJUSTES DE CAMPO, EN LA MISMA CONSULTA.
   *
   * No se piden al servicio de ajustes uno a uno: eso serian tantas
   * consultas como trabajos tenga la persona en pantalla, y esta lista se
   * carga entera al abrir la aplicacion en la calle.
   *
   * Los importes se leen y se tiran en `toMyJob`: el contrato de esta
   * pantalla no tiene donde ponerlos. Se traen porque el mapeador es
   * compartido con el panel, que si los ensena.
   */
  fieldAdjustments: {
    select: AJUSTE_SELECT,
    orderBy: { proposedAt: 'desc' as const },
    take: 10,
  },
};

/**
 * Las coordenadas de la casa, que se leen APARTE del trabajo.
 *
 * No van en `JOB_SELECT` a proposito: la casa tiene un punto en el mapa desde
 * la etapa 3.2, y ese punto se usa para CALCULAR la distancia, no para
 * mandarlo al movil. Si estuviera en la seleccion del trabajo acabaria en la
 * respuesta, y con el la posicion exacta de la casa de un cliente viajando a
 * un telefono donde no hace ninguna falta.
 */
const CASA_SELECT = {
  address: { select: { latitude: true, longitude: true } },
} satisfies Prisma.BookingSelect;

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
    @Inject(JOB_CHECKLIST_CATALOG_TOKEN)
    private readonly catalogo: readonly ChecklistItem[],
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

    return { jobs: trabajos.map((trabajo) => toMyJob(trabajo, staff.staffId, this.catalogo)) };
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

    /*
     * ======================================================================
     * AQUI ES DONDE MUEREN LAS COORDENADAS DEL EMPLEADO
     * ======================================================================
     * Estas cuatro lineas son la decision de privacidad de toda la etapa,
     * puesta en practica. Lo que entra son unas coordenadas; lo que sale de
     * este bloque es un numero de metros y un estado.
     *
     * A partir de la linea siguiente, la posicion de esa persona NO EXISTE en
     * ninguna variable de este proceso. No se guarda, no se audita y no se
     * escribe en el registro del servidor.
     *
     * Se calcula FUERA de la transaccion porque es aritmetica: no toca la
     * base para nada, y meterla dentro solo alargaria el bloqueo.
     */
    const fichaje = await this.medirDistancia(bookingId, cambio);

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

      /*
       * EL FICHAJE, DENTRO DE LA MISMA TRANSACCION QUE EL CAMBIO DE ESTADO.
       *
       * Van juntos o no van: un trabajo que pasa a EN CURSO sin su fichaje
       * deja a la empleada sin poder demostrar que fue, y un fichaje sin
       * cambio de estado es un registro de que alguien llego a un trabajo que
       * el sistema sigue considerando pendiente. Las dos mitades sueltas son
       * peores que ninguna.
       */
      await tx.bookingClockIn.create({
        data: {
          bookingId,
          staffId: staff.staffId,
          kind: fichaje.kind,
          locationState: fichaje.locationState,
          distanceMeters: fichaje.distanceMeters,
          accuracyMeters: fichaje.accuracyMeters,
        },
      });

      await this.audit.record(
        {
          staff,
          surface: 'PANEL',
          /*
           * MISMA ACCION QUE CUANDO LO MARCA COORDINACION desde el panel.
           * Antes esto ponia `booking.status_changed` y el panel ponia
           * `booking.status.<estado>`: dos nombres para el mismo hecho, asi
           * que filtrar «ensename todas las que se completaron» se dejaba
           * fuera justo las que marco el equipo de limpieza, que son la
           * mayoria. Quien lo hizo y desde donde se distingue por el actor y
           * por `source`, no por el nombre de la accion.
           */
          action: `booking.status.${cambio.status.toLowerCase()}`,
          entityType: 'booking',
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
            /*
             * LA DISTANCIA SI, LAS COORDENADAS NUNCA.
             *
             * Ante un «esto se cerro sin hacerse», que la auditoria diga «lo
             * marco a 30 kilometros de la casa» es exactamente el dato que
             * resuelve la conversacion, y no revela donde estaba esa persona:
             * un radio de 30 km alrededor de una casa conocida son miles de
             * kilometros cuadrados.
             *
             * La regla de este proyecto es que la auditoria no lleva nunca
             * datos de tarjeta, contrasenas ni codigos de puerta. Una
             * distancia no es ninguna de las tres, pero un par de
             * coordenadas si seria de la misma familia: un dato que permite
             * situar a una persona. Por eso aqui va el numero de metros y no
             * el punto.
             */
            locationState: fichaje.locationState,
            distanceMeters: fichaje.distanceMeters,
          },
          ipAddress,
        },
        tx,
      );

      return trabajo;
    });

    this.logger.log(
      `${actualizado.reference}: ${cambio.status} marcado por ${staff.email} ` +
        `(${fichaje.locationState}` +
        `${fichaje.distanceMeters === null ? '' : `, a ${fichaje.distanceMeters} m`})`,
    );
    return toMyJob(actualizado, staff.staffId, this.catalogo);
  }

  /**
   * Marca o desmarca una tarea de la lista de verificacion.
   *
   * ======================================================================
   * LAS TRES COMPROBACIONES, Y LAS TRES IMPORTAN
   * ======================================================================
   *   1. QUE EL TRABAJO SEA SUYO. Igual que al cambiar de estado: sin esto,
   *      con el identificador de otra reserva se podrian ir marcando tareas
   *      de trabajos ajenos. Responde 404 y no 403, por el mismo motivo que
   *      alli: un 403 enseñaria que esa reserva existe.
   *   2. QUE EL CODIGO SEA DE UNA TAREA QUE ESTE TRABAJO PIDE. Es una
   *      comprobacion de SEGURIDAD, no de forma: sin ella, cualquiera con
   *      sesion podria escribir una fila por cada cadena que se le ocurriera
   *      y usar la lista como un almacen de texto libre colgado de una
   *      reserva.
   *   3. QUE EL TRABAJO NO ESTE CERRADO. Una lista que se puede seguir
   *      tocando despues de cobrar no vale como registro de lo que se hizo.
   *
   * ======================================================================
   * NO HAY ENTRADA DE AUDITORIA POR CADA TOQUE, Y ES DELIBERADO
   * ======================================================================
   * Una lista son veinticinco tareas, y un trabajo de dos personas con sus
   * correcciones pasa de las cincuenta escrituras. Auditarlas enterraria
   * bajo miles de lineas al mes lo que coordinacion de verdad busca en la
   * auditoria: quien cambio un precio, quien cancelo una reserva, quien
   * entro al panel.
   *
   * Y NO SE PIERDE NADA: la propia fila ES el registro. Lleva quien la marco
   * y a que hora, que es exactamente lo que una entrada de auditoria
   * guardaria. La auditoria de este proyecto guarda que cambio, no un
   * volcado de todo lo que pasa.
   */
  async markChecklistItem(
    bookingId: string,
    cambio: ChecklistProgress,
    staff: AuthenticatedStaff,
  ): Promise<MyJob> {
    const asignacion = await this.prisma.db.bookingAssignment.findUnique({
      where: { bookingId_staffId: { bookingId, staffId: staff.staffId } },
      select: { booking: { select: { status: true, service: true } } },
    });

    if (!asignacion) {
      throw new NotFoundException({
        code: API_ERROR_CODES.NOT_FOUND,
        messageKey: 'admin.errorBookingNotFound',
      });
    }

    /*
     * UN TRABAJO CERRADO NO SE TOCA.
     *
     * `COMPLETED` SI entra, y no es una contradiccion: lo normal es acabar de
     * marcar la ultima tarea justo despues de pulsar «he terminado», y
     * negarlo ahi convertiria el ultimo toque de cada trabajo en un fallo. Lo
     * que no se puede tocar es una reserva cancelada o ya cobrada y cerrada
     * por coordinacion.
     */
    if (!canEditChecklist(asignacion.booking.status)) {
      throw new BadRequestException({
        code: API_ERROR_CODES.INVALID_TRANSITION,
        messageKey: 'admin.errorChecklistClosed',
      });
    }

    if (!esTareaDelTrabajo(asignacion.booking.service, cambio.itemCode, this.catalogo)) {
      throw new BadRequestException({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        messageKey: 'admin.errorChecklistUnknownItem',
      });
    }

    if (cambio.done) {
      /*
       * IDEMPOTENTE, Y HACE FALTA QUE LO SEA. Esta pantalla se usa de pie, a
       * veces con guantes y con una conexion mala en la puerta de una casa:
       * el doble toque y el reintento son la norma.
       *
       * `upsert` con el `update` VACIO a proposito: si ya estaba marcada, se
       * deja como estaba. Volver a escribir la hora y el autor convertiria el
       * segundo toque de otra persona en «lo hizo ella», borrando a quien de
       * verdad lo hizo.
       */
      await this.prisma.db.bookingChecklistItem.upsert({
        where: { bookingId_itemCode: { bookingId, itemCode: cambio.itemCode } },
        create: { bookingId, itemCode: cambio.itemCode, doneByStaffId: staff.staffId },
        update: {},
      });
    } else {
      /*
       * Desmarcar borra la fila. `deleteMany` y no `delete` porque `delete`
       * lanza si no hay nada que borrar, y desmarcar algo que no estaba
       * marcado no es un error: es el resultado que se pedia.
       */
      await this.prisma.db.bookingChecklistItem.deleteMany({
        where: { bookingId, itemCode: cambio.itemCode },
      });
    }

    return this.getOne(bookingId, staff);
  }

  /**
   * UN trabajo, tal como lo ve quien pregunta.
   *
   * Lo usan los endpoints que CAMBIAN algo de un trabajo —marcar una tarea,
   * proponer un ajuste— para devolver el estado de despues. Asi la pantalla
   * se pinta con lo que decidio el servidor en vez de suponer que hizo lo
   * que le pidieron.
   *
   * NO COMPRUEBA LA ASIGNACION, y es deliberado: lo llaman metodos que ya la
   * comprobaron. Es privado del servidor; no hay ningun endpoint que lo
   * exponga directamente.
   */
  async getOne(bookingId: string, staff: AuthenticatedStaff): Promise<MyJob> {
    const trabajo = await this.prisma.db.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: JOB_SELECT,
    });
    return toMyJob(trabajo, staff.staffId, this.catalogo);
  }

  /**
   * CONVIERTE UNAS COORDENADAS EN UN NUMERO DE METROS.
   *
   * Es el unico sitio del sistema que ve la posicion de un empleado, y la ve
   * durante el tiempo que tarda una resta. Devuelve lo que se va a guardar,
   * que no tiene donde poner un punto en el mapa.
   *
   * NUNCA LANZA, Y NUNCA DEVUELVE «NO SE PUEDE FICHAR». Cualquier problema
   * acaba en un fichaje sin distancia y con el motivo anotado, porque un
   * fichaje que se niega a registrar la llegada no protege a la empresa: deja
   * a la empleada sin poder demostrar que fue.
   */
  private async medirDistancia(
    bookingId: string,
    cambio: MyJobProgress,
  ): Promise<{
    kind: ClockInKind;
    locationState: ClockInLocationState;
    distanceMeters: number | null;
    accuracyMeters: number | null;
  }> {
    const kind: ClockInKind = cambio.status === 'IN_PROGRESS' ? 'ARRIVAL' : 'DEPARTURE';

    /*
     * Sin ubicacion. El movil dijo por que —o no dijo nada, y entonces se
     * asume que no pudo, que es lo que no acusa a nadie: `UNAVAILABLE` es un
     * fallo tecnico y `DENIED` es una decision de la persona, asi que ante la
     * duda se anota el primero.
     */
    if (!cambio.location) {
      return {
        kind,
        locationState: cambio.locationState ?? 'UNAVAILABLE',
        distanceMeters: null,
        accuracyMeters: null,
      };
    }

    let casa: { latitude: number | null; longitude: number | null } | null = null;
    try {
      const fila = await this.prisma.db.booking.findUnique({
        where: { id: bookingId },
        select: CASA_SELECT,
      });
      casa = fila?.address ?? null;
    } catch (error) {
      /*
       * Si no se puede leer la casa, el fichaje sigue adelante sin distancia.
       * Es `NO_HOUSE` porque el fallo es del lado nuestro, no de quien ficha.
       */
      this.logger.error(
        `No se pudieron leer las coordenadas de la casa para el fichaje: ` +
          `${error instanceof Error ? error.message : 'error desconocido'}`,
      );
    }

    const metros = casa === null ? null : clockInDistanceMeters(cambio.location, casa);

    /*
     * `NO_HOUSE`: la casa todavia no tiene coordenadas, porque la
     * geocodificacion no la resolvio o esta pendiente del barrido. EL FALLO
     * ES NUESTRO, y por eso tiene su propio estado: si se anotara como
     * `UNAVAILABLE` pareceria que el GPS de esa persona no funciona.
     */
    if (metros === null) {
      return { kind, locationState: 'NO_HOUSE', distanceMeters: null, accuracyMeters: null };
    }

    return {
      kind,
      locationState: 'RECORDED',
      distanceMeters: metros,
      /*
       * El margen se redondea igual que la distancia: el navegador da
       * decimales, y no significan nada sobre un punto interpolado.
       */
      accuracyMeters: Math.round(cambio.location.accuracyMeters),
    };
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
function toMyJob(trabajo: FilaTrabajo, staffId: string, catalogo: readonly ChecklistItem[]): MyJob {
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
    squareFeet: trabajo.squareFeet,
    /*
     * El JSON de la base es opaco: se relee con el contrato antes de
     * mandarlo. Una lista ilegible es «sin extras», no una pantalla rota.
     */
    addOns: ExtrasGuardadosSchema.parse(trabajo.addOns),
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
    /*
     * Se saca de los fichajes que YA vienen en la consulta: ni una consulta
     * mas, y es el mismo dato que mira el servidor al aceptar un ajuste.
     */
    iHaveArrived: trabajo.clockIns.some((f) => f.staffId === staffId && f.kind === 'ARRIVAL'),
    /*
     * La lista se monta en el servidor, no en el movil: el movil no sabe que
     * tareas pide cada servicio, y si lo supiera habria dos catalogos que
     * mantener de acuerdo.
     */
    checklist: montarChecklist(trabajo.service, trabajo.checklistItems, catalogo),
    /*
     * AQUI MUEREN LOS IMPORTES DEL AJUSTE. `toMyJobAdjustment` quita la
     * diferencia y el total nuevo: quien limpia reporta lo que ve, y lo que
     * cuesta lo dice coordinacion. Ver `field-adjustment.ts`.
     */
    adjustments: trabajo.fieldAdjustments.map((fila) => toMyJobAdjustment(ajusteAContrato(fila))),
    clockIns: trabajo.clockIns.map((f): ClockInRecord => ({
      staffId: f.staffId,
      staffFirstName: f.staff.firstName,
      kind: f.kind,
      occurredAt: f.occurredAt.toISOString(),
      locationState: f.locationState,
      distanceMeters: f.distanceMeters,
      accuracyMeters: f.accuracyMeters,
    })),
  };
}
