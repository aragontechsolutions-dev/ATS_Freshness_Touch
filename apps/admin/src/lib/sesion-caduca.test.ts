import { describe, expect, it } from 'vitest';
import {
  AVISO_DE_SESION_MINUTOS,
  hayQueAvisarDeLaSesion,
  minutosParaCaducar,
  minutosQueSeEnsenan,
} from './sesion-caduca';

/**
 * EL AVISO DE QUE LA SESION SE ACABA
 * ==================================
 * Tres cosas que no se ven leyendo el modulo y que, mal hechas, convierten
 * un aviso util en uno que nadie puede quitar:
 *
 *   1. QUE UNA FECHA ROTA NO AVISE A TODO EL MUNDO. Tratar lo ilegible como
 *      «ya caduco» sacaria la franja a toda la empresa a la vez, para
 *      siempre, sin corresponder a ningun hecho.
 *   2. QUE LA SESION YA CADUCADA SI AVISE. Es el caso mas urgente y el que
 *      una comprobacion ingenua («¿falta poco?») se deja fuera.
 *   3. QUE LOS MINUTOS NO DIGAN MENOS DE LOS QUE HAY. Con noventa segundos,
 *      «1 minuto» invita a no hacer nada.
 */

const AHORA = new Date('2026-10-31T12:00:00.000Z');

/** Una fecha de caducidad a `minutos` del momento de referencia. */
function dentroDe(minutos: number): string {
  return new Date(AHORA.getTime() + minutos * 60_000).toISOString();
}

describe('minutosParaCaducar', () => {
  it('cuenta los minutos que faltan', () => {
    expect(minutosParaCaducar(dentroDe(30), AHORA)).toBe(30);
  });

  it('DEVUELVE NEGATIVO si ya caduco, en vez de cero', () => {
    // Que sea negativo es lo que permite distinguir «se acaba» de «se acabo»
    // mas arriba, sin tener que volver a restar fechas.
    expect(minutosParaCaducar(dentroDe(-7), AHORA)).toBe(-7);
  });

  it('DEVUELVE null CON UNA FECHA QUE NO SE PUEDE LEER, no cero', () => {
    expect(minutosParaCaducar('mañana por la tarde', AHORA)).toBeNull();
    expect(minutosParaCaducar('', AHORA)).toBeNull();
  });
});

describe('hayQueAvisarDeLaSesion', () => {
  it('no avisa con una sesion recien renovada', () => {
    expect(hayQueAvisarDeLaSesion(dentroDe(59), AHORA)).toBe(false);
  });

  it('no avisa justo por encima del umbral', () => {
    expect(hayQueAvisarDeLaSesion(dentroDe(AVISO_DE_SESION_MINUTOS + 1), AHORA)).toBe(false);
  });

  it('avisa en el umbral', () => {
    expect(hayQueAvisarDeLaSesion(dentroDe(AVISO_DE_SESION_MINUTOS), AHORA)).toBe(true);
  });

  it('AVISA TAMBIEN CON LA SESION YA CADUCADA', () => {
    /*
     * EL FALLO QUE ESTA PRUEBA IMPIDE. Una comprobacion escrita como
     * «¿quedan entre 0 y 5 minutos?» dejaria sin aviso justo el caso en el
     * que la persona ya no puede fichar: el peor de todos.
     */
    expect(hayQueAvisarDeLaSesion(dentroDe(-30), AHORA)).toBe(true);
  });

  it('NO AVISA CON UNA FECHA ILEGIBLE', () => {
    /*
     * EL FALLO QUE ESTA PRUEBA IMPIDE. Es el unico fallo seguro de los dos:
     * una fecha rota no puede sacar una franja que no se puede cerrar y que
     * no corresponde a nada.
     */
    expect(hayQueAvisarDeLaSesion('no es una fecha', AHORA)).toBe(false);
  });
});

describe('minutosQueSeEnsenan', () => {
  it('REDONDEA HACIA ARRIBA, para no decir menos de lo que hay', () => {
    expect(minutosQueSeEnsenan(dentroDe(1.5), AHORA)).toBe(2);
    expect(minutosQueSeEnsenan(dentroDe(0.1), AHORA)).toBe(1);
  });

  it('nunca baja de cero', () => {
    expect(minutosQueSeEnsenan(dentroDe(-40), AHORA)).toBe(0);
    expect(minutosQueSeEnsenan(dentroDe(0), AHORA)).toBe(0);
  });

  it('con una fecha ilegible devuelve cero', () => {
    expect(minutosQueSeEnsenan('ayer', AHORA)).toBe(0);
  });
});
