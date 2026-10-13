import type { MyJob } from '@freshness/types';

/**
 * LLEVAR AL EQUIPO HASTA LA PUERTA
 * ================================
 * La pantalla de limpieza ya enlazaba la direccion a un mapa, pero con `?q=`,
 * que ENSENA el sitio: quien llega tiene que pulsar «Como llegar» y luego
 * «Iniciar». Son dos toques y una decision de mas con el coche en marcha.
 *
 * Esto construye el enlace que abre la navegacion YA EMPEZADA.
 *
 * ==========================================================================
 * NO SE MANDA EL ORIGEN, Y ES LO QUE MANTIENE EN PIE LA REGLA DE LA 3.3
 * ==========================================================================
 * El destino va en la URL; de donde sale lo pone la aplicacion de mapas con
 * la ubicacion del propio movil. Asi LA UBICACION DE LA EMPLEADA NO PASA POR
 * NUESTROS SERVIDORES en ningun momento —ni siquiera le pedimos el permiso de
 * geolocalizacion—. Es un enlace, no una funcionalidad.
 *
 * ==========================================================================
 * LO QUE NUNCA PUEDE ENTRAR EN UNA URL
 * ==========================================================================
 * `accessNotes` —el codigo de la puerta, donde esta la llave, el perro
 * suelto— se queda fuera. Una URL acaba en el historial del navegador, en
 * los registros del servicio de mapas y en el menu de «compartir» del movil.
 * Hay una prueba que falla si alguien lo mete.
 *
 * `addressLine2` tampoco: «Apto 3B» no mueve el edificio de sitio y algunos
 * geocodificadores fallan la coincidencia entera si se lo mandas. Es la
 * misma regla que ya aplica `GeocodeQuerySchema`.
 */

/** Lo minimo que hace falta para saber a donde se va. */
export type DestinoDeTrabajo = Pick<
  MyJob,
  'addressLine1' | 'city' | 'state' | 'postalCode' | 'doorPin'
>;

/**
 * A DONDE SE NAVEGA: el pin si lo hay, la direccion si no.
 *
 *   - CON PIN se navega a las coordenadas. El cliente lo marco precisamente
 *     porque el geocodificador interpola sobre el tramo de via y en una
 *     carretera comarcal deja la casa a cientos de metros.
 *
 *   - SIN PIN —que es EL CASO NORMAL, marcar el pin es opcional y la mayoria
 *     no lo hara— se manda la direccion en texto y la geocodifica el
 *     servicio de mapas, que lo hace mejor que nuestro proveedor del Censo.
 *
 * El pin se borra 24 h despues del trabajo, asi que esta funcion no puede
 * dar por hecho que lo que habia ayer sigue estando: por eso se decide en
 * cada llamada y no se guarda.
 */
export function destinoDeNavegacion(job: DestinoDeTrabajo): string {
  if (job.doorPin) {
    return `${job.doorPin.latitude},${job.doorPin.longitude}`;
  }

  return `${job.addressLine1}, ${job.city}, ${job.state} ${job.postalCode}`;
}

/**
 * Google Maps, con la ruta ya trazada.
 *
 * Se usa el enlace universal y no `comgooglemaps://`: este abre la aplicacion
 * si esta instalada y la version web si no, mientras que un esquema propio no
 * hace nada en un navegador sin la aplicacion —que es justo donde mas falta
 * hace que funcione algo—.
 */
export function enlaceGoogleMaps(job: DestinoDeTrabajo): string {
  const destino = encodeURIComponent(destinoDeNavegacion(job));
  return `https://www.google.com/maps/dir/?api=1&destination=${destino}&travelmode=driving`;
}

/**
 * Apple Maps, con la ruta ya trazada. Solo se ensena en iPhone y iPad.
 *
 * `maps.apple.com` tambien es un enlace universal: abre la aplicacion si esta
 * instalada y, si alguien la borro, Safari ensena la pagina de Apple que
 * ofrece recuperarla. POR ESO NO HAY —NI PUEDE HABER— UNA COMPROBACION DE SI
 * ESTA INSTALADA: ningun navegador expone que aplicaciones tiene el
 * dispositivo, y es deliberado, porque esa lista sirve para identificar a
 * una persona. Lo resuelve Apple, no nosotros.
 */
export function enlaceAppleMaps(job: DestinoDeTrabajo): string {
  const destino = encodeURIComponent(destinoDeNavegacion(job));
  return `https://maps.apple.com/?daddr=${destino}&dirflg=d`;
}

/**
 * Si el movil es un iPhone o un iPad.
 *
 * ==========================================================================
 * SE USA PARA ANADIR UN BOTON, NUNCA PARA QUITAR EL OTRO
 * ==========================================================================
 * Detectar el dispositivo por la cadena del navegador es fragil por
 * definicion: la escribe el fabricante, cambia con cada version y algunos
 * navegadores mienten a proposito. Por eso la deteccion solo decide si se
 * ANADE el boton de Apple Maps, y el de Google Maps se pinta siempre.
 *
 * Asi los dos fallos posibles son inofensivos: si acierta de mas, sobra un
 * boton; si acierta de menos, queda el de Google, que funciona en un iPhone
 * igual de bien. Si la deteccion decidiera CUAL se ensena, un fallo dejaria
 * a alguien conduciendo con un boton que no abre nada.
 *
 * Y hay un caso que no se puede resolver con la cadena a secas: un iPad con
 * iPadOS 13 o posterior se presenta como un Mac de escritorio. Lo delata que
 * tenga pantalla tactil.
 */
export function esDispositivoApple(): boolean {
  if (typeof navigator === 'undefined') return false;

  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;

  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}
