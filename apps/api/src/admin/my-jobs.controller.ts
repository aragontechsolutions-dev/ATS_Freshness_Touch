import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Req } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ChecklistProgressSchema,
  MyJobProgressSchema,
  type AuthenticatedStaff,
  type ChecklistProgress,
  type MyJob,
  type MyJobProgress,
  type MyJobs,
} from '@freshness/types';
import type { Request } from 'express';
import { ADMIN_ROUTE, CurrentStaff, Roles } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { SKIP_QUOTE_THROTTLER } from '../common/throttling';
import { MyJobsService } from './my-jobs.service';

/**
 * MIS TRABAJOS
 * ------------
 * La unica parte del panel donde CLEANER entra, y entra sin necesidad de
 * ningun filtro por rol en la consulta: lo que decide que se ve es la tabla
 * de asignaciones, no el puesto.
 *
 * POR ESO ADMITE A LOS TRES ROLES. Parece contradictorio en una pantalla
 * "del equipo de limpieza", pero es lo correcto: en una empresa pequena quien
 * coordina tambien limpia, y ya se le puede asignar a un trabajo desde la
 * etapa anterior. Si esto fuera solo para CLEANER, esa persona se veria
 * asignada en la agenda y no encontraria su propio trabajo en ningun sitio.
 *
 * Y no abre nada de mas: quien no tenga asignaciones vera una lista vacia.
 */
@SkipThrottle(SKIP_QUOTE_THROTTLER)
@Controller(`${ADMIN_ROUTE}/my-jobs`)
export class MyJobsController {
  constructor(private readonly jobs: MyJobsService) {}

  @Get()
  @Roles('ADMIN', 'DISPATCHER', 'CLEANER')
  list(@CurrentStaff() staff: AuthenticatedStaff): Promise<MyJobs> {
    // El identificador sale de la SESION. Si viniera en la direccion,
    // cualquiera podria pedir los trabajos de otra persona.
    return this.jobs.list(staff);
  }

  /**
   * Marcar que se ha llegado o que se ha terminado.
   *
   * El esquema va en el parametro del cuerpo, NO en `@UsePipes()`: a nivel de
   * metodo se aplicaria tambien al identificador de la URL.
   */
  @Patch(':bookingId/progress')
  @Roles('ADMIN', 'DISPATCHER', 'CLEANER')
  progress(
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) bookingId: string,
    @Body(new ZodValidationPipe<MyJobProgress>(MyJobProgressSchema)) body: MyJobProgress,
    @CurrentStaff() staff: AuthenticatedStaff,
    @Req() request: Request,
  ): Promise<MyJob> {
    return this.jobs.progress(bookingId, body, staff, request.ip ?? null);
  }

  /**
   * Marcar o desmarcar una tarea de la lista de verificacion.
   *
   * ======================================================================
   * UN ENDPOINT APARTE, Y NO UN CAMPO MAS EN `progress`
   * ======================================================================
   * Son dos hechos distintos y van por caminos distintos a proposito:
   * `progress` cambia el estado del trabajo y ficha, con su transaccion y su
   * entrada de auditoria; esto marca una casilla.
   *
   * Juntarlos obligaria a mandar el estado del trabajo en cada toque de la
   * lista, y entonces un toque mal puesto podria cerrar un trabajo. Son
   * veinticinco toques por casa: es demasiada superficie para colgarla del
   * mismo camino que cierra un trabajo y mueve el dinero.
   *
   * DEVUELVE EL TRABAJO ENTERO, no solo la tarea. Asi la pantalla se pinta
   * con lo que de verdad hay en la base despues del toque, incluido lo que
   * una companera haya marcado mientras tanto, en vez de con lo que el movil
   * cree que acaba de pasar.
   */
  @Patch(':bookingId/checklist')
  @Roles('ADMIN', 'DISPATCHER', 'CLEANER')
  markChecklistItem(
    @Param('bookingId', new ParseUUIDPipe({ version: '4' })) bookingId: string,
    @Body(new ZodValidationPipe<ChecklistProgress>(ChecklistProgressSchema))
    body: ChecklistProgress,
    @CurrentStaff() staff: AuthenticatedStaff,
  ): Promise<MyJob> {
    /*
     * NO SE PASA LA IP, al contrario que `progress`: aqui no se escribe
     * auditoria. El motivo esta en el servicio —una lista son veinticinco
     * toques, y auditarlos enterraria lo que coordinacion de verdad busca—, y
     * la propia fila ya lleva quien la marco y cuando.
     */
    return this.jobs.markChecklistItem(bookingId, body, staff);
  }
}
