import { describe, expect, it } from 'vitest';
import {
  ALL_SERVICES,
  CHECKLIST_ROOMS,
  ChecklistProgressSchema,
  JOB_CHECKLIST_CATALOG,
  JobChecklistEntrySchema,
  checklistForService,
  checklistItemTextKey,
  checklistRoomsPresent,
  pendingChecklistCount,
  type ChecklistItem,
  type JobChecklistEntry,
} from './job-checklist';

/**
 * UN CATALOGO DE PRUEBA, PORQUE EL DE VERDAD ESTA VACIO.
 *
 * El catalogo real espera las capturas de las plantillas de trabajo del
 * cliente (`docs/21` §4). Estas pruebas no pueden depender de un contenido
 * que no existe, asi que prueban la MAQUINARIA con un catalogo propio: el
 * orden por estancia, el filtro por servicio y el apagado de las retiradas
 * se comportan igual con tres tareas que con veinticinco.
 *
 * Es ademas el motivo por el que `checklistForService` recibe el catalogo por
 * parametro.
 */
const CATALOGO: readonly ChecklistItem[] = [
  { code: 'KITCHEN_A', room: 'KITCHEN', appliesTo: ALL_SERVICES },
  { code: 'COMMON_A', room: 'COMMON_AREAS', appliesTo: ALL_SERVICES },
  { code: 'BATH_A', room: 'BATHROOM', appliesTo: ALL_SERVICES },
  { code: 'COMMON_B', room: 'COMMON_AREAS', appliesTo: ALL_SERVICES },
  { code: 'DEEP_ONLY', room: 'KITCHEN', appliesTo: ['DEEP'] },
  { code: 'OLD_ONE', room: 'KITCHEN', appliesTo: ALL_SERVICES, retired: true },
];

function entrada(cambios: Partial<JobChecklistEntry> = {}): JobChecklistEntry {
  return {
    code: 'COMMON_A',
    room: 'COMMON_AREAS',
    done: false,
    doneAt: null,
    doneByFirstName: null,
    retired: false,
    ...cambios,
  };
}

