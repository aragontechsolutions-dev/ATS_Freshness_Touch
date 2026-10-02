import {
  CHECKLIST_ROOMS,
  JOB_CHECKLIST_CATALOG,
  checklistForService,
  type ChecklistItem,
  type ChecklistRoom,
  type JobChecklistEntry,
  type ServiceType,
} from '@freshness/types';

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
 * El catalogo de verdad esta VACIO hoy: las tareas de las plantillas del
 * cliente estan pendientes de transcribir. Con la constante importada a pelo,
 * el camino de escritura —marcar una tarea— no se podria probar de punta a
 * punta en absoluto: toda peticion seria rechazada por «esa tarea no existe»,
 * y la unica parte verificada seria el rechazo.
 *
 * Eso dejaria sin prueba justo lo que importa: que marcar escribe una fila,
 * que marcar dos veces no escribe dos, que desmarcar borra, y que no se puede
 * marcar en un trabajo ajeno. Con un token, la prueba de punta a punta pasa
 * un catalogo de tres tareas y recorre EL MISMO codigo que produccion.
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
 */
export function montarChecklist(
  service: ServiceType,
  marcadas: readonly FilaTareaMarcada[],
  catalogo?: readonly ChecklistItem[],
): JobChecklistEntry[] {
  const porCodigo = new Map(marcadas.map((fila) => [fila.itemCode, fila]));

  const vigentes = checklistForService(service, catalogo);
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
 */
export function esTareaDelTrabajo(
  service: ServiceType,
  itemCode: string,
  catalogo?: readonly ChecklistItem[],
): boolean {
  return checklistForService(service, catalogo).some((tarea) => tarea.code === itemCode);
}
