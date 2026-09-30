import { z } from 'zod';
import { haversineMeters } from './geo-distance';

/**
 * FICHAJE CON UBICACION
 * =====================
 * Responde a una sola pregunta: ¿estaba esta persona en la casa cuando dijo
 * que habia llegado?
 *
 * ========================================================================
 * LA DECISION QUE SOSTIENE TODO ESTO: SOLO SE GUARDA LA DISTANCIA
 * ========================================================================
 * Las coordenadas de quien ficha NO SE GUARDAN EN NINGUN SITIO. Llegan al
 * servidor, se convierten en un numero de metros, y se descartan en el mismo
 * metodo que las recibio. No van a la base de datos, no van a la auditoria y
 * no van al registro del servidor.
 *
 * El motivo es que la pregunta del negocio es «¿estaba en la casa?», y para
 * eso la distancia sobra. Guardar el punto en cambio construiria, sin que
 * nadie lo decidiera, un historial de por donde anda cada empleada: donde
 * vive, a que hora sale, donde come. Eso no hace falta para nada de lo que
 * esta empresa necesita, y un dato que no se guarda no se puede filtrar, ni
 * citar en un juicio, ni pedir por una orden judicial.
 *
 * ========================================================================
 * Y EL FICHAJE NUNCA SE BLOQUEA
 * ========================================================================
 * Sin ubicacion se ficha igual. Es deliberado y no es una concesion:
 *
 *   - Los sotanos y los interiores de hormigon no tienen GPS.
 *   - Hay zonas rurales de Georgia sin cobertura.
 *   - Y un movil se queda sin bateria a media manana.
 *
 * Un fichaje que se niega a registrar la llegada porque el GPS no responde
 * no protege a la empresa: deja a la empleada sin poder demostrar que fue, lo
 * cual es exactamente lo contrario de lo que se pretende. Se registra, se
 * anota POR QUE no hubo ubicacion, y se sigue trabajando.
 */

/**
 * Por que un fichaje no lleva distancia.
 *
 * ESTO NO ES UN NULO CON ADORNOS, Y LA DISTINCION IMPORTA MAS DE LO QUE
 * PARECE. «Sin ubicacion» puede significar tres cosas muy distintas:
 *
 *   - `DENIED`      la persona no dio permiso al navegador.
 *   - `UNAVAILABLE` el GPS no pudo dar una posicion: sotano, zona sin
 *                   cobertura, movil viejo. No lo decidio nadie.
 *   - `NO_HOUSE`    la casa todavia no tiene coordenadas. EL FALLO ES
 *                   NUESTRO, no de quien ficha.
 *
 * Meter las tres en el mismo cajon señalaria a una empleada por un fallo de
 * la geocodificacion. Con el motivo separado, un «sin ubicacion» se puede
 * leer sin acusar a nadie por error.
 */
export const CLOCK_IN_LOCATION_STATES = ['RECORDED', 'DENIED', 'UNAVAILABLE', 'NO_HOUSE'] as const;
export const ClockInLocationStateSchema = z.enum(CLOCK_IN_LOCATION_STATES);
export type ClockInLocationState = z.infer<typeof ClockInLocationStateSchema>;

/** Los dos momentos que se fichan. */
export const CLOCK_IN_KINDS = ['ARRIVAL', 'DEPARTURE'] as const;
export const ClockInKindSchema = z.enum(CLOCK_IN_KINDS);
export type ClockInKind = z.infer<typeof ClockInKindSchema>;

const LatitudSchema = z.number().min(-90).max(90);
const LongitudSchema = z.number().min(-180).max(180);

/**
 * LA PRECISION QUE REPORTA EL NAVEGADOR, Y POR QUE SE EXIGE.
 *
 * `coords.accuracy` es el radio en metros dentro del que el navegador cree
 * estar. Sin ese numero, la distancia no se puede interpretar: «a 250 metros
 * de la casa» con un margen de 30 metros dice que no estaba en la puerta;
 * «a 250 metros» con un margen de 2000 no dice absolutamente nada, y actuar
 * sobre ello seria acusar a alguien por el GPS de su movil.
 *
 * El tope de 100 km no es un limite tecnico: una lectura con ese margen es
 * inservible, y aceptarla solo llenaria la base de ruido con pinta de dato.
 */
const PrecisionEnMetrosSchema = z.number().min(0).max(100_000);

/**
 * Lo que el movil manda al fichar. TODO OPCIONAL.
 *
 * Es opcional porque el fichaje no se bloquea: quien no pueda dar ubicacion
 * manda solo el estado y se registra igual.
 *
 * `z.strictObject` rechaza cualquier campo que no este aqui. Eso vale doble
 * en este caso: si el dia de manana el movil empezara a mandar la altitud, el
 * rumbo o la velocidad —que la API del navegador tambien da—, el contrato lo
 * RECHAZA en vez de dejarlo pasar hacia la base de datos. Una fuga de datos
 * de ubicacion por descuido es justo lo que este diseño quiere hacer
 * imposible.
 */
