import { describe, expect, it } from 'vitest';
import {
  ALL_SERVICES,
  CHECKLIST_ROOMS,
  CHECKLIST_NOTE_MAX,
  ChecklistProgressSchema,
  JOB_CHECKLIST_CATALOG,
  JobChecklistEntrySchema,
  checklistCounts,
  checklistForService,
  checklistItemTextKey,
  checklistRoomTextKey,
  checklistRoomsPresent,
  type ChecklistItem,
  type ChecklistItemState,
  type JobChecklistEntry,
} from './job-checklist';
import { AddOnCodeSchema, type AddOnCode } from './enums';
import { OFFERED_ADD_ON_CODES } from './pricing-rates';

/**
 * UN CATALOGO DE PRUEBA, Y NO EL DE VERDAD.
 *
 * El de verdad tiene cincuenta y nueve tareas con codigos largos. Probar la
 * maquinaria con el obligaria a elegir codigos suyos a mano, y a partir de
 * ahi estas pruebas dejarian de comprobar el orden y el filtro para empezar a
 * comprobar que esos codigos siguen existiendo: el dia que la dueña reordene
 * su lista se caerian por un motivo que no tiene nada que ver con lo que
 * verifican.
 *
 * Con un catalogo propio de siete tareas se ve de un vistazo que lo que se
 * espera es lo que se espera. El contenido de verdad tiene sus propias
 * pruebas mas abajo.
 *
 * Es el motivo por el que `checklistForService` recibe el catalogo por
 * parametro.
 */
const CATALOGO: readonly ChecklistItem[] = [
  { code: 'KITCHEN_A', room: 'KITCHEN', appliesTo: ALL_SERVICES },
  { code: 'COMMON_A', room: 'COMMON_AREAS', appliesTo: ALL_SERVICES },
  { code: 'BATH_A', room: 'BATHROOM', appliesTo: ALL_SERVICES },
  { code: 'COMMON_B', room: 'COMMON_AREAS', appliesTo: ALL_SERVICES },
  { code: 'DEEP_ONLY', room: 'KITCHEN', appliesTo: ['DEEP'] },
  { code: 'OLD_ONE', room: 'KITCHEN', appliesTo: ALL_SERVICES, retired: true },
  {
    code: 'OVEN_EXTRA',
    room: 'KITCHEN',
    appliesTo: ALL_SERVICES,
    requiresAddOn: 'INSIDE_OVEN',
  },
];

/** Ninguna reserva de estas pruebas compro un extra, salvo donde se diga. */
const SIN_EXTRAS: readonly AddOnCode[] = [];

/**
 * Todos los extras pagados a la vez.
 *
 * Se usa donde lo que se comprueba es como se acumulan los SERVICIOS: con los
 * extras fuera, las comparaciones de longitud dependerian de dos cosas a la
 * vez y una tarea de extra mal puesta se colaria como si fuera del servicio.
 */
const TODOS_LOS_EXTRAS: readonly AddOnCode[] = AddOnCodeSchema.options;

function entrada(cambios: Partial<JobChecklistEntry> = {}): JobChecklistEntry {
  return {
    code: 'COMMON_A',
    room: 'COMMON_AREAS',
    state: null,
    note: null,
    markedAt: null,
    markedByFirstName: null,
    retired: false,
    ...cambios,
  };
}

/** Una tarea en un estado concreto, con hora y autor coherentes. */
function en(estado: ChecklistItemState, cambios: Partial<JobChecklistEntry> = {}) {
  return entrada({
    state: estado,
    markedAt: '2026-11-01T12:00:00.000Z',
    markedByFirstName: 'Ana',
    ...cambios,
  });
}

