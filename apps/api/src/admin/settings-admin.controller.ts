import { Body, Controller, Get, Put, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  BusinessSettingsSchema,
  type AdminBusinessSettings,
  type AuthenticatedStaff,
  type BusinessSettings,
} from '@freshness/types';
import type { Request } from 'express';
import { ADMIN_ROUTE, CurrentStaff, Roles } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { BusinessSettingsService } from '../settings/business-settings.service';

/**
 * CONFIGURACION DEL NEGOCIO DESDE EL PANEL
 * ----------------------------------------
 * SOLO ADMINISTRACION, tambien para leer.
 *
 * Que solo administracion pueda ESCRIBIR es lo evidente: el telefono y el
 * correo que hay aqui son los que ve todo el que entra en la web. Quien
 * pudiera cambiarlos podria desviar las llamadas de todos los clientes a otro
 * numero, y el sitio lo anunciaria con total naturalidad. Es una suplantacion
 * de la empresa hecha desde dentro, y no tiene nada que ver con coordinar una
 * agenda.
 *
 * Que solo administracion pueda LEER aqui es menos evidente, porque el
 * telefono es publico. La diferencia es lo que acompana al dato: esta
 * pantalla dice ademas quien lo cambio y cuando, y eso si es informacion
 * interna. Quien solo necesita el telefono lo tiene en el endpoint publico.
 */
@Controller(`${ADMIN_ROUTE}/settings`)
export class SettingsAdminController {
  constructor(private readonly settings: BusinessSettingsService) {}

  @Get()
  @Roles('ADMIN')
  @SkipThrottle({ quotes: true })
  get(): Promise<AdminBusinessSettings> {
    return this.settings.getForAdmin();
  }

  /**
   * Guarda la configuracion entera de una vez.
   *
   * Es un PUT y no un PATCH por una razon concreta: el horario es un bloque
   * de siete dias que se edita junto. Aceptar cambios parciales obligaria a
   * fusionar lo enviado con lo guardado, y dos personas editando a la vez
   * acabarian con una semana mitad de cada una, sin que ninguna lo supiera.
   *
   * El esquema va en el parametro del cuerpo, NO en `@UsePipes()`: a nivel de
   * metodo se aplicaria tambien al resto de parametros. Ese error dejo todos
   * los endpoints de acciones devolviendo 400 en la etapa anterior.
   */
  @Put()
  @Roles('ADMIN')
  @SkipThrottle({ quotes: true })
  async update(
    @Body(new ZodValidationPipe<BusinessSettings>(BusinessSettingsSchema))
    settings: BusinessSettings,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Req() request: Request,
  ): Promise<AdminBusinessSettings> {
    await this.settings.update(settings, staff, request.ip);
    return this.settings.getForAdmin();
  }
}
