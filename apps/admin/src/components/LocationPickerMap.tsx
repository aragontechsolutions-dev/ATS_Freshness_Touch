import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { GEORGIA_OUTLINE } from '@freshness/types';

/**
 * ELEGIR LA SEDE PULSANDO EN EL MAPA
 * ----------------------------------
 * Escribir 33.749 y -84.388 a mano es la forma mas facil de equivocarse con
 * algo que mueve dinero: un signo, un digito, o las dos cifras al reves, y
 * la empresa acaba midiendo desde otro continente. Pulsando sobre el mapa
 * ese error no se puede cometer.
 *
 * Los campos numericos siguen existiendo en el formulario, para pegar unas
 * coordenadas que vengan de otro sitio. Este mapa es la comprobacion: si el
 * punto no cae donde se esperaba, se ve.
 *
 * EL CIRCULO DE LAS 35 MILLAS SE MUEVE CON EL MARCADOR. Es lo que convierte
 * la pantalla en util: no se elige un punto, se elige que casas entran en
 * el radio sin traslado.
 *
 * POR QUE `circleMarker` Y NO EL MARCADOR DE LEAFLET. El marcador por
 * defecto carga sus imagenes por una ruta relativa que los empaquetadores
 * reescriben, asi que en produccion sale roto o invisible. Un circulo es
 * vector puro: no hay archivo que perder.
 */
interface LocationPickerMapProps {
  punto: { lat: number; lon: number };
  /** El radio sin traslado, para ver que abarca. 0 lo oculta. */
  radioLibreMillas: number;
  /** Para el lector de pantalla: un mapa sin describir no dice nada. */
  descripcion: string;
  onPick: (punto: { lat: number; lon: number }) => void;
  className?: string;
}

const METROS_POR_MILLA = 1609.34;
const COLOR_MARCA = '#145788';
const COLOR_ESTADO = '#64748b';

const CONTORNO_GEORGIA = GEORGIA_OUTLINE.map(([lat, lon]) => [lat, lon] as L.LatLngTuple);

export function LocationPickerMap({
  punto,
  radioLibreMillas,
  descripcion,
  onPick,
  className,
}: LocationPickerMapProps) {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<L.Map | null>(null);
  const marcador = useRef<L.CircleMarker | null>(null);
  const radio = useRef<L.Circle | null>(null);

  /*
   * EL CALLBACK EN UNA REF, y no en las dependencias del efecto.
   *
   * Si el efecto dependiera de `onPick`, cada render del formulario padre
   * crearia una funcion nueva, el efecto se volveria a ejecutar y el mapa se
   * destruiria y reconstruiria: las teselas se descargarian otra vez y la
   * vista saltaria al centro en mitad de un ajuste.
   */
  const alPulsar = useRef(onPick);
  alPulsar.current = onPick;

  // --- El mapa se crea UNA vez -------------------------------------------
  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo) return;

    const instancia = L.map(nodo, {
      center: [punto.lat, punto.lon],
      zoom: 7,
      scrollWheelZoom: false,
      attributionControl: true,
    });

    instancia.on('click', () => instancia.scrollWheelZoom.enable());
    instancia.on('mouseout', () => instancia.scrollWheelZoom.disable());

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      // El panel manda `Referrer-Policy: no-referrer` y OpenStreetMap
      // responde 403 a quien no se identifica. Ver `ServiceAreaMap`.
      referrerPolicy: 'strict-origin-when-cross-origin',
    }).addTo(instancia);

    /*
     * EL BORDE DEL ESTADO, para que se vea la unica regla que el contrato
     * impone: la sede tiene que estar dentro de Georgia. Sin el, un clic
     * rechazado no se entiende.
     */
    L.polygon(CONTORNO_GEORGIA, {
      color: COLOR_ESTADO,
      weight: 1,
      dashArray: '4 3',
      fill: false,
      interactive: false,
    }).addTo(instancia);

    instancia.on('click', (evento: L.LeafletMouseEvent) => {
      alPulsar.current({
        // Cuatro decimales son unos once metros: mas precision en un punto
        // que se elige a ojo es ruido que ensucia la ficha.
        lat: Number(evento.latlng.lat.toFixed(4)),
        lon: Number(evento.latlng.lng.toFixed(4)),
      });
    });

    mapa.current = instancia;

    return () => {
      instancia.remove();
      mapa.current = null;
      marcador.current = null;
      radio.current = null;
    };
    /*
     * LISTA DE DEPENDENCIAS VACIA A PROPOSITO: el mapa se crea una sola vez.
     *
     * `punto` se lee aqui solo para el encuadre inicial; moverlo despues lo
     * resuelve el efecto de abajo, que reposiciona el marcador sin tocar el
     * mapa. Si `punto` estuviera en esta lista, cada clic destruiria y
     * reconstruiria el mapa entero: las teselas se descargarian otra vez y
     * la vista saltaria al centro justo cuando se esta ajustando el punto.
     */
  }, []);

  // --- El marcador y el radio se MUEVEN, no se recrean ---------------------
  useEffect(() => {
    const instancia = mapa.current;
    if (!instancia) return;

    const centro: L.LatLngExpression = [punto.lat, punto.lon];

    if (radio.current) {
      radio.current.setLatLng(centro).setRadius(radioLibreMillas * METROS_POR_MILLA);
    } else if (radioLibreMillas > 0) {
      radio.current = L.circle(centro, {
        radius: radioLibreMillas * METROS_POR_MILLA,
        color: COLOR_MARCA,
        weight: 2,
        fillColor: COLOR_MARCA,
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(instancia);
    }

    /*
     * El marcador va DESPUES del circulo para quedar por encima, y tambien
     * sin interaccion: el clic tiene que llegar al mapa, no quedarse en el.
     */
    if (marcador.current) {
      marcador.current.setLatLng(centro);
    } else {
      marcador.current = L.circleMarker(centro, {
        radius: 6,
        color: '#ffffff',
        weight: 2,
        fillColor: COLOR_MARCA,
        fillOpacity: 1,
        interactive: false,
      }).addTo(instancia);
    }
  }, [punto.lat, punto.lon, radioLibreMillas]);

  return <div ref={contenedor} className={className} role="img" aria-label={descripcion} />;
}

export default LocationPickerMap;
