import {
  CanActivate,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { API_ERROR_CODES, type AuthenticatedStaff, type StaffRole } from '@freshness/types';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { ADMIN_ROUTE, ROLES_KEY } from './auth.decorators';

/** Coincide con el segmento de ruta completo, no con un trozo de palabra. */
const ADMIN_PATH = new RegExp(`(^|/)${ADMIN_ROUTE}(/|$)`);

/**
 * PUERTA DEL PANEL
 * ----------------
 * Se registra como guarda GLOBAL, pero solo actua sobre las rutas que cuelgan
 * del segmento "admin". Esa decision es deliberada:
 *
 *   - Si hubiera que poner @UseGuards() en cada controlador nuevo, olvidarlo
 *     dejaria datos de clientes al descubierto EN SILENCIO. Nada fallaria, no
 *     saltaria ningun test, y nadie se enteraria hasta que fuera tarde.
 *   - Si la guarda se aplicara a TODA la API, olvidar marcar publico un
 *     endpoint rompe el cotizador: es un fallo ruidoso, visible al instante,
 *     pero rompe el sitio publico cada vez que alguien anade una ruta.
 *
 * Asi que la zona protegida se define por la ruta: cualquier endpoint que
 * nazca bajo /admin esta cerrado desde el primer minuto, sin que nadie tenga
 * que acordarse de nada. Hay un test que lo demuestra con una ruta nueva.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<Request & { staff?: AuthenticatedStaff }>();
    if (!ADMIN_PATH.test(request.path)) return true;

    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      throw new UnauthorizedException({
        code: API_ERROR_CODES.UNAUTHORIZED,
        messageKey: 'admin.errorSessionExpired',
      });
    }

    const staff = await this.auth.authenticate(token);
    request.staff = staff;

    // --- Rol, si el endpoint lo exige ---------------------------------------
    const required = this.reflector.getAllAndOverride<StaffRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (required && required.length > 0 && !required.includes(staff.role)) {
      throw new ForbiddenException({
        code: API_ERROR_CODES.FORBIDDEN,
        messageKey: 'admin.errorNoAccess',
      });
    }

    return true;
  }
}

/**
 * Lee "Authorization: Bearer <token>".
 *
 * El esquema se compara sin distinguir mayusculas porque la norma lo exige,
 * pero el token se toma tal cual: un espacio de mas cambiaria la firma.
 */
function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;

  const [scheme, ...rest] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer') return null;

  const token = rest.join(' ').trim();
  return token.length > 0 ? token : null;
}
