import type { CSSProperties, ReactNode } from 'react';
import { usePrefiereMenosMovimiento } from '../hooks/usePrefiereMenosMovimiento';

/**
 * UNA FILA QUE SE DESPLAZA SOLA, SIN PRINCIPIO NI FINAL
 * =====================================================
 * Lo que antes era una rejilla de dos columnas que crecia hacia abajo con
 * cada foto, ahora es UNA fila que cabe de un vistazo.
 *
 * ========================================================================
 * COMO SE HACE QUE NO SE VEA LA COSTURA
 * ========================================================================
 * La lista se repite varias veces en la pista y la animacion desplaza
 * exactamente la fraccion que ocupa una repeticion. Al llegar al final, la
 * pista vuelve a cero y lo que se ve es identico a lo que habia: el salto
 * existe, pero no se nota porque los pixeles son los mismos.
 *
 * SE REPITE MAS DE DOS VECES CUANDO HAY POCAS PIEZAS. Con dos fotos, dos
 * copias no llenan una pantalla ancha y se veria un hueco cruzando la
 * seccion. Se repite hasta pasar de un minimo, y la duracion se calcula sobre
 * el total para que la velocidad sea la misma haya dos piezas o doce.
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
 *   - Al pasar el raton por encima o al entrar el foco con el tabulador:
 *     nadie puede pulsar algo que se esta escapando.
 *   - Mientras se reproduce un video, que lo decide quien use esto. Sin
 *     ello el video se iria de la pantalla mientras suena.
 *   - Si el sistema pide menos movimiento, no se anima NADA: se pinta una
 *     fila normal que se desplaza con el dedo o con la barra, sin copias.
 *     Un carrusel parado y recortado seria peor que no tenerlo.
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
}

/** Lo que tarda cada pieza en cruzar. Mas bajo marea; mas alto parece parado. */
const SEGUNDOS_POR_PIEZA = 7;

/**
 * Cuantas piezas tiene que haber en la pista como minimo.
 *
 * Doce cubren de sobra una pantalla ancha con tarjetas de 320 px. Es lo que
 * evita el hueco cuando la empresa ha publicado solo dos fotos.
 */
const PIEZAS_MINIMAS = 12;

/**
 * Cuantas veces hay que repetir la lista en la pista.
 *
 * Dos es el minimo que permite el truco —hace falta una copia completa
 * detras para que el salto al volver a cero sea invisible—, pero con pocas
 * piezas dos copias no llenan una pantalla ancha y se veria un hueco
 * cruzando la seccion. Con una sola foto haria falta repetirla doce veces.
 *
 * Es una funcion aparte, y exportada, porque es la unica decision del
 * carrusel que se puede equivocar en silencio: un hueco solo se ve en
 * pantallas anchas y con poco contenido, que es justo lo que nadie prueba.
 */
export function vueltasNecesarias(cuantasPiezas: number): number {
  if (cuantasPiezas <= 0) return 0;
  return Math.max(2, Math.ceil(PIEZAS_MINIMAS / cuantasPiezas));
}

export function Carrusel({ piezas, pausado = false, etiqueta }: CarruselProps) {
  const sinMovimiento = usePrefiereMenosMovimiento();

  if (piezas.length === 0) return null;

  /*
   * SIN ANIMACION, UNA FILA NORMAL Y SIN COPIAS. Repetir el contenido aqui
   * solo serviria para que al desplazar con el dedo aparecieran las mismas
   * fotos una y otra vez.
   */
  if (sinMovimiento) {
    return (
      <ul
        aria-label={etiqueta}
        className="mt-8 flex list-none gap-6 overflow-x-auto p-0 pb-3"
        tabIndex={0}
      >
        {piezas.map((pieza) => (
          <li key={pieza.clave} className="w-72 shrink-0 sm:w-80">
            {pieza.nodo}
          </li>
        ))}
      </ul>
    );
  }

  const vueltas = vueltasNecesarias(piezas.length);
  const total = piezas.length * vueltas;

  return (
    <div className="ft-carrusel mt-8">
      <ul
        aria-label={etiqueta}
        className={'ft-carrusel-pista flex list-none gap-6 p-0' + (pausado ? ' ft-quieta' : '')}
        style={
          // El `as` es lo que hace falta para pasar variables de CSS, igual
          // que en `Reveal`: el tipo de `style` no las conoce.
          {
            // La pista vuelve al principio tras recorrer UNA repeticion.
            '--ft-carrusel-fin': `-${String(100 / vueltas)}%`,
            '--ft-carrusel-duracion': `${String(total * SEGUNDOS_POR_PIEZA)}s`,
          } as CSSProperties
        }
      >
        {Array.from({ length: vueltas }, (_, vuelta) =>
          piezas.map((pieza) => {
            const esCopia = vuelta > 0;

            return (
              <li
                key={`${pieza.clave}-${String(vuelta)}`}
                className="w-72 shrink-0 sm:w-80"
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
  );
}
