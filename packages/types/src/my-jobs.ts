import { z } from 'zod';
import { BookingStatusSchema } from './booking';
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
});
export type MyJobProgress = z.infer<typeof MyJobProgressSchema>;
