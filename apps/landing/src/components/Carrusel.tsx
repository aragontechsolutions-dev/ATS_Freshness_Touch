import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { usePrefiereMenosMovimiento } from '../hooks/usePrefiereMenosMovimiento';
import { ArrowRightIcon } from './Icons';

/**
 * UNA FILA QUE SE DESPLAZA SOLA, SIN PRINCIPIO NI FINAL
 * =====================================================
 * Lo que antes era una rejilla que crecia hacia abajo con cada foto, ahora es
 * UNA fila que cabe de un vistazo.
 *
 * ========================================================================
 * SE MUEVE DESPLAZANDO DE VERDAD, NO CON UNA ANIMACION
 * ========================================================================
 * La primera version movia la pista con `transform` y una animacion de CSS.
 * Se veia igual, pero tenia un techo: a una pista transformada NO SE LA PUEDE
 * EMPUJAR. No hay forma de que un boton la adelante ni de que el dedo la
 * arrastre, porque el navegador no sabe que eso es contenido desplazable.
 *
 * Ahora la caja se desplaza de verdad y el movimiento automatico es un bucle
 * que suma unos pocos pixeles por fotograma. Se ve lo mismo y se gana todo lo
 * demas: los botones, el arrastre con el dedo, la rueda del raton y el
 * teclado funcionan porque son lo que el navegador ya sabia hacer.
 *
 * ========================================================================
 * COMO SE HACE QUE NO SE VEA LA COSTURA
 * ========================================================================
 * La lista se repite varias veces y, al pasar de una repeticion, la posicion
 * retrocede exactamente lo que ocupa UNA. Lo que se ve despues del salto es
 * identico a lo que habia, porque los pixeles son los mismos.
 *
 * PARA QUE ESO FUNCIONE, UNA REPETICION TIENE QUE SER MAS ANCHA QUE LA
 * PANTALLA. Con dos fotos no lo es ni de lejos, asi que el numero de
 * repeticiones se calcula al principio y SE CORRIGE MIDIENDO: si lo que hay
 * no basta para la pantalla de quien mira, se anaden mas. Sin esa correccion
 * el salto caeria dentro de lo visible y se veria dar el tiron.
 *
 * ========================================================================
 * LAS COPIAS NO EXISTEN PARA QUIEN NO MIRA
 * ========================================================================
 * Son el mismo contenido repetido. Un lector de pantalla leeria la galeria
 * cuatro veces, y el tabulador pasaria cuatro veces por cada boton de play.
 * Por eso las copias llevan `inert`: las saca del orden de tabulacion Y del
 * arbol de accesibilidad a la vez. Marcarlas solo como ocultas dejaria los
 * botones alcanzables con el teclado pero invisibles para el lector, que es
 * peor que no hacer nada.
 *
 * ========================================================================
 * SE PARA SOLO CUANDO HACE FALTA
 * ========================================================================
 *   - Con el raton encima o con el foco dentro: nadie puede pulsar algo que
 *     se esta escapando.
 *   - Mientras se reproduce un video, que lo decide quien use esto. Sin ello
 *     el video se iria de la pantalla mientras suena.
 *   - Un momento despues de tocar un boton o de arrastrar, para que el
 *     movimiento automatico no pelee con el de quien manda.
 *   - Si el sistema pide menos movimiento, NO SE MUEVE SOLO NUNCA. La fila
 *     sigue estando entera y se recorre con los botones, con el dedo o con la
 *     rueda: quien ha pedido menos movimiento no pierde contenido, solo deja
 *     de perseguirlo.
 */

export interface PiezaDelCarrusel {
  /** Identificador estable. Se usa tambien para las copias. */
  clave: string;
  nodo: ReactNode;
}

interface CarruselProps {
  piezas: PiezaDelCarrusel[];
  /** Cuando es cierto, la fila se queda quieta. */
  pausado?: boolean;
  /** Como se anuncia la fila a quien usa lector de pantalla. */
  etiqueta: string;
  etiquetaAnterior: string;
  etiquetaSiguiente: string;
}

/**
 * A que velocidad avanza, en pixeles por segundo.
 *
 * Mas rapido marea y no da tiempo a mirar una foto; mas lento parece que no
 * se mueve y la gente no descubre que hay mas.
 */
const PIXELES_POR_SEGUNDO = 45;

