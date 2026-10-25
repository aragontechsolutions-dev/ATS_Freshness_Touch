import { describe, expect, it } from 'vitest';
import { removalDeadline, removalState } from './index';

/**
 * EL PLAZO DE RETIRADA
 * --------------------
 * El papel promete que, si el cliente lo pide, sus fotos dejan de publicarse
 * en unos dias. Esta cuenta decide cuando ese plazo se ha incumplido, asi que
 * el borde importa: **el dia del vencimiento todavia NO esta vencido**.
 * Prometer «en cinco dias» incluye el quinto.
 *
 * Es una cuenta de dos lineas, y precisamente por eso se prueba: las cuentas
 * de dos lineas son las que se escriben de memoria y se escriben al reves.
 */

const PEDIDA = '2026-10-20';

function estado(hoy: string, revoked = false) {
  return removalState({ requestedAt: PEDIDA, removalDays: 5, revoked }, hoy);
}

describe('cuando no se ha pedido nada', () => {
  it('no hay plazo que vencer', () => {
    const sinPeticion = removalState({ requestedAt: null, removalDays: 5, revoked: false }, PEDIDA);

    expect(sinPeticion.requested).toBe(false);
    expect(sinPeticion.deadline).toBeNull();
    expect(sinPeticion.daysLeft).toBeNull();
    expect(sinPeticion.overdue).toBe(false);
  });
});

describe('el dia en que vence', () => {
  it('son los dias del papel contados desde que se pidio', () => {
    expect(removalDeadline('2026-10-20', 5)).toBe('2026-10-25');
  });

  /* Un plazo que cruza un cambio de mes no puede dar un dia 32. */
  it('cruza el final de mes sin inventarse fechas', () => {
    expect(removalDeadline('2026-10-29', 5)).toBe('2026-11-03');
  });

  /* Ni un cambio de ano. */
  it('y el final de ano tambien', () => {
    expect(removalDeadline('2026-12-30', 5)).toBe('2027-01-04');
  });
});

describe('mientras el plazo corre', () => {
  it('el mismo dia que se pide quedan los dias enteros', () => {
    expect(estado('2026-10-20').daysLeft).toBe(5);
    expect(estado('2026-10-20').overdue).toBe(false);
  });

  it('al dia siguiente queda uno menos', () => {
    expect(estado('2026-10-21').daysLeft).toBe(4);
  });

  /*
   * EL BORDE. Prometer «en cinco dias» incluye el quinto: el dia del
   * vencimiento quedan cero dias y todavia se esta a tiempo. Si esta prueba
   * se pone en rojo porque alguien cambio el `< 0` por un `<= 0`, lo que
   * acaba de pasar es que el sistema declara incumplida una promesa que se
   * esta cumpliendo.
   */
  it('el dia del vencimiento quedan cero dias y NO esta vencido', () => {
    expect(estado('2026-10-25').daysLeft).toBe(0);
    expect(estado('2026-10-25').overdue).toBe(false);
  });
});

describe('cuando el plazo se pasa', () => {
  it('al dia siguiente del vencimiento ya esta vencido', () => {
    expect(estado('2026-10-26').daysLeft).toBe(-1);
    expect(estado('2026-10-26').overdue).toBe(true);
  });

  it('y los dias de retraso se cuentan hacia atras', () => {
    expect(estado('2026-10-30').daysLeft).toBe(-5);
  });
});

describe('cuando ya se retiro', () => {
  /*
   * UNA PROMESA CUMPLIDA NO VENCE NUNCA MAS. Si se retiro, la cuenta sigue
   * dando dias negativos —el plazo paso— pero `overdue` tiene que ser falso:
   * de lo contrario la ficha seguiria apareciendo en los avisos para siempre.
   */
  it('deja de estar vencida aunque la fecha haya pasado', () => {
    const tarde = estado('2026-11-30', true);

    expect(tarde.fulfilled).toBe(true);
    expect(tarde.overdue).toBe(false);
    expect(tarde.daysLeft).toBeLessThan(0);
  });
});

describe('un plazo distinto del de la casa', () => {
  /*
   * El contrato admite de 1 a 30 dias porque un papel concreto puede
   * prometer otra cosa. La cuenta tiene que usar lo que dice ESE papel, no
   * los cinco dias de la configuracion.
   */
  it('se cuenta con los dias que promete ese papel, no con los de siempre', () => {
    const corto = removalState(
      { requestedAt: PEDIDA, removalDays: 1, revoked: false },
      '2026-10-22',
    );

    expect(corto.deadline).toBe('2026-10-21');
    expect(corto.overdue).toBe(true);
  });
});
