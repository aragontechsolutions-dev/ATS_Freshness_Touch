import { z } from 'zod';
import { BookingStatusSchema, type BookingStatus } from './booking';
import { ServiceTypeSchema, type ServiceType } from './enums';

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
 * SON LAS TRES DE LAS PLANTILLAS DE TRABAJO DEL CLIENTE, ni una mas: areas
 * comunes, baños y cocina. Los dormitorios no tienen lista propia porque en
 * esas plantillas no la tienen: entran en areas comunes.
 *
 * El orden es el del recorrido de la casa, y se respeta al pintar: una lista
 * que salta de la cocina al baño y vuelve al salon obliga a leerla entera
 * varias veces.
 */
export const CHECKLIST_ROOMS = ['COMMON_AREAS', 'BATHROOM', 'KITCHEN'] as const;
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
   * Una tarea retirada. Ver la cabecera: no se borra, se apaga.
   *
   * Deja de aparecer en los trabajos nuevos y sigue leyendose en los viejos
   * donde quedo marcada.
   */
  readonly retired?: boolean;
}

/**
 * EL CATALOGO DE TAREAS.
 *
 * ========================================================================
 * ESTA VACIO A PROPOSITO, Y NO ES UN OLVIDO
 * ========================================================================
 * Las tareas de las plantillas de trabajo del cliente —areas comunes (11),
 * baños (7) y cocina (7)— ESTAN PENDIENTES DE TRANSCRIBIR desde la Etapa 2,
 * y siguen pendientes hoy (`docs/21-modelo-de-operaciones.md` §4).
 *
 * No se rellena con tareas inventadas «de momento». Una lista de limpieza
 * plausible pero que no es la de esta empresa es peor que ninguna lista:
 * alguien la daria por buena, la marcaria entera, y quedaria registrado que
 * se hizo un trabajo que nadie pidio.
 *
 * Mientras este vacio, toda la maquinaria de arriba y de abajo funciona y la
 * seccion simplemente no se pinta. El dia que lleguen las capturas, esto se
 * rellena y no hay que tocar nada mas: ni la base de datos, ni la API, ni las
 * pantallas.
 */
export const JOB_CHECKLIST_CATALOG: readonly ChecklistItem[] = [];

/**
 * Las tareas que le toca a un servicio, en orden de recorrido de la casa.
 *
 * Deja fuera las retiradas: en un trabajo nuevo no se pide algo que la
 * empresa ya no hace.
 *
 * El catalogo entra POR PARAMETRO con un valor por defecto, y no es
 * decoracion: es lo que permite probar esta funcion y las pantallas con un
 * catalogo de prueba mientras el de verdad esta pendiente de contenido.
 */
export function checklistForService(
  service: ServiceType,
  catalogo: readonly ChecklistItem[] = JOB_CHECKLIST_CATALOG,
): readonly ChecklistItem[] {
  const vigentes = catalogo.filter(
    (tarea) => tarea.retired !== true && tarea.appliesTo.includes(service),
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
