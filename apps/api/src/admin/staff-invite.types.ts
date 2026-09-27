/**
 * INVITAR A ALGUIEN AL PANEL
 * --------------------------
 * Un puerto, como el correo o el pago, para que el servicio de personal no
 * sepa de que proveedor de identidad se trata.
 *
 * UNA DIFERENCIA IMPORTANTE CON EL PUERTO DE CORREO: aquel NUNCA lanza y se
 * traga los fallos, porque un correo que no sale no puede tumbar una reserva
 * ya pagada. Aqui es al reves. Si la invitacion falla, quien administra TIENE
 * que enterarse: creia estar dandole acceso a una persona y no se lo ha dado.
 * Un fallo silencioso aqui se descubre el dia que esa persona intenta entrar
 * y no puede, que suele ser el peor dia posible.
 *
 * Por eso el fallo se devuelve como dato —no como excepcion— y el servicio lo
 * convierte en un error visible en pantalla.
 */
export type InviteResult =
  | {
      ok: true;
      /**
       * Identificador de la cuenta recien creada.
       *
       * Es lo unico que se necesita de la respuesta, y es lo que vincula la
       * ficha con el acceso: sin el, la invitacion habria salido pero nadie
       * podria entrar con ella.
       */
      authUserId: string;
      /**
       * Enlace de un solo uso para elegir contrasena.
       *
       * El proveedor NO manda el correo: lo mandamos nosotros con nuestra
       * plantilla. Es una credencial, asi que no se registra en ningun log.
       */
      actionLink: string;
    }
  | { ok: false; reason: string };

/**
 * Una cuenta de acceso, tal y como la ve el proveedor.
 *
 * Hace falta para poder distinguir DOS situaciones que en nuestra tabla se
 * ven exactamente igual —ficha con cuenta vinculada— y que piden respuestas
 * opuestas cuando alguien pulsa «invitar»:
 *
 *   - Se le invito y NUNCA ha entrado: el enlace caduco y hay que reenviarlo.
 *   - Ya entra con normalidad: reenviar no procede; si perdio la contrasena,
 *     la pide ella desde «he olvidado mi contrasena».
 *
 * Sin esto, la unica salida era negarse siempre, que es lo que dejaba sin
 * acceso a quien se le caducaba el enlace.
 */
export interface StaffAccount {
  authUserId: string;
  /**
   * El correo CON EL QUE INICIA SESION, que manda sobre el de la ficha.
   * Editar el correo de contacto en el panel no cambia este.
   */
  email: string;
  /** Si alguna vez ha iniciado sesion. */
  hasSignedIn: boolean;
}

export interface StaffInviteProvider {
  readonly name: string;
  /**
   * Si este despliegue puede invitar.
   *
   * Depende de que la clave de servicio este configurada. Se expone para que
   * el panel no ofrezca un boton que va a fallar y para dar un error claro en
   * vez de uno del proveedor.
   */
  readonly available: boolean;

  invite(email: string): Promise<InviteResult>;

  /**
   * La cuenta, o `null` si el proveedor ya no la tiene o no se pudo
   * preguntar.
   *
   * DEVUELVE `null` EN VEZ DE LANZAR, y quien llama decide. Es una consulta
   * de apoyo: sirve para afinar el mensaje y para avisar de un desajuste de
   * correo, no para autorizar nada. Que el proveedor tarde un segundo de mas
   * no puede impedir invitar a alguien.
   */
  account(authUserId: string): Promise<StaffAccount | null>;
}

export const STAFF_INVITE_PROVIDER = Symbol('STAFF_INVITE_PROVIDER');
