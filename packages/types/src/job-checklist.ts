import { z } from 'zod';
import { BookingStatusSchema, type BookingStatus } from './booking';
import { ServiceTypeSchema, type AddOnCode, type ServiceType } from './enums';

/**
 * LA LISTA DE VERIFICACION DE UN TRABAJO
 * ======================================
 * Lo que hay que hacer en cada estancia de la casa, marcado a medida que se
 * hace. Es lo que el equipo mira al llegar y lo que coordinacion mira cuando
 * un cliente llama diciendo que algo se quedo sin hacer.
 *
 * ========================================================================
 * LA DECISION QUE SOSTIENE TODO ESTO: SE GUARDA LO MARCADO, NO LA LISTA
 * ========================================================================
 * La base de datos NO guarda una copia de la lista por cada trabajo. Guarda
 * una fila por tarea MARCADA, con su codigo, quien la marco y cuando. La
 * lista que se pinta sale de este catalogo, que vive en el codigo.
 *
 * La alternativa era copiar las veinticinco tareas sobre cada reserva al
 * crearla —una «fotografia», como se hace con el precio—. Se descarto, y
 * conviene tener escrito por que:
 *
 *   - EL PRECIO SE FOTOGRAFIA PORQUE ES UN ACUERDO. Lo que se pacto con el
 *     cliente no puede cambiar porque alguien toque la pantalla de Tarifas.
 *     Una lista de tareas no es un acuerdo con nadie: es como trabaja esta
 *     empresa, y cuando cambia, cambia para todos.
 *   - VEINTICINCO FILAS POR RESERVA, VACIAS. Con mil trabajos al ano son
 *     veinticinco mil filas que casi siempre dicen «no marcada», que es
 *     exactamente lo mismo que no tener fila.
 *   - Y HABRIA QUE ESCRIBIRLAS AL RESERVAR, dentro del camino del dinero.
 *     Ese camino ya hace demasiado; cualquier cosa que se le añada es una
 *     forma nueva de que una reserva pagada falle.
 *
 * ========================================================================
 * EL PRECIO DE ESA DECISION, Y COMO SE PAGA: LOS CODIGOS NO SE REUTILIZAN
 * ========================================================================
 * Si la lista sale del catalogo, cambiar el catalogo cambia lo que se ve en
 * un trabajo de hace tres meses. Eso se acota con una sola regla:
 *
 *   UN CODIGO DE TAREA NO SE BORRA NUNCA NI SE REUTILIZA. Se retira con
 *   `retired: true` y se queda en el catalogo para siempre.
 *
 * Es la misma regla que ya siguen los servicios retirados y las zonas `D` y
 * `E`: su codigo esta escrito en reservas que ya existen, y borrarlo dejaria
 * el historico ilegible. Una tarea retirada deja de ofrecerse en los
 * trabajos nuevos y sigue leyendose en los viejos donde se marco.
 */

/**
 * Las estancias de la casa.
 *
 * SON LAS DE LA LISTA QUE ESCRIBIO LA DUENA el 1/11/2026, y en su orden. Ese
 * orden es el del recorrido de la casa y se respeta al pintar: una lista que
 * salta de la cocina al baño y vuelve al salon obliga a leerla entera varias
 * veces.
 *
 * ========================================================================
 * DOS CAMBIOS RESPECTO A LO QUE HABIA, Y LOS DOS SON SUYOS
 * ========================================================================
 *   - LAS HABITACIONES TIENEN LISTA PROPIA. Antes entraban en areas comunes
 *     porque las plantillas antiguas no las separaban. Su lista si las
 *     separa, y tiene tareas que no estan en ningun otro sitio —cambiar las
 *     sabanas, tender las camas—.
 *   - `WHOLE_HOUSE` NO ES UNA ESTANCIA, y por eso va la ultima. Es donde
 *     caen las tareas de la limpieza profunda y de mudanza que no pertenecen
 *     a una habitacion concreta: zocalos, puertas, rejillas, ventiladores.
 *     Su lista las escribe asi, en bloque y despues de las estancias, porque
 *     es como se hacen: recorriendo la casa entera una vez.
 *
 * CAMBIAR ESTA LISTA ES SEGURO. La estancia NO se guarda en la base de
 * datos: alli solo esta el codigo de la tarea. La estancia sale del catalogo
 * cada vez que se pinta.
 */
