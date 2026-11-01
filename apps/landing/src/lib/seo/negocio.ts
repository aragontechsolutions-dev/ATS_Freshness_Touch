import { WEEKDAYS, type Weekday, type WeeklyHours } from '@freshness/types';
import { company } from '../../config/company';
import { OG_IMAGE_PATH } from './etiquetas';
import { urlAbsoluta } from './sitio';

/**
 * LOS DATOS ESTRUCTURADOS DEL NEGOCIO
 * ===================================
 * Un bloque JSON-LD que le dice a un buscador, en su propio vocabulario, QUE
 * es esto: una empresa, de que tipo, donde esta, a que distancia va, a que
 * hora abre y por donde se le escribe.
 *
 * ==========================================================================
 * POR QUE ESTO ES LO QUE MAS VALE DE TODO EL SEO DE ESTE SITIO
 * ==========================================================================
 * La web no compite por «cleaning services» a nivel nacional y nunca lo hara.
 * Compite por «house cleaning near me» en un radio de cincuenta millas, y eso
 * lo resuelve el buscador con el paquete local: tres fichas con mapa. Lo que
 * alimenta ese paquete es la coherencia entre la ficha de Google Business
 * Profile y lo que dice la web. Este bloque es la mitad web de esa
 * coherencia: el mismo nombre, el mismo telefono, el mismo horario, la misma
 * zona.
 *
 * ==========================================================================
 * SE CONSTRUYE EN CALIENTE, Y ESA ES LA DECISION INCOMODA
 * ==========================================================================
 * El telefono, el horario, la razon social y la base de operaciones se editan
 * desde el panel y llegan por la API. Hay dos formas de meterlos aqui:
 *
 *   A. Escribirlos en `index.html` al compilar. Los ve cualquier rastreador,
 *      incluso sin ejecutar JavaScript. Y MIENTEN el dia que la dueña cambie
 *      el telefono, porque habria que desplegar para actualizarlos.
 *   B. Construirlos en el navegador con los datos de verdad. Google ejecuta
 *      JavaScript y los lee; los rastreadores que no, se quedan con el bloque
 *      minimo que si esta en `index.html`.
 *
 * Se eligio B, y el motivo es el mismo que vacio `config/company.ts` en la
 * Etapa 2.3: un dato de contacto escrito en el codigo es un dato que acaba
 * siendo falso. Unos datos estructurados que contradicen a la pagina son
 * PEORES que no tenerlos —es la clase de incoherencia que Google penaliza— y
 * aqui la pagina pinta el telefono de la API.
 *
 * El bloque minimo de `index.html` lleva solo lo que no cambia sin un cambio
 * de codigo (nombre, direccion del sitio, logotipo, estado) y el MISMO `@id`,
 * asi que lo de aqui no es un segundo negocio: es el mismo, con mas detalle.
 *
 * ==========================================================================
 * LO QUE NO ESTA, Y NO ES UN OLVIDO
 * ==========================================================================
 *   - `aggregateRating`. NO SE INVENTA UNA VALORACION. Marcar estrellas que
 *     no corresponden a resenas reales y verificables es motivo de accion
 *     manual: desaparece el sitio entero de los resultados, no solo las
 *     estrellas. El dia que haya resenas de verdad en un sistema propio, se
 *     anade.
 *   - `priceRange`. Habria que inventarse un rango: los precios dependen del
 *     tamano, la frecuencia y la distancia. El cotizador da el numero exacto,
 *     que es mejor que un rango aproximado.
 *   - `sameAs`. Son los perfiles de redes sociales, y no los sé. Es ademas de
 *     las cosas que mas ayudan a que Google entienda que la web, la ficha de
 *     Google y el Facebook son la MISMA empresa, asi que esta apuntado en
 *     `docs/53` como tarea de la dueña.
 *   - Una calle en `address`. Es deliberado: esto es un negocio que va a casa
 *     del cliente, no una tienda. Google recomienda expresamente que un
 *     negocio de area de servicio no publique su direccion exacta, y aqui
 *     ademas seria la casa de la dueña.
 */

/** El dia de la semana en el vocabulario de schema.org. */
const DIA_SCHEMA: Record<Weekday, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

/** La base de operaciones, tal y como llega en el catalogo. */
export interface BaseDeOperaciones {
  city: string;
  state: string;
  postalCode: string;
  latitude: number;
  longitude: number;
}

