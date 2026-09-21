import { createServer, type Server } from 'node:http';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import type { CryptoKey } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InvalidTokenError } from '../auth.types';
import { SupabaseAuthProvider } from './supabase-auth.provider';

/**
 * VERIFICACION CONTRA UN SUPABASE SIMULADO
 * ----------------------------------------
 * Se genera un par de claves de verdad y se sirve el juego de claves publicas
 * por HTTP, igual que hace Supabase. Asi se ejercita el codigo de
 * verificacion completo (descarga del JWKS, seleccion por "kid", firma
 * asimetrica) sin necesidad de un proyecto real.
 */

const PORT = 55450;
const PROJECT_URL = `http://127.0.0.1:${PORT}`;
const ISSUER = `${PROJECT_URL}/auth/v1`;
const USUARIO = '22222222-2222-4222-8222-222222222222';
const KID = 'clave-de-prueba';

let servidor: Server;
let privada: CryptoKey;
let publica: CryptoKey;
let peticionesAlJwks = 0;

/** Token firmado con la clave privada, como lo emitiria Supabase. */
function firmarAsimetrico(
  cambios: { issuer?: string; audience?: string; expiresAt?: number } = {},
): Promise<string> {
  return new SignJWT({ email: 'staff@example.com' })
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setSubject(USUARIO)
    .setIssuer(cambios.issuer ?? ISSUER)
    .setAudience(cambios.audience ?? 'authenticated')
    .setIssuedAt()
    .setExpirationTime(cambios.expiresAt ?? Math.floor(Date.now() / 1000) + 3600)
    .sign(privada);
}

beforeAll(async () => {
  ({ privateKey: privada, publicKey: publica } = await generateKeyPair('RS256', {
    extractable: true,
  }));

  const jwk = await exportJWK(publica);
  const cuerpo = JSON.stringify({ keys: [{ ...jwk, kid: KID, alg: 'RS256', use: 'sig' }] });

  servidor = createServer((request, response) => {
    if (request.url?.includes('jwks')) {
      peticionesAlJwks += 1;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(cuerpo);
      return;
    }
    response.writeHead(404).end();
  });

  await new Promise<void>((resolve) => servidor.listen(PORT, '127.0.0.1', resolve));
}, 30_000);

afterAll(async () => {
  await new Promise<void>((resolve) => servidor.close(() => resolve()));
});

describe('claves asimetricas (proyectos actuales)', () => {
  const provider = () => new SupabaseAuthProvider({ projectUrl: PROJECT_URL, timeoutMs: 3000 });

  it('acepta un token firmado con la clave del proyecto', async () => {
    const claims = await provider().verify(await firmarAsimetrico());

    expect(claims.userId).toBe(USUARIO);
    expect(claims.email).toBe('staff@example.com');
  });

  it('no descarga el juego de claves en cada peticion', async () => {
    const p = provider();
    const antes = peticionesAlJwks;

    await p.verify(await firmarAsimetrico());
    await p.verify(await firmarAsimetrico());
    await p.verify(await firmarAsimetrico());

    // Una sola descarga: pedirlo en cada llamada multiplicaria la latencia y
    // dejaria el panel inservible si Supabase tarda en responder.
    expect(peticionesAlJwks - antes).toBe(1);
  });

  it('RECHAZA la confusion de algoritmos', async () => {
    /*
     * El ataque: la clave publica es publica, asi que un atacante puede
     * firmar un token con HS256 USANDO LA CLAVE PUBLICA COMO SECRETO. La
     * misma cadena sirve de clave publica para RSA y de secreto para HMAC.
     *
     * Contra el juego de claves publicas la libreria ya lo rechaza por su
     * cuenta (comprobado: "Unsupported alg value for a JSON Web Key Set"),
     * asi que este test vigila esa garantia, no la nuestra.
     *
     * Donde el ataque SI funcionaria es en el camino del secreto compartido,
     * y lo que lo cierra es no tener nunca los dos modos activos a la vez.
     * Eso lo demuestra el ultimo test de este archivo.
     */
    const jwk = await exportJWK(publica);
    const claveComoSecreto = new TextEncoder().encode(jwk.n ?? '');

    const falsificado = await new SignJWT({ email: 'atacante@example.com' })
      .setProtectedHeader({ alg: 'HS256', kid: KID })
      .setSubject(USUARIO)
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
      .sign(claveComoSecreto);

    await expect(provider().verify(falsificado)).rejects.toThrow(InvalidTokenError);
  });

  it('rechaza un token de otro proyecto de Supabase', async () => {
    const otroProyecto = await firmarAsimetrico({ issuer: 'https://otro.supabase.co/auth/v1' });
    await expect(provider().verify(otroProyecto)).rejects.toThrow(InvalidTokenError);
  });

  it('rechaza un token de la clave de servicio', async () => {
    // La audiencia "service_role" salta la seguridad de filas: si valiera
    // para entrar al panel, una fuga de esa clave lo abriria entero.
    const servicio = await firmarAsimetrico({ audience: 'service_role' });
    await expect(provider().verify(servicio)).rejects.toThrow(InvalidTokenError);
  });

  it('rechaza un token caducado', async () => {
    const vencido = await firmarAsimetrico({ expiresAt: Math.floor(Date.now() / 1000) - 60 });
    await expect(provider().verify(vencido)).rejects.toThrow(InvalidTokenError);
  });
});

describe('secreto compartido (proyectos antiguos)', () => {
  const SECRETO = 'secreto-heredado-del-proyecto-antiguo';
  const provider = () =>
    new SupabaseAuthProvider({
      projectUrl: PROJECT_URL,
      legacyJwtSecret: SECRETO,
      timeoutMs: 3000,
    });

  it('se activa cuando hay secreto configurado', () => {
    expect(provider().usesLegacySecret).toBe(true);
    expect(
      new SupabaseAuthProvider({ projectUrl: PROJECT_URL, timeoutMs: 3000 }).usesLegacySecret,
    ).toBe(false);
  });

  it('acepta un token firmado con el secreto', async () => {
    const token = await new SignJWT({ email: 'staff@example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USUARIO)
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
      .sign(new TextEncoder().encode(SECRETO));

    expect((await provider().verify(token)).userId).toBe(USUARIO);
  });

  it('en modo heredado NO acepta tokens asimetricos', async () => {
    /*
     * ESTE es el test que protege de verdad contra la confusion de
     * algoritmos. Si el proveedor intentara las dos verificaciones, bastaria
     * con que una diera el visto bueno; con un solo modo activo, el camino
     * vulnerable no existe.
     */
    await expect(provider().verify(await firmarAsimetrico())).rejects.toThrow(InvalidTokenError);
  });
});
