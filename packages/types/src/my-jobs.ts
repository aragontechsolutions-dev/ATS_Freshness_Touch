import { z } from 'zod';
import { BookingStatusSchema } from './booking';
import { ClockInLocationSchema, ClockInRecordSchema } from './clock-in';
import { JobChecklistEntrySchema } from './job-checklist';
import { ServiceTypeSchema } from './enums';

/**
 * LO QUE VE EL EQUIPO DE LIMPIEZA
 * -------------------------------
 * Un contrato APARTE del panel, y no una version recortada del suyo. Es la
 * decision que sostiene toda esta pantalla.
 *
 * La alternativa era reutilizar `AdminBookingDetail` y quitar campos al
 * pintarlo. Suena mas simple y es justo como se filtran los datos: el dia que
 * alguien anade un campo al detalle del panel, aparece tambien aqui sin que
 * nadie lo decida. Con un contrato propio, lo que llega a limpieza es una
 * lista explicita que hay que ampliar a proposito.
 *
 * QUE NO ESTA AQUI, Y NO ES UN OLVIDO:
 *
 *   - NINGUN IMPORTE. Ni total, ni deposito, ni desglose, ni el estado del
 *     pago. Quien limpia no factura, y saber lo que paga cada casa es como
 *     empiezan las comparaciones entre companeros y las conversaciones con el
 *     cliente que no tocan.
 *   - EL APELLIDO DEL CLIENTE. Para presentarse en la puerta basta el nombre.
 *   - EL CORREO DEL CLIENTE. Un telefono sirve para avisar de que se llega
 *     tarde; un correo solo sirve para escribirle por fuera del sistema.
 *   - CUALQUIER DATO DE OTRAS PERSONAS DEL EQUIPO mas alla de su nombre.
 */

/** Un trabajo en la lista de quien limpia. */
export const MyJobSchema = z.strictObject({
  bookingId: z.uuid(),
  reference: z.string(),
  status: BookingStatusSchema,
  service: ServiceTypeSchema,
  scheduledStart: z.iso.datetime(),
  scheduledEnd: z.iso.datetime(),
  timezone: z.string(),
  durationMinutes: z.int(),

  /** Tamano de la casa: dice cuanto trabajo hay antes de llegar. */
  bedrooms: z.int(),
  bathrooms: z.int(),

  /**
   * Nombre de pila del cliente. Sin apellido: para saludar en la puerta
   * sobra, y un apellido mas una direccion identifica a una persona.
   */
  customerFirstName: z.string(),
  /**
   * Telefono del cliente.
   *
   * Lo ve porque quien esta en la puerta a las ocho y no le abren necesita
   * poder llamar; hacerle pasar por la oficina anade un salto que en una
   * empresa pequena no siempre hay quien atienda.
   */
  customerPhone: z.string(),

  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),

  /**
   * DATO SENSIBLE: codigo de la puerta, donde esta la llave, perro suelto.
   *
   * Se manda porque es exactamente para lo que existe: sin esto, quien llega
   * a la casa no puede entrar. Pero SOLO en los trabajos asignados a esa
   * persona, comprobado en el servidor.
   */
  accessNotes: z.string().nullable(),
  /** Lo que pidio el cliente al reservar. */
  customerNotes: z.string().nullable(),

  /** Quien mas va, por su nombre. Para saber a quien esperar en la puerta. */
  teammates: z.array(z.strictObject({ name: z.string(), isLead: z.boolean() })),
  /** Si quien mira es la responsable de este trabajo. */
  iAmLead: z.boolean(),

  /**
   * LOS FICHAJES DE ESTE TRABAJO, INCLUIDOS LOS DE LOS COMPANEROS.
   *
   * Que una empleada vea su propio fichaje fue una decision explicita: no hay
   * un expediente secreto sobre nadie. Ve exactamente el mismo dato que vera
   * coordinacion, y si esta mal puede decirlo en el momento en vez de
   * enterarse en una revision tres meses despues.
   *
   * Y ve tambien los del resto del equipo, que es lo que ya ocurre con el
   * resto de esta pantalla: quien va a una casa sabe quien mas va y si ya ha
   * llegado. Aqui no se abre nada nuevo —la distancia no dice donde vive
   * nadie— y sirve para lo de siempre: saber si hay que esperar en la puerta.
   */
  clockIns: z.array(ClockInRecordSchema),

  /**
   * LA LISTA DE VERIFICACION DE ESTA CASA.
   *
   * Que hay que hacer en cada estancia, y que esta ya marcado. Es lo que
   * convierte esta pantalla de «donde voy» en «que hago», que es lo que de
   * verdad cambia el dia a dia de quien limpia.
   *
   * VIENE CALCULADA DEL SERVIDOR Y NO SE DEDUCE AQUI. El movil no sabe que
   * tareas pide cada servicio, y si lo supiera habria dos catalogos que
   * mantener de acuerdo. Llega la lista que toca, ya en orden, con el estado
   * de cada tarea.
   *
   * Puede venir VACIA, y es un estado legitimo: mientras las tareas de las
   * plantillas del cliente esten pendientes de transcribir, el catalogo esta
   * vacio y la seccion no se pinta. Ver `job-checklist.ts`.
   */
  checklist: z.array(JobChecklistEntrySchema),
});
export type MyJob = z.infer<typeof MyJobSchema>;

export const MyJobsSchema = z.strictObject({ jobs: z.array(MyJobSchema) });
export type MyJobs = z.infer<typeof MyJobsSchema>;

/**
 * Los dos unicos cambios de estado que puede hacer limpieza.
 *
 * Marcar que se ha llegado y que se ha terminado es lo que ocurre en la casa
 * y lo sabe quien esta alli. Cancelar o marcar que el cliente no estaba NO
 * entra: son los dos casos que el cliente discute despues y los que mueven
 * dinero, asi que los decide coordinacion, que es quien responde por ellos.
 */
export const MyJobProgressSchema = z.strictObject({
  status: z.enum(['IN_PROGRESS', 'COMPLETED']),

  /**
   * La ubicacion del movil, si la hubo. Ver `clock-in.ts`.
   *
   * Llega, se convierte en metros y se descarta. No se guarda en ningun
   * sitio.
   */
  location: ClockInLocationSchema.optional(),

  /**
   * Por que NO hubo ubicacion, cuando el movil puede decirlo.
   *
   * ========================================================================
   * SOLO DOS VALORES, Y LA RESTRICCION ES DE SEGURIDAD
   * ========================================================================
   * `RECORDED` y `NO_HOUSE` NO se aceptan aqui, aunque existan en el
   * enumerado, porque no son del cliente:
   *
   *   - `RECORDED` significa «hay una distancia calculada». Un cliente que lo
   *     declarara sin mandar coordenadas estaria afirmando que se comprobo
   *     algo que nadie comprobo. Lo pone el servidor, y solo despues de
   *     calcular los metros.
   *   - `NO_HOUSE` es un hecho de NUESTRA base de datos —la casa no tiene
   *     coordenadas—, que el movil no puede saber ni le corresponde opinar.
   *
   * Dicho de otra forma: el movil puede decir «no pude», nunca «si pude».
   */
  locationState: z.enum(['DENIED', 'UNAVAILABLE']).optional(),
});
export type MyJobProgress = z.infer<typeof MyJobProgressSchema>;
