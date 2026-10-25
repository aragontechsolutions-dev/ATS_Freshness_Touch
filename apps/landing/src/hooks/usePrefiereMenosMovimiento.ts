import { useEffect, useState } from 'react';

/**
 * SI QUIEN MIRA HA PEDIDO MENOS MOVIMIENTO
 * ----------------------------------------
 * Es un ajuste del sistema operativo, no del navegador, y quien lo activa
 * suele tener un motivo serio: a algunas personas el movimiento continuo en
 * pantalla les provoca mareo o migrana, y a otras les impide leer.
 *
 * NO BASTA CON PARAR LA ANIMACION. Un carrusel que se mueve solo y se queda
 * quieto deja la mitad del contenido fuera de la pantalla y sin forma de
 * llegar a el. Por eso esto se consulta en JavaScript y no solo en CSS: con
 * la respuesta en la mano se puede pintar OTRA COSA —una fila que se
 * desplaza con el dedo— en vez de la misma rota.
 *
 * ARRANCA EN `false` a proposito. En el primer pintado del servidor no hay
 * navegador al que preguntar, y suponer que todo el mundo quiere menos
 * movimiento dejaria a la mayoria con la version reducida.
 */
export function usePrefiereMenosMovimiento(): boolean {
  const [prefiere, setPrefiere] = useState(false);

  useEffect(() => {
    const consulta = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefiere(consulta.matches);

    const alCambiar = (evento: MediaQueryListEvent): void => {
      setPrefiere(evento.matches);
    };

    // Se escucha el cambio: el ajuste se puede activar con la pagina abierta.
    consulta.addEventListener('change', alCambiar);
    return () => {
      consulta.removeEventListener('change', alCambiar);
    };
  }, []);

  return prefiere;
}
