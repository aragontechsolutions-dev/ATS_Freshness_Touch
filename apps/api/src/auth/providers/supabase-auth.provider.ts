import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AuthProviderName } from '@freshness/types';
import { InvalidTokenError, type AuthProvider, type TokenClaims } from '../auth.types';
import { toClaims } from './local-auth.provider';

/** Algoritmos asimetricos que emite Supabase (RS256 por defecto). */
const ASYMMETRIC_ALGORITHMS = ['RS256', 'ES256', 'EdDSA'] as const;

export interface SupabaseAuthOptions {
  /** Direccion del proyecto: https://<ref>.supabase.co */
  projectUrl: string;
  /**
   * Secreto compartido de los proyectos ANTIGUOS. Si se indica, se usa la
   * verificacion heredada por HS256 en vez del juego de claves publicas.
   */
  legacyJwtSecret?: string;
  timeoutMs: number;
}

/**
 * PROVEEDOR REAL: SUPABASE AUTH
 * -----------------------------
 * Supabase firma hoy con CLAVES ASIMETRICAS y publica las publicas en un
 * juego de claves (JWKS). Verificar contra ellas permite comprobar cada token
 * sin llamar a Supabase en cada peticion, y que Supabase pueda rotar sus
 * claves sin que haya que tocar nada aqui.
 *
 * Los proyectos creados hace tiempo siguen usando un secreto compartido
 * (HS256). Se admiten los dos, pero NUNCA a la vez: ver mas abajo.
 */
export class SupabaseAuthProvider implements AuthProvider {
  readonly name: AuthProviderName = 'supabase';

  private readonly issuer: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet> | null;
  private readonly legacySecret: Uint8Array | null;

  constructor(options: SupabaseAuthOptions) {
    const base = options.projectUrl.replace(/\/+$/, '');
    this.issuer = `${base}/auth/v1`;

    /*
     * UN SOLO MODO, NUNCA LOS DOS.
     *
     * Si se aceptaran a la vez las claves publicas y el secreto compartido,
     * habria que probar las dos verificaciones, y la del secreto abre la
     * confusion de algoritmos: un atacante firma con HS256 usando como
     * secreto la clave PUBLICA, que por definicion conoce, y esa segunda
     * verificacion lo da por bueno.
     *
     * Contra el juego de claves publicas ese ataque no funciona ni queriendo
     * (la libreria rechaza los algoritmos simetricos ahi, comprobado); el
     * riesgo real esta en mezclar los dos caminos. Por eso el modo se decide
     * una sola vez al arrancar.
     */
    if (options.legacyJwtSecret) {
      this.legacySecret = new TextEncoder().encode(options.legacyJwtSecret);
      this.jwks = null;
    } else {
      this.legacySecret = null;
      this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`), {
        timeoutDuration: options.timeoutMs,
        // Si llega un token firmado con una clave que no conocemos, se vuelve
        // a pedir el juego de claves. El periodo de espera evita que un token
        // basura provoque una peticion por intento.
        cooldownDuration: 30_000,
      });
    }
  }

  /** true cuando verifica con el secreto compartido de los proyectos antiguos. */
  get usesLegacySecret(): boolean {
    return this.legacySecret !== null;
  }

  async verify(token: string): Promise<TokenClaims> {
    try {
      /*
       * `issuer` y `audience` son las comprobaciones que de verdad aportamos
       * aqui: sin pedirlas, valdria un token de OTRO proyecto de Supabase, o
       * uno emitido para "service_role", que salta la seguridad de filas.
       */
      const { payload } = this.legacySecret
        ? await jwtVerify(token, this.legacySecret, {
            issuer: this.issuer,
            audience: 'authenticated',
            algorithms: ['HS256'],
          })
        : await jwtVerify(token, this.jwks!, {
            issuer: this.issuer,
            audience: 'authenticated',
            algorithms: [...ASYMMETRIC_ALGORITHMS],
          });

      return toClaims(payload);
    } catch (error) {
      throw new InvalidTokenError(error instanceof Error ? error.message : 'token invalido');
    }
  }
}
