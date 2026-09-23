import { describe, expect, it } from 'vitest';
import {
  PANEL_PASSWORD_MIN_LENGTH,
  PanelPasswordChoiceSchema,
  PanelPasswordSchema,
  panelPasswordProblem,
} from './panel-password';

const BUENA = 'gato-azul-en-la-ventana';

describe('contrasena del panel', () => {
  it('acepta una larga sin adornos', () => {
    expect(PanelPasswordSchema.safeParse(BUENA).success).toBe(true);
  });

  /*
   * Largo y nada mas: no se exige mayuscula, numero ni simbolo. Esas reglas
   * producen `Password1!` una y otra vez, que es corta y adivinable.
   */
  it('acepta una de solo minusculas si es larga', () => {
    expect(PanelPasswordSchema.safeParse('abcdefghijkl').success).toBe(true);
  });

  it(`rechaza menos de ${PANEL_PASSWORD_MIN_LENGTH} caracteres`, () => {
    expect(PanelPasswordSchema.safeParse('a'.repeat(PANEL_PASSWORD_MIN_LENGTH - 1)).success).toBe(
      false,
    );
  });

  it('acepta justo el minimo', () => {
    expect(PanelPasswordSchema.safeParse('a'.repeat(PANEL_PASSWORD_MIN_LENGTH)).success).toBe(true);
  });

  /*
   * El tope no es cosmetico: sin el, alguien podria enviar megabytes y
   * obligar al proveedor a calcular el hash de todo ello.
   */
  it('rechaza una desmesurada', () => {
    expect(PanelPasswordSchema.safeParse('a'.repeat(201)).success).toBe(false);
  });
});

describe('las dos vueltas', () => {
  it('acepta cuando coinciden', () => {
    const resultado = PanelPasswordChoiceSchema.safeParse({
      password: BUENA,
      confirmation: BUENA,
    });

    expect(resultado.success).toBe(true);
  });

  /*
   * El campo va oculto, asi que una errata al elegirla no se ve. Sin la
   * segunda vuelta se descubriria al siguiente intento de entrar, cuando ya
   * no hay forma de saber que se tecleo.
   */
  it('rechaza cuando no coinciden', () => {
    const resultado = PanelPasswordChoiceSchema.safeParse({
      password: BUENA,
      confirmation: `${BUENA}x`,
    });

    expect(resultado.success).toBe(false);
  });

  it('una diferencia de un solo espacio al final tambien se detecta', () => {
    const resultado = PanelPasswordChoiceSchema.safeParse({
      password: BUENA,
      confirmation: `${BUENA} `,
    });

    expect(resultado.success).toBe(false);
  });
});

describe('el motivo del rechazo, como clave', () => {
  it('devuelve null cuando esta bien', () => {
    expect(panelPasswordProblem(BUENA, BUENA)).toBeNull();
  });

  it('avisa de la longitud antes que de la coincidencia', () => {
    // Las dos cosas fallan; se dice la que hay que arreglar primero, porque
    // corregir la coincidencia de algo demasiado corto no sirve de nada.
    expect(panelPasswordProblem('corta', 'otra')).toBe('tooShort');
  });

  it('avisa de que no coinciden', () => {
    expect(panelPasswordProblem(BUENA, 'otra-cosa-larguisima')).toBe('mismatch');
  });
});
