import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { EmailBrandingService } from '../notifications/email-branding.service';
import { EMAIL_PROVIDER, type EmailProvider } from '../notifications/notifications.types';
import { staffInviteEmail, staffRecoveryEmail } from '../notifications/templates/staff-emails';
import { BusinessSettingsService } from '../settings/business-settings.service';
import { STAFF_INVITE_PROVIDER, type StaffInviteProvider } from './staff-invite.types';

/**
 * VOLVER A ENTRAR CUANDO SE PERDIO LA CONTRASENA
 * ----------------------------------------------
 * POR QUE ESTO EXISTE, Y NO LO HACE YA LA LIBRERIA DEL NAVEGADOR.
 *
 * Lo hacia. El panel llamaba a `resetPasswordForEmail` de Supabase y se
 * acabo. Tenia dos problemas, y el segundo dejo a una persona sin poder
 * trabajar durante dias:
 *
 *   1. EL CORREO NO ERA NUESTRO. Llegaba en ingles, con el remitente del
 *      proveedor y su plantilla, por un servicio de correo que el propio
 *      proveedor describe como no apto para produccion y que corta los
 *      envios por hora.
 *
 *   2. NO PODIA FUNCIONAR NUNCA. Ese camino guarda un verificador en el
 *      navegador que PIDE el enlace y lo exige al canjearlo. El enlace llega
 *      por correo, y un correo se abre siempre en otra pestana —en el movil,
 *      siempre—, donde ese verificador no esta. Con la sesion guardada en
 *      `sessionStorage`, que muere con la pestana, el canje fallaba a la
 *      primera. La salida que le ofreciamos a quien se quedaba fuera era
 *      justamente esa.
 *
 * Generando el enlace AQUI, en el servidor, no hay verificador que perder:
 * vuelve con la sesion en el fragmento de la direccion, igual que el de
 * invitacion, y funciona se abra donde se abra.
 *
 * LA REGLA QUE GOBIERNA TODO ESTE ARCHIVO: haga lo que haga por dentro,
 * SIEMPRE termina igual y sin decir nada. Ni si la cuenta existe, ni si esa
 * persona sigue trabajando aqui, ni si el correo salio. Por eso este
 * servicio devuelve `void` y no un resultado: si devolviera algo, tarde o
 * temprano alguien lo pintaria en la pantalla.
 */
@Injectable()
export class PasswordRecoveryService {
  private readonly logger = new Logger(PasswordRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly business: BusinessSettingsService,
    @Inject(STAFF_INVITE_PROVIDER) private readonly invitaciones: StaffInviteProvider,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    private readonly marca: EmailBrandingService,
  ) {}

  /**
   * Manda el enlace si procede, y calla en cualquier otro caso.
   *
   * NO LANZA NUNCA, ni siquiera cuando el proveedor esta caido. Un fallo que
   * llegara a la pantalla seria una respuesta distinta a la normal, y una
   * respuesta distinta es exactamente lo que hace falta para averiguar que
   * correos estan dados de alta probandolos uno a uno.
   */
  async request(email: string, ipAddress: string | null): Promise<void> {
    try {
      await this.intentar(email, ipAddress);
    } catch (error) {
      // Solo al registro del servidor. Quien pregunta no se entera de nada.
      this.logger.error(
        `Fallo al atender una peticion de recuperacion: ${
          error instanceof Error ? error.message : 'error desconocido'
        }`,
      );
    }
  }

