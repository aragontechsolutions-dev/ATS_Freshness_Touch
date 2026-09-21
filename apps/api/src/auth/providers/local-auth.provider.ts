import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { AuthProviderName } from '@freshness/types';
import { InvalidTokenError, type AuthProvider, type TokenClaims } from '../auth.types';

const ISSUER = 'freshness-touch-local';
const AUDIENCE = 'authenticated';

/**
 * PROVEEDOR LOCAL DE DESARROLLO
 * -----------------------------
 * Emite y verifica sus propios tokens con un secreto compartido, para poder
 * construir y probar el panel sin depender de un proyecto de Supabase.
 *
 * NO PUEDE USARSE EN PRODUCCION, y la validacion de entorno lo impide. No es
 * una precaucion de mas: quien conozca el secreto puede fabricarse un token de
 * administrador. En los pagos, el simulador como mucho deja una reserva sin
 * cobrar; aqui seria entregar el sistema entero.
 *
 * Imita la forma de los tokens de Supabase (sub, email, iss, aud, exp) para
 * que el codigo que los consume no descubra diferencias al cambiar.
 */
export class LocalAuthProvider implements AuthProvider {
  readonly name: AuthProviderName = 'local';

  private readonly secret: Uint8Array;

  constructor(secret: string) {
    this.secret = new TextEncoder().encode(secret);
  }

  async verify(token: string): Promise<TokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.secret, {
        /*
         * Emisor y audiencia son comprobaciones QUE HAY QUE PEDIR: sin ellas,
         * la libreria acepta un token perfectamente firmado por otro sistema
         * que comparta secreto, o uno emitido para otra audiencia. Ambos casos
         * estan comprobados en los tests.
         */
        issuer: ISSUER,
        audience: AUDIENCE,
        // Fijar el algoritmo es defensa en profundidad: la libreria ya
        // rechaza "alg": "none" por su cuenta (comprobado). Se deja escrito
        // para que la garantia no dependa de una decision interna suya.
        algorithms: ['HS256'],
      });

      return toClaims(payload);
    } catch (error) {
      throw new InvalidTokenError(error instanceof Error ? error.message : 'token invalido');
    }
  }

  /** Emite un token. Solo para desarrollo y pruebas. */
  issue(userId: string, email: string, expiresInSeconds = 3600): Promise<string> {
    return new SignJWT({ email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSeconds)
      .sign(this.secret);
  }
}

/**
 * Traduce las reclamaciones del token al modelo interno.
 *
 * Compartida por los dos proveedores: ambos emiten tokens con la misma forma,
 * asi que duplicar esta lectura solo serviria para que se desincronizaran.
 */
export function toClaims(payload: JWTPayload): TokenClaims {
  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new InvalidTokenError('el token no identifica a ningun usuario');
  }
  /*
   * Exigir que EXISTA fecha de caducidad es cosa nuestra: la libreria
   * comprueba `exp` cuando esta presente, pero da por bueno un token que no
   * la lleve. Un token que no caduca nunca es un token que no se puede
   * revocar, y bastaria una fuga para tener acceso permanente.
   */
  if (typeof payload.exp !== 'number') {
    throw new InvalidTokenError('el token no caduca nunca');
  }

  return {
    userId: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
    expiresAt: new Date(payload.exp * 1000),
  };
}
