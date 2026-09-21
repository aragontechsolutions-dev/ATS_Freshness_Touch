import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * El temporizador se prueba sobre la misma lógica que usa el hook, sin montar
 * React: lo que importa aquí es CUÁNDO salta, no cómo se pinta.
 */
function crearTemporizador(minutos: number, alCaducar: () => void) {
  const EVENTOS = ['mousedown', 'keydown', 'scroll', 'touchstart'];
  let temporizador: ReturnType<typeof setTimeout>;

  const reiniciar = (): void => {
    clearTimeout(temporizador);
    temporizador = setTimeout(alCaducar, minutos * 60_000);
  };

  reiniciar();
  for (const evento of EVENTOS) window.addEventListener(evento, reiniciar);

  return () => {
    clearTimeout(temporizador);
    for (const evento of EVENTOS) window.removeEventListener(evento, reiniciar);
  };
}

describe('cierre por inactividad', () => {
  let cerrado: number;
  let detener: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    cerrado = 0;
    detener = crearTemporizador(30, () => {
      cerrado += 1;
    });
  });

  afterEach(() => {
    detener();
    vi.useRealTimers();
  });

  it('cierra la sesion tras el plazo sin actividad', () => {
    vi.advanceTimersByTime(29 * 60_000);
    expect(cerrado).toBe(0);

    vi.advanceTimersByTime(60_000);
    expect(cerrado).toBe(1);
  });

  it('teclear o desplazarse reinicia la cuenta', () => {
    vi.advanceTimersByTime(29 * 60_000);
    window.dispatchEvent(new Event('keydown'));

    vi.advanceTimersByTime(29 * 60_000);
    expect(cerrado, 'no debe cerrar: hubo actividad hace 29 minutos').toBe(0);

    vi.advanceTimersByTime(60_000);
    expect(cerrado).toBe(1);
  });

  it('volver a la pestana NO cuenta como actividad', () => {
    /*
     * Si contara, bastaria con pasar por encima de la pestana para mantener
     * la sesion viva para siempre, que es lo contrario de lo que se busca.
     */
    vi.advanceTimersByTime(29 * 60_000);
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));

    vi.advanceTimersByTime(60_000);
    expect(cerrado).toBe(1);
  });

  it('deja de vigilar al desmontarse', () => {
    detener();
    vi.advanceTimersByTime(120 * 60_000);
    expect(cerrado).toBe(0);
  });
});
