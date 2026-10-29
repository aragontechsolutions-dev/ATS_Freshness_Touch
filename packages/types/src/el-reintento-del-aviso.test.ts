import { describe, expect, it } from 'vitest';
import {
  NOTIFICATION_MAX_ATTEMPTS,
  NOTIFICATION_RETRY_DELAYS_MINUTES,
  nextRetryAt,
} from './notifications';

/**
 * LA ESPERA ENTRE REINTENTOS
 * --------------------------
 * Una cuenta pequena de la que dependen dos cosas que no se ven hasta que
 * fallan: que no se insista eternamente sobre una direccion mal escrita, y
 * que el primer reintento llegue antes de que el cliente eche de menos su
 * correo.
 */

const AHORA = new Date('2026-10-29T10:00:00.000Z');

describe('nextRetryAt', () => {
  it('con un intento hecho, el siguiente en cinco minutos', () => {
    expect(nextRetryAt(1, AHORA)?.toISOString()).toBe('2026-10-29T10:05:00.000Z');
  });

  /*
   * CRECE, y no es decoracion: si a la media hora sigue fallando no es un
   * hipo del proveedor, y seguir cada cinco minutos solo gasta cuota.
   */
  it('la espera crece en cada intento', () => {
    const esperas = NOTIFICATION_RETRY_DELAYS_MINUTES.map(
      (_, indice) => ((nextRetryAt(indice + 1, AHORA)?.getTime() ?? 0) - AHORA.getTime()) / 60_000,
    );

    expect(esperas).toEqual([...NOTIFICATION_RETRY_DELAYS_MINUTES]);
    for (let i = 1; i < esperas.length; i++) {
      expect(esperas[i]).toBeGreaterThan(esperas[i - 1] ?? 0);
    }
  });

  /*
   * Y SE ACABA. Un reintento infinito sobre una direccion que no existe no
   * entrega nada y esconde el problema para siempre.
   */
  it('al agotar los intentos ya no programa nada', () => {
    expect(nextRetryAt(NOTIFICATION_MAX_ATTEMPTS, AHORA)).toBeNull();
    expect(nextRetryAt(99, AHORA)).toBeNull();
  });

  it('son cinco envios en total: el primero y cuatro reintentos', () => {
    expect(NOTIFICATION_MAX_ATTEMPTS).toBe(5);
    expect(NOTIFICATION_RETRY_DELAYS_MINUTES).toHaveLength(4);
  });
});