export const CHECKLIST_ROOMS = [
  'KITCHEN',
  'BATHROOM',
  'BEDROOM',
  'COMMON_AREAS',
  'WHOLE_HOUSE',
] as const;
export const ChecklistRoomSchema = z.enum(CHECKLIST_ROOMS);
export type ChecklistRoom = z.infer<typeof ChecklistRoomSchema>;

/**
 * UNA TAREA DEL CATALOGO.
 *
 * NO LLEVA TEXTO, LLEVA CODIGO. El texto vive en los paquetes de idioma, en
 * `checklist.items.<CODIGO>`, y no es un detalle de implementacion: parte del
 * equipo de limpieza tiene el panel en castellano y parte en ingles, y una
 * lista de tareas escrita en el catalogo saldria en un solo idioma para
 * todos. Es el mismo motivo por el que los mensajes de error de los
 * contratos son claves y no frases.
 */
export interface ChecklistItem {
  /**
   * Codigo estable. ES LO QUE SE ESCRIBE EN LA BASE DE DATOS, asi que no se
   * cambia ni se reutiliza jamas: cambiarlo convierte las marcas antiguas en
   * filas que no corresponden a ninguna tarea.
   */
  readonly code: string;

  /** En que estancia se hace. */
  readonly room: ChecklistRoom;

  /**
   * En que servicios se pide esta tarea.
   *
   * Existe porque una limpieza profunda y una estandar no son el mismo
   * trabajo, y la lista tiene que poder decirlo. Lo que NO hace es filtrar
   * por frecuencia: una estandar semanal y una mensual se limpian igual; lo
   * que cambia es cada cuanto, no que se hace.
   */
  readonly appliesTo: readonly ServiceType[];

  /**
   * LA TAREA SOLO APARECE SI SE CONTRATO ESTE EXTRA.
   *
   * El interior del horno, el del refrigerador, los gabinetes por dentro,
   * los vidrios y doblar la ropa NO entran en ninguna limpieza, ni siquiera
   * en la profunda o en la de mudanza: se pagan aparte. Su lista lo dice
   * dos veces, en la seccion de extras y otra vez en las aclaraciones.
   *
   * Sin esto habria que elegir entre dos cosas malas: ofrecer la tarea
   * siempre —y que el equipo limpie un horno que nadie pago— u omitirla
   * siempre, y que la pague alguien y no aparezca en la lista.
   */
  readonly requiresAddOn?: AddOnCode;

  /**
   * Una tarea retirada. Ver la cabecera: no se borra, se apaga.
   *
   * Deja de aparecer en los trabajos nuevos y sigue leyendose en los viejos
   * donde quedo marcada.
   */
  readonly retired?: boolean;
}

/**
 * Atajos de legibilidad. Sesenta tareas repitiendo el mismo array seria
 * ruido, y un array distinto por descuido seria una tarea que no aparece.
 */
const RESIDENCIAL: readonly ServiceType[] = ['STANDARD', 'DEEP', 'MOVE_IN_OUT'];
const PROFUNDA_Y_MUDANZA: readonly ServiceType[] = ['DEEP', 'MOVE_IN_OUT'];
const SOLO_MUDANZA: readonly ServiceType[] = ['MOVE_IN_OUT'];

/**
 * EL CATALOGO DE TAREAS.
 *
 * Transcrito el 1/11/2026 de la lista que escribio la dueña. Estuvo vacio
 * desde la Etapa 2 a proposito: una lista de limpieza plausible pero que no
 * fuera la de esta empresa habria sido peor que ninguna, porque alguien la
 * daria por buena y quedaria registrado que se hizo un trabajo que nadie
 * pidio.
 *
 * ==========================================================================
 * COMO SE ACUMULAN LOS SERVICIOS, QUE ES LO QUE DICE SU LISTA
 * ==========================================================================
 *   - ESTANDAR: las cuatro estancias.
 *   - PROFUNDA: todo lo de la estandar MAS once tareas suyas.
 *   - ENTRADA O SALIDA: todo lo de la profunda MAS cuatro suyas.
 *
 * Eso se expresa con `appliesTo` y no con una jerarquia: una tarea estandar
 * se declara en los tres servicios. Es mas repetitivo de leer y no tiene el
 * fallo de la herencia —cambiar la base y mover sin querer lo que incluye un
 * servicio que no se estaba tocando—.
 *
 * ==========================================================================
 * LA DE MUDANZA LLEVA TODAS LAS TAREAS, AUNQUE LA CASA ESTE VACIA
 * ==========================================================================
 * Su lista dice «todas las tareas APLICABLES». Y en una vivienda vacia hay
 * tareas que no aplican: cambiar las sabanas, por ejemplo.
 *
 * No se decide aqui cuales. Van todas, y el equipo marca «no aplica» en la
 * casa, que es justo el estado que ella pidio. Decidirlo en el catalogo
 * seria adivinar desde una oficina lo que hay dentro de una casa concreta:
 * hay mudanzas con la cama todavia puesta.
 */
