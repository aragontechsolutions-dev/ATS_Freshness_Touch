/**
 * LA SESION QUE SE ACABA A MITAD DE TURNO
 * =======================================
 * La API devuelve `sessionExpiresAt` en cada comprobacion de sesion desde
 * que existe el panel, y el panel NO LO MIRABA EN NINGUN SITIO. Esto es lo
 * que lo convierte en un aviso.
 *
 * ==========================================================================
 * POR QUE HACE FALTA SI EL TOKEN SE RENUEVA SOLO
 * ==========================================================================
 * El cliente de Supabase va con `autoRefreshToken: true`, asi que mientras
 * haya pestana abierta, red y un token de refresco vivo, la sesion se renueva
 * sola y este aviso no aparece nunca. Eso es lo correcto: el aviso NO es un
 * recordatorio periodico.
 *
 * Aparece exactamente cuando la renovacion automatica NO ha podido ocurrir,
 * que en este producto es un caso cotidiano y no una rareza:
 *
 *   - El movil de quien limpia, en una casa sin cobertura. El reloj de
 *     renovacion salta, la peticion no sale, y el token sigue caducando.
 *   - La PWA en segundo plano horas: el navegador congela los temporizadores
 *     de una pestana que no se esta mirando, y al volver la renovacion
 *     llega tarde o no llega.
 *
 * Sin aviso, el sintoma es el peor posible: la persona se entera de que la
 * sesion murio AL INTENTAR FICHAR LA SALIDA, que es justo cuando ya no tiene
 * tiempo ni cobertura para volver a entrar.
 *
 * ==========================================================================
 * NO ES SEGURIDAD, Y CONVIENE DECIRLO
 * ==========================================================================
 * Este modulo no protege nada: no acorta ninguna sesion ni decide quien
 * entra. Lo que caduca la sesion es el token, en el servidor, y eso sigue
 * igual. Quien cierra por descuido fisico es `useIdleSignOut`. Esto solo
 * mira una fecha que ya venia y avisa antes de que duela.
 */

/**
 * CUANTOS MINUTOS ANTES SE AVISA.
 *
 * Cinco sale de lo que tiene que caber dentro: pulsar un boton y que una
 * peticion a la API salga adelante con mala cobertura. Mas alto convertiria
 * el aviso en algo que se ve a diario y se aprende a ignorar —el token dura
 * una hora— y es justo lo que lo haria inutil el dia que importe.
 */
export const AVISO_DE_SESION_MINUTOS = 5;

/**
 * Minutos que le quedan a la sesion, o `null` si la fecha no se puede leer.
 *
 * ========================================================================
 * `null` NO ES «YA CADUCO», Y LA DISTINCION IMPORTA
 * ========================================================================
 * Si la fecha viniera rota, tratarla como caducada sacaria el aviso a todo
 * el mundo a la vez y para siempre: un aviso permanente que nadie puede
 * quitar y que no corresponde a ningun hecho. Devolver `null` hace que quien
 * llama no avise, que es el fallo seguro de los dos.
 *
 * Puede ser NEGATIVO, y tambien a proposito: una sesion ya caducada es el
 * caso mas urgente de todos, no uno que haya que esconder.
 */
export function minutosParaCaducar(expiresAt: string, ahora: Date = new Date()): number | null {
  const fin = new Date(expiresAt).getTime();
  if (Number.isNaN(fin)) return null;

  return (fin - ahora.getTime()) / 60_000;
}

/** Si toca sacar el aviso. */
export function hayQueAvisarDeLaSesion(expiresAt: string, ahora: Date = new Date()): boolean {
  const restante = minutosParaCaducar(expiresAt, ahora);
  return restante !== null && restante <= AVISO_DE_SESION_MINUTOS;
}

/**
 * Los minutos redondeados que se ensenan, nunca por debajo de cero.
 *
 * Se redondea HACIA ARRIBA para que nunca diga menos de lo que hay: con
 * noventa segundos reales, «1 minuto» invita a no hacer nada y «2» invita a
 * pulsar. Y con la sesion ya caducada devuelve `0`, que es lo que el texto
 * usa para cambiar de «te quedan N minutos» a «se ha terminado».
 */
export function minutosQueSeEnsenan(expiresAt: string, ahora: Date = new Date()): number {
  const restante = minutosParaCaducar(expiresAt, ahora);
  if (restante === null || restante <= 0) return 0;

  return Math.ceil(restante);
}
