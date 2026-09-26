import { describe, expect, it } from 'vitest';
import { ApiClientError } from './api';
import { sessionOutcome } from './session-outcome';

describe('que hacer cuando falla la comprobacion de sesion', () => {
  it('401 es una sesion que ya no vale', () => {
    expect(sessionOutcome(new ApiClientError('UNAUTHORIZED', 'x', 401))).toBe('expired');
  });

  it('403 es una cuenta sin acceso al panel', () => {
    expect(sessionOutcome(new ApiClientError('FORBIDDEN', 'x', 403))).toBe('noAccess');
  });

  /*
   * LAS PRUEBAS QUE IMPORTAN. Todo esto se trataba antes como "tu sesion ha
   * caducado", y provocaba dos cosas malas a la vez: cerrar una sesion
   * perfectamente buena y mentir sobre el motivo. Un corte de un segundo no
   * puede obligar a teclear la contrasena otra vez.
   */
  it('sin red NO cierra la sesion', () => {
    expect(sessionOutcome(new ApiClientError('NETWORK_ERROR', 'x', 0))).toBe('unreachable');
  });

  it.each([500, 502, 503, 504])('un error %d del servidor tampoco', (codigo) => {
    expect(sessionOutcome(new ApiClientError('INTERNAL_ERROR', 'x', codigo))).toBe('unreachable');
  });

  it('un desajuste de contrato tampoco', () => {
    expect(sessionOutcome(new ApiClientError('BAD_CONTRACT', 'x', 500))).toBe('unreachable');
  });

  /*
   * Lo que lanza la libreria de sesion al fallar su bloqueo o el
   * almacenamiento del navegador no es un `ApiClientError`. Eso es justo lo
   * que dejaba la pantalla muda, porque no lo cogia nadie.
   */
  it.each([
    ['un error corriente', new Error('fallo del bloqueo')],
    ['algo que ni es un error', 'vaya'],
    ['nada', undefined],
  ])('%s se trata como "no se pudo comprobar"', (_caso, valor) => {
    expect(sessionOutcome(valor)).toBe('unreachable');
  });
});