describe('el catalogo de verdad', () => {
  it('ESTA PENDIENTE DE CONTENIDO, y esta prueba lo deja escrito', () => {
    /*
     * NO ES UNA PRUEBA DE QUE ESTE VACIO: es un recordatorio con forma de
     * prueba. Las tareas de las plantillas del cliente —areas comunes (11),
     * baños (7) y cocina (7)— no se han transcrito todavia.
     *
     * El dia que se rellene, esta prueba se pone en rojo y hay que cambiarla
     * por las de abajo, que comprueban el contenido de verdad. Es
     * deliberado: asi nadie rellena el catalogo sin enterarse de que hay
     * comprobaciones que escribir.
     */
    expect(JOB_CHECKLIST_CATALOG).toEqual([]);
  });

  it('cuando se rellene, ningun codigo podra repetirse', () => {
    /*
     * Esta si vale ya, vacio o lleno, y es la invariante critica: dos tareas
     * con el mismo codigo comparten fila en la base de datos, asi que marcar
     * una marcaria la otra.
     */
    const codigos = JOB_CHECKLIST_CATALOG.map((tarea) => tarea.code);
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it('y ninguna tarea podra quedarse sin servicio al que aplicar', () => {
    // Una tarea con `appliesTo` vacio no sale en ninguna lista: es una tarea
    // escrita que nadie vera nunca, y eso siempre es un error de dedo.
    for (const tarea of JOB_CHECKLIST_CATALOG) {
      expect(tarea.appliesTo.length, tarea.code).toBeGreaterThan(0);
    }
  });
});

describe('la lista de un servicio', () => {
  it('va agrupada por estancia, en el orden del recorrido de la casa', () => {
    /*
     * El catalogo de prueba tiene la cocina primero a proposito. Si la lista
     * saliera en el orden del catalogo, se saltaria de la cocina al salon y
     * volveria al baño, y habria que leerla entera varias veces.
     */
    const codigos = checklistForService('STANDARD', CATALOGO).map((t) => t.code);

    expect(codigos).toEqual(['COMMON_A', 'COMMON_B', 'BATH_A', 'KITCHEN_A']);
  });

  it('dentro de una estancia respeta el orden del catalogo', () => {
    // Es el orden de la plantilla del cliente, que es el orden en el que de
    // verdad se limpia una habitacion.
    const comunes = checklistForService('STANDARD', CATALOGO)
      .filter((t) => t.room === 'COMMON_AREAS')
      .map((t) => t.code);

    expect(comunes).toEqual(['COMMON_A', 'COMMON_B']);
  });

  it('deja fuera las tareas de otros servicios', () => {
    const estandar = checklistForService('STANDARD', CATALOGO).map((t) => t.code);
    const profunda = checklistForService('DEEP', CATALOGO).map((t) => t.code);

    expect(estandar).not.toContain('DEEP_ONLY');
    expect(profunda).toContain('DEEP_ONLY');
  });

  it('DEJA FUERA LAS RETIRADAS: no se pide lo que la empresa ya no hace', () => {
    for (const servicio of ALL_SERVICES) {
      expect(checklistForService(servicio, CATALOGO).map((t) => t.code)).not.toContain('OLD_ONE');
    }
  });

  it('con el catalogo vacio devuelve una lista vacia, no falla', () => {
    // Es el estado de hoy: la maquinaria funciona y la seccion no se pinta.
    expect(checklistForService('STANDARD', [])).toEqual([]);
  });
});

describe('lo que queda por hacer', () => {
  it('cuenta solo las sin marcar', () => {
    expect(
      pendingChecklistCount([
        entrada({ code: 'A', done: true }),
        entrada({ code: 'B' }),
        entrada({ code: 'C' }),
      ]),
    ).toBe(2);
  });

  it('las retiradas NO cuentan: no son trabajo pendiente de nadie', () => {
    /*
     * Sin esto, un trabajo con una tarea retirada sin marcar diria «te queda
     * 1» para siempre, y no habria forma de marcarla porque no se pinta como
     * marcable.
     */
    expect(
      pendingChecklistCount([
        entrada({ code: 'A', done: true }),
        entrada({ code: 'Z', retired: true }),
      ]),
    ).toBe(0);
  });

  it('una lista entera marcada no deja nada pendiente', () => {
    expect(
      pendingChecklistCount([entrada({ done: true }), entrada({ code: 'B', done: true })]),
    ).toBe(0);
  });

  it('y una lista vacia tampoco', () => {
    expect(pendingChecklistCount([])).toBe(0);
  });
});

describe('las estancias que se pintan', () => {
  it('solo las que tienen alguna tarea, en orden', () => {
    expect(
      checklistRoomsPresent([entrada({ room: 'KITCHEN' }), entrada({ room: 'COMMON_AREAS' })]),
    ).toEqual(['COMMON_AREAS', 'KITCHEN']);
  });

  it('una estancia sin tareas no deja una cabecera suelta', () => {
    // Pasa en cuanto un servicio no pide nada en la cocina.
    expect(checklistRoomsPresent([entrada({ room: 'BATHROOM' })])).toEqual(['BATHROOM']);
  });

  it('y todas las estancias del contrato son pintables', () => {
    const todas = CHECKLIST_ROOMS.map((room) => entrada({ room }));
    expect(checklistRoomsPresent(todas)).toEqual([...CHECKLIST_ROOMS]);
  });
});

describe('el contrato de marcar una tarea', () => {
  it('acepta marcar y desmarcar', () => {
    expect(ChecklistProgressSchema.safeParse({ itemCode: 'COMMON_A', done: true }).success).toBe(
      true,
    );
    expect(ChecklistProgressSchema.safeParse({ itemCode: 'COMMON_A', done: false }).success).toBe(
      true,
    );
  });

  it('RECHAZA un codigo desmesurado', () => {
    /*
     * Sin el tope, cada toque podria escribir en la base una cadena de un
     * megabyte. El codigo real son unas pocas letras.
     */
    expect(
      ChecklistProgressSchema.safeParse({ itemCode: 'A'.repeat(65), done: true }).success,
    ).toBe(false);
    expect(ChecklistProgressSchema.safeParse({ itemCode: '', done: true }).success).toBe(false);
  });

  it('rechaza campos de mas', () => {
    /*
     * El caso realista no es malicia, es un cliente que manda tambien
     * `doneAt` o `doneBy`. Los dos los pone el SERVIDOR: la hora, porque el
     * reloj de un movil se cambia a mano, y el autor, porque sale de la
     * sesion.
     */
    for (const extra of ['doneAt', 'doneByStaffId', 'bookingId']) {
      expect(
        ChecklistProgressSchema.safeParse({ itemCode: 'COMMON_A', done: true, [extra]: 'x' })
          .success,
      ).toBe(false);
    }
  });
});

describe('lo que se lee de una tarea', () => {
  it('una tarea marcada lleva hora y autor', () => {
    expect(
      JobChecklistEntrySchema.safeParse(
        entrada({ done: true, doneAt: '2026-10-01T12:00:00.000Z', doneByFirstName: 'Ana' }),
      ).success,
    ).toBe(true);
  });

  it('una tarea sin marcar los lleva a null', () => {
    expect(JobChecklistEntrySchema.safeParse(entrada()).success).toBe(true);
  });

  it('NO lleva el apellido de quien la marco', () => {
    // Igual que en el resto de la pantalla de limpieza: para saber quien hizo
    // que, en un equipo de dos o tres personas, sobra el nombre de pila.
    expect(
      JobChecklistEntrySchema.safeParse({ ...entrada(), doneByLastName: 'Perez' }).success,
    ).toBe(false);
  });
});

describe('las claves de traduccion', () => {
  it('el texto de una tarea sale de los paquetes de idioma, no del catalogo', () => {
    /*
     * Parte del equipo tiene el panel en castellano y parte en ingles. Una
     * lista escrita en el catalogo saldria en un solo idioma para todos.
     */
    expect(checklistItemTextKey('COMMON_A')).toBe('checklist.items.COMMON_A');
  });
});
