import { useEffect, useRef } from 'react';

/** Minutos de inactividad antes de cerrar la sesión. */
const DEFAULT_MINUTES = 30;

/*
 * Qué cuenta como actividad: tocar, teclear o desplazarse.
 *
 * Recuperar el foco de la pestaña NO está en la lista a propósito. Si contara,
 * bastaría con pasar por encima de la pestaña para mantener viva la sesión
 * indefinidamente, que es justo lo contrario de lo que se busca.
 */
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;

/**
 * CIERRE POR INACTIVIDAD
 * ----------------------
 * El panel enseña nombres, teléfonos, direcciones y códigos de puerta de los
 * clientes. Una pestaña abierta en el ordenador de la oficina mientras el
 * equipo está fuera es una carpeta abierta encima de la mesa.
 *
 * No sustituye a nada: el token sigue caducando por su cuenta y la baja de un
 * empleado sigue siendo inmediata. Esto cubre un caso distinto, el del
 * descuido físico, que ninguna de las otras dos medidas alcanza.
 */
export function useIdleSignOut(
  active: boolean,
  onIdle: () => void,
  minutes: number = DEFAULT_MINUTES,
): void {
  // Se guarda en una referencia para que cambiar la función no reinicie el
  // temporizador en cada render.
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!active) return;

    let temporizador: ReturnType<typeof setTimeout>;

    const reiniciar = (): void => {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => onIdleRef.current(), minutes * 60_000);
    };

    reiniciar();
    for (const evento of ACTIVITY_EVENTS) {
      window.addEventListener(evento, reiniciar, { passive: true });
    }

    return () => {
      clearTimeout(temporizador);
      for (const evento of ACTIVITY_EVENTS) window.removeEventListener(evento, reiniciar);
    };
  }, [active, minutes]);
}
