import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BUSINESS_SETTINGS, SITE_COPY_KEYS, type WeeklyHours } from '@freshness/types';
import { grafoJsonLd, negocioJsonLd, faqJsonLd, type DatosDelNegocio } from './negocio';
import { CLAVES_DE_PREGUNTAS } from './preguntas';

/**
 * LO QUE EL SITIO DECLARA SER
 * ===========================
 * El bloque JSON-LD es lo que alimenta el paquete local: tres fichas con
 * mapa, que es donde de verdad compite una empresa de limpieza. Y es
 * invisible: nadie lo mira al abrir la web, asi que un error aqui vive
 * indefinidamente.
 *
 * Lo que se comprueba es lo que mas duele si esta mal:
 *
 *   1. QUE NO HAYA `null`. Un `"telephone": null` no es «no tengo telefono»:
 *      es un valor invalido que un validador marca como error en TODO el
 *      bloque. Y pasa en el caso normal, porque el telefono llega de la API y
 *      puede no estar configurado.
 *   2. QUE NO HAYA VALORACIONES INVENTADAS. Marcar estrellas sin resenas
 *      reales es motivo de accion manual, y eso no quita las estrellas: quita
 *      el sitio de los resultados.
 *   3. QUE LAS PREGUNTAS DECLARADAS SEAN LAS QUE SE PINTAN. Declarar
 *      contenido que no esta visible es lo que las directrices prohiben.
 */

const SITIO = 'https://ejemplo.test';

const BASE = {
  city: 'Marietta',
  state: 'GA',
  postalCode: '30060',
  latitude: 33.9526,
  longitude: -84.5499,
};

function datos(cambios: Partial<DatosDelNegocio> = {}): DatosDelNegocio {
  return {
    sitio: SITIO,
    legalName: 'Freshness Touch LLC',
    telefono: '+14045550199',
    email: 'contact@freshnesstouch.com',
    horario: DEFAULT_BUSINESS_SETTINGS.hours,
    base: BASE,
    radioMillas: 50,
    ciudades: ['Marietta', 'Smyrna'],
    redes: ['https://www.instagram.com/freshnesstouch.cleaning'],
    ...cambios,
  };
}

