import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GEORGIA_OUTLINE, farthestGeorgiaMiles } from '@freshness/types';

/**
 * EL AREA DE SERVICIO, EN UN MAPA
 * -------------------------------
 * Vista previa mientras se editan las zonas: escribir «hasta 325 millas» no
 * dice nada hasta que se ve el circulo encima del estado.
 *
 * GEMELO DEL SITIO PUBLICO. Es casi el mismo componente que
 * `apps/landing/src/components/ServiceAreaMap.tsx`, copiado a proposito: las
 * dos aplicaciones se despliegan por separado y el monorepo no tiene ningun
 * paquete compartido de React, asi que montar uno para cien lineas seria mas
 * estructura que beneficio. Si aparece un tercer consumidor, toca extraerlo.
 *
 * POR QUE LEAFLET Y OPENSTREETMAP. No necesita clave de API ni cuenta ni
 * tarjeta: se puede desplegar y funciona. Las alternativas conocidas cobran
 * por carga de mapa y exigen una clave que hay que guardar, rotar y vigilar
 * —y que, al ir en el navegador, es publica por definicion—. Para dibujar
 * unos circulos sobre un estado, eso es pagar y arriesgar por nada.
 *
 * LAS TESELAS HAY QUE PERMITIRLAS EN LA CSP. `img-src` estaba en `'self'
 * data:`, asi que sin tocarlo el mapa sale gris EN PRODUCCION y en local no:
 * ahi no hay cabeceras. Ver `vercel.json`.
 *
 * SE CARGA APARTE. Leaflet son unos 40 kB comprimidos y esta pantalla se
 * abre unas pocas veces al ano: no tiene por que pesar en el arranque del
 * panel, que se usa a diario. Ver como lo importa `ServiceAreaForm`.
 */

/** Una zona a dibujar, de dentro hacia fuera. */
export interface ZonaDibujable {
  code: string;
  maxMiles: number;
  /** Cambia el color: el area con precio al instante se distingue del resto. */
  instantQuote: boolean;
  /** Lo que se lee al pulsar el circulo. Ya traducido. */
  etiqueta: string;
}

interface ServiceAreaMapProps {
  centro: { lat: number; lon: number };
  zonas: ZonaDibujable[];
  /** Para el lector de pantalla: un mapa sin describir no dice nada. */
  descripcion: string;
  /**
   * A cuantas millas se encuadra la vista.
   *
   * HACE FALTA PORQUE LAS ESCALAS NO SE LLEVAN. El area con precio al
   * instante llega a 60 millas y la cobertura entera a 325: encuadrado al
   * estado completo, las cuatro zonas cercanas se apelotonan en un punto y
   * no se distingue ninguna. Cambiando el encuadre se ven las dos cosas.
   */
  focoMillas: number;
  className?: string;
}

const METROS_POR_MILLA = 1609.34;

/**
 * Colores del propio sistema, no de Leaflet.
 *
 * El azul de marca para lo que tiene precio automatico y el amarillo para lo
 * que se cotiza en persona. Van en el codigo y no en CSS porque Leaflet los
 * pinta sobre SVG con atributos, no con clases.
 */
const COLOR_INSTANTANEO = '#145788';
const COLOR_A_PETICION = '#f0b429';

/**
 * El borde del estado, siempre visible y en gris.
 *
 * En gris y no en color de marca a proposito: NO es una zona, es el limite
 * de donde se opera. Pintarlo con los colores de las zonas lo convertiria
 * en una mas y volveria a confundir «hasta aqui llegamos» con «esto es un
 * area de precio».
 */
const COLOR_ESTADO = '#64748b';

/** El contorno, en el formato que quiere Leaflet. Se construye una vez. */
const CONTORNO_GEORGIA = GEORGIA_OUTLINE.map(([lat, lon]) => [lat, lon] as L.LatLngTuple);