  private async intentar(email: string, ipAddress: string | null): Promise<void> {
    if (!this.invitaciones.available) return;

    const buscado = email.trim().toLowerCase();
    if (buscado.length === 0) return;

    /*
     * SE BUSCA POR LOS DOS CORREOS, y hace falta.
     *
     * `email` es el de contacto y `authEmail` es con el que se inicia
     * sesion. Normalmente coinciden, pero dejan de hacerlo en cuanto se
     * edita el de contacto en el panel: la cuenta sigue respondiendo al
     * antiguo. Buscar solo por uno dejaria fuera justo a quien mas
     * probablemente esta perdida.
     *
     * La comparacion es insensible a mayusculas porque nadie recuerda como
     * escribio su correo hace tres meses.
     */
    const persona = await this.prisma.db.staff.findFirst({
      where: {
        isActive: true,
        authUserId: { not: null },
        OR: [
          { email: { equals: buscado, mode: 'insensitive' } },
          { authEmail: { equals: buscado, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        locale: true,
        email: true,
        authEmail: true,
        /*
         * El puesto solo se usa si hay que caer al correo de bienvenida,
         * que lo menciona. Se pide siempre porque es una columna de la fila
         * que ya se esta trayendo: pedirla condicionalmente costaria una
         * segunda consulta para ahorrar una palabra.
         */
        role: true,
      },
    });

    /*
     * No hay ficha activa con cuenta. Se acaba aqui, en silencio.
     *
     * Cubre tres casos que merecen respuestas distintas por dentro y la
     * MISMA por fuera: el correo no existe, la persona causo baja, o nunca
     * se la llego a invitar. Distinguirlos en la respuesta convertiria esta
     * pantalla en un directorio de la plantilla.
     */
    if (!persona) return;

    /*
     * EL ENLACE VA AL CORREO DE LA CUENTA, no al de contacto.
     *
     * Es la misma leccion que el reenvio de invitaciones: la cuenta responde
     * a su propio correo, y mandar el enlace a otro sitio es mandarlo a un
     * buzon que puede no ser el de su duena. Si la ficha no tiene guardado
     * el de la cuenta —fichas anteriores a que se empezara a guardar—, se
     * usa el de contacto, que es lo unico que se sabe.
     */
    const destino = persona.authEmail ?? persona.email;

    /*
     * SE INTENTA RECUPERACION Y, SI FALLA, INVITACION.
     *
     * No son intercambiables: «recovery» es para una cuenta que ya confirmo
     * su correo, e «invite» para una que todavia no. Y las dos situaciones
     * se dan de verdad en la misma pantalla: quien lleva un ano entrando y
     * olvido la contrasena, y quien nunca llego a abrir su invitacion
     * porque se le caduco —que es el caso que motivo todo esto—.
     *
     * Se prueba en este orden y no al reves porque la recuperacion es lo que
     * pidio la persona; la invitacion es la red de seguridad. El coste de
     * equivocarse es una llamada de mas al proveedor en un camino raro.
     */
    const recuperacion = await this.invitaciones.recovery(destino);
    const enlace = recuperacion.ok ? recuperacion : await this.invitaciones.invite(destino);

    if (!enlace.ok) {
      this.logger.error(`No se pudo generar el enlace de recuperacion: ${enlace.reason}`);
      return;
    }

    const negocio = await this.business.get();
    const comun = {
      locale: persona.locale,
      firstName: persona.firstName,
      actionLink: enlace.actionLink,
      companyPhone: negocio.phone,
      companyEmail: negocio.email,
      logoUrl: this.marca.logoUrl,
    };

    /*
     * EL TEXTO SIGUE AL TIPO DE ENLACE QUE SE PUDO GENERAR, no a lo que
     * pidio la persona.
     *
     * Si hubo que caer a la invitacion es porque esa cuenta nunca llego a
     * estrenarse, y «elige una contrasena nueva» sonaria raro a quien nunca
     * tuvo una. El correo de bienvenida dice exactamente lo que toca.
     */
    const mensaje = recuperacion.ok
      ? staffRecoveryEmail(destino, comun)
      : staffInviteEmail(destino, { ...comun, role: persona.role });

    const envio = await this.email.send(mensaje);

    if (!envio.ok) {
      this.logger.error(`El correo de recuperacion no salio: ${envio.failureReason}`);
      return;
    }

    /*
     * SE AUDITA SOLO CUANDO EL CORREO SALE DE VERDAD.
     *
     * Registrar tambien los intentos fallidos convertiria este registro en
     * la lista ordenada por hora de las direcciones que alguien ha ido
     * probando. La auditoria existe para detectar eso, no para recopilarlo.
     *
     * No va dentro de una transaccion —a diferencia del resto— porque no
     * acompana a ningun cambio en la base: el hecho que registra ya ocurrio
     * fuera, en el proveedor de correo, y no hay nada que deshacer.
     *
     * El enlace NO se registra: es una credencial de un solo uso y quien
     * leyera esta fila entraria en su lugar.
     */
    await this.audit.record({
      staff: null,
      surface: 'PANEL',
      action: 'staff.recovery_sent',
      entityType: 'staff',
      entityId: persona.id,
      metadata: { email: destino },
      ipAddress,
    });
  }
}
