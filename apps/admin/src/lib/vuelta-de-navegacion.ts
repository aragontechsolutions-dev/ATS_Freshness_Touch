/**
 * «¿HAS LLEGADO?» AL VOLVER DE LA NAVEGACION
 * ==========================================
 * Quien pulsa «Llévame allí» sale de la aplicacion, conduce, aparca y
 * vuelve. En ese momento tiene que fichar su llegada, y lo que hay delante
 * es una pantalla con cinco secciones donde el boton esta donde estaba.
 *
 * Esto recuerda a que trabajo se fue navegando, para que al volver la
 * aplicacion pueda preguntar directamente.
 *
 * ==========================================================================
 * NO SE USA EL GPS PARA DECIDIR SI PREGUNTAR, Y ES A PROPOSITO
 * ==========================================================================
 * Lo evidente seria mirar si esta cerca de la casa. Pero eso obliga a pedir
 * el permiso de ubicacion AL VOLVER a la aplicacion, sin que la persona haya
 * pulsado nada, que es exactamente lo que la etapa 3.3 decidio no hacer:
 *
 *     «que aparezca al abrir la aplicacion —sin que la persona haya hecho
 *      nada que lo justifique— es la forma mas rapida de que le de a
 *      Bloquear para siempre»
 *
 * Y no hace falta: la pregunta no afirma nada, pregunta. Quien contesta que
 * si ficha, y es AHI donde se mide la distancia, como siempre. Si ficho
 * lejos, operaciones recibe su aviso igual (etapa 3.13). La comprobacion no
 * se pierde: se queda donde ya estaba.
 *
 * ==========================================================================
 * `sessionStorage` Y NO UNA VARIABLE
 * ==========================================================================
 * Un movil con poca memoria mata la aplicacion en segundo plano mientras se
 * conduce, y al volver la PWA se recarga entera. Una variable no sobrevive a
 * eso; `sessionStorage` si, y se vacia sola al cerrar la pestana, que es lo
 * que se quiere: esto no es un dato que deba durar entre jornadas.
 *
 * TODO VA EN `try`: en navegacion privada el acceso LANZA, y quedarse sin
 * preguntar es un inconveniente, pero una pantalla de limpieza en blanco en
 * la puerta de una casa no.
 */

const CLAVE = 'ft.navegando';

/**
 * Cuanto vale el recuerdo.
 *
 * Cuatro horas cubren el trayecto mas largo del area de servicio con margen
 * de sobra. Pasado eso, preguntar «¿has llegado?» por una navegacion de esta
 * manana es ruido, y el ruido ensena a ignorar la pregunta.
 */
const VIGENCIA_MS = 4 * 60 * 60 * 1000;

interface Recuerdo {
  bookingId: string;
  at: number;
}

/** Se pulso «Llévame allí» para este trabajo. */
export function recordarNavegacion(bookingId: string, ahora: number = Date.now()): void {
  try {
    const recuerdo: Recuerdo = { bookingId, at: ahora };
    sessionStorage.setItem(CLAVE, JSON.stringify(recuerdo));
  } catch {
    // Sin almacenamiento no se pregunta. El boton sigue estando.
  }
}

/**
 * A que trabajo se fue navegando, si sigue valiendo. `null` si no hay nada,
 * si caduco o si lo guardado no se entiende.
 */
export function navegacionReciente(ahora: number = Date.now()): string | null {
  try {
    const crudo = sessionStorage.getItem(CLAVE);
    if (crudo === null) return null;

    const recuerdo: unknown = JSON.parse(crudo);

    /*
     * Se valida en vez de confiar: `sessionStorage` lo puede escribir
     * cualquier cosa que corra en este origen, y una version anterior de la
     * aplicacion pudo guardar otra forma. Lo que no se entiende se tira.
     */
    if (
      typeof recuerdo !== 'object' ||
      recuerdo === null ||
      typeof (recuerdo as Recuerdo).bookingId !== 'string' ||
      typeof (recuerdo as Recuerdo).at !== 'number'
    ) {
      return null;
    }

    const { bookingId, at } = recuerdo as Recuerdo;
    if (bookingId === '' || ahora - at > VIGENCIA_MS || at > ahora) return null;

    return bookingId;
  } catch {
    return null;
  }
}

/**
 * Se olvida.
 *
 * Se llama al contestar —da igual que si o que no— y al fichar la llegada
 * por el boton de siempre. Sin esto, la pregunta volveria cada vez que se
 * cambia de aplicacion, y una pregunta que insiste se contesta sin leerla.
 */
export function olvidarNavegacion(): void {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    // Si no se pudo borrar, caduca sola en cuatro horas.
  }
}
