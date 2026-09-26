import type { AuthProviderName } from '@freshness/types';

/**
 * CONTRATO DE CUALQUIER PROVEEDOR DE IDENTIDAD
 * --------------------------------------------
 * Mismo patron que la distancia y los pagos: el resto del sistema no sabe si
 * el token lo emitio Supabase o el proveedor local de desarrollo.
 *
 * Lo unico que hace un proveedor es RESPONDER A UNA PREGUNTA: "este token esta
 * firmado por quien dice y sigue vigente?". No decide permisos ni sabe que es
 * el personal: eso es asunto de la base de datos.
 */

/** Lo que afirma un token verificado. Es identidad, no autoridad. */
export interface TokenClaims {
  /** Identificador del usuario en el proveedor (reclamacion "sub"). */
  userId: string;
  email: string | null;
  /**
   * Identificador de la SESION, no del token.
   *
   * Supabase lo emite como `session_id` y se mantiene mientras dure la
   * sesion, aunque el token se refresque cada hora. Es justo lo que hace
   * falta para registrar «esta persona entro» una sola vez por acceso real
   * en vez de una vez por cada peticion o por cada refresco.
   *
   * Nulo cuando el proveedor no lo emite —el local de desarrollo no lo
   * hace—: en ese caso no se puede deduplicar y no se registra el acceso,
   * que es preferible a llenar la tabla de ruido.
   */
  sessionId: string | null;
  /** Cuando caduca el token. */
  expiresAt: Date;
}

export interface AuthProvider {
  readonly name: AuthProviderName;
  /** Verifica firma, emisor, audiencia y vigencia. Lanza si algo no cuadra. */
  verify(token: string): Promise<TokenClaims>;
}

/** Token de inyeccion de dependencias del proveedor activo. */
export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER');

/**
 * Token ausente, caducado, mal firmado o de otro emisor.
 *
 * El motivo concreto se registra en el servidor pero NUNCA se envia al
 * navegador: decir "la firma no cuadra" en vez de "ha caducado" le ahorra
 * trabajo a quien esta probando tokens.
 */
export class InvalidTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTokenError';
  }
}
