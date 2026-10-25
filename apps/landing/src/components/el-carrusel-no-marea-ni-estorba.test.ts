import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en, es } from '@freshness/i18n';
import { vueltasNecesarias, vueltasQueCaben } from './Carrusel';

/**
 * EL CARRUSEL NO MAREA, NO ESTORBA Y SE DEJA MANDAR
 * =================================================
 * La seccion de antes y despues era una rejilla que crecia hacia abajo con
 * cada pieza: con seis fotos y dos videos empujaba las zonas de servicio y el
 * contacto una pantalla entera. Ahora es una fila que se desplaza sola y
 * ocupa lo mismo con dos piezas que con veinte.
 *
 * SE DESPLAZA DE VERDAD, NO CON UNA ANIMACION DE `transform`. La primera
 * version se veia igual pero tenia un techo: a una pista transformada no se
 * la puede empujar, asi que no habia forma de poner botones ni de arrastrar
 * con el dedo. Varias de estas pruebas existen para que nadie vuelva a
 * cambiarlo sin darse cuenta de lo que se pierde.
 *
 * Un carrusel automatico tiene cuatro formas clasicas de salir mal, y
 * ninguna se ve mirando la pantalla propia:
 *
 *   1. MAREA a quien ha pedido menos movimiento en su sistema.
 *   2. SE ESCAPA de debajo del raton justo cuando vas a pulsar.
 *   3. SE LEE CUATRO VECES con un lector de pantalla, porque las copias que
 *      hacen el bucle son contenido repetido.
 *   4. OBLIGA A ESPERAR: sin mandos, para ver la pieza que acaba de pasar hay
 *      que esperar a que de la vuelta entera.
 */

const RAIZ = import.meta.dirname;

const CARRUSEL = readFileSync(join(RAIZ, 'Carrusel.tsx'), 'utf8');
const FACHADA = readFileSync(join(RAIZ, 'VideoFacade.tsx'), 'utf8');
const SECCION = readFileSync(join(RAIZ, '../sections/Gallery.tsx'), 'utf8');
const ESTILOS = readFileSync(join(RAIZ, '../styles.css'), 'utf8');

/**
 * El codigo sin sus comentarios.
 *
 * Hace falta porque lo que se prohibe aqui son COSAS USADAS, y los
 * comentarios explican precisamente por que no se usan — nombrandolas.
 * Buscando sobre el archivo entero, la propia explicacion haria fallar la
 * prueba, que es la peor clase de prueba: la que obliga a borrar el
 * comentario que dice por que existe.
 */
function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

const CARRUSEL_CODIGO = sinComentarios(CARRUSEL);

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
  ])('con %i piezas se repite %i veces de entrada', (piezas, esperadas) => {
    expect(vueltasNecesarias(piezas)).toBe(esperadas);
  });

  it('nunca baja de dos, que es lo que hace invisible el salto', () => {
    // Hace falta una copia completa detras: al saltar, lo que se ve tiene que
    // ser identico a lo que habia.
    for (let piezas = 1; piezas <= 40; piezas += 1) {
      expect(vueltasNecesarias(piezas)).toBeGreaterThanOrEqual(2);
    }
  });

  it('sin piezas no se repite nada', () => {
    expect(vueltasNecesarias(0)).toBe(0);
  });
});

describe('y cuantas hacen falta de verdad, ya medidas', () => {
  /*
   * Lo calculado a ojo no sabe de que tamano es la pantalla de quien mira.
   * Si una repeticion cabe entera en la pantalla, EL SALTO CAE DENTRO DE LO
   * VISIBLE y se ve dar el tiron. Medir y corregir es lo que lo evita.
   */
  it.each([
    ['dos fotos en un portatil', 1200, 640, 4],
    ['dos fotos en un movil', 390, 640, 3],
    ['doce piezas en un movil', 390, 4000, 3],
    ['doce piezas en una pantalla muy ancha', 3840, 4000, 3],
  ])('%s: %i de ancho y %i por vuelta → %i vueltas', (_caso, visible, vuelta, esperadas) => {
    expect(vueltasQueCaben(visible, vuelta)).toBe(esperadas);
  });

  /*
   * LA PROPIEDAD QUE DE VERDAD IMPORTA, y la razon de los «+2»: despues de lo
   * que se ve tiene que quedar AL MENOS una repeticion entera por delante. Si
   * no, al saltar hacia atras se veria el final de la pista.
   */
  it('siempre sobra al menos una repeticion por delante de lo visible', () => {
    for (const visible of [320, 390, 768, 1200, 1920, 3840]) {
      for (const vuelta of [300, 640, 1000, 4000]) {
        const total = vueltasQueCaben(visible, vuelta) * vuelta;
        expect(total - visible).toBeGreaterThanOrEqual(vuelta);
      }
    }
  });

  it('sin poder medir todavia, se queda en el minimo', () => {
    // En el primer pintado el ancho es cero: no se puede dividir por el.
    expect(vueltasQueCaben(1200, 0)).toBe(2);
  });
});

