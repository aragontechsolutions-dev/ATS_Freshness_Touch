import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { SystemHealth } from '@freshness/types';
import { ADMIN_ROUTE, Roles } from '../auth/auth.decorators';
import { SKIP_QUOTE_THROTTLER } from '../common/throttling';
import { SystemChecksService } from './system-checks.service';

/**
 * EL DIAGNOSTICO DETALLADO, SOLO PARA ADMINISTRACION
 * ---------------------------------------------------
 * Las sondas publicas (`/health` y `/health/ready`) siguen donde estaban y
 * siguen diciendo lo mismo de siempre: si el proceso esta en pie y si la
 * base responde. Esto es otra cosa.
 *
 * ========================================================================
 * POR QUE ESTO NO PUEDE SER PUBLICO
 * ========================================================================
 * `/health/ready` tiene que ser publico porque lo consulta Render. Este no,
 * y la diferencia esta en lo que cuenta: que hay migraciones pendientes dice
 * que el esquema de la base no coincide con el codigo desplegado, y eso es
 * media invitacion. Que el proveedor de pago esta en modo simulado dice que
 * AHORA MISMO se pueden hacer reservas sin que se retenga dinero.
 *
 * Es informacion de operacion, y la operacion es de la empresa.
 *
 * ========================================================================
 * SOLO ADMINISTRACION, TAMBIEN PARA LEER
 * ========================================================================
 * Mismo criterio que la configuracion del negocio y el registro de
 * auditoria. Coordinacion mueve citas y asigna equipos; el estado de las
 * migraciones y de las claves de pago no es su trabajo, y saberlo no le
 * ayuda a hacerlo.
 *
 * SOLO LECTURA, y no hay nada que escribir: esta pantalla no arregla nada.
 * Arreglar una migracion pendiente se hace con `db:deploy` y credenciales,
 * desde fuera. Un boton de «reparar» en el panel seria un boton que ejecuta
 * migraciones desde un navegador, y eso no se pone nunca.
 */
@SkipThrottle(SKIP_QUOTE_THROTTLER)
@Controller(`${ADMIN_ROUTE}/system-health`)
export class SystemHealthController {
  constructor(private readonly checks: SystemChecksService) {}

  @Get()
  @Roles('ADMIN')
  get(): Promise<SystemHealth> {
    /*
     * NO SE AUDITA, y es la diferencia con el registro de auditoria, que si
     * anota cada consulta.
     *
     * Alli lo que se mira son los actos de las personas, y mirar eso es un
     * acto que tambien deja rastro. Aqui lo que se mira es una maquina. Si
     * cada vistazo al estado escribiera una fila, la pantalla —que se
     * refresca sola— llenaria el registro de auditoria de ruido y enterraria
     * justo lo que ese registro existe para conservar.
     *
     * Lo cacheado se devuelve tal cual: ver `SystemChecksService`.
     */
    return this.checks.run();
  }
}