describe('el nodo del negocio', () => {
  it('dice quien es, donde y a que hora', () => {
    const nodo = negocioJsonLd(datos()) as Record<string, unknown>;

    expect(nodo['@type']).toBe('LocalBusiness');
    expect(nodo['@id']).toBe('https://ejemplo.test/#business');
    expect(nodo.telephone).toBe('+14045550199');
    expect(nodo.legalName).toBe('Freshness Touch LLC');
    expect(nodo.geo).toEqual({
      '@type': 'GeoCoordinates',
      latitude: BASE.latitude,
      longitude: BASE.longitude,
    });
  });

  it('SIN DATOS DE LA API SIGUE SIENDO VALIDO: omite, no pone null', () => {
    /*
     * EL FALLO QUE ESTA PRUEBA IMPIDE, y es el caso NORMAL, no el raro: la
     * primera regla de `useBusinessSettings` es que la pagina se pinta aunque
     * la API no conteste. Con `telephone: null` dentro, el bloque entero
     * quedaria invalido justo cuando la API esta caida.
     */
    const serializado = JSON.stringify(
      negocioJsonLd(
        datos({ telefono: null, email: null, legalName: null, base: null, radioMillas: 0 }),
      ),
    );

    expect(serializado).not.toContain('null');
    expect(serializado).not.toContain('undefined');
    // Y aun asi dice la ciudad: una ficha local sin ciudad no sirve de nada.
    expect(serializado).toContain('Marietta');
  });

  it('NUNCA declara una valoracion', () => {
    const serializado = JSON.stringify(grafoJsonLd(datos(), []));

    expect(serializado).not.toContain('aggregateRating');
    expect(serializado).not.toContain('reviewCount');
    expect(serializado).not.toContain('ratingValue');
  });

  it('NO publica una calle', () => {
    /*
     * Es un negocio que va a casa del cliente, no una tienda: Google
     * recomienda que un negocio de area de servicio no publique su direccion
     * exacta, y aqui ademas seria la casa de la dueña.
     */
    const direccion = (negocioJsonLd(datos()) as { address: Record<string, unknown> }).address;

    expect(direccion.streetAddress).toBeUndefined();
    expect(direccion.addressLocality).toBe('Marietta');
    expect(direccion.addressCountry).toBe('US');
  });

  it('el area atendida lleva el estado Y el circulo real, en metros', () => {
    const nodo = negocioJsonLd(datos()) as { areaServed: Record<string, unknown>[] };

    /*
     * SE BUSCA POR TIPO Y NO POR POSICION. La primera version miraba
     * `areaServed[1]` y se rompio sola al meter las ciudades en medio: una
     * prueba que depende del orden de una lista denuncia un cambio que no
     * es un fallo, y entonces se "arregla" moviendo el indice en vez de
     * mirar lo que de verdad pasa.
     */
    expect(nodo.areaServed).toContainEqual({ '@type': 'State', name: 'Georgia' });

    const circulo = nodo.areaServed.find((a) => a['@type'] === 'GeoCircle') as {
      geoRadius: number;
    };
    // 50 millas en metros. `GeoCircle` no admite millas.
    expect(circulo.geoRadius).toBe(80467);
  });

  it('LAS CIUDADES VAN POR SU NOMBRE Y CON SU ESTADO', () => {
    /*
     * EL FALLO QUE ESTA PRUEBA IMPIDE. `containedInPlace` no sobra: hay un
     * Smyrna en Tennessee y otro en Delaware, y un Dallas que casi todo el
     * mundo situa en Texas. Sin decir el estado, la ciudad mas buscada de la
     * lista apunta a dos mil kilometros de aqui.
     */
    const nodo = negocioJsonLd(datos({ ciudades: ['Smyrna', 'Dallas'] })) as {
      areaServed: Record<string, unknown>[];
    };
    const ciudades = nodo.areaServed.filter((a) => a['@type'] === 'City');

    expect(ciudades).toHaveLength(2);
    expect(ciudades[0]).toEqual({
      '@type': 'City',
      name: 'Smyrna',
      containedInPlace: { '@type': 'State', name: 'Georgia' },
    });
  });

  it('sin ciudades configuradas no aparece ninguna', () => {
    const nodo = negocioJsonLd(datos({ ciudades: [] })) as { areaServed: { '@type': string }[] };
    expect(nodo.areaServed.some((a) => a['@type'] === 'City')).toBe(false);
  });

  it('`sameAs` lleva las redes, y OMITE LAS QUE NO HAY', () => {
    /*
     * EL FALLO QUE ESTA PRUEBA IMPIDE. `sameAs: [null]` no es «no tengo
     * redes»: es un valor invalido que tumba el bloque entero. Y el caso de
     * tener una sola red configurada es el normal mientras falte la otra.
     */
    const una = negocioJsonLd(datos({ redes: ['https://www.instagram.com/x', null] })) as {
      sameAs?: string[];
    };
    expect(una.sameAs).toEqual(['https://www.instagram.com/x']);

    const ninguna = negocioJsonLd(datos({ redes: [null, null] })) as { sameAs?: string[] };
    expect(ninguna.sameAs).toBeUndefined();
    expect(JSON.stringify(ninguna)).not.toContain('sameAs');
  });

  it('sin radio conocido NO INVENTA UN CIRCULO', () => {
    const nodo = negocioJsonLd(datos({ radioMillas: 0 })) as {
      areaServed: { '@type': string }[];
    };
    expect(nodo.areaServed.some((a) => a['@type'] === 'GeoCircle')).toBe(false);
  });

  it('LOS DIAS CERRADOS NO SE LISTAN', () => {
    /*
     * schema.org admite declararlos con las horas a 00:00, y eso se lee como
     * «abierto a medianoche»: lo contrario de lo que se quiere decir. El
     * horario de partida cierra el domingo.
     */
    const nodo = negocioJsonLd(datos()) as { openingHoursSpecification: { dayOfWeek: string }[] };
    const dias = nodo.openingHoursSpecification.map((d) => d.dayOfWeek);

    expect(dias).toHaveLength(6);
    expect(dias).not.toContain('https://schema.org/Sunday');
    expect(dias).toContain('https://schema.org/Saturday');
  });

  it('con todo cerrado el horario sale vacio, no inventado', () => {
    const cerrado = Object.fromEntries(
      [1, 2, 3, 4, 5, 6, 7].map((dia) => [dia, null]),
    ) as unknown as WeeklyHours;

    const nodo = negocioJsonLd(datos({ horario: cerrado })) as {
      openingHoursSpecification: unknown[];
    };
    expect(nodo.openingHoursSpecification).toEqual([]);
  });
});

