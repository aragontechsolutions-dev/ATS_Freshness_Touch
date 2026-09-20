import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'ft-theme';

function readInitialTheme(): Theme {
  // El script en linea de index.html ya aplico la clase; aqui solo se lee.
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

/**
 * Tema claro/oscuro con persistencia.
 * Si el usuario nunca ha elegido, se sigue la preferencia del sistema y se
 * reacciona a sus cambios en vivo.
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const onChange = (event: MediaQueryListEvent): void => {
      try {
        if (localStorage.getItem(STORAGE_KEY)) return; // el usuario ya decidio
      } catch {
        return;
      }
      setTheme(event.matches ? 'dark' : 'light');
    };

    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Sin persistencia: el tema dura lo que la pestana.
      }
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
