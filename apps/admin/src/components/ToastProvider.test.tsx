import { StrictMode, act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { ToastProvider, useToast } from './ToastProvider';
import { TOAST_DURACION_MS } from '../lib/toast-queue';

/**
 * PRUEBA DE REGRESION DE LA PAUSA
 * -------------------------------
 * Esto existe por un fallo concreto que las pruebas de `toast-queue` NO
 * podian ver, porque la cola estaba bien: lo que estaba mal era COMO se la
 * llamaba.
 *
 * La primera version reanudaba la cuenta atras desde dentro del actualizador
 * de otro estado. React invoca los actualizadores dos veces en modo estricto
 * —justamente para destapar efectos escondidos ahi— asi que el tiempo parado
 * se sumaba dos veces y los avisos ya no se iban nunca. Lo cazo una
 * comprobacion en navegador; esto lo deja fijado.
 *
 * Por eso se monta DENTRO de `<StrictMode>`: sin el, el fallo no aparece.
 *
 * Se usa el foco y no el raton porque `onMouseEnter` de React se sintetiza a
 * partir de `mouseover`/`mouseout` y disparar eventos nativos a mano es poco
 * fiable. `focusin`/`focusout` burbujean de verdad, recorren el mismo
 * `pausar`/`reanudar`, y ademas son el caso de quien navega con teclado, que
 * es el que mas necesita que el aviso no se le escape.
 */
function LanzaUnAviso() {
  const toast = useToast();
  useEffect(() => {
    toast.success('admin.settings.saved');
  }, [toast]);
  return null;
}

let contenedor: HTMLDivElement;
let raiz: Root;

function avisos(): number {
  return contenedor.querySelectorAll('.ft-toast').length;
}

/** El boton de cerrar: es lo unico enfocable dentro de un aviso. */
function botonDeCerrar(): HTMLButtonElement {
  const boton = contenedor.querySelector<HTMLButtonElement>('.ft-toast button');
  if (!boton) throw new Error('No hay ningun aviso en pantalla.');
  return boton;
}

beforeEach(() => {
  vi.useFakeTimers();
  contenedor = document.createElement('div');
  document.body.append(contenedor);
  raiz = createRoot(contenedor);

  act(() => {
    raiz.render(
      <StrictMode>
        <ToastProvider>
          <LanzaUnAviso />
        </ToastProvider>
      </StrictMode>,
    );
  });
});

afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  vi.useRealTimers();
});

describe('avisos en pantalla', () => {
  it('aparece al pedirlo', () => {
    expect(avisos()).toBe(1);
  });

  it('se va solo cuando le toca', () => {
    act(() => {
      vi.advanceTimersByTime(TOAST_DURACION_MS + 500);
    });
    expect(avisos()).toBe(0);
  });

  it('con el foco dentro NO se va, por mucho que pase el tiempo', () => {
    act(() => botonDeCerrar().focus());
    act(() => {
      vi.advanceTimersByTime(TOAST_DURACION_MS * 4);
    });

    expect(avisos()).toBe(1);
  });

  it('al salir el foco le queda EXACTAMENTE lo que le quedaba, ni mas ni menos', () => {
    /*
     * Aqui es donde fallaba. Se para a la mitad, se mantiene una eternidad y
     * al soltar deben quedar los 2,5 segundos que faltaban. Con el tiempo
     * sumado dos veces quedaban cinco, y el aviso seguia ahi tras la primera
     * comprobacion: ese es el «todavia no» de abajo convertido en «nunca».
     */
    act(() => {
      vi.advanceTimersByTime(TOAST_DURACION_MS / 2);
    });
    act(() => botonDeCerrar().focus());
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    act(() => botonDeCerrar().blur());

    // Le faltaba la mitad: con un poco menos, sigue.
    act(() => {
      vi.advanceTimersByTime(TOAST_DURACION_MS / 2 - 500);
    });
    expect(avisos(), 'todavia no le toca irse').toBe(1);

    // Y con el resto, se va.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(avisos(), 'ya deberia haberse ido').toBe(0);
  });

  it('se puede cerrar a mano antes de tiempo', () => {
    act(() => botonDeCerrar().click());
    expect(avisos()).toBe(0);
  });
});
