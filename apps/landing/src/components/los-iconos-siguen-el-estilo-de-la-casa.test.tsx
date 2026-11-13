import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import * as modulo from './Icons';
import type { IconProps } from './Icons';

/**
 * TODOS LOS ICONOS DEL SITIO SIGUEN EL MISMO CONTRATO DE DIBUJO
 * ============================================================
 * Los iconos son SVG escritos a mano en el repositorio, no una libreria: no
 * se arrastra una dependencia entera por catorce simbolos. El precio de esa
 * decision es que nadie los valida, y un icono que se sale del estilo no da
 * ningun error: se pinta, se ve, y queda distinto al de al lado.
 *
 * ==========================================================================
 * DE DONDE SALE ESTA PRUEBA, Y POR QUE VIGILA ESTE ARCHIVO Y NO OTRO
 * ==========================================================================
 * Es la heredera de `ServiceIcons.test.tsx`, que comprobaba lo mismo sobre
 * los seis iconos de los servicios. El 13/11/2026 las tarjetas de servicio
 * pasaron a llevar FOTOGRAFIAS en vez de iconos (ver `Services.tsx`),
 * `ServiceIcons.tsx` se quedo sin un solo uso y se retiro con el.
 *
 * Con el se habria ido esta guardia, y eso habria sido un error: las reglas
 * nunca fueron de los iconos de los servicios, son DEL ESTILO DE LA CASA, y
 * se estaban comprobando en el archivo pequeno mientras el grande —este, el
 * que usa el sitio entero— no tenia a nadie mirando.
 *
 * ==========================================================================
 * SE PRUEBA SIN NAVEGADOR, A PROPOSITO
 * ==========================================================================
 * `renderToStaticMarkup` viene con `react-dom`, que ya es dependencia, y
 * funciona en Node sin DOM. Un icono es una funcion pura que devuelve
 * marcado: mirar ese marcado es exactamente la prueba que hace falta, y
 * ahorra montar `jsdom` por unos SVG sin estado.
 */

/**
 * Los iconos exportados, por su nombre.
 *
 * Se descubren por convencion (`...Icon`) y no por una lista escrita a mano:
 * una lista a mano se queda corta el dia que alguien anade un icono, y un
 * icono nuevo es justo el caso que esta prueba existe para vigilar.
 */
type Icono = (props: IconProps) => ReactElement;

const ICONOS: [string, Icono][] = Object.entries(modulo)
  .filter(([nombre, valor]) => typeof valor === 'function' && nombre.endsWith('Icon'))
  .map(([nombre, valor]): [string, Icono] => [nombre, valor as Icono])
  .sort((a, b) => a[0].localeCompare(b[0]));

/** El marcado del icono tal y como lo usa el sitio, sin tocarle nada. */
function dibujar(Icono: Icono): string {
  return renderToStaticMarkup(<Icono />);
}

describe('los iconos del sitio', () => {
  it('la prueba encuentra iconos de verdad', () => {
    /*
     * Red de seguridad de la propia prueba: si la convencion de nombres
     * cambiara, el filtro dejaria la lista vacia y TODO lo de abajo pasaria
     * sin comprobar nada. Un bucle sobre cero elementos no falla nunca.
     */
    expect(ICONOS.length).toBeGreaterThanOrEqual(10);
  });

  it('TODOS USAN LA MISMA REJILLA', () => {
    /*
     * `viewBox="0 0 24 24"` en todos. Uno dibujado sobre otra rejilla se ve
     * de distinto grosor al lado de los demas, y en una fila de botones eso
     * se lee como «esto esta pegado de dos sitios distintos».
     */
    for (const [nombre, Icono] of ICONOS) {
      expect(dibujar(Icono), nombre).toContain('viewBox="0 0 24 24"');
    }
  });

  it('NINGUNO TRAE EL COLOR ESCRITO DENTRO', () => {
    /*
     * ESTA ES LA REGLA QUE MAS IMPORTA.
     *
     * Un `#145788` o un `fill="white"` metido en un `path` rompe el modo
     * oscuro EN SILENCIO: el icono se sigue pintando, pero del color
     * equivocado sobre una superficie aclarada. No falla ninguna prueba, no
     * avisa nadie, y solo se descubre mirando la pantalla en oscuro.
     *
     * El color lo hereda de quien lo coloca, via `currentColor`. Unos lo
     * heredan en el trazo (`stroke`) y el de reproducir en el relleno
     * (`fill`), que es como se dibuja un triangulo macizo: la regla no es que
     * sea trazo, es que el color NO se decide aqui.
     */
    for (const [nombre, Icono] of ICONOS) {
      const svg = dibujar(Icono);

      expect(svg, nombre).toContain('currentColor');
      expect(svg, nombre).not.toMatch(/(?:fill|stroke)="#[0-9a-fA-F]{3,8}"/);
      expect(svg, nombre).not.toMatch(
        /(?:fill|stroke)="(?:white|black|red|blue|green|gray|grey)"/i,
      );
      expect(svg, nombre).not.toMatch(/(?:fill|stroke)="(?:rgb|rgba|hsl|oklch)\(/i);
    }
  });

  it('EL TAMANO SE MANDA DESDE FUERA', () => {
    /*
     * Sin esto, quien coloca el icono no puede fijar su tamano y cada sitio
     * tendria que envolverlo en un `span` para recortarlo. Con esto, el
     * tamano es una clase mas de la llamada.
     */
    for (const [nombre, Icono] of ICONOS) {
      const svg = renderToStaticMarkup(<Icono className="h-6 w-6" />);

      expect(svg, nombre).toContain('class="h-6 w-6"');
      // Y sin el tamano de dentro pegado detras del de fuera.
      expect(svg, nombre).not.toContain('h-5 w-5');
    }
  });

  it('NINGUNO LO LEE EL LECTOR DE PANTALLA', () => {
    /*
     * Todos son decorativos: al lado de cada uno hay texto que dice lo
     * mismo. Sin `aria-hidden`, un lector de pantalla anunciaria el nombre
     * del archivo SVG o un «graphic» suelto delante de la etiqueta de
     * verdad, y lo diria dos veces.
     */
    for (const [nombre, Icono] of ICONOS) {
      expect(dibujar(Icono), nombre).toContain('aria-hidden="true"');
    }
  });

  it('cada icono dibuja algo distinto de los demas', () => {
    /*
     * ESTA ES LA QUE CAZA EL FALLO ABURRIDO: copiar un icono para hacer otro
     * y olvidarse de cambiarle el trazado. No da error, se despliega, y dos
     * cosas distintas de la pantalla salen con el mismo simbolo.
     */
    const porDibujo = new Map<string, string[]>();
    for (const [nombre, Icono] of ICONOS) {
      const svg = dibujar(Icono);
      porDibujo.set(svg, [...(porDibujo.get(svg) ?? []), nombre]);
    }

    const repetidos = [...porDibujo.values()].filter((nombres) => nombres.length > 1);

    expect(repetidos, 'estos iconos dibujan lo mismo').toEqual([]);
  });
});
