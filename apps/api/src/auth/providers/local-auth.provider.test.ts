import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { InvalidTokenError } from '../auth.types';
import { LocalAuthProvider } from './local-auth.provider';

const SECRETO = 'secreto-de-prueba-suficientemente-largo';
const provider = new LocalAuthProvider(SECRETO);
const clave = new TextEncoder().encode(SECRETO);

const USUARIO = '11111111-1111-4111-8111-111111111111';

/** Firma un token a medida para provocar cada fallo por separado. */
function firmar(
  cambios: {
    subject?: string | null;
    issuer?: string;
    audience?: string;
    expiresAt?: number | null;
    secret?: Uint8Array;
  } = {},
): Promise<string> {
  let jwt = new SignJWT({ email: 'ana@example.com' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(cambios.issuer ?? 'freshness-touch-local')
    .setAudience(cambios.audience ?? 'authenticated')
    .setIssuedAt();

  if (cambios.subject !== null) jwt = jwt.setSubject(cambios.subject ?? USUARIO);
  if (cambios.expiresAt !== null) {
    jwt = jwt.setExpirationTime(cambios.expiresAt ?? Math.floor(Date.now() / 1000) + 3600);
  }

  return jwt.sign(cambios.secret ?? clave);
}

describe('token valido', () => {
  it('devuelve el usuario, el correo y la caducidad', async () => {
    const token = await provider.issue(USUARIO, 'ana@example.com');
    const claims = await provider.verify(token);

    expect(claims.userId).toBe(USUARIO);
    expect(claims.email).toBe('ana@example.com');
    expect(claims.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('tokens que deben rechazarse', () => {
  it('firmado con otro secreto', async () => {
    const ajeno = await firmar({ secret: new TextEncoder().encode('otro-secreto-distinto') });
    await expect(provider.verify(ajeno)).rejects.toThrow(InvalidTokenError);
  });

  it('caducado', async () => {
    const vencido = await firmar({ expiresAt: Math.floor(Date.now() / 1000) - 60 });
    await expect(provider.verify(vencido)).rejects.toThrow(InvalidTokenError);
  });

  it('de otro emisor', async () => {
    /*
     * Este si tiene dientes: sin pedir la comprobacion de emisor, la libreria
     * ACEPTA este token (comprobado). Un sistema que compartiera secreto
     * podria emitir accesos a este panel.
     */
    const otroEmisor = await firmar({ issuer: 'otro-sistema' });
    await expect(provider.verify(otroEmisor)).rejects.toThrow(InvalidTokenError);
  });

  it('para otra audiencia', async () => {
    // Igual que el anterior: sin pedirlo, la libreria lo acepta.
    const otraAudiencia = await firmar({ audience: 'service_role' });
    await expect(provider.verify(otraAudiencia)).rejects.toThrow(InvalidTokenError);
  });

  it('sin usuario', async () => {
    const sinSub = await firmar({ subject: null });
    await expect(provider.verify(sinSub)).rejects.toThrow(InvalidTokenError);
  });

  it('sin fecha de caducidad', async () => {
    /*
     * Con dientes: la libreria comprueba `exp` cuando existe, pero da por
     * bueno un token que no la lleve (comprobado). Un token que no caduca
     * nunca es un token que no se puede revocar.
     */
    const eterno = await firmar({ expiresAt: null });
    await expect(provider.verify(eterno)).rejects.toThrow(InvalidTokenError);
  });

  it('SIN FIRMA (alg: none)', async () => {
    /*
     * El ataque mas antiguo contra JWT: se cambia la cabecera a "alg": "none"
     * y se borra la firma.
     *
     * Comprobado que la libreria lo rechaza por su cuenta, asi que este test
     * no demuestra que nuestra fijacion de algoritmos sea lo que protege:
     * vigila que una actualizacion de la libreria no cambie ese
     * comportamiento sin que nos enteremos.
     */
    const base64url = (valor: object): string =>
      Buffer.from(JSON.stringify(valor)).toString('base64url');

    const falso = [
      base64url({ alg: 'none', typ: 'JWT' }),
      base64url({
        sub: USUARIO,
        iss: 'freshness-touch-local',
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
      '',
    ].join('.');

    await expect(provider.verify(falso)).rejects.toThrow(InvalidTokenError);
  });

  it('texto que no es un token', async () => {
    for (const basura of ['', 'no-es-un-token', 'a.b.c', 'Bearer x']) {
      await expect(provider.verify(basura), basura).rejects.toThrow(InvalidTokenError);
    }
  });
});
