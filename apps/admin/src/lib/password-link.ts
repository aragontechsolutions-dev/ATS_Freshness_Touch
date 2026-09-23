/**
 * EL ENLACE QUE LLEGA POR CORREO
 * ------------------------------
 * Dos caminos llevan a elegir contrasena, y NO son iguales:
 *
 *   - INVITACION. La crea el servidor con la clave de servicio, asi que el
 *     navegador de quien la recibe no participo en iniciarla. Por eso NO
 *     puede usar el flujo con verificador (PKCE) y vuelve con los tokens en
 *     el fragmento de la direccion.
 *
 *   - RECUPERACION. La pide la propia persona desde esta pantalla, asi que su
 *     navegador si guarda el verificador y vuelve con un `code` que hay que
 *     canjear. Es el camino bueno: los tokens no viajan nunca en la
 *     direccion, asi que no quedan en el historial.
 *
 * POR QUE SE LEE A MANO Y NO CON `detectSessionInUrl`.
 *
 * Esa opcion esta apagada a proposito en el cliente: con ella encendida,
 * CUALQUIER pantalla del panel aceptaria una sesion metida en la direccion.
 * Bastaria con mandarle a alguien un enlace a la agenda con un token pegado
 * para que se quedara dentro de la sesion de otra persona sin notarlo, y
 * siguiera trabajando ahi.
 *
 * Leyendolo a mano, la sesion del enlace solo se acepta en UN sitio y tras
 * una decision explicita: la pantalla de elegir contrasena. En el resto del
 * panel, un enlace manipulado no hace absolutamente nada.
 */

export type PasswordLinkKind = 'invite' | 'recovery';

export type PasswordLink =
  /** Flujo con verificador: hay que canjear el codigo. */
  | { via: 'code'; code: string; kind: PasswordLinkKind }
  /** Flujo sin verificador: los tokens vienen en el fragmento. */
  | { via: 'tokens'; accessToken: string; refreshToken: string; kind: PasswordLinkKind }
  /** El proveedor devolvio un error, por ejemplo un enlace caducado. */
  | { via: 'error'; reason: string };

/** Los unicos tipos que abren esta pantalla. Cualquier otro se ignora. */
function tipoValido(valor: string | null): PasswordLinkKind | null {
  return valor === 'invite' || valor === 'recovery' ? valor : null;
}

/**
 * Lee el enlace SIN tocar nada.
 *
 * Es una funcion pura sobre una cadena para poder probarla sin navegador: la
 * logica de decidir que abre esta pantalla es justo lo que conviene tener
 * cubierto, y montar un navegador para comprobarlo lo haria lento y fragil.
 */
export function readPasswordLink(href: string): PasswordLink | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  // El fragmento llega como "#a=1&b=2": se analiza igual que una consulta.
  const fragmento = new URLSearchParams(url.hash.replace(/^#/, ''));

  /*
   * El error se mira PRIMERO y en los dos sitios. Un enlace caducado vuelve
   * con `error_description` y sin tokens; sin esta rama, la pantalla se
   * quedaria en blanco sin explicar nada, que es cuando la gente vuelve a
   * pedir el enlace una y otra vez.
   */
  const error =
    fragmento.get('error_description') ??
    fragmento.get('error') ??
    url.searchParams.get('error_description') ??
    url.searchParams.get('error');
  if (error) return { via: 'error', reason: error.slice(0, 200) };

  const accessToken = fragmento.get('access_token');
  const refreshToken = fragmento.get('refresh_token');
  const tipoFragmento = tipoValido(fragmento.get('type'));

  if (accessToken && refreshToken && tipoFragmento) {
    return { via: 'tokens', accessToken, refreshToken, kind: tipoFragmento };
  }

  const code = url.searchParams.get('code');
  if (code) {
    /*
     * El canje por codigo no siempre dice de que tipo es. Se asume
     * recuperacion porque es el unico camino que lo usa: la invitacion no
     * puede, al iniciarse fuera de este navegador.
     */
    return { via: 'code', code, kind: tipoValido(url.searchParams.get('type')) ?? 'recovery' };
  }

  return null;
}

/**
 * Borra de la barra de direcciones lo que traia el enlace.
 *
 * Se hace en cuanto se ha leido, y no al terminar: mientras siga ahi, el
 * token esta en el historial del navegador, en lo que se comparte al copiar
 * la direccion y en cualquier captura de pantalla.
 */
export function clearPasswordLinkFromUrl(): void {
  try {
    window.history.replaceState(null, '', window.location.pathname);
  } catch {
    // Si el navegador no deja reescribir la direccion, no es motivo para
    // dejar a nadie sin poder elegir su contrasena.
  }
}
