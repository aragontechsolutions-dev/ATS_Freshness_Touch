import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedStaff, StaffRole } from '@freshness/types';
import type { Request } from 'express';

/**
 * Segmento de ruta que marca una zona protegida.
 *
 * Todo lo que cuelgue de aqui exige sesion, SIN tener que acordarse de poner
 * ninguna guarda. Ver `admin.guard.ts` para el razonamiento.
 */
export const ADMIN_ROUTE = 'admin';

export const ROLES_KEY = 'roles';

/**
 * Limita un endpoint a ciertos roles.
 *
 * Sin este decorador, cualquier miembro del personal activo puede entrar. Es
 * deliberado: la puerta ya esta cerrada por defecto y lo que se afina aqui es
 * QUIEN de dentro pasa, no si hay que comprobar algo.
 */
export const Roles = (...roles: StaffRole[]) => SetMetadata(ROLES_KEY, roles);

/** Inyecta en el controlador a la persona que hizo la peticion. */
export const CurrentStaff = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedStaff => {
    const request = context.switchToHttp().getRequest<Request & { staff?: AuthenticatedStaff }>();
    if (!request.staff) {
      // Solo puede ocurrir si alguien usa el decorador en una ruta que no
      // pasa por la guarda. Es un fallo de programacion, no del usuario.
      throw new Error('@CurrentStaff() usado en una ruta sin autenticar');
    }
    return request.staff;
  },
);