export const JOB_CHECKLIST_CATALOG: readonly ChecklistItem[] = [
  /* ----------------------- COCINA ----------------------- */
  { code: 'KITCHEN_COUNTERS', room: 'KITCHEN', appliesTo: RESIDENCIAL },
  { code: 'KITCHEN_CABINET_FRONTS', room: 'KITCHEN', appliesTo: RESIDENCIAL },
  { code: 'KITCHEN_STOVETOP', room: 'KITCHEN', appliesTo: RESIDENCIAL },
  { code: 'KITCHEN_APPLIANCE_FRONTS', room: 'KITCHEN', appliesTo: RESIDENCIAL },
  { code: 'KITCHEN_MICROWAVE', room: 'KITCHEN', appliesTo: RESIDENCIAL },
  { code: 'KITCHEN_SINK', room: 'KITCHEN', appliesTo: RESIDENCIAL },
  { code: 'KITCHEN_TABLE', room: 'KITCHEN', appliesTo: RESIDENCIAL },
  { code: 'KITCHEN_WINDOW_DUST', room: 'KITCHEN', appliesTo: RESIDENCIAL },
  { code: 'KITCHEN_COBWEBS', room: 'KITCHEN', appliesTo: RESIDENCIAL },
  { code: 'KITCHEN_TRASH', room: 'KITCHEN', appliesTo: RESIDENCIAL },
  { code: 'KITCHEN_VACUUM', room: 'KITCHEN', appliesTo: RESIDENCIAL },
  { code: 'KITCHEN_MOP', room: 'KITCHEN', appliesTo: RESIDENCIAL },

  /* ----------------------- BANOS ----------------------- */
  { code: 'BATH_SINK', room: 'BATHROOM', appliesTo: RESIDENCIAL },
  { code: 'BATH_MIRRORS', room: 'BATHROOM', appliesTo: RESIDENCIAL },
  { code: 'BATH_TOILET', room: 'BATHROOM', appliesTo: RESIDENCIAL },
  { code: 'BATH_SHOWER', room: 'BATHROOM', appliesTo: RESIDENCIAL },
  { code: 'BATH_CABINET_FRONTS', room: 'BATHROOM', appliesTo: RESIDENCIAL },
  { code: 'BATH_WINDOW_DUST', room: 'BATHROOM', appliesTo: RESIDENCIAL },
  { code: 'BATH_COBWEBS', room: 'BATHROOM', appliesTo: RESIDENCIAL },
  { code: 'BATH_TRASH', room: 'BATHROOM', appliesTo: RESIDENCIAL },
  { code: 'BATH_VACUUM', room: 'BATHROOM', appliesTo: RESIDENCIAL },
  { code: 'BATH_MOP', room: 'BATHROOM', appliesTo: RESIDENCIAL },

  /* ----------------------- HABITACIONES ----------------------- */
  { code: 'BEDROOM_DUST', room: 'BEDROOM', appliesTo: RESIDENCIAL },
  { code: 'BEDROOM_MIRRORS', room: 'BEDROOM', appliesTo: RESIDENCIAL },
  { code: 'BEDROOM_BEDS', room: 'BEDROOM', appliesTo: RESIDENCIAL },
  { code: 'BEDROOM_WINDOW_DUST', room: 'BEDROOM', appliesTo: RESIDENCIAL },
  { code: 'BEDROOM_COBWEBS', room: 'BEDROOM', appliesTo: RESIDENCIAL },
  { code: 'BEDROOM_TRASH', room: 'BEDROOM', appliesTo: RESIDENCIAL },
  { code: 'BEDROOM_VACUUM', room: 'BEDROOM', appliesTo: RESIDENCIAL },
  { code: 'BEDROOM_MOP', room: 'BEDROOM', appliesTo: RESIDENCIAL },

  /* ----------------------- SALA, COMEDOR, PASILLOS Y ESCALERAS ----------------------- */
  { code: 'COMMON_DUST', room: 'COMMON_AREAS', appliesTo: RESIDENCIAL },
  { code: 'COMMON_GLASS_TABLES', room: 'COMMON_AREAS', appliesTo: RESIDENCIAL },
  { code: 'COMMON_FINGERPRINTS', room: 'COMMON_AREAS', appliesTo: RESIDENCIAL },
  { code: 'COMMON_WINDOW_DUST', room: 'COMMON_AREAS', appliesTo: RESIDENCIAL },
  { code: 'COMMON_COBWEBS', room: 'COMMON_AREAS', appliesTo: RESIDENCIAL },
  { code: 'COMMON_HANDRAILS', room: 'COMMON_AREAS', appliesTo: RESIDENCIAL },
  { code: 'COMMON_TRASH', room: 'COMMON_AREAS', appliesTo: RESIDENCIAL },
  { code: 'COMMON_VACUUM', room: 'COMMON_AREAS', appliesTo: RESIDENCIAL },
  { code: 'COMMON_MOP', room: 'COMMON_AREAS', appliesTo: RESIDENCIAL },

  /* ------- SOLO PROFUNDA Y MUDANZA: se suman a todo lo de arriba ------- */
  { code: 'DEEP_BASEBOARDS', room: 'WHOLE_HOUSE', appliesTo: PROFUNDA_Y_MUDANZA },
  { code: 'DEEP_DOORS', room: 'WHOLE_HOUSE', appliesTo: PROFUNDA_Y_MUDANZA },
  { code: 'DEEP_FANS_LIGHTS', room: 'WHOLE_HOUSE', appliesTo: PROFUNDA_Y_MUDANZA },
  { code: 'DEEP_BLINDS_SILLS', room: 'WHOLE_HOUSE', appliesTo: PROFUNDA_Y_MUDANZA },
  { code: 'DEEP_VENTS', room: 'WHOLE_HOUSE', appliesTo: PROFUNDA_Y_MUDANZA },
  { code: 'DEEP_CABINET_FRONTS', room: 'KITCHEN', appliesTo: PROFUNDA_Y_MUDANZA },
  { code: 'DEEP_STOVE_GREASE', room: 'KITCHEN', appliesTo: PROFUNDA_Y_MUDANZA },
  { code: 'DEEP_SOAP_SCUM', room: 'BATHROOM', appliesTo: PROFUNDA_Y_MUDANZA },
  { code: 'DEEP_TOILET_EDGES', room: 'BATHROOM', appliesTo: PROFUNDA_Y_MUDANZA },
  { code: 'DEEP_UNDER_CUSHIONS', room: 'COMMON_AREAS', appliesTo: PROFUNDA_Y_MUDANZA },
  { code: 'DEEP_BEHIND_OBJECTS', room: 'WHOLE_HOUSE', appliesTo: PROFUNDA_Y_MUDANZA },

  /* ----------------- SOLO ENTRADA O SALIDA ----------------- */
  { code: 'MOVE_CLOSETS', room: 'WHOLE_HOUSE', appliesTo: SOLO_MUDANZA },
  { code: 'MOVE_CLEARED_SPACES', room: 'WHOLE_HOUSE', appliesTo: SOLO_MUDANZA },
  { code: 'MOVE_FINAL_SWEEP', room: 'WHOLE_HOUSE', appliesTo: SOLO_MUDANZA },
  { code: 'MOVE_REPORT_DAMAGE', room: 'WHOLE_HOUSE', appliesTo: SOLO_MUDANZA },

  /* ------------- SOLO SI SE CONTRATO EL EXTRA ------------- */
  {
    code: 'ADDON_INSIDE_OVEN',
    room: 'KITCHEN',
    appliesTo: RESIDENCIAL,
    requiresAddOn: 'INSIDE_OVEN',
  },
  {
    code: 'ADDON_INSIDE_FRIDGE',
    room: 'KITCHEN',
    appliesTo: RESIDENCIAL,
    requiresAddOn: 'INSIDE_FRIDGE',
  },
  {
    code: 'ADDON_INSIDE_CABINETS',
    room: 'KITCHEN',
    appliesTo: RESIDENCIAL,
    requiresAddOn: 'WINDOWS_AND_CABINETS',
  },
  {
    code: 'ADDON_INTERIOR_WINDOWS',
    room: 'WHOLE_HOUSE',
    appliesTo: RESIDENCIAL,
    requiresAddOn: 'WINDOWS_AND_CABINETS',
  },
  { code: 'ADDON_LAUNDRY', room: 'WHOLE_HOUSE', appliesTo: RESIDENCIAL, requiresAddOn: 'LAUNDRY' },
];

