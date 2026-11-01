import {
  CHECKLIST_ROOMS,
  JOB_CHECKLIST_CATALOG,
  checklistForService,
  type AddOnCode,
  type ChecklistItem,
  type ChecklistRoom,
  type JobChecklistEntry,
  type ServiceType,
} from '@freshness/types';
import { ExtrasGuardadosSchema } from './field-adjustment.helper';

/**
 * LA LISTA DE VERIFICACION DE UN TRABAJO, MONTADA EN UN SITIO
 * ==========================================================
 * Junta las dos mitades: el catalogo de tareas, que vive en el codigo, y las
 * filas de lo que ya se marco, que viven en la base de datos.
 *
 * ESTA APARTE DE LOS DOS SERVICIOS QUE LA USAN —la pantalla de limpieza y el
 * detalle del panel— y es a proposito: si cada uno montara la lista por su
 * cuenta, coordinacion y limpieza podrian estar viendo listas distintas del
 * mismo trabajo. Esa es exactamente la clase de discrepancia que convierte
 * «yo lo marque» en una discusion sin arbitro.
 */

/**
 * EL CATALOGO DE TAREAS, COMO DEPENDENCIA INYECTADA.
 *
 * ========================================================================
 * POR QUE UN PROVEEDOR Y NO LA CONSTANTE IMPORTADA DIRECTAMENTE
 * ========================================================================
 * El catalogo de verdad tiene cincuenta y nueve tareas con codigos largos
 * —`KITCHEN_APPLIANCE_FRONTS`—. Una prueba de punta a punta que los use tiene
 * que elegir uno de esos codigos a mano, y a partir de ahi deja de probar el
 * camino de escritura y pasa a probar que ese codigo sigue existiendo: el dia
 * que la dueña reordene su lista, la prueba se cae por un motivo que no tiene
 * nada que ver con lo que verifica.
 *
 * Lo que importa verificar es que marcar escribe una fila, que marcar dos
 * veces no escribe dos, que desmarcar borra, y que no se puede marcar en un
 * trabajo ajeno. Con un token, la prueba pasa un catalogo de tres tareas
 * inventadas y recorre EL MISMO codigo que produccion.
 *
 * Y sigue habiendo un motivo que no es de pruebas: cuando el catalogo salga
 * del codigo y lo edite coordinacion desde el panel, el sitio por donde
 * entra ya esta hecho.
 *
 * Es la misma decision que ya se tomo con el proveedor de geocodificacion y
 * con el de pagos: lo que cambia entre entornos entra por la puerta de
 * delante.
 */
export const JOB_CHECKLIST_CATALOG_TOKEN = 'JOB_CHECKLIST_CATALOG';

/** Una fila de tarea marcada, tal como se lee de la base. */
export interface FilaTareaMarcada {
  itemCode: string;
  doneAt: Date;
  doneBy: { firstName: string };
}

/**
 * La lista completa de un trabajo: las tareas que toca y su estado.
 *
 * ========================================================================
 * INCLUYE LAS TAREAS MARCADAS QUE YA NO ESTAN EN EL CATALOGO
 * ========================================================================
 * Pasa con las retiradas: se marcaron cuando se pedian, y hay que seguir
 * leyendolas en ese trabajo. Si se dejaran fuera, un trabajo de hace tres
 * meses parecerian siete tareas cuando se hicieron nueve, y la lista estaria
 * mintiendo justo cuando se consulta por un motivo.
 *
 * Van al final y marcadas con `retired`, para que la pantalla pueda decir
 * «esto ya no se pide» en vez de enseñarlas como trabajo de hoy.
 *
 * ========================================================================
 * Y ESO MISMO CUBRE UN EXTRA QUE SE QUITO DESPUES DE MARCARLO
 * ========================================================================
 * `extras` decide si el interior del horno entra en la lista. Si un ajuste de
 * campo quitara ese extra de la reserva despues de que alguien marcara la
 * tarea, la tarea ya no estaria en la lista de hoy — y por el mismo camino de
 * arriba se sigue leyendo, señalada. No se pierde el registro de un trabajo
 * que se hizo de verdad.
 */
