import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { API_ERROR_CODES, type AuthenticatedStaff, type StaffRole } from '@freshness/types';
import { PrismaService } from '../database/prisma.service';
import { AUTH_PROVIDER, InvalidTokenError, type AuthProvider } from './auth.types';

/**
 * DE UN TOKEN A UNA PERSONA CON PERMISOS
 * --------------------------------------
 * Dos comprobaciones distintas y las dos obligatorias:
 *
 *   1. IDENTIDAD. El token esta firmado por el proveedor y sigue vigente.
 *   2. AUTORIDAD. Ese usuario figura en la tabla `staff` y sigue activo.
 *
 * El segundo paso es el que de verdad protege el panel. Cualquiera puede
 * registrarse en Supabase y conseguir un token impecable; si bastara con eso,
 * el panel estaria abierto a todo internet.
 *
 * Tambien es el interruptor para dar de baja a alguien: poner `isActive` en
 * false le cierra la puerta en la siguiente peticion, sin esperar a que
 * caduque su token ni tener que revocarlo en el proveedor.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(AUTH_PROVIDER) private readonly provider: AuthProvider,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Como `authenticate`, pero devolviendo ademas el identificador de sesion.
   *
   * Existe aparte para que el resto del sistema siga pidiendo solo «quien
   * eres» y nadie tenga que arrastrar un dato que no necesita. El
   * identificador de sesion lo usa UNICAMENTE la guarda, y solo para no
   * registrar dos veces el mismo acceso.
   */
  async authenticateWithSession(
    token: string,
  ): Promise<{ staff: AuthenticatedStaff; sessionId: string | null }> {
    // --- 1. Identidad -------------------------------------------------------
    let claims;
    try {
      claims = await this.provider.verify(token);
    } catch (error) {
      /*
       * El motivo queda en el log del servidor y NUNCA sale al navegador:
       * distinguir "ha caducado" de "la firma no cuadra" le ahorra trabajo a
       * quien esta probando tokens a ver cual cuela.
       */
      this.logger.warn(
        `Token rechazado: ${error instanceof InvalidTokenError ? error.message : 'error desconocido'}`,
      );
      throw new UnauthorizedException({
        code: API_ERROR_CODES.UNAUTHORIZED,
        messageKey: 'admin.errorSessionExpired',
      });
    }

    // --- 2. Autoridad -------------------------------------------------------
    const staff = await this.prisma.db.staff.findUnique({
      where: { authUserId: claims.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!staff || !staff.isActive) {
      // Se registra el identificador del proveedor, no el correo: un intento
      // de acceso no autorizado no deberia dejar datos personales en el log.
      this.logger.warn(
        `Acceso denegado al panel: el usuario ${claims.userId} no es personal activo`,
      );
      throw new ForbiddenException({
        code: API_ERROR_CODES.FORBIDDEN,
        messageKey: 'admin.errorNoAccess',
      });
    }

    return {
      staff: {
        staffId: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        email: staff.email,
        role: staff.role satisfies StaffRole,
        sessionExpiresAt: claims.expiresAt.toISOString(),
      },
      sessionId: claims.sessionId,
    };
  }

  /** Quien eres. Lo que necesita todo el mundo salvo la guarda. */
  async authenticate(token: string): Promise<AuthenticatedStaff> {
    return (await this.authenticateWithSession(token)).staff;
  }
}