export interface DatosDelNegocio {
  sitio: string;
  /** La razon social exacta, si esta configurada. */
  legalName: string | null;
  /** Telefono en E.164, o `null` si no esta configurado. */
  telefono: string | null;
  email: string | null;
  horario: WeeklyHours;
  /** `null` mientras el catalogo no ha llegado o si la API no responde. */
  base: BaseDeOperaciones | null;
  /** Radio maximo atendido, en millas. `0` si todavia no se sabe. */
  radioMillas: number;
  /** Las ciudades que se anuncian, por su nombre. Puede venir vacia. */
  ciudades: readonly string[];
  /** Perfiles de redes sociales, para `sameAs`. Los nulos se omiten. */
  redes: readonly (string | null)[];
}

/** Una milla en metros, para `GeoCircle`, que se expresa en metros. */
const METROS_POR_MILLA = 1609.344;

function horarioSchema(horario: WeeklyHours): object[] {
  /*
   * Los dias CERRADOS no se listan. schema.org admite declararlos con
   * `opens`/`closes` a las 00:00, pero eso se lee como «abierto a
   * medianoche», que es lo contrario de lo que se quiere decir. La ausencia
   * de un dia significa cerrado, y es la forma que recomienda Google.
   */
  return WEEKDAYS.filter((dia) => horario[dia] !== null).map((dia) => ({
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: `https://schema.org/${DIA_SCHEMA[dia]}`,
    opens: horario[dia]?.open,
    closes: horario[dia]?.close,
  }));
}

/**
 * El nodo del negocio.
 *
 * ========================================================================
 * `LocalBusiness` Y NO UN TIPO DE LIMPIEZA
 * ========================================================================
 * schema.org NO TIENE un tipo para empresas de limpieza. Existe
 * `HomeAndConstructionBusiness`, pero mete la limpieza en el mismo cajon que
 * la obra, y un tipo inventado («CleaningService») simplemente se ignora: un
 * vocabulario desconocido no es un error, es ruido que no aporta.
 *
 * `LocalBusiness` es el tipo que Google documenta para esto, y lo que de
 * verdad dice a que se dedica la empresa es `description` mas el contenido de
 * la pagina.
 */
export function negocioJsonLd(datos: DatosDelNegocio): object {
  const { sitio } = datos;

  /*
   * La ciudad: la de la base de operaciones cuando ha llegado, y si no la de
   * respaldo de `config/company.ts`. Nunca se omite: una ficha local sin
   * ciudad no sirve para nada local.
   */
  const ciudad = datos.base?.city ?? company.city;
  const estado = datos.base?.state ?? company.state;

  const nodo: Record<string, unknown> = {
    '@type': 'LocalBusiness',
    '@id': `${sitio}/#business`,
    name: company.name,
    url: `${sitio}/`,
    logo: urlAbsoluta(sitio, '/brand/logo-full.webp'),
    image: urlAbsoluta(sitio, OG_IMAGE_PATH),
    address: {
      '@type': 'PostalAddress',
      addressLocality: ciudad,
      addressRegion: estado,
      addressCountry: 'US',
      ...(datos.base ? { postalCode: datos.base.postalCode } : {}),
    },
    /*
     * DOS COSAS EN `areaServed`, y las dos hacen falta:
     *
     *   - El estado entero, que es lo que la pagina promete y lo que se
     *     busca («cleaning services in Georgia»).
     *   - El circulo real alrededor de la base, que es lo que de verdad se
     *     atiende. Sin el, un buscador no tiene forma de saber si esta
     *     empresa llega a una direccion concreta.
     */
    areaServed: [
      { '@type': 'State', name: 'Georgia' },
      /*
       * LAS CIUDADES, UNA A UNA.
       *
       * El estado y el circulo dicen «hasta aqui llegamos»; esto dice los
       * NOMBRES, que es lo que se busca. Un buscador no deduce «Smyrna» de
       * un circulo de 50 millas alrededor de unas coordenadas.
       *
       * `containedInPlace` con Georgia NO SOBRA: hay un Smyrna en Tennessee
       * y otro en Delaware, y un Dallas que casi todo el mundo situa en
       * Texas. Sin decir el estado, la ciudad mas buscada de esta lista
       * apunta a dos mil kilometros de aqui.
       */
      ...datos.ciudades.map((nombre) => ({
        '@type': 'City',
        name: nombre,
        containedInPlace: { '@type': 'State', name: 'Georgia' },
      })),
      ...(datos.base && datos.radioMillas > 0
        ? [
            {
              '@type': 'GeoCircle',
              geoMidpoint: {
                '@type': 'GeoCoordinates',
                latitude: datos.base.latitude,
                longitude: datos.base.longitude,
              },
              /* En METROS: `GeoCircle` no admite millas. */
              geoRadius: Math.round(datos.radioMillas * METROS_POR_MILLA),
            },
          ]
        : []),
    ],
    openingHoursSpecification: horarioSchema(datos.horario),
  };

  /*
   * LOS CAMPOS QUE PUEDEN FALTAR SE OMITEN, NO SE PONEN VACIOS.
   *
   * `telephone: null` en JSON-LD no es «no tengo telefono»: es un valor
   * invalido, y un validador lo marca como error en todo el bloque. Es la
   * misma regla que ya cumple la web al pintarlo: sin numero no hay boton.
   */
  /*
   * `sameAs`: los perfiles que tambien son este negocio.
   *
   * Es de lo que mas ayuda a que Google entienda que la web, la ficha de
   * Google Business Profile y el Facebook son LA MISMA empresa. Los nulos se
   * filtran: `sameAs: [null]` no es «no tengo redes», es un valor invalido
   * que tumba el bloque entero.
   */
  const redes = datos.redes.filter((url): url is string => url !== null && url !== '');
  if (redes.length > 0) nodo.sameAs = redes;

  if (datos.telefono) nodo.telephone = datos.telefono;
  if (datos.email) nodo.email = datos.email;
  if (datos.legalName) nodo.legalName = datos.legalName;
  if (datos.base) {
    nodo.geo = {
      '@type': 'GeoCoordinates',
      latitude: datos.base.latitude,
      longitude: datos.base.longitude,
    };
  }

  return nodo;
}

