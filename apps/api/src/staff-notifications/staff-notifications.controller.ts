import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  NOTIFICATION_PREVIEW_COUNT,
  type AuthenticatedStaff,
  type StaffNotificationList,
} from '@freshness/types';
import { ADMIN_ROUTE, CurrentStaff } from '../auth/auth.decorators';
import { SKIP_QUOTE_THROTTLER } from '../common/throttling';
import { StaffNotificationsService } from './staff-notifications.service';

/** Tope de lo que se puede pedir de una vez, para que nadie pida la tabla. */
const MAXIMO = 100;

/**
 * LA BANDEJA DEL EQUIPO
 * ---------------------
 * SIN `@Roles`: esto no es de un puesto, es de TODOS. Lo que cambia no es el
 * permiso sino el contenido — cada puesto ve lo suyo, y eso lo decide la
 * consulta, no el guardia. Poner un rol aqui dejaria a limpieza sin bandeja.
 *
 * EXENTA DEL LIMITADOR DE COTIZACIONES: el panel pregunta por el contador
 * cada vez que se abre una pantalla, y ese limitador esta puesto para el
 * cotizador publico. Sin esto, trabajar media hora seguida en el panel
 * acabaria devolviendo 429 en la campana.
 */
@Controller(`${ADMIN_ROUTE}/notifications`)
@SkipThrottle(SKIP_QUOTE_THROTTLER)
export class StaffNotificationsController {
  constructor(private readonly notificaciones: StaffNotificationsService) {}

  /**
   * La bandeja, lo mas reciente primero.
   *
   * `limit` lo pone quien llama porque hay dos pantallas con necesidades
   * distintas: el desplegable pide cinco y la lista completa pide mas. El
   * contador de no leidas es el mismo en las dos y cuenta TODAS.
   */
  @Get()
  listar(
    @CurrentStaff() staff: AuthenticatedStaff,
    @Query('limit') limit?: string,
  ): Promise<StaffNotificationList> {
    const pedido = Number.parseInt(limit ?? '', 10);
    const limite =
      Number.isFinite(pedido) && pedido > 0 ? Math.min(pedido, MAXIMO) : NOTIFICATION_PREVIEW_COUNT;

    return this.notificaciones.listar(staff, limite);
  }

  /**
   * Marca como leidas. Para quien pregunta, no para su puesto entero: una
   * notificacion del puesto la ven varias personas y cada una lleva su cuenta.
   */
  @Post('read')
  @HttpCode(204)
  async marcarLeidas(
    @Body('ids') ids: unknown,
    @CurrentStaff() staff: AuthenticatedStaff,
  ): Promise<void> {
    const lista = Array.isArray(ids)
      ? ids.filter((id): id is string => typeof id === 'string')
      : [];
    await this.notificaciones.marcarLeidas(lista, staff);
  }

  @Post('read-all')
  @HttpCode(204)
  async marcarTodasLeidas(@CurrentStaff() staff: AuthenticatedStaff): Promise<void> {
    await this.notificaciones.marcarTodasLeidas(staff);
  }
}
