import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { REMOVAL_TOKEN_BYTES } from '@freshness/types';

/**
 * EL TESTIGO CON EL QUE EL CLIENTE RETIRA SUS FOTOS
 * -------------------------------------------------
 * Vive aqui, en un archivo propio y diminuto, porque es lo unico de este
 * modulo que es CRIPTOGRAFIA y conviene poder leerlo entero de una vez.
 *
 * ========================================================================
 * SE GUARDA EL RESUMEN, NUNCA EL TESTIGO
 * ========================================================================
 * Quien tenga el testigo puede despublicar esa ficha sin identificarse de
 * ninguna otra forma: es una credencial, igual que un enlace de invitacion
 * al panel. Guardarlo tal cual significaria que una copia de seguridad
 * filtrada permite retirar las fotos de cualquiera.
 *
 * Con el resumen, la base guarda algo que sirve para RECONOCER el testigo y
 * no para fabricarlo.
 *
 * ========================================================================
 * SIN SAL, Y NO ES UN DESCUIDO
 * ========================================================================
 * Las contrasenas llevan sal porque las elige una persona y son
 * adivinables: dos personas eligen la misma y un diccionario las encuentra.
 * Esto son 32 bytes de aleatoriedad del sistema operativo. No hay diccionario
 * que lo adivine, no hay dos iguales, y anadir sal solo impediria buscarlo
 * por indice — que es justo lo que hace que un intento falso se resuelva en
 * una busqueda directa y no recorriendo la tabla entera.
 */

/** Un testigo nuevo y su resumen. El testigo solo existe en esta devolucion. */
export function crearTestigoDeRetirada(): { token: string; hash: string } {
  /*
   * base64url y no hexadecimal: la mitad de caracteres para la misma
   * aleatoriedad, y sin `+`, `/` ni `=`, que en una direccion hay que
   * escapar y en un correo se parten de linea.
   */
  const token = randomBytes(REMOVAL_TOKEN_BYTES).toString('base64url');
  return { token, hash: resumenDeTestigo(token) };
}

export function resumenDeTestigo(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Compara dos resumenes sin que el TIEMPO que tarda diga cuantos caracteres
 * acertaste.
 *
 * Aqui la busqueda va por indice y Postgres ya compara como quiere, asi que
 * esto no cierra ningun hueco real: esta para que el dia que alguien compare
 * resumenes a mano en este modulo, tenga la funcion correcta delante en vez
 * de escribir un `===`.
 */
export function mismoResumen(a: string, b: string): boolean {
  const uno = Buffer.from(a, 'utf8');
  const otro = Buffer.from(b, 'utf8');
  return uno.length === otro.length && timingSafeEqual(uno, otro);
}
