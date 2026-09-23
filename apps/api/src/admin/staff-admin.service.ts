import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  API_ERROR_CODES,
  type AdminStaffDirectory,
  type AdminStaffDirectoryItem,
  type AuthenticatedStaff,
  type PanelAccess,
  type StaffCreate,
  type StaffUpdate,
} from '@freshness/types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { EMAIL_PROVIDER, type EmailProvider } from '../notifications/notifications.types';
import { staffInviteEmail } from '../notifications/templates/staff-emails';
import { BusinessSettingsService } from '../settings/business-settings.service';
import type { Prisma } from '../generated/prisma/client';
import { STAFF_INVITE_PROVIDER, type StaffInviteProvider } from './staff-invite.types';

/** Lo que se devuelve al panel. NUNCA `authUserId`: ver el contrato. */
const DIRECTORY_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  locale: true,
  isActive: true,
  authUserId: true,
  invitedAt: true,
  createdAt: true,
} as const;

type FilaPersonal = Prisma.StaffGetPayload<{ select: typeof DIRECTORY_SELECT }>;

/**
 * ALTA Y GESTION DE PERSONAL
 * --------------------------
 * Hasta ahora solo existia quien se hubiera metido a mano en la base de
 * datos. Eso convertia "contratar a alguien" en una tarea del equipo tecnico,
 * que es justo lo que este panel existe para evitar.
 *
 * LO QUE HAY QUE PROTEGER AQUI es que el sistema no se quede sin ningun
 * administrador activo. Todas las demas puertas se pueden volver a abrir
 * desde dentro: si cancelas una reserva por error, la vuelves a crear; si
 * apagas un aviso, lo enciendes. Quedarse sin administracion NO se deshace
 * desde el panel, porque hace falta ser administrador para crear otro, y la
 * unica salida seria entrar a la base de datos a mano.
 *
 * SE PROTEGE CON TRES CAPAS, y merece la pena saber que la tercera es la que
 * salta casi siempre:
 *
 *   1. Nadie se cambia a si mismo el puesto ni se da de baja. Esto solo ya
 *      basta para cualquier peticion suelta: quien pide el cambio es
 *      administracion activa y sigue siendolo despues.
 *   2. El recuento posterior a la escritura, con las filas bloqueadas, cubre
 *      la carrera: dos administradoras degradandose a la vez.
 *   3. La comprobacion de rol relee la ficha en CADA peticion, asi que quien
 *      acaba de dejar de ser administradora ni siquiera entra aqui.
 *
 * La segunda es defensa en profundidad: con la primera y la tercera en pie no
 * se ha conseguido provocar que salte. Se mantiene porque las tres protegen
 * cosas distintas y la primera es la candidata evidente a relajarse el dia
 * que alguien quiera "ceder la administracion a otra persona".
 */
@Injectable()
export class StaffAdminService {
  private readonly logger = new Logger(StaffAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(STAFF_INVITE_PROVIDER) private readonly invitaciones: StaffInviteProvider,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    private readonly business: BusinessSettingsService,
  ) {}

  /** Si este despliegue puede invitar. Lo consulta el directorio. */
  get canInvite(): boolean {
    return this.invitaciones.available;
  }

  /** El directorio completo, activos y de baja. */
  async directory(canInvite: boolean): Promise<AdminStaffDirectory> {
    const personas = await this.prisma.db.staff.findMany({
      select: DIRECTORY_SELECT,
      // Primero quien trabaja hoy; quien causo baja queda al final, visible
      // pero sin estorbar.
      orderBy: [{ isActive: 'desc' }, { firstName: 'asc' }, { lastName: 'asc' }],
    });

    return { staff: personas.map(toDirectoryItem), canInvite };
  }