describe('el grafo completo', () => {
  it('es UN solo bloque con el negocio y el sitio relacionados', () => {
    /*
     * Con bloques sueltos, `publisher: { '@id': ... }` apuntaria a un nodo de
     * otro documento y la referencia no se resolveria: habria tres cosas sin
     * relacion en vez de una empresa con su web.
     */
    const grafo = grafoJsonLd(datos(), []) as {
      '@context': string;
      '@graph': Record<string, unknown>[];
    };

    expect(grafo['@context']).toBe('https://schema.org');
    const tipos = grafo['@graph'].map((n) => n['@type']);
    expect(tipos).toEqual(['LocalBusiness', 'WebSite']);

    const web = grafo['@graph'][1] as { publisher: { '@id': string } };
    expect(web.publisher['@id']).toBe('https://ejemplo.test/#business');
  });

  it('NO declara un buscador interno que no existe', () => {
    // `SearchAction` produce un enlace roto en los resultados si el sitio no
    // tiene buscador, y este no lo tiene.
    expect(JSON.stringify(grafoJsonLd(datos(), []))).not.toContain('SearchAction');
  });

  it('las preguntas solo entran si las hay', () => {
    const conFaq = grafoJsonLd(datos(), [{ pregunta: 'P', respuesta: 'R' }]) as {
      '@graph': Record<string, unknown>[];
    };
    expect(conFaq['@graph'].map((n) => n['@type'])).toContain('FAQPage');

    expect(faqJsonLd(SITIO, [])).toBeNull();
  });
});

describe('las preguntas declaradas y las que se pintan', () => {
  it('SON LAS MISMAS', () => {
    /*
     * EL FALLO QUE ESTA PRUEBA IMPIDE. `Faq.tsx` tiene su propia lista
     * (`QUESTIONS`) y los datos estructurados deducen la suya de
     * `SITE_COPY_KEYS`. Dos listas se desincronizan, y la version mala de
     * esa desincronizacion es declarar una pregunta que no esta en la pagina,
     * que es justo lo que las directrices prohiben.
     */
    const fuente = readFileSync(join(import.meta.dirname, '../../sections/Faq.tsx'), 'utf8');
    const pintadas = /const QUESTIONS = \[([^\]]*)\]/
      .exec(fuente)?.[1]
      ?.match(/'([a-z0-9]+)'/g)
      ?.map((trozo) => trozo.replaceAll("'", ''));

    expect(pintadas).toBeDefined();

    const declaradas = CLAVES_DE_PREGUNTAS.map((par) => par.pregunta.split('.')[1]);
    expect(declaradas).toEqual(pintadas);
  });

  it('cada pregunta tiene su respuesta', () => {
    // Una clave `.q` sin su `.a` produciria `"text": undefined` y dejaria el
    // bloque entero invalido.
    for (const par of CLAVES_DE_PREGUNTAS) {
      expect(SITE_COPY_KEYS).toContain(par.respuesta);
      expect(par.respuesta).toBe(par.pregunta.replace(/\.q$/, '.a'));
    }
  });

  it('hay seis, que es lo que tiene la seccion', () => {
    expect(CLAVES_DE_PREGUNTAS).toHaveLength(6);
  });
});