/**
 * Las tareas que le toca a un servicio, en orden de recorrido de la casa.
 *
 * Deja fuera las retiradas: en un trabajo nuevo no se pide algo que la
 * empresa ya no hace.
 *
 * ==========================================================================
 * LOS EXTRAS SON OBLIGATORIOS, Y NO POR CAPRICHO DE LA FIRMA
 * ==========================================================================
 * `extras` son los extras QUE ESA RESERVA PAGO. Sin ellos no se puede
 * decidir si el interior del horno entra en la lista, y un valor por defecto
 * —`[]`— seria la peor version posible de esto: quien llamara sin pasarlos no
 * veria ningun error, simplemente la tarea del horno no apareceria nunca, en
 * ninguna casa, y nadie sabria por que. Exigirlo convierte ese descuido en un
 * fallo de compilacion en el unico momento en que se puede arreglar barato.
 *
 * Por eso va ANTES del catalogo: al cambiar el orden, cualquier llamada
 * antigua deja de compilar en vez de seguir funcionando a medias.
 *
 * El catalogo, en cambio, SI entra con valor por defecto: es lo que permite
 * probar esta funcion y las pantallas con un catalogo pequeño y controlado en
 * vez de con las cincuenta y nueve tareas de verdad.
 */
export function checklistForService(
  service: ServiceType,
  extras: readonly AddOnCode[],
  catalogo: readonly ChecklistItem[] = JOB_CHECKLIST_CATALOG,
): readonly ChecklistItem[] {
  const vigentes = catalogo.filter(
    (tarea) =>
      tarea.retired !== true &&
      tarea.appliesTo.includes(service) &&
      (tarea.requiresAddOn === undefined || extras.includes(tarea.requiresAddOn)),
  );

  /*
   * Se ordena por estancia siguiendo `CHECKLIST_ROOMS`, y dentro de cada
   * estancia se respeta el orden del catalogo: es el de la plantilla del
   * cliente, que es el orden en el que de verdad se limpia una habitacion.
   */
  return CHECKLIST_ROOMS.flatMap((estancia) => vigentes.filter((tarea) => tarea.room === estancia));
}

