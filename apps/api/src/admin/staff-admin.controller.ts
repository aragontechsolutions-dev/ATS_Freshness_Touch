import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  StaffCreateSchema,
  StaffUpdateSchema,
  type AdminStaffDirectory,
  type AdminStaffDirectoryItem,
  type AuthenticatedStaff,
  type StaffCreate,
  type StaffUpdate,
} from '@freshness/types';
import type { Request } from 'express';
import { ADMIN_ROUTE, CurrentStaff, Roles } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SKIP_QUOTE_THROTTLER } from '../common/throttling';
import { StaffAdminService } from './staff-admin.service';

/**
 * DIRECTORIO Y GESTION DE PERSONAL
 * --------------------------------
 * SOLO ADMINISTRACION, tambien para leer, y por un motivo distinto al de las
 * otras pantallas restringidas.
 *
 * Que solo administracion pueda ESCRIBIR aqui es lo evidente: crear personal
 * y darle acceso es repartir autoridad sobre los datos de todos los clientes.
 * Coordinacion organiza la agenda; no decide quien entra por la puerta.
 *
 * Que solo administracion pueda LEER es menos evidente, porque coordinacion
 * ya ve los nombres de la plantilla en el selector de asignacion. La
 * diferencia esta en lo que acompana al nombre: aqui van el correo, el
 * telefono y quien tiene acceso al panel. Eso ultimo es un mapa de a quien
 * atacar para entrar: quien quiera colarse empieza por saber que cuentas
 * existen.
 *
 * El limitador de cotizaciones se desactiva A NIVEL DE CLASE, como en el
 * resto del panel. Ver `common/throttling.ts`.
 */
@SkipThrottle(SKIP_QUOTE_THROTTLER)
@Controller(`${ADMIN_ROUTE}/staff-directory`)
export class StaffAdminController {
  constructor(private readonly staff: StaffAdminService) {}

  @Get()
  @Roles('ADMIN')
  list(): Promise<AdminStaffDirectory> {
    return this.staff.directory(this.staff.canInvite);
  }

  /**
   * Alta.
   *
   * Nace SIN acceso al panel y activa. No hay contrasena que escribir en
   * ningun momento: dar acceso es una accion aparte y deliberada.
   */
  @Post()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe<StaffCreate>(StaffCreateSchema)) body: StaffCreate,
    @CurrentStaff() actor: AuthenticatedStaff,
    @Req() request: Request,
  ): Promise<AdminStaffDirectoryItem> {
    return this.staff.create(body, actor, request.ip ?? null);
  }

  /**
   * Edicion de la ficha entera, el estado incluido.
   *
   * El esquema va en el parametro del cuerpo, NO en `@UsePipes()`: a nivel de
   * metodo se aplicaria tambien al identificador de la URL.
   */
  @Put(':staffId')
  @Roles('ADMIN')
  update(
    @Param('staffId', new ParseUUIDPipe({ version: '4' })) staffId: string,
    @Body(new ZodValidationPipe<StaffUpdate>(StaffUpdateSchema)) body: StaffUpdate,
    @CurrentStaff() actor: AuthenticatedStaff,
    @Req() request: Request,
  ): Promise<AdminStaffDirectoryItem> {
    return this.staff.update(staffId, body, actor, request.ip ?? null);
  }

  /** Manda la invitacion al panel y vincula la cuenta creada. */
  @Post(':staffId/invite')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  invite(
    @Param('staffId', new ParseUUIDPipe({ version: '4' })) staffId: string,
    @CurrentStaff() actor: AuthenticatedStaff,
    @Req() request: Request,
  ): Promise<AdminStaffDirectoryItem> {
    return this.staff.invite(staffId, actor, request.ip ?? null);
  }
}
