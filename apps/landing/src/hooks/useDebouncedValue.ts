import { useEffect, useState } from 'react';

/**
 * Retrasa la propagacion de un valor que cambia rapido.
 *
 * En el cotizador evita lanzar una peticion por cada pulsacion: ademas de
 * ahorrar cuota del proveedor de distancia, impide chocar contra el limite
 * de peticiones de la API.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