describe('se desplaza de verdad, que es lo que permite mandarlo', () => {
  it('la caja es desplazable, no una pista transformada', () => {
    expect(ESTILOS).toContain('.ft-carrusel');
    expect(ESTILOS).toContain('overflow-x: auto');
    // La animacion de `transform` de la primera version ya no existe.
    expect(ESTILOS).not.toContain('@keyframes ft-carrusel');
  });

  it('la barra se esconde, pero la caja sigue siendo desplazable', () => {
    // Esconderla es estetico; desactivar el desplazamiento dejaria sin dedo,
    // sin rueda y sin teclado a quien no use los botones.
    expect(ESTILOS).toContain('scrollbar-width: none');
    expect(ESTILOS).not.toContain('overflow-x: hidden');
  });

  it('el movimiento automatico lleva su propia posicion en coma flotante', () => {
    /*
     * `scrollLeft` redondea, y a 45 px por segundo cada fotograma avanza
     * menos de un pixel: sumando sobre el valor redondeado, el carrusel se
     * quedaria parado del todo.
     */
    expect(CARRUSEL).toContain('let posicion =');
    expect(CARRUSEL).toContain('requestAnimationFrame');
  });
});

describe('los mandos de los lados', () => {
  it('hay uno a cada lado y los dos dicen para que sirven', () => {
    // Sin texto visible, la etiqueta es lo unico que los nombra.
    expect(CARRUSEL).toContain('aria-label={etiqueta}');
    expect(SECCION).toContain("etiquetaAnterior={t('gallery.previous')}");
    expect(SECCION).toContain("etiquetaSiguiente={t('gallery.next')}");

    for (const textos of [en.gallery, es.gallery]) {
      expect(textos.previous.length).toBeGreaterThan(3);
      expect(textos.next.length).toBeGreaterThan(3);
    }
  });

  it('se normaliza antes de saltar, para que la fila no tenga final', () => {
    /*
     * Un salto cerca del final chocaria con el borde y la fila dejaria de ser
     * infinita justo cuando alguien esta usando los botones para recorrerla,
     * que es cuando mas se nota.
     */
    const salto = CARRUSEL.slice(CARRUSEL.indexOf('const desplazar'));
    expect(salto.indexOf('normalizar(elemento)')).toBeLessThan(salto.indexOf('scrollTo'));
  });

  it('y se para un momento al tocarlos, para no pelear con el', () => {
    expect(CARRUSEL).toContain('PAUSA_TRAS_TOCAR_MS');
    expect(CARRUSEL).toContain('setTocadoHace(Date.now() + PAUSA_TRAS_TOCAR_MS)');
  });
});

describe('quien ha pedido menos movimiento no persigue nada', () => {
  it('no se mueve solo', () => {
    expect(CARRUSEL).toContain('usePrefiereMenosMovimiento');
    expect(CARRUSEL).toContain('const detenido = sinMovimiento ||');
  });

  it('pero la fila sigue entera y se recorre igual', () => {
    /*
     * Es la diferencia con parar la animacion en CSS, que dejaba la mitad del
     * contenido fuera de la pantalla y sin forma de llegar a el. Aqui los
     * botones, el dedo y la rueda siguen funcionando: solo deja de moverse
     * solo.
     */
    expect(CARRUSEL).toContain("behavior: sinMovimiento ? 'auto' : 'smooth'");
  });

  it('y el cinturon de seguridad del CSS sigue puesto', () => {
    expect(ESTILOS).toContain('@media (prefers-reduced-motion: reduce)');
  });
});

describe('se para mientras alguien esta, y vuelve a arrancar al irse', () => {
  it('se para con el raton dentro y con el foco dentro', () => {
    // Nadie puede pulsar algo que se esta escapando. Con el teclado es peor:
    // el foco entraria en un boton que ya no esta donde se ve.
    expect(CARRUSEL).toContain('onPointerEnter');
    expect(CARRUSEL).toContain('onPointerLeave');
    expect(CARRUSEL).toContain('onFocusCapture');
    expect(CARRUSEL).toContain('onBlurCapture');
  });

  it('el foco solo cuenta si es del teclado', () => {
    /*
     * Al pulsar play con el raton, el foco se va dentro del marco del video
     * y ahi se queda. Contando ese foco, la fila no volveria a arrancar
     * jamas aunque apartes el raton.
     */
    expect(CARRUSEL).toContain("evento.target.matches(':focus-visible')");
  });

  it('y mientras esta parada se vigila el raton en todo el documento', () => {
    /*
     * Un marco de video se traga los eventos del raton: al salir desde
     * encima de el, o al salirse por el borde de la ventana, el aviso de «me
     * he ido» puede no llegar nunca.
     *
     * Y solo mientras esta parada: un oyente en todo el documento que
     * estuviera siempre puesto correria en cada movimiento del raton de la
     * pagina entera.
     */
    expect(CARRUSEL).toContain("document.addEventListener('pointermove', alMoverse)");
    expect(CARRUSEL).toContain('if (!quieto) return;');
    expect(CARRUSEL).toContain("document.removeEventListener('pointermove', alMoverse)");
  });
});

