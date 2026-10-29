/**
 * EL PUERTO POR EL QUE EL FILTRO CUENTA LO QUE HA REVENTADO
 * =========================================================
 * El filtro de excepciones es la unica pieza por la que pasan TODOS los
 * fallos de la API, asi que es el unico sitio desde el que se puede contar.
 * Pero contar no es su trabajo —el suyo es responder— y quien lleva la cuenta
 * vive en el modulo de estado, junto a la alarma que la mira.
 *
 * Por eso esto es una interfaz y no una importacion: `common/` no sabe nada
 * de `health/`, igual que no sabe nada de Telegram ni de Stripe. El filtro
 * pide «algo donde anotar»; quien se lo da es `main.ts`.
 *
 * Tambien hace la prueba trivial: un `anotar` que mete en un array.
 */
export interface ErrorAnotado {
  /** El codigo con el que se respondio. Solo se cuentan los 5xx. */
  status: number;
  /** El metodo HTTP. */
  method: string;
  /**
   * EL PATRON DE LA RUTA (`/api/v1/bookings/:id`), NO LA URL PEDIDA.
   *
   * Es la diferencia entre un agrupador y una fuga: la URL real lleva el
   * identificador de la reserva dentro y, si alguien la escribio a mano,
   * la cadena de consulta entera. `undefined` cuando la excepcion ocurrio
   * antes de que Express resolviera la ruta.
   */
  routePath: string | undefined;
  /** `error.name`. NUNCA `error.message`: el mensaje se queda en el log. */
  errorName: string | undefined;
}

export interface ErrorRecorder {
  /**
   * Anota un fallo.
   *
   * NO PUEDE LANZAR. Se llama desde dentro del filtro de excepciones, y una
   * excepcion ahi dejaria la peticion sin respuesta: el cliente se quedaria
   * esperando hasta que el proxy cortara. Quien lo llama lo envuelve de
   * todas formas, pero la obligacion es de quien lo implementa.
   */
  anotar(entrada: ErrorAnotado): void;
}