describe('el catalogo de verdad', () => {
  it('TIENE CONTENIDO: es la lista de la dueña, transcrita el 1/11/2026', () => {
    /*
     * Esta prueba existe por lo que habia antes en su sitio: una que exigia
     * que el catalogo estuviera VACIO, como recordatorio de que las tareas
     * estaban pendientes de transcribir. Cumplio su funcion —se puso en rojo
     * al rellenarlo— y ahora vigila lo contrario: que nadie se lo deje a
     * medias ni lo vacie por un conflicto de fusion mal resuelto.
     *
     * El numero esta escrito a mano a proposito. Si cambia, hay que mirar por
     * que: una tarea de menos es una tarea que el equipo deja de ver.
     */
    expect(JOB_CHECKLIST_CATALOG.length).toBe(59);
  });

  it('NINGUN CODIGO SE REPITE', () => {
    /*
     * La invariante critica: dos tareas con el mismo codigo comparten fila en
     * la base de datos, asi que marcar una marcaria la otra.
     */
    const codigos = JOB_CHECKLIST_CATALOG.map((tarea) => tarea.code);
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it('ningun codigo se pasa de los 64 caracteres que acepta el contrato', () => {
    /*
     * `ChecklistProgressSchema` topa `itemCode` en 64. Una tarea con un
     * codigo mas largo seria imposible de marcar: el servidor rechazaria cada
     * toque por un motivo que no se entiende mirando la pantalla.
     */
    for (const tarea of JOB_CHECKLIST_CATALOG) {
      expect(tarea.code.length, tarea.code).toBeLessThanOrEqual(64);
    }
  });

  it('ninguna tarea se queda sin servicio al que aplicar', () => {
    // Una tarea con `appliesTo` vacio no sale en ninguna lista: es una tarea
    // escrita que nadie vera nunca, y eso siempre es un error de dedo.
    for (const tarea of JOB_CHECKLIST_CATALOG) {
      expect(tarea.appliesTo.length, tarea.code).toBeGreaterThan(0);
    }
  });

  it('los extras que exige una tarea son extras que existen', () => {
    /*
     * `requiresAddOn` es un `AddOnCode`, asi que el compilador ya lo vigila.
     * Esto cubre lo que el compilador no puede: que el enumerado cambie y
     * alguien retire un extra del catalogo de ventas dejando aqui una tarea
     * que no volveria a aparecer nunca, sin error en ningun sitio.
     */
    for (const tarea of JOB_CHECKLIST_CATALOG) {
      if (tarea.requiresAddOn === undefined) continue;
      expect(AddOnCodeSchema.safeParse(tarea.requiresAddOn).success, tarea.code).toBe(true);
    }
  });

  it('LA ESTANDAR, LA PROFUNDA Y LA DE MUDANZA SE ACUMULAN, en ese orden', () => {
    /*
     * Es como lo escribio la dueña: la profunda es «todo lo de la estandar
     * mas», y la de mudanza «todo lo de la profunda mas». Se expresa con
     * `appliesTo` tarea por tarea, y esta prueba es la que comprueba que las
     * cincuenta y nueve declaraciones dicen de verdad eso.
     */
    const codigos = (servicio: 'STANDARD' | 'DEEP' | 'MOVE_IN_OUT'): readonly string[] =>
      checklistForService(servicio, TODOS_LOS_EXTRAS).map((tarea) => tarea.code);

    const estandar = codigos('STANDARD');
    const profunda = codigos('DEEP');
    const mudanza = codigos('MOVE_IN_OUT');

    expect(profunda).toEqual(expect.arrayContaining([...estandar]));
    expect(mudanza).toEqual(expect.arrayContaining([...profunda]));
    expect(estandar.length).toBeLessThan(profunda.length);
    expect(profunda.length).toBeLessThan(mudanza.length);
  });

  it('la estandar NO lleva tareas de profunda ni de mudanza', () => {
    const estandar = checklistForService('STANDARD', TODOS_LOS_EXTRAS).map((tarea) => tarea.code);

    expect(estandar.filter((code) => code.startsWith('DEEP_'))).toEqual([]);
    expect(estandar.filter((code) => code.startsWith('MOVE_'))).toEqual([]);
  });

  it('todas las estancias del contrato tienen alguna tarea', () => {
    /*
     * Una estancia declarada sin ninguna tarea es una cabecera que nunca se
     * pinta: o sobra la estancia, o falta la tarea.
     */
    for (const estancia of CHECKLIST_ROOMS) {
      const cuantas = JOB_CHECKLIST_CATALOG.filter((tarea) => tarea.room === estancia).length;
      expect(cuantas, estancia).toBeGreaterThan(0);
    }
  });
});

describe('la lista de un servicio', () => {
  it('va agrupada por estancia, en el orden del recorrido de la casa', () => {
    /*
     * El catalogo de prueba esta desordenado a proposito —cocina, salon,
     * baño, salon—. Si la lista saliera en el orden del catalogo, se saltaria
     * de la cocina al salon y volveria al baño, y habria que leerla entera
     * varias veces para no dejarse nada.
     */
    const codigos = checklistForService('STANDARD', SIN_EXTRAS, CATALOGO).map((t) => t.code);

    expect(codigos).toEqual(['KITCHEN_A', 'BATH_A', 'COMMON_A', 'COMMON_B']);
  });

  it('dentro de una estancia respeta el orden del catalogo', () => {
    // Es el orden de la plantilla del cliente, que es el orden en el que de
    // verdad se limpia una habitacion.
    const comunes = checklistForService('STANDARD', SIN_EXTRAS, CATALOGO)
      .filter((t) => t.room === 'COMMON_AREAS')
      .map((t) => t.code);

    expect(comunes).toEqual(['COMMON_A', 'COMMON_B']);
  });

  it('deja fuera las tareas de otros servicios', () => {
    const estandar = checklistForService('STANDARD', SIN_EXTRAS, CATALOGO).map((t) => t.code);
    const profunda = checklistForService('DEEP', SIN_EXTRAS, CATALOGO).map((t) => t.code);

    expect(estandar).not.toContain('DEEP_ONLY');
    expect(profunda).toContain('DEEP_ONLY');
  });

  it('DEJA FUERA LAS RETIRADAS: no se pide lo que la empresa ya no hace', () => {
    for (const servicio of ALL_SERVICES) {
      expect(checklistForService(servicio, SIN_EXTRAS, CATALOGO).map((t) => t.code)).not.toContain(
        'OLD_ONE',
      );
    }
  });

  it('con el catalogo vacio devuelve una lista vacia, no falla', () => {
    // La maquinaria funciona y la seccion simplemente no se pinta.
    expect(checklistForService('STANDARD', SIN_EXTRAS, [])).toEqual([]);
  });
});

describe('las tareas de un extra', () => {
  /*
   * ========================================================================
   * LA MITAD QUE IMPORTA: SIN EL EXTRA PAGADO, LA TAREA NO EXISTE
   * ========================================================================
   * El interior del horno, el del refrigerador, los gabinetes por dentro, los
   * vidrios y doblar la ropa NO entran en ninguna limpieza, ni siquiera en la
   * profunda o en la de mudanza: se pagan aparte. La lista de la dueña lo
   * dice dos veces.
   *
   * Que esto falle tiene dos costes distintos y los dos reales: ofrecer la
   * tarea sin el extra hace que el equipo limpie un horno que nadie pago;
   * omitirla con el extra pagado hace que alguien pague y no se limpie.
   */
  it('NO APARECE si no se contrato el extra', () => {
    const codigos = checklistForService('STANDARD', SIN_EXTRAS, CATALOGO).map((t) => t.code);

    expect(codigos).not.toContain('OVEN_EXTRA');
  });

  it('aparece si se contrato', () => {
    const codigos = checklistForService('STANDARD', ['INSIDE_OVEN'], CATALOGO).map((t) => t.code);

    expect(codigos).toContain('OVEN_EXTRA');
  });

  it('OTRO EXTRA NO LA DESBLOQUEA', () => {
    // Pagar el refrigerador no paga el horno.
    const codigos = checklistForService('STANDARD', ['INSIDE_FRIDGE'], CATALOGO).map((t) => t.code);

    expect(codigos).not.toContain('OVEN_EXTRA');
  });

  it('el extra no cambia nada de lo que ya entraba', () => {
    /*
     * Un extra SUMA una tarea; no puede quitar ni reordenar las demas. Sin
     * esto, un filtro mal escrito podria dejar la lista en «solo el horno».
     */
    const sin = checklistForService('STANDARD', SIN_EXTRAS, CATALOGO).map((t) => t.code);
    const con = checklistForService('STANDARD', ['INSIDE_OVEN'], CATALOGO).map((t) => t.code);

    expect(con.filter((code) => code !== 'OVEN_EXTRA')).toEqual(sin);
  });

  it('una tarea de extra RETIRADA sigue sin aparecer, aunque se pague', () => {
    /*
     * Las dos condiciones son independientes y las dos tienen que cumplirse.
     * Una tarea que la empresa ya no hace no se ofrece porque alguien la haya
     * pagado: eso se arregla devolviendo el dinero, no limpiando.
     */
    const catalogo: readonly ChecklistItem[] = [
      {
        code: 'OVEN_OLD',
        room: 'KITCHEN',
        appliesTo: ALL_SERVICES,
        requiresAddOn: 'INSIDE_OVEN',
        retired: true,
      },
    ];

    expect(checklistForService('STANDARD', ['INSIDE_OVEN'], catalogo)).toEqual([]);
  });

  it('en el catalogo de verdad, cada extra que se vende tiene su tarea', () => {
    /*
     * Al contrario que las de arriba, esta mira el contenido. Un extra que se
     * puede comprar y no tiene tarea es un extra que se cobra y que el equipo
     * no ve en la lista: lo limpia si se acuerda.
     *
     * OJO CON LO QUE *NO* COMPRUEBA: que la tarea exista no significa que el
     * extra este a la venta. `WINDOWS_AND_CABINETS` y `LAUNDRY` tienen tarea
     * y hoy NO se ofrecen (`OFFERED_ADD_ON_CODES`), asi que esas tareas no
     * apareceran en ninguna casa hasta que se pongan a la venta. Es correcto
     * y esta escrito a proposito: el dia que se ofrezcan, ya funcionan.
     */
    const conTarea = new Set(
      JOB_CHECKLIST_CATALOG.flatMap((tarea) =>
        tarea.requiresAddOn === undefined ? [] : [tarea.requiresAddOn],
      ),
    );

    for (const extra of OFFERED_ADD_ON_CODES) {
      expect(conTarea.has(extra), extra).toBe(true);
    }
  });
});

describe('como queda una lista, contada por estados', () => {
  it('SIN TOCAR Y PENDIENTE SE CUENTAN APARTE, y es el cambio que importa', () => {
    /*
     * ======================================================================
     * EL FALLO QUE ESTO ARREGLA, Y ERA EL MOTIVO DE LA DUENA
     * ======================================================================
     * Antes habia un solo numero: «sin marcar». Mezclaba una tarea que nadie
     * ha mirado con una que no habia que hacer, y el resultado era que una
     * casa vacia de mudanza salia con veinte tareas «sin hacer» cuando en
     * veinte de ellas no habia nada que hacer.
     */
    const cuentas = checklistCounts([
      entrada({ code: 'A' }),
      entrada({ code: 'B' }),
      en('DONE', { code: 'C' }),
      en('PENDING', { code: 'D', note: 'No habia productos' }),
      en('NOT_APPLICABLE', { code: 'E' }),
    ]);

    expect(cuentas).toEqual({ untouched: 2, done: 1, pending: 1, notApplicable: 1 });
  });

  it('LAS RETIRADAS NO CUENTAN EN NINGUNO de los cuatro', () => {
    /*
     * No son trabajo de nadie hoy: son historia de un trabajo viejo. Sin
     * esto, un trabajo con una tarea retirada sin tocar diria «te queda 1»
     * para siempre, y no habria forma de resolverla porque no se pinta como
     * tocable.
     */
    const cuentas = checklistCounts([
      entrada({ code: 'A', retired: true }),
      en('DONE', { code: 'B', retired: true }),
      en('PENDING', { code: 'C', retired: true }),
      en('NOT_APPLICABLE', { code: 'D', retired: true }),
    ]);

    expect(cuentas).toEqual({ untouched: 0, done: 0, pending: 0, notApplicable: 0 });
  });

  it('una lista entera resuelta no deja nada sin tocar', () => {
    const cuentas = checklistCounts([en('DONE'), en('NOT_APPLICABLE', { code: 'B' })]);

    expect(cuentas.untouched).toBe(0);
  });

  it('y una lista vacia tampoco', () => {
    expect(checklistCounts([])).toEqual({
      untouched: 0,
      done: 0,
      pending: 0,
      notApplicable: 0,
    });
  });
});

describe('las estancias que se pintan', () => {
  it('solo las que tienen alguna tarea, en orden', () => {
    expect(
      checklistRoomsPresent([entrada({ room: 'COMMON_AREAS' }), entrada({ room: 'KITCHEN' })]),
    ).toEqual(['KITCHEN', 'COMMON_AREAS']);
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

describe('el contrato de decir en que queda una tarea', () => {
  it('acepta los tres estados y el null que la deja sin tocar', () => {
    for (const state of ['DONE', 'PENDING', 'NOT_APPLICABLE', null] as const) {
      expect(
        ChecklistProgressSchema.safeParse({ itemCode: 'COMMON_A', state }).success,
        String(state),
      ).toBe(true);
    }
  });

  it('rechaza un estado inventado', () => {
    expect(ChecklistProgressSchema.safeParse({ itemCode: 'COMMON_A', state: 'CASI' }).success).toBe(
      false,
    );
  });

  it('EL MOTIVO SOLO VIAJA CON «PENDIENTE»', () => {
    /*
     * NO ES UNA REGLA DE FORMA. Un campo de texto que se acepta en cualquier
     * estado es un almacen de texto libre colgado de una reserva, que es
     * exactamente lo que evita la comprobacion del codigo de tarea contra el
     * catalogo. Y un motivo de «no se pudo» colgado de una tarea hecha seria,
     * ademas, una contradiccion guardada.
     */
    const con = (state: ChecklistItemState | null) =>
      ChecklistProgressSchema.safeParse({ itemCode: 'COMMON_A', state, note: 'un motivo' }).success;

    expect(con('PENDING')).toBe(true);
    expect(con('DONE')).toBe(false);
    expect(con('NOT_APPLICABLE')).toBe(false);
    expect(con(null)).toBe(false);
  });

  it('UNA PENDIENTE SIN MOTIVO ES VALIDA, y es un caso normal', () => {
    /*
     * La duena escribio «debe PERMITIR anotar el motivo», no «debe
     * exigirlo». Exigirlo dejaria a quien no puede escribir en ese momento
     * sin poder marcar la tarea como pendiente, y la dejaria sin tocar: se
     * perderia la informacion entera por intentar conseguirla completa.
     */
    const leido = ChecklistProgressSchema.safeParse({ itemCode: 'COMMON_A', state: 'PENDING' });

    expect(leido.success).toBe(true);
    expect(leido.success && leido.data.note).toBeNull();
  });

  it('rechaza un motivo EN BLANCO: no es un motivo', () => {
    // Admitirlo dejaria filas que dicen «hay un motivo» sin motivo.
    for (const note of ['', '   ', '\n']) {
      expect(
        ChecklistProgressSchema.safeParse({ itemCode: 'COMMON_A', state: 'PENDING', note }).success,
        JSON.stringify(note),
      ).toBe(false);
    }
  });

  it('recorta el motivo, y lo tope en el maximo del contrato', () => {
    const leido = ChecklistProgressSchema.safeParse({
      itemCode: 'COMMON_A',
      state: 'PENDING',
      note: '  No habia productos  ',
    });

    expect(leido.success && leido.data.note).toBe('No habia productos');
    expect(
      ChecklistProgressSchema.safeParse({
        itemCode: 'COMMON_A',
        state: 'PENDING',
        note: 'A'.repeat(CHECKLIST_NOTE_MAX + 1),
      }).success,
    ).toBe(false);
  });

  it('RECHAZA un codigo desmesurado', () => {
    /*
     * Sin el tope, cada toque podria escribir en la base una cadena de un
     * megabyte. El codigo real son unas pocas letras.
     */
    expect(
      ChecklistProgressSchema.safeParse({ itemCode: 'A'.repeat(65), state: 'DONE' }).success,
    ).toBe(false);
    expect(ChecklistProgressSchema.safeParse({ itemCode: '', state: 'DONE' }).success).toBe(false);
  });

  it('rechaza campos de mas', () => {
    /*
     * El caso realista no es malicia, es un cliente que manda tambien
     * `markedAt` o `markedBy`. Los dos los pone el SERVIDOR: la hora, porque
     * el reloj de un movil se cambia a mano, y el autor, porque sale de la
     * sesion.
     */
    for (const extra of ['markedAt', 'markedByStaffId', 'bookingId', 'done']) {
      expect(
        ChecklistProgressSchema.safeParse({
          itemCode: 'COMMON_A',
          state: 'DONE',
          [extra]: 'x',
        }).success,
        extra,
      ).toBe(false);
    }
  });
});

describe('lo que se lee de una tarea', () => {
  it('una tarea decidida lleva estado, hora y autor', () => {
    expect(JobChecklistEntrySchema.safeParse(en('DONE')).success).toBe(true);
  });

  it('una pendiente puede llevar su motivo', () => {
    expect(JobChecklistEntrySchema.safeParse(en('PENDING', { note: 'Cerrada' })).success).toBe(
      true,
    );
  });

  it('una tarea SIN TOCAR lo lleva todo a null', () => {
    expect(JobChecklistEntrySchema.safeParse(entrada()).success).toBe(true);
  });

  it('NO lleva el apellido de quien lo decidio', () => {
    // Igual que en el resto de la pantalla de limpieza: para saber quien hizo
    // que, en un equipo de dos o tres personas, sobra el nombre de pila.
    expect(
      JobChecklistEntrySchema.safeParse({ ...entrada(), markedByLastName: 'Perez' }).success,
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

  it('y el de una estancia tambien', () => {
    expect(checklistRoomTextKey('WHOLE_HOUSE')).toBe('checklist.rooms.WHOLE_HOUSE');
  });
});
