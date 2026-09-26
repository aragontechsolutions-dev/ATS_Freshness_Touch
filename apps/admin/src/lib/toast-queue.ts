/**
 * LA COLA DE AVISOS, SIN REACT
 * ----------------------------
 * Aqui esta TODA la logica de cuando aparece un aviso, cuando se va y que
 * pasa si llegan cinco de golpe. Vive aparte del componente a proposito: es
 * logica con reloj, y la logica con reloj hay que poder probarla adelantando
 * el reloj a mano, sin pintar nada.
 *
 * TRES DECISIONES QUE NO SON DE ADORNO:
 *
 * 1. LOS ERRORES NO SE VAN SOLOS. Un "guardado" que desaparece a los cinco
 *    segundos es correcto: ya esta hecho, no hay nada que hacer. Un error
 *    que desaparece solo es una incidencia que nadie llega a leer. Se queda
 *    hasta que se cierra.
 *
 * 2. UN AVISO REPETIDO NO SE APILA, SE RENUEVA. Pulsar «guardar» tres veces
 *    seguidas no debe llenar la esquina con tres tarjetas identicas; lo que
 *    hace es reiniciar la cuenta atras de la que ya estaba.
 *
 * 3. NUNCA MAS DE TRES A LA VEZ. Por encima de eso se tapan los botones y
 *    deja de ser un aviso para ser un estorbo. Al llegar el cuarto se va el
 *    mas viejo.
 */

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  /** Identificador propio: React lo necesita y el cierre manual tambien. */
  readonly id: string;
  readonly tone: ToastTone;
  /**
   * CLAVE DE TRADUCCION, nunca un texto ya montado. Es lo que permite que el
   * aviso siga en el idioma del panel aunque se cambie con el aviso abierto,
   * y lo que impide que un texto del servidor acabe pintado sin pasar por la
   * tabla de traducciones.
   */
  readonly messageKey: string;
  readonly params?: Readonly<Record<string, string | number>>;
  /**
   * Detalle literal, cuando lo hay: el nombre de quien choca en la agenda, o
   * el motivo que devuelve el proveedor de correo. Es TEXTO y se pinta como
   * texto —React lo escapa— nunca como HTML. Sin esto, errores que se
   * resuelven en un minuto se convierten en "algo ha ido mal".
   */
  readonly detail?: string;
  /** Instante en el que le toca irse. `null` = no se va solo. */
  readonly expiraEn: number | null;
}

/** Lo que se va solo, se va a los cinco segundos. */
export const TOAST_DURACION_MS = 5000;

/** Mas de tres tapan la pantalla. */
export const TOAST_MAXIMO = 3;

export interface ToastNuevo {
  readonly tone: ToastTone;
  readonly messageKey: string;
  readonly params?: Readonly<Record<string, string | number>>;
  readonly detail?: string;
}

/** Los errores se quedan; el resto caduca. */
export function caducidad(tone: ToastTone, ahora: number): number | null {
  return tone === 'error' ? null : ahora + TOAST_DURACION_MS;
}

/**
 * Dos avisos son el mismo si coinciden tono, clave y detalle. El detalle
 * cuenta: dos choques de agenda con personas distintas son dos problemas
 * distintos aunque compartan el mensaje.
 */
function mismoAviso(a: Toast, b: ToastNuevo): boolean {
  return a.tone === b.tone && a.messageKey === b.messageKey && a.detail === b.detail;
}

/**
 * Mete un aviso en la cola. Devuelve SIEMPRE una lista nueva —React compara
 * por identidad— y respeta las tres reglas de arriba.
 */
export function encolar(
  actuales: readonly Toast[],
  nuevo: ToastNuevo,
  id: string,
  ahora: number,
): Toast[] {
  const expiraEn = caducidad(nuevo.tone, ahora);
  const repetido = actuales.find((toast) => mismoAviso(toast, nuevo));

  if (repetido) {
    // Renovar: se mantiene su sitio en la pila para que no salte de posicion.
    return actuales.map((toast) => (toast.id === repetido.id ? { ...toast, expiraEn } : toast));
  }

  const conElNuevo = [...actuales, { ...nuevo, id, expiraEn }];
  return conElNuevo.slice(Math.max(0, conElNuevo.length - TOAST_MAXIMO));
}

export function descartar(actuales: readonly Toast[], id: string): Toast[] {
  return actuales.filter((toast) => toast.id !== id);
}

/** Quita los que ya cumplieron. Los que no caducan nunca entran aqui. */
export function barrerCaducados(actuales: readonly Toast[], ahora: number): Toast[] {
  return actuales.filter((toast) => toast.expiraEn === null || toast.expiraEn > ahora);
}

/** ¿Hay algo pendiente de caducar? Si no, no hace falta tener un reloj en marcha. */
export function hayCaducables(actuales: readonly Toast[]): boolean {
  return actuales.some((toast) => toast.expiraEn !== null);
}

/**
 * Aplaza todo lo que caduca.
 *
 * Es lo que hace que un aviso NO desaparezca mientras se tiene el raton
 * encima o el foco dentro. Leer un aviso y verlo irse a media frase, teniendo
 * el cursor justo ahi, es de las cosas que mas molestan de una interfaz; y
 * para quien navega con teclado no es molestia sino barrera, porque el foco
 * puede estar en el propio boton de cerrar.
 */
export function aplazar(actuales: readonly Toast[], milisegundos: number): Toast[] {
  if (milisegundos <= 0) return [...actuales];
  return actuales.map((toast) =>
    toast.expiraEn === null ? toast : { ...toast, expiraEn: toast.expiraEn + milisegundos },
  );
}
