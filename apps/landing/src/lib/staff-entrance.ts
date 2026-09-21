/**
 * PUERTA DE SERVICIO
 * ------------------
 * El panel de administración no aparece en ningún enlace del sitio. Se entra
 * con Shift + Ctrl (o Cmd) + clic sobre el logotipo de la cabecera.
 *
 * ESTO NO ES UNA MEDIDA DE SEGURIDAD y no se debe tratar como tal. La
 * dirección del panel viaja en el paquete que descarga el navegador:
 * cualquiera que abra las herramientas de desarrollo la encuentra en un
 * minuto. Lo único que aporta es que el sitio público no enseñe una puerta
 * de personal a los clientes.
 *
 * Lo que de verdad protege el panel está en el servidor: hace falta un token
 * válido Y figurar como personal activo (ver `docs/13-panel-y-permisos.md`).
 * Si eso fallara, ocultar el enlace no salvaría nada.
 */

/** Dirección del panel. Sin configurar, el gesto no hace nada. */
const ADMIN_URL: string | undefined = import.meta.env.VITE_ADMIN_URL;

/**
 * ¿Lleva el gesto los modificadores correctos?
 *
 * Se acepta Ctrl **o** Cmd porque en macOS `Ctrl + clic` es la forma estándar
 * de abrir el menú contextual: exigir Ctrl allí haría que el gesto fuera
 * incómodo o directamente imposible.
 */
export function hasStaffModifiers(event: {
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}): boolean {
  // Alt queda fuera a propósito: con él, varios navegadores interpretan el
  // clic como "descargar el destino" y el gesto se volvería impredecible.
  return event.shiftKey && (event.ctrlKey || event.metaKey) && !event.altKey;
}

/**
 * Abre el panel. Devuelve false si no hay dirección configurada, para que
 * quien llama pueda dejar pasar el clic normal.
 */
export function openStaffEntrance(): boolean {
  if (!ADMIN_URL) {
    // Visible solo para quien va a buscarlo, que es justo el operador que
    // está probando por qué no le funciona el gesto.
    console.info('[Freshness Touch] Entrada de personal sin configurar: falta VITE_ADMIN_URL.');
    return false;
  }

  /*
   * Se abre en la MISMA pestaña, no en una nueva.
   *
   * `window.open` hacia otro origen deja al panel una referencia a esta
   * ventana (`window.opener`) con la que podría manipularla. Se puede anular
   * con `noopener`, pero navegar directamente evita el problema de raíz y
   * además no lo bloquean los bloqueadores de ventanas emergentes.
   */
  window.location.assign(ADMIN_URL);
  return true;
}

/** true si hay panel configurado. Solo para decidir si escuchar el gesto. */
export const staffEntranceEnabled = Boolean(ADMIN_URL);