  async create(
    datos: StaffCreate,
    actor: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<AdminStaffDirectoryItem> {
    await this.assertEmailLibre(datos.email, null);

    const creada = await this.prisma.db.$transaction(async (tx) => {
      const persona = await tx.staff.create({
        /*
         * Se escriben SOLO los campos del contrato. `authUserId` se queda a
         * nulo: nace sin acceso al panel, y concederlo es una accion aparte
         * y deliberada. Una alta no puede ser nunca una concesion de acceso.
         */
        data: {
          firstName: datos.firstName,
          lastName: datos.lastName,
          email: datos.email,
          phone: datos.phone,
          role: datos.role,
          locale: datos.locale,
        },
        select: DIRECTORY_SELECT,
      });

      await this.audit.record(
        {
          staff: actor,
          action: 'staff.created',
          entityType: 'Staff',
          entityId: persona.id,
          metadata: { email: persona.email, role: persona.role },
          ipAddress,
        },
        tx,
      );

      return persona;
    });

    this.logger.log(`Alta de personal: ${creada.role} creado por ${actor.email}`);
    return toDirectoryItem(creada);
  }

  async update(
    staffId: string,
    datos: StaffUpdate,
    actor: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<AdminStaffDirectoryItem> {
    const anterior = await this.cargar(staffId);

    /*
     * NADIE SE EDITA A SI MISMO EL PUESTO NI SE DA DE BAJA.
     *
     * No es desconfianza: es que esos dos cambios son los unicos que te
     * cierran la puerta a ti mismo en la siguiente peticion. Un descuido
     * —elegir el puesto equivocado en tu propia ficha— te deja fuera del
     * panel sin forma de volver a entrar. El resto de campos de tu ficha
     * (nombre, telefono, correo) si los puedes cambiar.
     */
    if (staffId === actor.staffId && (datos.role !== anterior.role || !datos.isActive)) {
      throw new BadRequestException({
        code: API_ERROR_CODES.STAFF_SELF_CHANGE,
        messageKey: 'admin.errorStaffSelfChange',
      });
    }

    if (datos.email !== anterior.email) await this.assertEmailLibre(datos.email, staffId);

    const actualizada = await this.prisma.db.$transaction(async (tx) => {
      /*
       * EL BLOQUEO QUE EVITA LA CATASTROFE SILENCIOSA.
       *
       * Sin el, dos administradores que se degradan a la vez pasan los dos la
       * comprobacion —cada transaccion ve al otro todavia como administrador,
       * porque el cambio ajeno aun no esta confirmado— y las dos se
       * confirman. El sistema se queda sin ningun administrador y nadie puede
       * arreglarlo desde el panel.
       *
       * Es poco probable y es catastrofico, que es exactamente la
       * combinacion que hay que cerrar. Bloquear las filas de administracion
       * obliga a las dos transacciones a ponerse en fila, y la segunda ve el
       * cambio de la primera.
       */
      await tx.$queryRaw`SELECT id FROM staff WHERE role = 'ADMIN' AND "isActive" = true FOR UPDATE`;

      const persona = await tx.staff.update({
        where: { id: staffId },
        data: {
          firstName: datos.firstName,
          lastName: datos.lastName,
          email: datos.email,
          phone: datos.phone,
          role: datos.role,
          locale: datos.locale,
          isActive: datos.isActive,
        },
        select: DIRECTORY_SELECT,
      });

      /*
       * Se cuenta DESPUES de escribir, no antes. Contar antes obliga a
       * simular mentalmente el efecto del cambio ("si esta era administradora
       * y deja de serlo, entonces..."), y esa simulacion es justo donde se
       * cuelan los casos que no se habian pensado. Contando despues, dentro
       * de la transaccion, se mira el mundo tal y como quedaria.
       */
      const administradores = await tx.staff.count({
        where: { role: 'ADMIN', isActive: true },
      });

      if (administradores === 0) {
        // Deshace la escritura: la transaccion entera se cae.
        throw new BadRequestException({
          code: API_ERROR_CODES.STAFF_LAST_ADMIN,
          messageKey: 'admin.errorStaffLastAdmin',
        });
      }

      await this.audit.record(
        {
          staff: actor,
          action: 'staff.updated',
          entityType: 'Staff',
          entityId: staffId,
          metadata: {
            before: { role: anterior.role, isActive: anterior.isActive, email: anterior.email },
            after: { role: persona.role, isActive: persona.isActive, email: persona.email },
          },
          ipAddress,
        },
        tx,
      );

      return persona;
    });

    this.logger.log(`Ficha de personal actualizada por ${actor.email}`);
    return toDirectoryItem(actualizada);
  }

  /**
   * Da acceso al panel a alguien que ya existe como personal.
   *
   * ES UNA ACCION APARTE DEL ALTA, y a proposito. Crear una ficha es decir
   * "esta persona trabaja aqui"; invitarla es decir "esta persona puede ver
   * los datos de todos los clientes". Son decisiones de peso muy distinto, y
   * juntarlas en un mismo formulario haria que la segunda se tomara sin
   * pensarla, por inercia de estar rellenando campos.
   *
   * EL ORDEN IMPORTA: primero se invita y despues se guarda el vinculo. Al
   * reves, un fallo del proveedor dejaria una ficha marcada como "con acceso"
   * sin cuenta detras, y nadie se enteraria hasta que esa persona intentara
   * entrar.
   */
  async invite(
    staffId: string,
    actor: AuthenticatedStaff,
    ipAddress: string | null,
  ): Promise<AdminStaffDirectoryItem> {
    const persona = await this.cargar(staffId);

    if (!this.invitaciones.available) {
      throw new ServiceUnavailableException({
        code: API_ERROR_CODES.STAFF_INVITE_UNAVAILABLE,
        messageKey: 'admin.errorInviteUnavailable',
      });
    }

    /*
     * A quien causo baja no se le da acceso. Parece obvio, pero sin la
     * comprobacion basta con invitar a una ficha inactiva para crearle
     * cuenta; no entraria —la sesion exige personal activo— y quedaria una
     * cuenta suelta en el proveedor que nadie sabe de quien es.
     */
    if (!persona.isActive) {
      throw new BadRequestException({
        code: API_ERROR_CODES.VALIDATION_ERROR,
        messageKey: 'admin.errorInviteInactive',
      });
    }

    /*
     * Invitar dos veces crearia una segunda cuenta con el mismo correo, o el
     * proveedor lo rechazaria con un error suyo que no dice nada util. Mejor
     * decirlo aqui con claridad.
     */
    if (persona.authUserId !== null) {
      throw new ConflictException({
        code: API_ERROR_CODES.STAFF_ALREADY_INVITED,
        messageKey: 'admin.errorAlreadyInvited',
      });
    }

    const resultado = await this.invitaciones.invite(persona.email);

    if (!resultado.ok) {
      /*
       * El motivo del proveedor se pasa como detalle porque ahorra mucho
       * tiempo ("email address is invalid", "signups not allowed"), pero el
       * mensaje que se traduce es el nuestro. Ese detalle NUNCA contiene la
       * clave: el adaptador solo devuelve el texto del error.
       */
      throw new ServiceUnavailableException({
        code: API_ERROR_CODES.STAFF_INVITE_FAILED,
        messageKey: 'admin.errorInviteFailed',
        fields: [{ path: 'email', message: resultado.reason }],
      });
    }

    /*
     * EL VINCULO SE GUARDA ANTES DE MANDAR EL CORREO, y el orden importa.
     *
     * La cuenta YA existe en el proveedor en cuanto se genera el enlace: eso
     * es un hecho, y no guardarlo dejaria una cuenta huerfana que impide
     * volver a invitar —el proveedor rechaza el correo repetido— sin que la
     * ficha muestre nada. Guardandolo, si el correo no llega esa persona
     * todavia puede entrar por «he olvidado mi contrasena», que lleva a la
     * misma pantalla de elegir clave.
     *
     * `invitedAt` se deja para DESPUES del envio: marca que el correo salio,
     * no que la cuenta existe. Son dos cosas distintas y conviene poder
     * distinguirlas al mirar la pantalla.
     */
    await this.prisma.db.$transaction(async (tx) => {
      await tx.staff.update({
        where: { id: staffId },
        data: { authUserId: resultado.authUserId },
      });

      await this.audit.record(
        {
          staff: actor,
          action: 'staff.invited',
          entityType: 'Staff',
          entityId: staffId,
          /*
           * Se registra a quien y con que puesto, NUNCA el identificador de
           * la cuenta ni el enlace: el registro de auditoria lo puede leer
           * quien investigue un incidente, y el enlace es una credencial de
           * un solo uso que serviria para entrar en su lugar.
           */
          metadata: { email: persona.email, role: persona.role },
          ipAddress,
        },
        tx,
      );
    });

    const negocio = await this.business.get();
    const envio = await this.email.send(
      staffInviteEmail(persona.email, {
        locale: persona.locale,
        firstName: persona.firstName,
        role: persona.role,
        actionLink: resultado.actionLink,
        companyPhone: negocio.phone,
        companyEmail: negocio.email,
      }),
    );

    if (!envio.ok) {
      /*
       * La cuenta quedo creada y vinculada, pero el correo no salio. Se dice
       * exactamente eso, con la salida concreta: esa persona puede entrar
       * igualmente pidiendo el enlace desde «he olvidado mi contrasena».
       *
       * Callarlo seria peor que el propio fallo: la pantalla diria «invitada»
       * y nadie sabria por que esa persona nunca entra.
       */
      this.logger.error(`La invitacion se genero pero el correo no salio: ${envio.failureReason}`);
      throw new ServiceUnavailableException({
        code: API_ERROR_CODES.STAFF_INVITE_FAILED,
        messageKey: 'admin.errorInviteNotDelivered',
        fields: [{ path: 'email', message: envio.failureReason ?? '' }],
      });
    }

    const actualizada = await this.prisma.db.staff.update({
      where: { id: staffId },
      data: { invitedAt: new Date() },
      select: DIRECTORY_SELECT,
    });

    this.logger.log(`Invitacion al panel enviada por ${actor.email}`);
    return toDirectoryItem(actualizada);
  }

  /** Carga una ficha o falla con 404. Publico porque lo usa la invitacion. */
  async cargar(staffId: string): Promise<FilaPersonal> {
    const persona = await this.prisma.db.staff.findUnique({
      where: { id: staffId },
      select: DIRECTORY_SELECT,
    });

    if (!persona) {
      throw new BadRequestException({
        code: API_ERROR_CODES.NOT_FOUND,
        messageKey: 'admin.errorStaffNotFound',
      });
    }

    return persona;
  }

  /**
   * Que el correo no este cogido.
   *
   * Se comprueba aqui ademas de en la base para poder dar un error con
   * sentido. La restriccion de la base es la que de verdad garantiza la
   * unicidad —entre esta consulta y la escritura cabe otra alta— y por eso
   * los controladores traducen tambien su violacion.
   */
  private async assertEmailLibre(email: string, exceptoStaffId: string | null): Promise<void> {
    const existente = await this.prisma.db.staff.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existente && existente.id !== exceptoStaffId) {
      throw new ConflictException({
        code: API_ERROR_CODES.STAFF_EMAIL_TAKEN,
        messageKey: 'admin.errorStaffEmailTaken',
      });
    }
  }
}

/**
 * Traduce la fila a lo que ve el panel.
 *
 * Aqui es donde `authUserId` se convierte en un estado y DESAPARECE: el panel
 * recibe "tiene acceso" o "se le invito", nunca el identificador de la cuenta.
 */
export function toDirectoryItem(persona: FilaPersonal): AdminStaffDirectoryItem {
  const access: PanelAccess =
    persona.authUserId === null ? 'NONE' : persona.invitedAt === null ? 'LINKED' : 'INVITED';

  return {
    staffId: persona.id,
    firstName: persona.firstName,
    lastName: persona.lastName,
    email: persona.email,
    phone: persona.phone,
    role: persona.role,
    locale: persona.locale,
    isActive: persona.isActive,
    access,
    invitedAt: persona.invitedAt?.toISOString() ?? null,
    createdAt: persona.createdAt.toISOString(),
  };
}
