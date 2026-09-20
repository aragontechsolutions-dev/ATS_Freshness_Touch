import { useEffect, useState } from 'react';

/**
 * Indica si la pagina ya se ha desplazado.
 *
 * Se usa para dar sombra a la cabecera solo cuando hay contenido debajo: en
 * lo alto de la pagina la sombra sobra y ensucia, al desplazar ayuda a
 * separar la cabecera del contenido que pasa por debajo.
 */
export function useScrolled(umbralPx = 8): boolean {
  const [desplazada, setDesplazada] = useState(false);

  useEffect(() => {
    const comprobar = (): void => setDesplazada(window.scrollY > umbralPx);
    comprobar();

    // `passive` evita que el navegador espere por si se cancela el gesto,
    // que es lo que provoca tirones al desplazar en movil.
    window.addEventListener('scroll', comprobar, { passive: true });
    return () => window.removeEventListener('scroll', comprobar);
  }, [umbralPx]);

  return desplazada;
}
