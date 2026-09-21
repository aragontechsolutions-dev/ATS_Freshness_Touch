import { describe, expect, it } from 'vitest';
import { hasStaffModifiers } from './staff-entrance';

/** Evento de raton con los modificadores que se indiquen. */
const evento = (
  cambios: Partial<Record<'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey', boolean>>,
) => ({
  shiftKey: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...cambios,
});

describe('gesto de la puerta de servicio', () => {
  it('reconoce Shift + Ctrl, como en Windows y Linux', () => {
    expect(hasStaffModifiers(evento({ shiftKey: true, ctrlKey: true }))).toBe(true);
  });

  it('reconoce tambien Shift + Cmd, porque en macOS Ctrl+clic es el menu contextual', () => {
    // Exigir Ctrl en un Mac haria el gesto incomodo o imposible: el sistema
    // se queda el evento para abrir el menu contextual.
    expect(hasStaffModifiers(evento({ shiftKey: true, metaKey: true }))).toBe(true);
  });

  it('no se dispara con un clic normal', () => {
    // Lo mas importante: el logotipo tiene que seguir llevando arriba.
    expect(hasStaffModifiers(evento({}))).toBe(false);
  });

  it('no se dispara con un solo modificador', () => {
    expect(hasStaffModifiers(evento({ shiftKey: true }))).toBe(false);
    expect(hasStaffModifiers(evento({ ctrlKey: true }))).toBe(false);
    expect(hasStaffModifiers(evento({ metaKey: true }))).toBe(false);
  });

  it('no se dispara con Alt pulsado', () => {
    /*
     * Con Alt, varios navegadores interpretan el clic como "descargar el
     * destino". Dejarlo pasar haria el gesto impredecible segun el navegador.
     */
    expect(hasStaffModifiers(evento({ shiftKey: true, ctrlKey: true, altKey: true }))).toBe(false);
    expect(hasStaffModifiers(evento({ shiftKey: true, metaKey: true, altKey: true }))).toBe(false);
  });

  it('Ctrl y Cmd a la vez tambien vale', () => {
    // No es un gesto habitual, pero rechazarlo solo sorprenderia a quien lo
    // haga sin querer teniendo las dos teclas pulsadas.
    expect(hasStaffModifiers(evento({ shiftKey: true, ctrlKey: true, metaKey: true }))).toBe(true);
  });
});
