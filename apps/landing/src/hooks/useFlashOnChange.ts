import { useEffect, useRef, useState } from 'react';

/**
 * Destella un elemento cuando su valor cambia.
 *
 * El cotizador recalcula solo al modificar el formulario, y sin una senal
 * visual el total cambia en silencio: el usuario no sabe si el precio que
 * esta mirando corresponde ya a lo que acaba de tocar.
 *
 * No destella en el primer valor: aparecer no es cambiar.
 */
export function useFlashOnChange(value: unknown, duracionMs = 900): string {
  const [activo, setActivo] = useState(false);
  const anterior = useRef(value);

  useEffect(() => {
    if (anterior.current === value) return;
    anterior.current = value;

    setActivo(true);
    const temporizador = setTimeout(() => setActivo(false), duracionMs);
    return () => clearTimeout(temporizador);
  }, [value, duracionMs]);

  return activo ? 'ft-flash' : '';
}