export function montarChecklist(
  service: ServiceType,
  extras: readonly AddOnCode[],
  marcadas: readonly FilaTareaMarcada[],
  catalogo?: readonly ChecklistItem[],
): JobChecklistEntry[] {
  const porCodigo = new Map(marcadas.map((fila) => [fila.itemCode, fila]));

  const vigentes = checklistForService(service, extras, catalogo);
  const entradas: JobChecklistEntry[] = vigentes.map((tarea) =>
    entrada(tarea.code, tarea.room, false, porCodigo.get(tarea.code)),
  );

  /*
   * Lo marcado que no sale en la lista de hoy. El caso normal es una tarea
   * retirada; tambien cubre el caso en el que se cambia a que servicios
   * aplica una tarea despues de haberla marcado en un trabajo.
   *
   * La estancia se busca en el catalogo COMPLETO —retiradas incluidas—,
   * porque la tarea existe, solo que ya no se pide. El `??` final es para un
   * codigo que no este ni ahi: no deberia pasar nunca, porque los codigos no
   * se borran, pero si pasara es mejor pintar la tarea en areas comunes que
   * perderla.
   */
  const codigosVigentes = new Set(vigentes.map((tarea) => tarea.code));
  for (const fila of marcadas) {
    if (codigosVigentes.has(fila.itemCode)) continue;
    entradas.push(entrada(fila.itemCode, estanciaDe(fila.itemCode, catalogo), true, fila));
  }

  return entradas;
}

function entrada(
  code: string,
  room: ChecklistRoom,
  retired: boolean,
  marcada: FilaTareaMarcada | undefined,
): JobChecklistEntry {
  return {
    code,
    room,
    done: marcada !== undefined,
    doneAt: marcada?.doneAt.toISOString() ?? null,
    doneByFirstName: marcada?.doneBy.firstName ?? null,
    retired,
  };
}

/**
 * La estancia de un codigo, buscando tambien entre las tareas retiradas.
 *
 * Se busca en el catalogo COMPLETO y no con `checklistForService`, que filtra
 * las retiradas: aqui lo que se busca es justo una de ellas.
 */
function estanciaDe(code: string, catalogo?: readonly ChecklistItem[]): ChecklistRoom {
  const todas = catalogo ?? JOB_CHECKLIST_CATALOG;
  return todas.find((tarea) => tarea.code === code)?.room ?? CHECKLIST_ROOMS[0];
}

/**
 * Comprueba que un codigo de tarea es de los que este trabajo pide.
 *
 * ES UNA COMPROBACION DE SEGURIDAD, NO DE FORMA, y por eso esta en el
 * servidor: sin ella, cualquiera con sesion podria escribir en la base de
 * datos una fila por cada cadena que se le ocurriera, usando la lista de
 * tareas como un almacen de texto libre asociado a una reserva.
 *
 * Las retiradas NO valen: una tarea que la empresa ya no hace no se puede
 * marcar como hecha hoy.
 *
 * Y TAMPOCO VALE LA DE UN EXTRA QUE NO SE PAGO. Es la mitad que de verdad
 * importa de los extras: sin esto, el movil podria marcar
 * `ADDON_INSIDE_OVEN` en una reserva sin ese extra, y quedaria registrado que
 * se limpio por dentro un horno que nadie contrato. Eso no es un dato de
 * adorno: es lo que coordinacion lee cuando un cliente reclama, y lo que
 * sostiene la factura de un extra.
 */
export function esTareaDelTrabajo(
  service: ServiceType,
  extras: readonly AddOnCode[],
  itemCode: string,
  catalogo?: readonly ChecklistItem[],
): boolean {
  return checklistForService(service, extras, catalogo).some((tarea) => tarea.code === itemCode);
}

/**
 * LOS CODIGOS DE EXTRA DE UNA RESERVA, LEIDOS DEL JSON DE LA BASE.
 *
 * La columna `addOns` es un `Json` opaco: lo que hay dentro lo escribio
 * alguna version del codigo, puede que no la de hoy. `ExtrasGuardadosSchema`
 * es el MISMO contrato con el que se releen los extras para el precio y para
 * los ajustes de campo, y su `catch([])` convierte una lista ilegible en «sin
 * extras» en vez de en una pantalla rota.
 *
 * QUE EL FALLO CAIGA DEL LADO DE «SIN EXTRAS» ES LO CORRECTO AQUI: una lista
 * a la que le falta la tarea del horno se nota —el equipo pregunta— y no deja
 * rastro falso. Una lista con la tarea del horno que nadie pago se marca, y
 * entonces la base de datos afirma que se hizo un trabajo que no se vendio.
 */
export function extrasContratados(addOns: unknown): readonly AddOnCode[] {
  return ExtrasGuardadosSchema.parse(addOns).map((extra) => extra.code);
}