/**
 * LOS ESTADOS DE UN TRABAJO EN LOS QUE SE PUEDE MARCAR UNA TAREA.
 *
 * ESTA EN EL CONTRATO Y NO EN CADA LADO, y eso es lo importante: el servidor
 * la usa para rechazar y la pantalla para decidir si pinta las casillas. Con
 * dos listas, la pantalla acabaria ofreciendo casillas que el servidor
 * rechaza, y cada toque daria un error que nadie sabria explicar.
 *
 * `COMPLETED` ENTRA, y no es un descuido: lo normal es acabar de marcar la
 * ultima tarea justo despues de pulsar «he terminado», y negarlo ahi
 * convertiria el ultimo toque de cada trabajo en un fallo delante de una
 * persona que acaba de hacer bien su trabajo.
 *
 * Los que quedan fuera son `CANCELLED` —a esa casa no fue nadie—, `NO_SHOW`
 * —el cliente no estaba— y `PENDING_PAYMENT`, que es una reserva que todavia
 * no existe de verdad. Marcar tareas en cualquiera de los tres solo podria
 * crear un registro que contradice al estado.
 */
export const CHECKLIST_EDITABLE_STATUSES: readonly BookingStatus[] = [
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
];

/** Si en este estado se pueden marcar tareas. */
export function canEditChecklist(status: BookingStatus): boolean {
  return CHECKLIST_EDITABLE_STATUSES.includes(status);
}

/**
 * Lo que el movil manda al marcar o desmarcar una tarea.
 *
 * ========================================================================
 * SE PUEDE DESMARCAR, Y ES DELIBERADO
 * ========================================================================
 * `done: false` existe porque esta pantalla se usa de pie, con una mano y a
 * veces con guantes: los toques equivocados son la norma, no la excepcion.
 *
 * Una lista que no se puede corregir tiene un resultado predecible: la
 * primera vez que alguien marque sin querer «horno limpiado», aprendera que
 * la lista miente y dejara de usarla. Y una lista en la que nadie confia no
 * sirve para lo unico que tiene que servir: responder a un cliente que llama
 * diciendo que algo se quedo sin hacer.
 *
 * Quien desmarca y cuando queda registrado igual, porque la fila se borra y
 * se vuelve a crear con su autor y su hora.
 */