export function ServiceAreaMap({
  centro,
  zonas,
  descripcion,
  focoMillas,
  className,
}: ServiceAreaMapProps) {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<L.Map | null>(null);

  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo || zonas.length === 0) return;

    const puntoCentral: L.LatLngExpression = [centro.lat, centro.lon];

    const instancia = L.map(nodo, {
      center: puntoCentral,
      zoom: 7,
      /*
       * EL ZOOM CON LA RUEDA VA APAGADO. Este mapa esta en medio de una
       * pagina que se lee hacia abajo: con la rueda activa, quien pasa por
       * encima se queda atrapado haciendo zoom en vez de seguir leyendo. Se
       * activa al pulsar sobre el, que es cuando de verdad se quiere usar.
       */
      scrollWheelZoom: false,
      attributionControl: true,
    });

    instancia.on('click', () => instancia.scrollWheelZoom.enable());
    instancia.on('mouseout', () => instancia.scrollWheelZoom.disable());

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      // Obligatoria por la licencia de OpenStreetMap, y ademas es de justicia.
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      /*
       * HAY QUE MANDAR DE DONDE VIENE LA PETICION, O NOS BLOQUEAN.
       *
       * OpenStreetMap exige que una aplicacion se identifique; si no, sus
       * servidores responden 403 «App is not following the tile usage
       * policy». Le paso al panel y al sitio no, y la diferencia estaba en
       * una cabecera: el panel manda `Referrer-Policy: no-referrer` —que es
       * lo correcto para una herramienta interna— y el sitio no.
       *
       * Se arregla AQUI y no aflojando esa cabecera: el atributo del
       * elemento manda sobre la politica del documento, asi que solo estas
       * imagenes envian referente, y solo el ORIGEN. La ruta que se estaba
       * mirando en el panel no sale a ningun sitio.
       */
      referrerPolicy: 'strict-origin-when-cross-origin',
    }).addTo(instancia);

    /*
     * DE FUERA HACIA DENTRO. Leaflet apila en el orden en que se anaden, asi
     * que dibujando primero el circulo grande los pequenos quedan encima y
     * se pueden pulsar. Al reves, el circulo exterior taparia a todos los
     * demas y el mapa no respondería a nada.
     */
    const deFueraHaciaDentro = [...zonas].sort((a, b) => b.maxMiles - a.maxMiles);

    /*
     * A CUANTAS MILLAS SE ACABA GEORGIA desde la base. Es la unica cuenta
     * que decide la forma de cada zona, y por eso se hace aqui arriba.
     */
    const millasHastaElFinDelEstado = farthestGeorgiaMiles(centro.lat, centro.lon);

    /*
     * EL BORDE DEL ESTADO, SALVO CUANDO YA LO DIBUJA UNA ZONA.
     *
     * Con el area de partida, la zona mas lejana ES el estado, asi que
     * pintar tambien la linea de referencia seria repetir el mismo trazado
     * de 476 puntos por debajo del otro: mismo dibujo, el doble de trabajo.
     * Hace falta cuando ninguna zona llega tan lejos, que es cuando el
     * cliente necesita ver donde se acaba Georgia para situar los circulos.
     *
     * Va lo primero para quedar por debajo de las zonas, y sin relleno ni
     * interaccion: es una referencia, no algo que se pueda pulsar.
     */
    const algunaZonaDibujaElEstado = zonas.some(
      (zona) => zona.maxMiles >= millasHastaElFinDelEstado,
    );

    if (!algunaZonaDibujaElEstado) {
      L.polygon(CONTORNO_GEORGIA, {
        color: COLOR_ESTADO,
        weight: 1,
        dashArray: '4 3',
        fill: false,
        interactive: false,
      }).addTo(instancia);
    }

    for (const zona of deFueraHaciaDentro) {
      const color = zona.instantQuote ? COLOR_INSTANTANEO : COLOR_A_PETICION;
      const estilo = { color, weight: 2, fillColor: color, fillOpacity: 0.08 };

      /*
       * UNA ZONA QUE LLEGA MAS LEJOS QUE EL ESTADO SE DIBUJA COMO EL ESTADO.
       *
       * El circulo de 325 millas entraba en Tennessee, Carolina del Sur,
       * Alabama, Carolina del Norte y Florida, y a ninguno de esos sitios
       * se va: el motor marca `outOfState` en cuanto el codigo postal no es
       * de Georgia. El contorno no es una aproximacion del circulo, es la
       * cobertura DE VERDAD, asi que esto es mas preciso y no menos.
       *
       * Las zonas cercanas —35 y 60 millas— se quedan dentro del estado por
       * todos lados, asi que siguen siendo circulos: ahi el circulo si dice
       * la verdad, y ademas es lo que se entiende de un vistazo.
       */
      const cubreElEstado = zona.maxMiles >= millasHastaElFinDelEstado;

      const forma = cubreElEstado
        ? L.polygon(CONTORNO_GEORGIA, estilo)
        : L.circle(puntoCentral, { radius: zona.maxMiles * METROS_POR_MILLA, ...estilo });

      forma.addTo(instancia).bindPopup(zona.etiqueta);
    }

    mapa.current = instancia;

    /*
     * Se destruye al desmontar. Sin esto, Leaflet deja escuchadores de
     * `resize` en `window` y el nodo marcado como inicializado: al volver a
     * montar revienta con «Map container is already initialized».
     */
    return () => {
      instancia.remove();
      mapa.current = null;
    };
  }, [centro.lat, centro.lon, zonas]);

  /*
   * El encuadre va en su PROPIO efecto, aparte del que crea el mapa.
   *
   * Si estuviera en el de arriba, cambiar de vista destruiria y volveria a
   * crear el mapa entero: las teselas se descargarian otra vez y la vista
   * daria un salto en vez de moverse.
   *
   * Se calculan los limites desde el PUNTO, con `toBounds`, y no pidiendo
   * `getBounds()` a un circulo suelto: un circulo que no esta anadido al
   * mapa no tiene con que convertir metros a coordenadas, asi que revienta
   * con «Cannot read properties of undefined (reading 'layerPointToLatLng')»
   * y se lleva por delante el mapa entero. No se ve leyendo el codigo; se
   * vio abriendolo en un navegador.
   *
   * `toBounds` recibe el LADO del cuadrado, de ahi el doble del radio.
   */
  useEffect(() => {
    const instancia = mapa.current;
    if (!instancia || focoMillas <= 0) return;

    /*
     * SI EL ENCUADRE ABARCA EL ESTADO, SE ENCUADRA EL ESTADO.
     *
     * Un cuadrado de 325 millas de radio centrado en Atlanta deja media
     * Carolina y medio Alabama en pantalla, y Georgia pequena en el medio:
     * el mapa dedicaba la mayor parte del espacio a sitios donde no se
     * trabaja. Ajustandose al poligono, el estado llena el recuadro.
     */
    const limites =
      focoMillas >= farthestGeorgiaMiles(centro.lat, centro.lon)
        ? L.latLngBounds(CONTORNO_GEORGIA)
        : L.latLng(centro.lat, centro.lon).toBounds(focoMillas * METROS_POR_MILLA * 2);

    instancia.flyToBounds(limites, { padding: [16, 16], duration: 0.6 });
  }, [centro.lat, centro.lon, focoMillas]);

  return (
    <div
      ref={contenedor}
      className={className}
      // El mapa es una imagen interactiva: sin esto, un lector de pantalla
      // solo encuentra un cajon vacio lleno de enlaces de atribucion.
      role="img"
      aria-label={descripcion}
    />
  );
}

export default ServiceAreaMap;
