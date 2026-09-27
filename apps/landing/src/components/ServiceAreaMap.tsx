import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * EL AREA DE SERVICIO, EN UN MAPA
 * -------------------------------
 * Una lista de tarjetas que dice «hasta 35 millas» no le dice nada a alguien
 * que solo quiere saber si vamos a su casa. Un mapa si.
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
 * SE CARGA APARTE. Leaflet son unos 40 kB comprimidos, y este mapa esta al
 * final de la pagina. Cargarlo con el resto retrasaria el cotizador, que es
 * lo que de verdad genera ingresos. Ver como lo importa `ServiceAreas`.
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
    }).addTo(instancia);

    /*
     * DE FUERA HACIA DENTRO. Leaflet apila en el orden en que se anaden, asi
     * que dibujando primero el circulo grande los pequenos quedan encima y
     * se pueden pulsar. Al reves, el circulo exterior taparia a todos los
     * demas y el mapa no respondería a nada.
     */
    const deFueraHaciaDentro = [...zonas].sort((a, b) => b.maxMiles - a.maxMiles);

    for (const zona of deFueraHaciaDentro) {
      const color = zona.instantQuote ? COLOR_INSTANTANEO : COLOR_A_PETICION;

      L.circle(puntoCentral, {
        radius: zona.maxMiles * METROS_POR_MILLA,
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.08,
      })
        .addTo(instancia)
        .bindPopup(zona.etiqueta);
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

    instancia.flyToBounds(
      L.latLng(centro.lat, centro.lon).toBounds(focoMillas * METROS_POR_MILLA * 2),
      { padding: [16, 16], duration: 0.6 },
    );
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
