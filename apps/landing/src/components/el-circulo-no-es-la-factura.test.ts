import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en, es } from '@freshness/i18n';

/**
 * EL CIRCULO DEL MAPA NO ES LO QUE SE FACTURA
 * ===========================================
 * Leaflet dibuja los anillos del area de servicio con `L.circle`, que es un
 * circulo GEODESICO: 35 millas en linea recta desde la sede.
 *
 * Lo que se cobra son las millas que recorre el coche, y en un area
 * metropolitana con rios, interestatales y sin diagonales son SIEMPRE mas.
 *
 * ========================================================================
 * POR QUE ESTO ES UN PROBLEMA Y NO UN DETALLE
 * ========================================================================
 * Una casa que el cliente ve DENTRO del circulo azul puede llevar recargo
 * de traslado igualmente. El mapa promete una cosa y el presupuesto dice
 * otra, y el cliente lo descubre al final del formulario, que es cuando
 * peor sienta y cuando mas caro sale perderlo.
 *
 * No se arregla dibujando isocronas —eso seria una consulta a Google por
 * cada punto del contorno, en cada visita—. Se arregla DICIENDOLO.
 *
 * Esta prueba ata las dos cosas: mientras el mapa dibuje un circulo, el
 * aviso tiene que estar. El dia que alguien borre la frase por quedar mas
 * limpio, se pone roja.
 */

const raiz = join(import.meta.dirname, '..');

const MAPA = readFileSync(join(raiz, 'components/ServiceAreaMap.tsx'), 'utf8');
const SECCION = readFileSync(join(raiz, 'sections/ServiceAreas.tsx'), 'utf8');

describe('el aviso de que el circulo es en linea recta', () => {
  it('el mapa sigue dibujando un circulo geodesico, que es lo que lo hace falta', () => {
    /*
     * La premisa de toda la prueba. Si algun dia el mapa pasara a dibujar
     * el area real de conduccion, el aviso sobraria y esta prueba deberia
     * reescribirse en vez de ir tapando el fallo con una frase.
     */
    expect(MAPA).toContain('L.circle');
    expect(MAPA).toContain('METROS_POR_MILLA');
  });

  it('y la seccion de zonas lo advierte', () => {
    expect(SECCION).toContain('areas.mapRadiusNote');
  });

  it('el texto dice las dos mitades: linea recta y millas de carretera', () => {
    // Decir solo «aproximado» no sirve: no explica en que direccion falla,
    // y la distancia por carretera nunca es menor, siempre mayor.
    expect(en.areas.mapRadiusNote).toMatch(/straight-line/i);
    expect(en.areas.mapRadiusNote).toMatch(/road miles/i);

    expect(es.areas.mapRadiusNote).toMatch(/línea recta/i);
    expect(es.areas.mapRadiusNote).toMatch(/carretera/i);
  });
});

describe('el codigo postal de la sede ya no mide nada (etapa 3.14)', () => {
  it('su etiqueta en el panel no puede seguir diciendo que si', () => {
    /*
     * Hasta la etapa 3.14 el texto decia «el codigo postal es desde el que
     * el motor calcula la distancia hasta cada cliente», y era verdad.
     * Ahora mide el punto marcado en el mapa, y dejar el texto viejo seria
     * mandar a administracion a corregir el campo que no toca el dia que
     * una distancia no cuadre.
     */
    expect(en.admin.location.postalCodeNote).toMatch(/marked on the map/i);
    expect(es.admin.location.postalCodeNote).toMatch(/punto marcado en el mapa/i);

    expect(en.admin.location.postalCodeNote).not.toMatch(/measures from/i);
    expect(es.admin.location.postalCodeNote).not.toMatch(/calcula la distancia/i);
  });
});