describe('un video abierto para la fila', () => {
  /*
   * Lo que se esta viendo no puede irse de la pantalla solo. Antes bastaba
   * con pararla al pasar el raton, pero en cuanto lo apartas para mirar el
   * video se iba sonando.
   */
  it('la galeria cuenta los videos abiertos y la fila se para', () => {
    expect(SECCION).toContain('onAbierto={alAbrirse}');
    expect(SECCION).toContain('pausado={abiertos > 0}');
    expect(CARRUSEL).toContain('(pausado && !redRota)');
  });

  it('se cuentan, no se marcan: la misma pieza se repite', () => {
    /*
     * La misma pieza esta varias veces en la fila y se puede abrir en mas de
     * una copia. Con un booleano, cerrar una dejaria la fila andando con la
     * otra sonando.
     */
    expect(SECCION).toContain('cuantos + (abierto ? 1 : -1)');
    expect(SECCION).toContain('Math.max(0, ');
  });

  it('hay una forma de volver, y es la que suelta la fila', () => {
    // Sin esto, una vez abierto el video no habia manera de regresar a la
    // tarjeta: el marco se quedaba puesto para siempre.
    expect(FACHADA).toContain('closeLabel');
    expect(FACHADA).toContain('setReproduciendo(false)');

    for (const textos of [en.gallery, es.gallery]) {
      expect(textos.close.length).toBeGreaterThan(3);
    }
  });

  it('el aviso sale del estado, para que valga tambien si la tarjeta desaparece', () => {
    /*
     * Avisando solo en el clic, al recalcularse las copias del carrusel la
     * fila se quedaria creyendo que hay un video abierto que ya no existe, y
     * no volveria a moverse nunca.
     */
    const efecto = FACHADA.slice(FACHADA.indexOf('useEffect(() => {'));
    expect(efecto).toContain('onAbierto(true)');
    expect(efecto).toContain('onAbierto(false)');
  });

  it('y hay una red de seguridad por si nadie cierra', () => {
    // Quien abrio el video puede irse de la pagina sin cerrarlo, y la fila
    // se quedaria parada para siempre.
    expect(CARRUSEL).toContain('PAUSA_MAXIMA_MS');
    expect(CARRUSEL).toContain('const PAUSA_MAXIMA_MS = 5 * 60 * 1000;');
  });
});

describe('las copias se pulsan, pero no se leen ni se tabulan', () => {
  /*
   * ========================================================================
   * EL FALLO QUE ESTA PRUEBA IMPIDE QUE VUELVA
   * ========================================================================
   * La primera version marcaba las copias con `inert`. Saca del tabulador y
   * del arbol de accesibilidad, que es justo lo que hacia falta — PERO
   * TAMBIEN QUITA EL RATON.
   *
   * El resultado: solo se podia reproducir el video de la PRIMERA copia, la
   * del extremo izquierdo. En cualquier otra posicion la tarjeta parecia una
   * foto mas, se pulsaba y no pasaba nada. Y no se descubre mirando el
   * codigo: se descubre pulsando un video que va por el centro de la fila.
   */
  it('no se usa `inert`, que tambien habria quitado el raton', () => {
    expect(CARRUSEL_CODIGO).not.toContain('inert');
  });

  it('las copias no se leen', () => {
    expect(CARRUSEL).toContain('aria-hidden={esCopia || undefined}');
  });

  it('y sus botones salen del tabulador uno a uno, dentro de la pieza', () => {
    /*
     * `aria-hidden` sobre algo que si se puede tabular seria lo peor de los
     * dos mundos: alcanzable con el teclado pero invisible para el lector.
     * Por eso la pieza recibe si es enfocable y lo aplica a sus botones.
     */
    expect(CARRUSEL).toContain('{pieza.nodo(!esCopia)}');
    expect(FACHADA).toContain('tabIndex={enfocable ? undefined : -1}');
  });

  it('y la primera vuelta no es copia', () => {
    expect(CARRUSEL).toContain('const esCopia = vuelta > 0;');
  });
});

describe('en un movil se lee una tarjeta', () => {
  it('cada tarjeta ocupa casi toda la pantalla, con un trozo de la siguiente', () => {
    /*
     * Una tarjeta de 320 px en un telefono de 390 deja dos a medias y no se
     * lee ninguna. El trozo que asoma es el que dice que hay mas.
     */
    expect(CARRUSEL).toContain('w-[78vw]');
    expect(CARRUSEL).toContain('max-w-80');
    expect(CARRUSEL).toContain('sm:w-80');
  });

  it('y los mandos son lo bastante grandes para el dedo', () => {
    // 44 px de lado es el minimo para acertar sin fallar.
    expect(CARRUSEL).toContain('h-11 w-11');
  });
});
