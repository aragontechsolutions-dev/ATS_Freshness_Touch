import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { vueltasNecesarias } from './Carrusel';

/**
 * EL CARRUSEL NO MAREA, NO ESTORBA Y NO SE REPITE EN VOZ ALTA
 * ===========================================================
 * La seccion de antes y despues era una rejilla que crecia hacia abajo con
 * cada pieza: con seis fotos y dos videos empujaba las zonas de servicio y el
 * contacto una pantalla entera. Ahora es una fila que se desplaza sola y
 * ocupa lo mismo con dos piezas que con veinte.
 *
 * Un carrusel automatico tiene tres formas clasicas de salir mal, y ninguna
 * se ve mirando la pantalla propia:
 *
 *   1. MAREA a quien ha pedido menos movimiento en su sistema.
 *   2. SE ESCAPA de debajo del raton justo cuando vas a pulsar.
 *   3. SE LEE CUATRO VECES con un lector de pantalla, porque las copias que
 *      hacen el bucle son contenido repetido.
 *
 * Esta prueba ata las tres.
 */

const RAIZ = import.meta.dirname;

const CARRUSEL = readFileSync(join(RAIZ, 'Carrusel.tsx'), 'utf8');
const FACHADA = readFileSync(join(RAIZ, 'VideoFacade.tsx'), 'utf8');
const SECCION = readFileSync(join(RAIZ, '../sections/Gallery.tsx'), 'utf8');
const ESTILOS = readFileSync(join(RAIZ, '../styles.css'), 'utf8');

describe('cuantas veces se repite la lista', () => {
  /*
   * Dos es el minimo que permite el truco. Con pocas piezas, dos copias no
   * llenan una pantalla ancha y se veria un hueco cruzando la seccion — y
   * solo en pantallas anchas y con poco contenido, que es justo lo que nadie
   * prueba.
   */
  it.each([
    [1, 12],
    [2, 6],
    [3, 4],
    [5, 3],
    [6, 2],
    [12, 2],
    [20, 2],
  ])('con %i piezas se repite %i veces', (piezas, esperadas) => {
    expect(vueltasNecesarias(piezas)).toBe(esperadas);
  });

  it('nunca baja de dos, que es lo que hace invisible el salto', () => {
    // Hace falta una copia completa detras: al volver a cero, lo que se ve
    // tiene que ser identico a lo que habia.
    for (let piezas = 1; piezas <= 40; piezas += 1) {
      expect(vueltasNecesarias(piezas)).toBeGreaterThanOrEqual(2);
    }
  });

  it('sin piezas no se repite nada', () => {
    expect(vueltasNecesarias(0)).toBe(0);
  });
});

describe('quien ha pedido menos movimiento no ve un carrusel', () => {
  it('se consulta el ajuste del sistema, no solo en CSS', () => {
    /*
     * En CSS solo se puede parar la animacion, y un carrusel parado deja la
     * mitad del contenido fuera de la pantalla y sin forma de llegar a el.
     * Con la respuesta en JavaScript se pinta otra cosa: una fila que se
     * desplaza con el dedo.
     */
    expect(CARRUSEL).toContain('usePrefiereMenosMovimiento');
    expect(CARRUSEL).toContain('if (sinMovimiento)');
    expect(CARRUSEL).toContain('overflow-x-auto');
  });

  it('y en esa version no hay copias', () => {
    // Repetir el contenido ahi solo serviria para que al desplazar con el
    // dedo aparecieran las mismas fotos una y otra vez.
    const rama = CARRUSEL.slice(
      CARRUSEL.indexOf('if (sinMovimiento)'),
      CARRUSEL.indexOf('const vueltas ='),
    );
    expect(rama).not.toContain('vueltas');
  });

  it('y el cinturon de seguridad del CSS sigue puesto', () => {
    expect(ESTILOS).toContain('@media (prefers-reduced-motion: reduce)');
  });
});

describe('se para cuando hace falta', () => {
  it('al pasar el raton por encima y al entrar el foco', () => {
    // Nadie puede pulsar algo que se esta escapando. Con el teclado es peor:
    // el foco entraria en un boton que ya no esta donde se ve.
    expect(ESTILOS).toContain('.ft-carrusel:hover .ft-carrusel-pista');
    expect(ESTILOS).toContain('.ft-carrusel:focus-within .ft-carrusel-pista');
    expect(ESTILOS).toContain('animation-play-state: paused');
  });

  it('y mientras se reproduce un video', () => {
    /*
     * Pararlo al pasar el raton no basta: en cuanto apartas el raton para
     * mirar el video, se va de la pantalla sonando.
     */
    expect(FACHADA).toContain('onPlay?.()');
    expect(SECCION).toContain('setVideoActivo(video.videoId)');
    expect(SECCION).toContain('pausado={videoActivo !== null}');
    expect(ESTILOS).toContain('.ft-carrusel-pista.ft-quieta');
  });
});

describe('las copias no existen para quien no mira', () => {
  /*
   * Son el mismo contenido repetido. Un lector de pantalla leeria la galeria
   * cuatro veces y el tabulador pasaria cuatro veces por cada boton de play.
   */
  it('llevan `inert`, que las saca del tabulador y del arbol a la vez', () => {
    // Marcarlas solo como ocultas dejaria los botones alcanzables con el
    // teclado pero invisibles para el lector: peor que no hacer nada.
    expect(CARRUSEL).toContain('inert={esCopia}');
    expect(CARRUSEL).toContain('aria-hidden={esCopia || undefined}');
  });

  it('y la primera vuelta no es copia', () => {
    expect(CARRUSEL).toContain('const esCopia = vuelta > 0;');
  });
});
