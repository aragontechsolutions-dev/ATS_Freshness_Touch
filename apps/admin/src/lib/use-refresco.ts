import { useEffect, useRef } from 'react';

/**
 * REFRESCAR MIENTRAS SE ESTA MIRANDO, Y AL VOLVER
 * ===============================================
 * Un reloj que llama a `refrescar` cada `intervaloMs`, pero SOLO cuando la
 * pantalla esta a la vista, y ademas en el momento exacto de volver a ella.
 *
 * ========================================================================
 * POR QUE NO ES UN `setInterval` A SECAS
 * ========================================================================
 * Esto corre en el movil de alguien que esta trabajando en una casa. Un
 * reloj que sigue pidiendo con la aplicacion en segundo plano gasta bateria
 * y datos durante toda la jornada para repintar una pantalla que nadie esta
 * mirando. Y en una zona rural de Georgia, los datos no son gratis.
 *
 * Con esto, el coste solo existe mientras la pantalla esta delante.
 *
 * ========================================================================
 * Y POR QUE EL AVISO AL VOLVER ES LA MITAD IMPORTANTE
 * ========================================================================
 * El caso real no es tener la aplicacion abierta media hora: es sacar el
 * movil del bolsillo. Si solo hubiera reloj, al desbloquear se veria hasta
 * medio minuto de datos viejos —justo cuando se mira para decidir algo—.
 * Por eso al volver se pide SIEMPRE, sin esperar al siguiente tic.
 *
 * `visibilitychange` es el que dispara en un movil al volver a la
 * aplicacion; `focus` cubre el escritorio, donde se puede cambiar de
 * ventana sin que la pagina llegue a ocultarse. Los dos pueden saltar
 * juntos, asi que QUIEN LO USA tiene que soportar que le llamen dos veces
 * seguidas.
 */
export function useRefrescoVisible(refrescar: () => void, intervaloMs: number): void {
  /*
   * La funcion vive en una referencia para que cambiar de identidad en cada
   * render NO reinicie el reloj. Con `refrescar` en las dependencias, un
   * render a los 29 segundos volveria a empezar la cuenta y el refresco no
   * llegaria nunca.
   */
  const ultima = useRef(refrescar);
  useEffect(() => {
    ultima.current = refrescar;
  });

  useEffect(() => {
    const seEstaMirando = (): boolean => document.visibilityState === 'visible';

    const reloj = setInterval(() => {
      if (seEstaMirando()) ultima.current();
    }, intervaloMs);

    const alVolver = (): void => {
      if (seEstaMirando()) ultima.current();
    };

    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('focus', alVolver);

    return () => {
      clearInterval(reloj);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('focus', alVolver);
    };
  }, [intervaloMs]);
}
