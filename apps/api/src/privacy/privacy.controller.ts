import {
  Body,
  Controller,
  Get,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  PrivacyCorrectionSchema,
  PrivacyErasureSchema,
  type AuthenticatedStaff,
  type PrivacyCorrection,
  type PrivacyErasure,
  type PrivacyErasureResult,
  type PrivacyExport,
  type PrivacySearchResult,
} from '@freshness/types';
import { ADMIN_ROUTE, CurrentStaff, Roles } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RECOVERY_RATE_LIMIT, SKIP_QUOTE_THROTTLER } from '../common/throttling';
import { PrivacyService } from './privacy.service';

/**
 * LOS DERECHOS DE PRIVACIDAD
 * ==========================
 * SOLO ADMINISTRACION, y es la restriccion mas facil de justificar de todo
 * el panel: aqui se descarga el expediente completo de una persona y se
 * borra para siempre. Coordinacion mueve la agenda; esto no es la agenda.
 *
 * ========================================================================
 * CON LIMITE DE PETICIONES, AUNQUE SEA UNA RUTA INTERNA
 * ========================================================================
 * El resto del panel esta exento porque son pantallas que se abren todo el
 * dia. Esta no: una cuenta de administracion comprometida que recorra la
 * base exportando clientes uno a uno es el peor escenario del sistema, y un
 * limite bajo convierte «en diez minutos» en «en varios dias», que es tiempo
 * de sobra para que alguien lo note en la auditoria.
 */
@SkipThrottle(SKIP_QUOTE_THROTTLER)
@Controller(`${ADMIN_ROUTE}/privacy`)
@Roles('ADMIN')
export class PrivacyController {
  constructor(private readonly privacidad: PrivacyService) {}

  /**
   * Busca por correo, EXACTO.
   *
   * Con una busqueda parcial, escribir «@gmail» sacaria media cartera de
   * clientes en la pantalla que exporta y borra.
   */
  @Get('customers')
  @Throttle({ global: RECOVERY_RATE_LIMIT, quotes: RECOVERY_RATE_LIMIT })
  buscar(@Query('email') email?: string): Promise<PrivacySearchResult> {
    return this.privacidad.buscar(email ?? '');
  }

  /** La copia de todo lo que tenemos sobre esa persona. Se audita. */
  @Get('customers/:customerId/export')
  @Throttle({ global: RECOVERY_RATE_LIMIT, quotes: RECOVERY_RATE_LIMIT })
  exportar(
    @Param('customerId', new ParseUUIDPipe({ version: '4' })) customerId: string,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Ip() ip: string,
  ): Promise<PrivacyExport> {
    return this.privacidad.exportar(customerId, staff, ip);
  }

  @Patch('customers/:customerId')
  async corregir(
    @Param('customerId', new ParseUUIDPipe({ version: '4' })) customerId: string,
    @Body(new ZodValidationPipe<PrivacyCorrection>(PrivacyCorrectionSchema))
    cambio: PrivacyCorrection,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Ip() ip: string,
  ): Promise<void> {
    await this.privacidad.corregir(customerId, cambio, staff, ip);
  }

  /**
   * El borrado. IRREVERSIBLE: anonimiza y no hay deshacer.
   *
   * Pide el correo escrito a mano y tiene que coincidir. Un «¿seguro?» se
   * pulsa dos veces seguidas sin leer; copiar el correo obliga a mirar A
   * QUIEN se esta borrando, que es el error que hay que evitar.
   */
  @Post('customers/:customerId/erase')
  @Throttle({ global: RECOVERY_RATE_LIMIT, quotes: RECOVERY_RATE_LIMIT })
  borrar(
    @Param('customerId', new ParseUUIDPipe({ version: '4' })) customerId: string,
    @Body(new ZodValidationPipe<PrivacyErasure>(PrivacyErasureSchema)) peticion: PrivacyErasure,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Ip() ip: string,
  ): Promise<PrivacyErasureResult> {
    return this.privacidad.anonimizar(customerId, peticion, staff, ip);
  }
}