/** El nodo del sitio, que es lo que ata las paginas al negocio. */
export function sitioWebJsonLd(sitio: string): object {
  return {
    '@type': 'WebSite',
    '@id': `${sitio}/#website`,
    url: `${sitio}/`,
    name: company.name,
    publisher: { '@id': `${sitio}/#business` },
    /*
     * NO HAY `SearchAction`. Es la propiedad que declara un buscador interno,
     * y este sitio no tiene ninguno. Declarar una accion que no existe
     * produce un enlace roto en los resultados.
     */
    inLanguage: ['en', 'es'],
  };
}

/** Una pregunta de las frecuentes, ya con el texto que se esta pintando. */
export interface PreguntaFrecuente {
  pregunta: string;
  respuesta: string;
}

/**
 * El nodo de las preguntas frecuentes.
 *
 * ========================================================================
 * EL TEXTO TIENE QUE SER EL MISMO QUE SE PINTA, Y POR ESO SE RECIBE
 * ========================================================================
 * Las seis preguntas SE EDITAN DESDE EL PANEL (`useSiteText`). Construir este
 * bloque con el texto del paquete de idioma produciria datos estructurados
 * que dicen una cosa y una pagina que dice otra en cuanto la dueña reescriba
 * una respuesta — y marcar contenido que no esta visible en la pagina es
 * justo lo que las directrices prohiben.
 *
 * ========================================================================
 * Y NO, ESTO NO VA A SACAR EL ACORDEON EN GOOGLE
 * ========================================================================
 * Conviene decirlo para que nadie lo espere: desde agosto de 2023 Google
 * limita el resultado enriquecido de `FAQPage` a sitios oficiales de gobierno
 * y de salud. Una empresa de limpieza no lo va a ver.
 *
 * Se pone igual, y por razones concretas: Bing si lo usa, los rastreadores de
 * los asistentes lo leen para contestar preguntas sobre el negocio, y es la
 * forma de declarar en limpio la politica de cancelacion y el deposito, que
 * son las dos cosas que la gente pregunta antes de reservar.
 */
export function faqJsonLd(sitio: string, preguntas: readonly PreguntaFrecuente[]): object | null {
  if (preguntas.length === 0) return null;

  return {
    '@type': 'FAQPage',
    '@id': `${sitio}/#faq`,
    mainEntity: preguntas.map((p) => ({
      '@type': 'Question',
      name: p.pregunta,
      acceptedAnswer: { '@type': 'Answer', text: p.respuesta },
    })),
  };
}

/**
 * El grafo completo, listo para serializar.
 *
 * UN SOLO `<script>` CON `@graph` y no tres bloques sueltos. Con bloques
 * sueltos, `publisher: { '@id': ... }` del sitio apuntaria a un nodo que esta
 * en otro documento y la referencia no se resolveria: habria tres cosas sin
 * relacion en vez de una empresa con su web y sus preguntas.
 */
export function grafoJsonLd(
  datos: DatosDelNegocio,
  preguntas: readonly PreguntaFrecuente[],
): object {
  const faq = faqJsonLd(datos.sitio, preguntas);

  return {
    '@context': 'https://schema.org',
    '@graph': [negocioJsonLd(datos), sitioWebJsonLd(datos.sitio), ...(faq ? [faq] : [])],
  };
}