/**
 * Cuantas piezas tiene que haber en la pista como minimo.
 *
 * Es la primera estimacion, antes de medir nada. Doce cubren de sobra una
 * pantalla normal con tarjetas de 320 px, y evita el parpadeo de pintar poco
 * y tener que anadir enseguida.
 */
const PIEZAS_MINIMAS = 12;

/** Lo que se queda quieto tras tocar un boton, para no pelear con el. */
const PAUSA_TRAS_TOCAR_MS = 1200;

/**
 * Cuantas veces hay que repetir la lista en la pista.
 *
 * Dos es el minimo que permite el truco —hace falta una copia completa detras
 * para que el salto sea invisible—, pero con pocas piezas dos copias no
 * llenan una pantalla ancha y se veria un hueco cruzando la seccion. Con una
 * sola foto haria falta repetirla doce veces.
 *
 * Es una funcion aparte, y exportada, porque es la unica decision del
 * carrusel que se puede equivocar en silencio: un hueco solo se ve en
 * pantallas anchas y con poco contenido, que es justo lo que nadie prueba.
 */
export function vueltasNecesarias(cuantasPiezas: number): number {
  if (cuantasPiezas <= 0) return 0;
  return Math.max(2, Math.ceil(PIEZAS_MINIMAS / cuantasPiezas));
}

/**
 * Cuantas repeticiones hacen falta DE VERDAD, ya medidas.
 *
 * Dos de margen por encima de lo que se ve: una para que el salto caiga
 * siempre fuera de la pantalla, y otra para que despues del salto siga
 * habiendo contenido por delante.
 */
export function vueltasQueCaben(anchoVisible: number, anchoDeUnaVuelta: number): number {
  if (anchoDeUnaVuelta <= 0) return 2;
  return Math.ceil(anchoVisible / anchoDeUnaVuelta) + 2;
}

