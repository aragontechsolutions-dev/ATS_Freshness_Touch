import { Controller, Get, Ip, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  AuditQuerySchema,
  type AuditPage,
  type AuditQuery,
  type AuthenticatedStaff,
} from '@freshness/types';
import { ADMIN_ROUTE, CurrentStaff, Roles } from '../auth/auth.decorators';
import { SKIP_QUOTE_THROTTLER } from '../common/throttling';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuditQueryService } from './audit-query.service';

/**
 * CONSULTA DEL REGISTRO DE AUDITORIA
 * ----------------------------------
 * SOLO ADMINISTRACION. No es una restriccion de comodidad: aqui se ve quien
 * hizo que y desde donde, incluidos los companeros. Coordinacion puede mover
 * citas y asignar equipos, pero no tiene por que poder revisar la actividad
 * de nadie.
 *
 * SOLO LECTURA. No hay POST, ni PATCH, ni DELETE, y no es un olvido: el
 * unico borrado del modulo es la purga por antiguedad, que corre sola y no
 * elige filas. Un registro que se puede editar no prueba nada, y el dia que
 * alguien quiera cambiarlo sera justo el dia en que importe.
 */
@SkipThrottle(SKIP_QUOTE_THROTTLER)
@Controller(`${ADMIN_ROUTE}/audit`)
export class AuditController {
  constructor(private readonly auditQuery: AuditQueryService) {}

  @Get()
  @Roles('ADMIN')
  async list(
    /*
     * EL ESQUEMA VA EN EL PARAMETRO, NO EN `@UsePipes()` A NIVEL DE METODO.
     *
     * No es un detalle de estilo. Nest aplica una tuberia de metodo a TODOS
     * los parametros que puede validar, y eso incluye los decoradores
     * propios como `@CurrentStaff()`. Con `@UsePipes` aqui, la ficha de quien
     * consulta pasaba por `AuditQuerySchema`, que al no ser estricto se queda
     * con los campos que conoce y descarta el resto: `staff` llegaba
     * convertido en `{ limit: 50 }`.
     *
     * El resultado era el peor posible para un registro de auditoria: la
     * consulta se anotaba igual, con un 200 y sin error, pero SIN QUIEN LA
     * HIZO. Lo encontro la prueba de punta a punta al comprobar el autor.
     */
    @Query(new ZodValidationPipe<AuditQuery>(AuditQuerySchema))
    filtros: AuditQuery,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Ip() ip: string,
  ): Promise<AuditPage> {
    /*
     * SE ANOTA LA CONSULTA ANTES DE RESPONDER, Y SE ESPERA.
     *
     * Es la unica escritura de todo el modulo que se hace de forma
     * bloqueante, y es deliberado: si no se puede dejar constancia de que
     * alguien miro el registro, no se le ensena el registro. Al reves —
     * responder primero y anotar despues sin esperar— dejaria una ventana en
     * la que se puede consultar sin rastro, y bastaria con provocar fallos de
     * escritura para tener barra libre.
     *
     * Aqui si es preferible fallar: quedarse sin ver la auditoria un minuto
     * no rompe ninguna operacion del negocio.
     */
    await this.auditQuery.recordQuery(staff, filtros, ip);

    return this.auditQuery.query(filtros);
  }
}
