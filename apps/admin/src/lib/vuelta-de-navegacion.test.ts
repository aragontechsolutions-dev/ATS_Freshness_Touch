import { beforeEach, describe, expect, it } from 'vitest';
import { navegacionReciente, olvidarNavegacion, recordarNavegacion } from './vuelta-de-navegacion';

/**
 * EL RECUERDO QUE DECIDE SI SE PREGUNTA «¿HAS LLEGADO?»
 * ====================================================
 * Lo que se vigila aqui no es que funcione, sino que NO PREGUNTE DE MAS. Una
 * pregunta que aparece cuando no toca se contesta sin leerla, y entonces
 * tampoco sirve el dia que toca.
 */

const AHORA = Date.parse('2026-10-13T14:00:00.000Z');
const HORA = 3_600_000;

beforeEach(() => {
  sessionStorage.clear();
});

describe('recordar a donde se fue', () => {
  it('se guarda y se recupera', () => {
    recordarNavegacion('reserva-1', AHORA);

    expect(navegacionReciente(AHORA + 10 * 60_000)).toBe('reserva-1');
  });

  it('sin nada guardado no hay nada que preguntar', () => {
    expect(navegacionReciente(AHORA)).toBeNull();
  });

  it('olvidar lo borra', () => {
    recordarNavegacion('reserva-1', AHORA);
    olvidarNavegacion();

    expect(navegacionReciente(AHORA)).toBeNull();
  });
});

describe('cuando NO hay que preguntar', () => {
  it('pasadas cuatro horas', () => {
    /*
     * Cuatro horas cubren el trayecto mas largo del area con margen. Mas
     * alla, preguntar «¿has llegado?» por una navegacion de esta manana es
     * ruido, y el ruido ensena a ignorar la pregunta.
     */
    recordarNavegacion('reserva-1', AHORA);

    expect(navegacionReciente(AHORA + 4 * HORA - 1000)).toBe('reserva-1');
    expect(navegacionReciente(AHORA + 4 * HORA + 1000)).toBeNull();
  });

  it('si la marca viene del futuro', () => {
    // Pasa de verdad: el reloj del movil se corrige solo al recuperar
    // cobertura. Una marca del futuro no caducaria nunca.
    recordarNavegacion('reserva-1', AHORA + HORA);

    expect(navegacionReciente(AHORA)).toBeNull();
  });
});

describe('lo guardado NO se cree sin mirarlo', () => {
  /*
   * `sessionStorage` lo puede escribir cualquier cosa que corra en este
   * origen, y una version anterior de la aplicacion pudo guardar otra forma.
   * Lo que no se entiende se tira, en vez de reventar la pantalla.
   */
  it.each([
    'esto no es json',
    '"una cadena"',
    '42',
    'null',
    '{}',
    '{"bookingId":"","at":1}',
    '{"bookingId":123,"at":1}',
    '{"bookingId":"reserva-1"}',
    '{"bookingId":"reserva-1","at":"ayer"}',
  ])('%s no se interpreta como un trabajo', (basura) => {
    sessionStorage.setItem('ft.navegando', basura);

    expect(navegacionReciente(AHORA)).toBeNull();
  });
});

describe('sin almacenamiento la pantalla no se cae', () => {
  it('guardar y leer se tragan el fallo', () => {
    /*
     * En navegacion privada el acceso LANZA. Quedarse sin preguntar es un
     * inconveniente; una pantalla en blanco en la puerta de una casa, no.
     */
    const original = Object.getOwnPropertyDescriptor(window, 'sessionStorage');

    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('acceso denegado');
      },
    });

    expect(() => recordarNavegacion('reserva-1', AHORA)).not.toThrow();
    expect(navegacionReciente(AHORA)).toBeNull();
    expect(() => olvidarNavegacion()).not.toThrow();

    if (original) Object.defineProperty(window, 'sessionStorage', original);
  });
});
