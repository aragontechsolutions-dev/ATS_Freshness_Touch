import { describe, expect, it } from 'vitest';
import { readPasswordLink } from './password-link';

const PANEL = 'https://panel.example.com/';

describe('lectura del enlace de correo', () => {
  it('una direccion normal no abre nada', () => {
    expect(readPasswordLink(PANEL)).toBeNull();
    expect(readPasswordLink(`${PANEL}?date=2026-09-25`)).toBeNull();
  });

  it('lee la invitacion, que viene con los tokens en el fragmento', () => {
    const enlace = readPasswordLink(
      `${PANEL}#access_token=abc&refresh_token=def&type=invite&expires_in=3600`,
    );

    expect(enlace).toEqual({
      via: 'tokens',
      accessToken: 'abc',
      refreshToken: 'def',
      kind: 'invite',
    });
  });

  it('lee la recuperacion por codigo', () => {
    expect(readPasswordLink(`${PANEL}?code=xyz`)).toEqual({
      via: 'code',
      code: 'xyz',
      kind: 'recovery',
    });
  });

  it('lee un enlace caducado y dice por que', () => {
    const enlace = readPasswordLink(
      `${PANEL}#error=access_denied&error_description=Email+link+is+invalid+or+has+expired`,
    );

    expect(enlace).toEqual({
      via: 'error',
      reason: 'Email link is invalid or has expired',
    });
  });

  it('el error manda sobre cualquier token que venga en el mismo enlace', () => {
    const enlace = readPasswordLink(
      `${PANEL}#access_token=abc&refresh_token=def&type=recovery&error=otp_expired`,
    );

    expect(enlace?.via).toBe('error');
  });

  /*
   * LAS PRUEBAS QUE IMPORTAN. Esta pantalla es el UNICO sitio del panel que
   * acepta una sesion metida en la direccion, asi que la puerta tiene que ser
   * estrecha: solo invitacion y recuperacion, y solo con los dos tokens.
   *
   * Sin esto, bastaria con mandarle a alguien un enlace con un token pegado
   * para meterlo en la sesion de otra persona sin que lo notara.
   */
  it.each(['magiclink', 'signup', 'email_change', 'bearer', '', 'RECOVERY '])(
    'ignora el tipo %j',
    (tipo) => {
      const enlace = readPasswordLink(
        `${PANEL}#access_token=abc&refresh_token=def&type=${encodeURIComponent(tipo)}`,
      );
      expect(enlace).toBeNull();
    },
  );

  it('ignora un fragmento con token pero sin tipo', () => {
    expect(readPasswordLink(`${PANEL}#access_token=abc&refresh_token=def`)).toBeNull();
  });

  it('ignora un fragmento al que le falta el token de renovacion', () => {
    expect(readPasswordLink(`${PANEL}#access_token=abc&type=recovery`)).toBeNull();
  });

  it('una direccion rota no revienta la pantalla', () => {
    expect(readPasswordLink('esto-no-es-una-direccion')).toBeNull();
  });

  it('recorta un motivo de error desmesurado', () => {
    const largo = 'x'.repeat(500);
    const enlace = readPasswordLink(`${PANEL}#error_description=${largo}`);

    expect(enlace?.via).toBe('error');
    expect(enlace && 'reason' in enlace && enlace.reason.length).toBe(200);
  });
});
