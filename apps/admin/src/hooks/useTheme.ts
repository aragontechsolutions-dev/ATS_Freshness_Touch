import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'ft-theme';

/**
 * TEMA CLARO / OSCURO DEL PANEL
 * -----------------------------
 * El panel llevaba desde el principio con el modo oscuro escrito —cientos de
 * clases `dark:` repartidas por cada pantalla— y NUNCA ENCENDIDO: la variante
 * cuelga de la clase `dark` en el documento y nadie la ponia. Todo ese estilo
 * era, literalmente, invisible.
 *
 * Esto lo enciende. El estado inicial NO se calcula aqui: lo aplico ya
 * `public/theme-init.js` antes del primer pintado, y este hook solo lee lo
 * que dejo puesto. Calcularlo dos veces es como aparece el fogonazo blanco.
 */
function temaInicial(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(temaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  /*
   * Si nadie ha elegido todavia, manda el sistema y se sigue EN VIVO: quien
   * tiene el movil en oscuro automatico al anochecer no deberia tener que
   * recargar el panel para que lo acompane.
   */
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const alCambiar = (evento: MediaQueryListEvent): void => {
      try {
        if (localStorage.getItem(STORAGE_KEY)) return; // ya hay eleccion propia
      } catch {
        return;
      }
      setTheme(evento.matches ? 'dark' : 'light');
    };

    media.addEventListener('change', alCambiar);
    return () => media.removeEventListener('change', alCambiar);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((actual) => {
      const siguiente: Theme = actual === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, siguiente);
      } catch {
        // Sin persistencia el tema dura lo que la pestana: aceptable.
      }
      return siguiente;
    });
  }, []);

  return { theme, toggleTheme };
}
