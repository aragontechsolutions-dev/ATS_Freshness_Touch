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
    }
  | { ok: false; reason: string };

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
}

export const STAFF_INVITE_PROVIDER = Symbol('STAFF_INVITE_PROVIDER');
