import { z } from 'zod';
import { isInsideGeorgia } from './georgia-outline';

/**
 * GEOCODIFICACION DE LAS DIRECCIONES
 * ==================================
 * Convertir «123 Main St, Atlanta, GA 30303» en un punto del mapa.
 *
 * POR QUE HACE FALTA. El sistema sabia la direccion de cada casa en texto,
 * pero no donde cae en el mapa. Sin eso no se puede responder a la unica
 * pregunta que justifica el fichaje con ubicacion: «¿estaba esta persona en
 * la casa cuando dijo que habia llegado?».
 *
 * QUE NO CAMBIA, Y CONVIENE DEJARLO CLARO. Geocodificar la casa NO añade
 * ninguna exposicion de privacidad: la direccion completa ya estaba guardada
 * en texto plano en la misma tabla. Un par de coordenadas no revela nada que
 * «123 Main St» no revelara. Lo que se decidio evitar era guardar la
 * ubicacion DEL EMPLEADO, y eso se sigue evitando: sus coordenadas se
 * descartan en el servidor en cuanto se calcula la distancia.
 *
 * SE GUARDA, NO SE CONSULTA CADA VEZ. Una direccion no se mueve. Se
 * geocodifica una vez y el resultado queda en la ficha, igual que ya se
 * cachea la distancia desde la base de operaciones.
 */

const LatitudSchema = z.number().min(-90).max(90);
const LongitudSchema = z.number().min(-180).max(180);

/** Quien resolvio las coordenadas. */
export const GEOCODING_PROVIDERS = ['mock', 'census'] as const;
export const GeocodingProviderNameSchema = z.enum(GEOCODING_PROVIDERS);
export type GeocodingProviderName = z.infer<typeof GeocodingProviderNameSchema>;

/**
 * Como de fina es la coincidencia.
 *
 * NO ES UN ADORNO: decide si la distancia del fichaje significa algo.
 *
 *   - `ROOFTOP` es el portal. A partir de aqui, «llego a 40 metros» quiere
 *     decir que estaba en la puerta.
 *   - `INTERPOLATED` es un punto estimado sobre el tramo de calle, que es lo
 *     que devuelve el Censo la mayor parte de las veces. Puede errar la casa
 *     por unas decenas de metros, asi que sirve para «estaba en esta calle»,
 *     no para «estaba en este portal».
 *
 * Guardarlo es lo que impide que dentro de un ano alguien mire un «llego a
 * 60 metros» y no sepa si eso es bueno o malo.
 */
export const GEOCODING_PRECISIONS = ['ROOFTOP', 'INTERPOLATED'] as const;
export const GeocodingPrecisionSchema = z.enum(GEOCODING_PRECISIONS);
export type GeocodingPrecision = z.infer<typeof GeocodingPrecisionSchema>;

/**
 * Lo que se le pide a un geocodificador.
 *
 * Los cuatro campos que tiene la ficha de direccion. `line2` NO entra a
 * proposito: «Apto 3B» no mueve el edificio de sitio y algunos servicios
 * fallan la coincidencia entera si se lo mandas.
 */
export const GeocodeQuerySchema = z.strictObject({
  line1: z.string().trim().min(1),
  city: z.string().trim().min(1),
  state: z.string().trim().toUpperCase().length(2),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/),
});
export type GeocodeQuery = z.infer<typeof GeocodeQuerySchema>;

/**
 * Lo que devuelve.
 *
 * `matchedAddress` es la direccion tal y como la entendio el servicio.
 *
 * Se guarda en la ficha de la direccion (`geocodeMatchedAddress`) porque es
 * lo UNICO que revela la coincidencia plausible pero equivocada: si se pidio
 * «123 Main St» y el servicio entendio «123 Main Ave», las dos estan en
 * Atlanta, la guardia del estado no ve nada raro, y la casa queda a
 * kilometro y medio de donde esta. Comparando las dos cadenas se ve.
 *
 * Lo que NO hace es salir de la base de datos: no esta en
 * `AddressCoordinates`, que es lo que el fichaje consume y manda al movil.
 */
export const GeocodeResultSchema = z.strictObject({
  latitude: LatitudSchema,
  longitude: LongitudSchema,
  precision: GeocodingPrecisionSchema,
  matchedAddress: z.string().trim().min(1).max(300),
  provider: GeocodingProviderNameSchema,
});
export type GeocodeResult = z.infer<typeof GeocodeResultSchema>;

/**
 * Las coordenadas guardadas de una direccion, con su procedencia.
 *
 * `geocodedAt` no es decoracion: si algun dia se cambia de proveedor o se
 * corrige un fallo, es lo que permite saber que fichas hay que rehacer.
 */
export const AddressCoordinatesSchema = z.strictObject({
  latitude: LatitudSchema,
  longitude: LongitudSchema,
  precision: GeocodingPrecisionSchema,
  provider: GeocodingProviderNameSchema,
  geocodedAt: z.iso.datetime(),
});
export type AddressCoordinates = z.infer<typeof AddressCoordinatesSchema>;

// ---------------------------------------------------------------------------
// La guardia
// ---------------------------------------------------------------------------

/**
 * Por que un resultado de Georgia TIENE que caer dentro de Georgia.
 *
 * Los geocodificadores no devuelven un error cuando no encuentran la
 * direccion exacta: devuelven **lo mas parecido que hayan encontrado**. Hay
 * una «Main Street» en cada pueblo de Estados Unidos, y una coincidencia
 * equivocada no llega marcada como equivocada — llega como una coincidencia
 * normal, con sus coordenadas perfectamente validas, en Ohio.
 *
 * Sin esta comprobacion, esa casa quedaria guardada en Ohio y a partir de
 * entonces TODOS los fichajes de ese cliente dirian «a 800 kilometros de la
 * casa». El fichaje no fallaria: mentiria.
 *
 * Reutiliza el contorno del estado de la etapa 2.25, que ya estaba en el
 * contrato para recortar el mapa de zonas.
 */
export function isPlausibleGeorgiaMatch(result: { latitude: number; longitude: number }): boolean {
  return isInsideGeorgia(result.latitude, result.longitude);
}

/**
 * Cuando una coincidencia sirve para guardarse.
 *
 * Se aceptan las dos precisiones: una interpolada sobre el tramo de calle es
 * peor que el portal, pero sigue diciendo en que calle esta la casa, y eso
 * distingue «llego» de «esta en su casa a 30 kilometros». Lo que se rechaza
 * es una coincidencia FUERA DEL ESTADO, que es la que miente.
 */
export function isUsableGeocodeResult(result: GeocodeResult, state: string): boolean {
  // La guardia del contorno solo sabe de Georgia; para otro estado, que de
  // momento no existe, se acepta lo que diga el servicio.
  if (state.trim().toUpperCase() !== 'GA') return true;
  return isPlausibleGeorgiaMatch(result);
}
