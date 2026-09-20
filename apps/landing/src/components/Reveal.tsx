import { createElement, type ReactNode } from 'react';
import { useReveal } from '../hooks/useReveal';

/** Etiquetas que se usan en el sitio; no hace falta abrir la mano mas. */
type Etiqueta = 'div' | 'section' | 'article' | 'li' | 'p' | 'h2' | 'span';

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Etiqueta real que se pinta: no se anade ningun envoltorio extra. */
  as?: Etiqueta;
  /**
   * Retardo en milisegundos. Sirve para que una fila de tarjetas aparezca en
   * cascada y no todas de golpe, que resulta brusco.
   */
  delayMs?: number;
  id?: string;
}

/**
 * Envuelve a un elemento para que aparezca al entrar en pantalla.
 *
 * No anade ningun nodo al arbol: pinta la etiqueta indicada con la clase y la
 * referencia necesarias, asi que el diseno no cambia.
 */
export function Reveal({ children, className = '', as = 'div', delayMs = 0, id }: RevealProps) {
  const ref = useReveal<HTMLElement>();

  return createElement(
    as,
    {
      ref,
      id,
      className: `ft-reveal ${className}`.trim(),
      style: delayMs ? ({ '--ft-delay': `${delayMs}ms` } as React.CSSProperties) : undefined,
    },
    children,
  );
}
