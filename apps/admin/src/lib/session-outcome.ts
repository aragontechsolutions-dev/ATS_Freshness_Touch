import { ApiClientError } from './api';

/**
 * QUE HACER CUANDO LA COMPROBACION DE SESION FALLA
 * ------------------------------------------------
 * Se saca a una funcion propia, y pura, por dos motivos:
 *
 *   1. Es la decision con mas consecuencias del panel: de ella depende que a
 *      alguien se le eche fuera o no. Merece pruebas, y una funcion sobre un
 *      error se prueba sin navegador.
 *   2. Estaba escrita dentro de un `catch` como una condicion de una linea, y
 *      esa condicion metia en el mismo saco "tu sesion no vale" y "no he
 *      podido preguntar". No son lo mismo ni de lejos.
 */
export type SessionOutcome =
  /** La sesion de verdad no sirve: hay que volver a entrar. */
  | 'expired'
  /** Ha entrado bien, pero esta cuenta no es personal del panel. */
  | 'noAccess'
  /**
   * NO SE HA PODIDO COMPROBAR. La sesion puede ser perfectamente buena.
   *
   * Es el caso que antes se trataba como "caducada", y eso tenia dos efectos
   * malos a la vez: se cerraba una sesion valida —obligando a teclear la
   * contrasena otra vez por un corte de un segundo— y se mentia al decir que
   * habia caducado. Un fallo de red o una API todavia arrancando no son
   * motivo para echar a nadie.
   */
  | 'unreachable';

export function sessionOutcome(error: unknown): SessionOutcome {
  if (!(error instanceof ApiClientError)) {
    /*
     * Cualquier cosa que no venga de nuestro cliente: un fallo del
     * almacenamiento del navegador, del bloqueo que usa la libreria de
     * sesion, o un error de programacion. Nada de eso dice que la sesion sea
     * mala, asi que no se cierra.
     */
    return 'unreachable';
  }

  if (error.statusCode === 401) return 'expired';
  if (error.statusCode === 403) return 'noAccess';

  /*
   * El resto —0 (sin red), 500, 502, 504, y el desajuste de contrato— son
   * problemas del camino o del servidor, no de la sesion.
   */
  return 'unreachable';
}
