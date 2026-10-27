import { describe, expect, it } from 'vitest';
import { clavesDeNotificacion, parametrosDeNotificacion } from './notificacion';

/**
 * EL TEXTO DE UNA NOTIFICACION
 * ----------------------------
 * Lo que viaja en la fila son datos crudos —centavos enteros, fechas en
 * ISO—. Pegarlos tal cual daria «quedan 3500 retenidos» y «el
 * 2026-10-27T14:00:00.000Z»: correcto y, para quien lo lee, inutil.
 */

describe('que clave de texto le toca a cada clase', () => {
  /*
   * ANIDADA IGUAL QUE EL `kind`, como las acciones de auditoria: la clave se
   * construye pegandolo tal cual y no hay tabla de equivalencias que
   * mantener. Si esto se separa, anadir una clase obliga a tocar dos sitios
   * y un dia se toca solo uno.
   */
  it('se construye pegando el kind, sin tabla de equivalencias', () => {
    expect(clavesDeNotificacion('booking.confirmed')).toEqual({
      titulo: 'admin.inbox.kind.booking.confirmed.title',
      cuerpo: 'admin.inbox.kind.booking.confirmed.body',
    });
  });
});

describe('los parametros que se pegan en la frase', () => {
  it('el dinero sale en centavos y se ensena como moneda', () => {
    const salida = parametrosDeNotificacion({ params: { amountCents: 3500 } }, 'en');

    expect(salida.amount).toContain('35');
    /* Y el crudo sigue ahi: una frase antigua que lo use no se queda vacia. */
    expect(salida.amountCents).toBe(3500);
  });

  it('las fechas salen en ISO y se ensenan legibles', () => {
    const salida = parametrosDeNotificacion(
      { params: { scheduledStart: '2026-10-27T14:00:00.000Z' } },
      'en',
    );

    expect(typeof salida.when).toBe('string');
    expect(salida.when).not.toBe('2026-10-27T14:00:00.000Z');
  });

  /*
   * LO QUE NO SE RECONOCE PASA TAL CUAL. Una clase nueva anadida en la API,
   * con el panel todavia sin desplegar, ensena su texto con los datos en
   * crudo en vez de no ensenar nada.
   */
  it('lo que no conoce lo deja como esta', () => {
    const salida = parametrosDeNotificacion({ params: { reference: 'FT-2026-0007' } }, 'es');

    expect(salida.reference).toBe('FT-2026-0007');
  });

  it('una fecha que no es una fecha no se convierte', () => {
    const salida = parametrosDeNotificacion({ params: { scheduledStart: 'manana' } }, 'es');

    expect(salida.when).toBeUndefined();
    expect(salida.scheduledStart).toBe('manana');
  });

  it('sin parametros no inventa ninguno', () => {
    expect(parametrosDeNotificacion({ params: {} }, 'en')).toEqual({});
  });
});