export const ChecklistProgressSchema = z.strictObject({
  /**
   * El codigo de la tarea. SE COMPRUEBA EN EL SERVIDOR contra el catalogo
   * del servicio de ese trabajo: aqui no se puede validar contra el
   * enumerado porque el catalogo es una lista de datos, no un `z.enum`.
   *
   * El tope de 64 caracteres no es un detalle: sin el, se podria meter en la
   * base una cadena de un megabyte por cada toque.
   */
  itemCode: z.string().min(1).max(64),
  done: z.boolean(),
});
export type ChecklistProgress = z.infer<typeof ChecklistProgressSchema>;

/**
 * Una tarea tal como se LEE: la tarea y su estado en este trabajo.
 *
 * `doneByFirstName` es el nombre de pila de quien la marco, sin apellido,
 * igual que en el resto de la pantalla de limpieza. Esta porque en una casa
 * con dos personas sirve para no hacer dos veces lo mismo, que es justo el
 * problema que esta lista resuelve en el dia a dia.
 */
export const JobChecklistEntrySchema = z.strictObject({
  code: z.string(),
  room: ChecklistRoomSchema,
  done: z.boolean(),
  /** Cuando se marco. `null` si no esta marcada. */
  doneAt: z.iso.datetime().nullable(),
  /** Quien la marco, por su nombre de pila. `null` si no esta marcada. */
  doneByFirstName: z.string().nullable(),
  /**
   * Una tarea MARCADA que ya no esta en el catalogo del servicio.
   *
   * Pasa con las tareas retiradas: se marcaron cuando se pedian y hay que
   * seguir leyendolas en ese trabajo. Se señala para que la pantalla pueda
   * decir «esto ya no se pide» en vez de enseñarla como una tarea normal que
   * el equipo de hoy deberia estar haciendo.
   */
  retired: z.boolean(),
});
export type JobChecklistEntry = z.infer<typeof JobChecklistEntrySchema>;

/**
 * Cuantas tareas quedan sin marcar.
 *
 * NO BLOQUEA NADA, Y ESO ES UNA DECISION DE DISENO, no una simplificacion.
 * Un trabajo se puede terminar con tareas sin marcar, por el mismo motivo
 * por el que el fichaje nunca se bloquea (`clock-in.ts`): el boton de «he
 * terminado» es lo que registra la salida, y negarlo porque falta un toque
 * deja a la empleada en la puerta de una casa sin poder cerrar su trabajo.
 *
 * Sirve para avisar —«te quedan 3»— y para que coordinacion lo vea despues.
 * Las retiradas no cuentan: no son trabajo pendiente de nadie.
 */
export function pendingChecklistCount(entradas: readonly JobChecklistEntry[]): number {
  return entradas.filter((entrada) => !entrada.done && !entrada.retired).length;
}

/** La clave de traduccion del texto de una tarea. */
export function checklistItemTextKey(code: string): string {
  return `checklist.items.${code}`;
}

/** La clave de traduccion del nombre de una estancia. */
export function checklistRoomTextKey(room: ChecklistRoom): string {
  return `checklist.rooms.${room}`;
}

/**
 * Las estancias que de verdad tienen tareas en una lista, en orden.
 *
 * Se usa para pintar: una cabecera de estancia sin ninguna tarea debajo es
 * ruido, y pasa en cuanto un servicio no pide nada en la cocina.
 */
export function checklistRoomsPresent(
  entradas: readonly JobChecklistEntry[],
): readonly ChecklistRoom[] {
  return CHECKLIST_ROOMS.filter((estancia) =>
    entradas.some((entrada) => entrada.room === estancia),
  );
}

/** Todos los servicios, para el catalogo: una tarea que se pide siempre. */
export const ALL_SERVICES: readonly ServiceType[] = ServiceTypeSchema.options;

/** Todos los estados, para las pruebas que recorren el enumerado entero. */
export const ALL_BOOKING_STATUSES: readonly BookingStatus[] = BookingStatusSchema.options;