export function Carrusel({
  piezas,
  pausado = false,
  etiqueta,
  etiquetaAnterior,
  etiquetaSiguiente,
}: CarruselProps) {
  const sinMovimiento = usePrefiereMenosMovimiento();
  const caja = useRef<HTMLDivElement | null>(null);

  const [vueltas, setVueltas] = useState(() => vueltasNecesarias(piezas.length));
  const [quieto, setQuieto] = useState(false);
  const [tocadoHace, setTocadoHace] = useState(0);

  /*
   * MEDIR Y CORREGIR. Lo calculado a ojo no sabe de que tamano es la pantalla
   * de quien mira; esto si. Se hace antes de pintar para que no se vea el
   * cambio, y se repite si la ventana cambia de tamano —girar el movil basta
   * para que lo que sobraba deje de bastar—.
   */
  useLayoutEffect(() => {
    if (piezas.length === 0) return;

    const revisar = (): void => {
      const elemento = caja.current;
      if (!elemento) return;

      const anchoDeUnaVuelta = elemento.scrollWidth / vueltas;
      const necesarias = vueltasQueCaben(elemento.clientWidth, anchoDeUnaVuelta);
      if (necesarias > vueltas) setVueltas(necesarias);
    };

    revisar();
    window.addEventListener('resize', revisar);
    return () => {
      window.removeEventListener('resize', revisar);
    };
  }, [vueltas, piezas.length]);

  /** Devuelve la posicion al principio cuando se pasa de una repeticion. */
  const normalizar = useCallback(
    (elemento: HTMLDivElement): void => {
      const anchoDeUnaVuelta = elemento.scrollWidth / vueltas;
      if (anchoDeUnaVuelta <= 0) return;

      if (elemento.scrollLeft >= anchoDeUnaVuelta) {
        elemento.scrollLeft -= anchoDeUnaVuelta;
      } else if (elemento.scrollLeft <= 0) {
        // Hacia atras: se salta al final de la segunda repeticion.
        elemento.scrollLeft += anchoDeUnaVuelta;
      }
    },
    [vueltas],
  );

  const detenido = sinMovimiento || pausado || quieto || Date.now() < tocadoHace;

  useEffect(() => {
    if (detenido || piezas.length === 0) return;

    let anterior = performance.now();
    /*
     * La posicion se lleva en coma flotante aparte. `scrollLeft` redondea, y
     * a 45 px por segundo cada fotograma avanza menos de un pixel: sumando
     * sobre el valor redondeado, el carrusel se quedaria parado.
     */
    let posicion = caja.current?.scrollLeft ?? 0;
    let id = 0;

    const paso = (ahora: number): void => {
      const elemento = caja.current;
      if (elemento) {
        posicion += (PIXELES_POR_SEGUNDO * (ahora - anterior)) / 1000;

        const anchoDeUnaVuelta = elemento.scrollWidth / vueltas;
        if (anchoDeUnaVuelta > 0 && posicion >= anchoDeUnaVuelta) posicion -= anchoDeUnaVuelta;

        elemento.scrollLeft = posicion;
      }
      anterior = ahora;
      id = requestAnimationFrame(paso);
    };

    id = requestAnimationFrame(paso);
    return () => {
      cancelAnimationFrame(id);
    };
  }, [detenido, vueltas, piezas.length]);

  /** Un salto de una tarjeta hacia el lado que se pida. */
  const desplazar = (direccion: 1 | -1): void => {
    const elemento = caja.current;
    if (!elemento) return;

    // Se para un momento para no pelear con el desplazamiento suave.
    setTocadoHace(Date.now() + PAUSA_TRAS_TOCAR_MS);

    const tarjeta = elemento.querySelector('li');
    const salto = tarjeta ? tarjeta.getBoundingClientRect().width + 24 : elemento.clientWidth;

    /*
     * Se normaliza ANTES de animar. Si no, un salto cerca del final chocaria
     * con el borde y la fila dejaria de ser infinita justo cuando alguien
     * esta usando los botones para recorrerla.
     */
    normalizar(elemento);

    elemento.scrollTo({
      left: elemento.scrollLeft + direccion * salto,
      behavior: sinMovimiento ? 'auto' : 'smooth',
    });
  };

  if (piezas.length === 0) return null;

  return (
    <div className="relative mt-8">
      <div
        ref={caja}
        className="ft-carrusel"
        onPointerEnter={() => {
          setQuieto(true);
        }}
        onPointerLeave={() => {
          setQuieto(false);
        }}
        onFocusCapture={() => {
          setQuieto(true);
        }}
        onBlurCapture={() => {
          setQuieto(false);
        }}
      >
        <ul aria-label={etiqueta} className="flex w-max list-none gap-6 p-0">
          {Array.from({ length: vueltas }, (_, vuelta) =>
            piezas.map((pieza) => {
              const esCopia = vuelta > 0;

              return (
                <li
                  key={`${pieza.clave}-${String(vuelta)}`}
                  /*
                   * En movil casi toda la pantalla: una tarjeta de 320 px en
                   * un telefono de 390 deja dos a medias y no se lee ninguna.
                   * El trozo que asoma es el que dice que hay mas.
                   */
                  className="w-[78vw] max-w-80 shrink-0 sm:w-80"
                  // Las copias no existen para el teclado ni para el lector.
                  inert={esCopia}
                  aria-hidden={esCopia || undefined}
                >
                  {pieza.nodo}
                </li>
              );
            }),
          )}
        </ul>
      </div>

      {/*
        LOS BOTONES VAN FUERA DE LA CAJA QUE SE DESPLAZA, encima de ella.
        Dentro se irian con el contenido, que es exactamente lo que no tiene
        que pasar con un mando.
      */}
      <BotonDeLado
        lado="izquierda"
        etiqueta={etiquetaAnterior}
        onPulsar={() => {
          desplazar(-1);
        }}
      />
      <BotonDeLado
        lado="derecha"
        etiqueta={etiquetaSiguiente}
        onPulsar={() => {
          desplazar(1);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------ */

interface BotonDeLadoProps {
  lado: 'izquierda' | 'derecha';
  etiqueta: string;
  onPulsar: () => void;
}

/**
 * EL MANDO DE UN LADO.
 *
 * 44 pixeles de lado: el minimo para acertar con el dedo. Con fondo solido y
 * sombra porque va ENCIMA de las fotos, y una flecha sobre una foto clara sin
 * fondo no se ve.
 */
function BotonDeLado({ lado, etiqueta, onPulsar }: BotonDeLadoProps) {
  return (
    <button
      type="button"
      onClick={onPulsar}
      aria-label={etiqueta}
      className={
        'absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center ' +
        'rounded-full bg-white/95 text-brand-800 shadow-lg transition hover:bg-white ' +
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ' +
        'dark:bg-night-800/95 dark:text-brand-200 dark:hover:bg-night-800 ' +
        (lado === 'izquierda' ? 'left-1 sm:-left-3' : 'right-1 sm:-right-3')
      }
    >
      <ArrowRightIcon className={'h-5 w-5' + (lado === 'izquierda' ? ' rotate-180' : '')} />
    </button>
  );
}