export const ClockInLocationSchema = z.strictObject({
  latitude: LatitudSchema,
  longitude: LongitudSchema,
  accuracyMeters: PrecisionEnMetrosSchema,
});
export type ClockInLocation = z.infer<typeof ClockInLocationSchema>;

/**
 * Lo que queda REGISTRADO de un fichaje.
 *
 * Comparese con `ClockInLocationSchema`: ahi entran unas coordenadas, y aqui
 * sale un numero de metros. Ese cambio de forma es la decision de privacidad
 * hecha tipo: no hay manera de guardar un fichaje con coordenadas, porque el
 * tipo de lo que se guarda no tiene donde ponerlas.
 */
export const ClockInRecordSchema = z.strictObject({
  staffId: z.uuid(),
  /** Nombre de pila, para que coordinacion sepa de quien habla. */
  staffFirstName: z.string(),
  kind: ClockInKindSchema,
  occurredAt: z.iso.datetime(),
  locationState: ClockInLocationStateSchema,
  /** Metros en linea recta hasta la casa. `null` si no hubo ubicacion. */
  distanceMeters: z.int().nullable(),
  /** El margen de error de la lectura. `null` si no hubo ubicacion. */
  accuracyMeters: z.int().nullable(),
});
export type ClockInRecord = z.infer<typeof ClockInRecordSchema>;

/**
 * DISTANCIA A PARTIR DE LA CUAL SE CONSIDERA «LEJOS DE LA CASA».
 *
 * 250 metros, y el numero viene de una limitacion real, no de una intuicion:
 * el geocodificador del Censo NO da la posicion del portal, sino un punto
 * interpolado sobre el tramo de calle (`docs/24-geocodificacion.md` §4). En
 * una manzana rural larga de Georgia ese punto puede quedar a cientos de
 * metros de la puerta con todo correcto.
 *
 * Un umbral de veinte metros marcaria como sospechosos a la mitad de los
 * fichajes legitimos del campo. 250 sigue distinguiendo perfectamente lo que
 * se queria distinguir: «llego a la casa» de «ficho desde su propia casa a 30
 * kilometros».
 *
 * NO BLOQUEA NADA. Es solo lo que decide si coordinacion ve un aviso al lado
 * del fichaje en el panel.
 */
export const CLOCK_IN_FAR_METERS = 250;

/**
 * Si un fichaje quedo lejos de la casa.
 *
 * TIENE EN CUENTA EL MARGEN DE ERROR, y es la parte que importa. Una lectura
 * de «a 300 metros» con un margen de ±500 es compatible con estar en la
 * puerta, asi que NO se marca: lo que se compara con el umbral es la
 * distancia MINIMA posible segun la propia lectura.
 *
 * Dicho de otra forma: solo se marca cuando el movil mismo dice que la
 * persona no puede estar en la casa. Un GPS malo no acusa a nadie.
 */
export function isFarFromHouse(record: ClockInRecord): boolean {
  if (record.distanceMeters === null) return false;

  const margen = record.accuracyMeters ?? 0;
  const distanciaMinimaPosible = record.distanceMeters - margen;

  return distanciaMinimaPosible > CLOCK_IN_FAR_METERS;
}

/**
 * Los metros entre quien ficha y la casa, redondeados.
 *
 * Se redondea a metro entero a proposito: ni el GPS de un movil ni un punto
 * interpolado sobre una calle justifican decimales, y un `2483.7194` en la
 * base de datos sugiere una exactitud que no existe.
 *
 * Devuelve `null` cuando la casa no tiene coordenadas, que es el caso
 * `NO_HOUSE` y no un error.
 */
export function clockInDistanceMeters(
  ubicacion: ClockInLocation,
  casa: { latitude: number | null; longitude: number | null },
): number | null {
  if (casa.latitude === null || casa.longitude === null) return null;

  return Math.round(
    haversineMeters(ubicacion.latitude, ubicacion.longitude, casa.latitude, casa.longitude),
  );
}

/**
 * EL SUFIJO DE TEXTO DE CADA ESTADO, EXPLICITO.
 *
 * ========================================================================
 * NO SE DERIVA CON `toLowerCase()`, Y LA RAZON ES UN FALLO REAL
 * ========================================================================
 * La primera version hacia `estado.toLowerCase()`. Funcionaba con `DENIED` y
 * `UNAVAILABLE` —palabras sueltas— y se rompia con `NO_HOUSE`, que daba
 * `no_house` mientras la clave de traduccion era `noHouse`. En pantalla
 * aparecia literalmente «admin.clockIns.no_house», y ninguna prueba lo vio:
 * solo se noto al abrir el navegador.
 *
 * Con esta tabla, `Record<ClockInLocationState, string>` obliga a declarar el
 * sufijo de CADA estado. Añadir uno nuevo al enumerado sin darle texto es un
 * error de compilacion, no un texto roto delante de una persona.
 */
export const CLOCK_IN_STATE_TEXT_KEY: Record<ClockInLocationState, string> = {
  RECORDED: 'recorded',
  DENIED: 'denied',
  UNAVAILABLE: 'unavailable',
  NO_HOUSE: 'noHouse',
};
