import { useCallback, useEffect, useRef } from 'react';

/**
 * APARICION AL ENTRAR EN PANTALLA
 * -------------------------------
 * Un unico observador compartido por todos los elementos del sitio, en vez de
 * uno por componente: el navegador agrupa las comprobaciones en una sola
 * pasada y el coste no crece con el numero de tarjetas.
 *
 * Cada elemento se deja de observar en cuanto aparece. La animacion es de
 * bienvenida, no un efecto que deba repetirse cada vez que se sube y se baja.
 */

const alRevelar = new WeakMap<Element, () => void>();
let observador: IntersectionObserver | null = null;

function obtenerObservador(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null;

  observador ??= new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        alRevelar.get(entrada.target)?.();
        alRevelar.delete(entrada.target);
        observador?.unobserve(entrada.target);
      }
    },
    {
      // Se dispara un poco antes de que el elemento asome del todo, para que
      // la animacion termine justo cuando el usuario llega a mirarlo.
      rootMargin: '0px 0px -10% 0px',
      threshold: 0.1,
    },
  );

  return observador;
}

/**
 * Devuelve una referencia para el elemento que debe aparecer.
 *
 * Si el navegador no soporta el observador, o el usuario pidio reducir el
 * movimiento, el elemento se marca visible de inmediato: nunca se queda
 * oculto por culpa de un efecto.
 */
export function useReveal<T extends HTMLElement>(): (node: T | null) => void {
  const observado = useRef<T | null>(null);

  useEffect(() => {
    const nodo = observado.current;
    return () => {
      if (nodo) {
        alRevelar.delete(nodo);
        observador?.unobserve(nodo);
      }
    };
  }, []);

  return useCallback((node: T | null) => {
    observado.current = node;
    if (!node) return;

    const mostrar = (): void => node.classList.add('is-visible');
    const instancia = obtenerObservador();

    // Sin permiso de movimiento el estado inicial oculto ni siquiera se
    // aplica (depende de la clase `ft-motion`), pero se marca igual por si
    // algun elemento llega aqui con la clase puesta.
    if (!instancia || !document.documentElement.classList.contains('ft-motion')) {
      mostrar();
      return;
    }

    alRevelar.set(node, mostrar);
    instancia.observe(node);
  }, []);
}
