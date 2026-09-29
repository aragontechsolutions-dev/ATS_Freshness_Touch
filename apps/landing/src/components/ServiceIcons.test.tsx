import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ServiceTypeSchema } from '@freshness/types';
import { ICONO_POR_SERVICIO } from './ServiceIcons';

/*
 * ============================================================================
 * SE PRUEBA SIN NAVEGADOR, A PROPOSITO
 * ============================================================================
 * El sitio publico no tiene entorno de DOM en sus pruebas: las cuatro que
 * habia son de `lib/`, puro TypeScript. Anadir `jsdom` y una libreria de
 * pruebas de componentes por seis SVG sin estado seria pagar dos dependencias
 * por nada.
 *
 * `renderToStaticMarkup` viene con `react-dom`, que ya es dependencia, y
 * funciona en Node sin DOM. Un icono es una funcion pura que devuelve marcado:
 * comparar ese marcado es exactamente la prueba que hace falta.
 * ============================================================================
 */

/** El marcado de un icono, para poder compararlo con el de los demas. */
function dibujar(code: keyof typeof ICONO_POR_SERVICIO): string {
  const Icono = ICONO_POR_SERVICIO[code];
  return renderToStaticMarkup(<Icono />);
}

const CODIGOS = ServiceTypeSchema.options;

describe('iconos de los servicios', () => {
  it('todos los servicios del catalogo tienen icono', () => {
    /*
     * El `Record<ServiceType, …>` ya lo impide en compilacion. Esta prueba
     * cubre el dia en que alguien lo relaje a un objeto parcial para «salir
     * del paso»: sin ella, el servicio nuevo saldria en produccion con un
     * hueco en blanco donde deberia ir su icono.
     */
    for (const code of CODIGOS) {
      expect(ICONO_POR_SERVICIO[code], `falta el icono de ${code}`).toBeTypeOf('function');
    }
    expect(Object.keys(ICONO_POR_SERVICIO).sort()).toEqual([...CODIGOS].sort());
  });

  it('los seis iconos dibujan seis cosas distintas', () => {
    /*
     * ESTA ES LA PRUEBA QUE IMPORTA. Antes las seis tarjetas llevaban la
     * MISMA imagen (el girasol de la marca), y nada avisaba de que el icono
     * no distinguia un servicio de otro. Si alguien vuelve a apuntar dos
     * servicios al mismo dibujo, esto falla.
     */
    const dibujos = CODIGOS.map(dibujar);
    expect(new Set(dibujos).size).toBe(CODIGOS.length);
  });

  it('cada icono respeta el estilo de la casa', () => {
    for (const code of CODIGOS) {
      const svg = dibujar(code);

      // Misma rejilla que el resto de los iconos del sitio: si uno usara otra,
      // se veria de distinto grosor al lado de los demas.
      expect(svg, code).toContain('viewBox="0 0 24 24"');
      // El color lo pone quien lo usa (la placa de la tarjeta), no el icono.
      expect(svg, code).toContain('stroke="currentColor"');
      expect(svg, code).toContain('fill="none"');
      // Decorativo: la tarjeta ya lleva su titulo como texto de verdad.
      expect(svg, code).toContain('aria-hidden="true"');
    }
  });

  it('el tamano se manda desde fuera', () => {
    // Sin esto la placa no podria fijar el tamano del simbolo.
    const Icono = ICONO_POR_SERVICIO.STANDARD;
    expect(renderToStaticMarkup(<Icono className="h-6 w-6" />)).toContain('class="h-6 w-6"');
  });

  it('ningun icono trae color escrito dentro', () => {
    /*
     * Un `#145788` o un `fill="white"` metido en el path romperia el modo
     * oscuro en silencio: el icono seguiria pintandose, pero del color
     * equivocado sobre la placa aclarada.
     */
    for (const code of CODIGOS) {
      const svg = dibujar(code);
      expect(svg, code).not.toMatch(/#[0-9a-f]{3,8}/i);
      expect(svg, code).not.toMatch(/(fill|stroke)="(?!none|currentColor)[a-z]/i);
    }
  });
});
