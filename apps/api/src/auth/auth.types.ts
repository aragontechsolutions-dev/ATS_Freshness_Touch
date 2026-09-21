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
