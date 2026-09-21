import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { AuthenticatedStaff } from '@freshness/types';
import { ADMIN_ROUTE, CurrentStaff } from '../auth/auth.decorators';
import { SKIP_ALL_THROTTLERS } from '../common/throttling';

@Controller(`${ADMIN_ROUTE}/session`)
export class SessionController {
  /**
   * Quien soy y hasta cuando dura mi sesion.
   *
   * El panel lo consulta al abrir para decidir si pinta la aplicacion o el
   * formulario de acceso, y para saber que opciones mostrar segun el rol.
   *
   * No lleva limitador: el panel lo llama al cargar y al recuperar el foco de
   * la pestana, y un 429 aqui expulsaria a alguien que si tiene permiso.
   */
  @Get()
  @SkipThrottle(SKIP_ALL_THROTTLERS)
  me(@CurrentStaff() staff: AuthenticatedStaff): AuthenticatedStaff {
    // La guarda global ya comprobo el token y que la persona sigue activa.
    return staff;
  }
}
