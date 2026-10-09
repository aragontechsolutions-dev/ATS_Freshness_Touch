import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CAJA_DE_GEORGIA, type DoorPin } from '@freshness/types';

/**
 * «¿POR DONDE SE ENTRA A TU CASA?»
 * ================================
 * Un mapa con un marcador que el cliente arrastra hasta su puerta.
 *
 * ========================================================================
 * POR QUE EXISTE
 * ========================================================================
 * El geocodificador del Censo de EE. UU. resuelve bien una calle de Atlanta
 * y REGULAR una carretera comarcal: interpola sobre el tramo de via, asi que
 * en el campo deja la casa a cientos de metros, a veces al otro lado de la
 * carretera. En la Georgia rural —que es casi todo nuestro territorio— eso
 * son vueltas con una furgoneta y una limpieza que empieza tarde.
 *
 * Quien sabe donde esta la puerta es quien vive alli.
 *
 * ========================================================================
 * NO PIDE LA UBICACION DEL NAVEGADOR, Y ES DELIBERADO
 * ========================================================================
 * No hay boton de «usar mi ubicacion actual». Dos motivos:
 *
 *   - MIENTE LA MITAD DE LAS VECES. Mucha gente reserva desde el trabajo o
 *     desde el movil en la calle, y el GPS pondria el pin donde esta la
 *     PERSONA, no la casa. Un pin equivocado es peor que ninguno: el equipo
 *     se fia de el.
 *   - CAMBIA LO QUE ES EL DATO. Arrastrar un marcador sobre la casa que ya
 *     nos dieron por direccion no dice nada nuevo de nadie. Leer el GPS si:
 *     eso es donde esta una persona en un momento concreto.
 *
 * ========================================================================
 * SIN MARCADOR POR DEFECTO
 * ========================================================================
 * El mapa abre SIN pin. Poner uno en el centro invitaria a dejarlo donde
 * cayo —«ya esta marcado»— y entonces tendriamos pines que no señalan nada
 * y en los que el equipo confiaria. Hay que tocar el mapa a proposito.
 */

/** El azul de marca. Va en codigo porque Leaflet pinta SVG con atributos. */
const COLOR_MARCA = '#145788';

/**
 * EL MARCADOR, DIBUJADO CON HTML Y SIN NINGUNA IMAGEN.
 *
 * ========================================================================
 * EL MARCADOR POR DEFECTO DE LEAFLET SALE ROTO EN PRODUCCION
 * ========================================================================
 * Carga sus iconos por una ruta relativa que los empaquetadores reescriben,
 * asi que acaba pidiendo un PNG que no existe y se pinta el cuadrito de
 * imagen rota. Ya estaba documentado en el mapa del panel
 * (`LocationPickerMap`), que lo resolvio con un circulo vectorial; aqui no
 * sirve, porque un `circleMarker` NO SE PUEDE ARRASTRAR.
 *
 * Un `divIcon` es las dos cosas: HTML puro —no hay archivo que perder— y un
 * marcador de verdad, arrastrable.
 *
 * `iconAnchor` apunta a la PUNTA de la gota, no a su centro: si apuntara al
 * centro, el pin señalaria unos metros mas al norte de donde se solto, que
 * es justo la precision que esta pantalla existe para dar.
 */
const ICONO_DE_PUERTA = L.divIcon({
  className: '',
  html:
    `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;` +
    `transform:rotate(-45deg);background:${COLOR_MARCA};` +
    `border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

interface DoorPinMapProps {
  /** Donde se centra mientras no hay pin: la sede, o la ciudad escrita. */
  centro: { lat: number; lon: number };
  valor: DoorPin | null;
  onCambiar: (pin: DoorPin) => void;
  /** Para el lector de pantalla: un mapa sin describir no dice nada. */
  descripcion: string;
}

export function DoorPinMap({ centro, valor, onCambiar, descripcion }: DoorPinMapProps) {
  const contenedor = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<L.Map | null>(null);
  const marcador = useRef<L.Marker | null>(null);
  /*
   * El callback en una referencia: cambia de identidad en cada render del
   * formulario, y sin esto habria que volver a montar el mapa entero —y
   * perder el pin puesto— cada vez que el cliente teclea una letra en otro
   * campo.
   */
  const alCambiar = useRef(onCambiar);
  useEffect(() => {
    alCambiar.current = onCambiar;
  });

  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo) return;

    const instancia = L.map(nodo, {
      center: [centro.lat, centro.lon],
      zoom: 13,
      /*
       * EL ZOOM CON LA RUEDA, APAGADO. Este mapa esta en medio de un
       * formulario que se rellena hacia abajo: con la rueda activa, quien
       * pasa por encima se queda atrapado haciendo zoom en vez de seguir.
       * Se activa al pulsar, que es cuando de verdad se quiere usar.
       */
      scrollWheelZoom: false,
    });
    instancia.on('click', () => instancia.scrollWheelZoom.enable());
    instancia.on('mouseout', () => instancia.scrollWheelZoom.disable());

    /*
     * SIN EL `{s}` DE SUBDOMINIO, Y ES OBLIGATORIO.
     *
     * ====================================================================
     * ESTE MAPA SALIO GRIS EN PRODUCCION POR ESCRIBIRLO CON `{s}`
     * ====================================================================
     * Leaflet expande `{s}` a `a.`, `b.` y `c.`, y la CSP del sitio permite
     * EXACTAMENTE `https://tile.openstreetmap.org` —host literal, sin
     * comodin—, asi que el navegador bloqueo todas las teselas y el mapa
     * quedo en gris. En local no se ve: ahi no hay cabeceras.
     *
     * Tiene que ser la MISMA URL que `ServiceAreaMap`. Hay una prueba que
     * compara las dos cosas (`teselas-permitidas.test.ts`), porque este
     * fallo no lo caza ni el lint ni los tipos ni el navegador en local.
     */
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
      /*
       * OpenStreetMap responde 403 a quien no se identifica. Sin esto el
       * mapa sale gris en produccion y en local no. Ver `ServiceAreaMap`.
       */
      referrerPolicy: 'strict-origin-when-cross-origin',
    }).addTo(instancia);

    /** Pone o mueve el marcador, y avisa hacia arriba. */
    const ponerPin = (punto: L.LatLng): void => {
      /*
       * LA GUARDIA DE GEORGIA, TAMBIEN AQUI. El servidor la repite y la base
       * de datos tambien; esta es la que evita que el cliente llegue hasta
       * el final del formulario para que entonces le digan que no.
       */
      const dentro =
        punto.lat >= CAJA_DE_GEORGIA.latMin &&
        punto.lat <= CAJA_DE_GEORGIA.latMax &&
        punto.lng >= CAJA_DE_GEORGIA.lonMin &&
        punto.lng <= CAJA_DE_GEORGIA.lonMax;
      if (!dentro) return;

      if (marcador.current) {
        marcador.current.setLatLng(punto);
      } else {
        marcador.current = L.marker(punto, { draggable: true, icon: ICONO_DE_PUERTA })
          .addTo(instancia)
          .on('dragend', (evento) => ponerPin((evento.target as L.Marker).getLatLng()));
      }

      // El redondeo de verdad lo hace el contrato; aqui solo se evita
      // mandar quince decimales en cada arrastre.
      alCambiar.current({
        latitude: Math.round(punto.lat * 1e6) / 1e6,
        longitude: Math.round(punto.lng * 1e6) / 1e6,
      });
    };

    // Un toque en el mapa tambien pone el pin: en un movil es mas facil que
    // arrastrar, y es lo primero que intenta cualquiera.
    instancia.on('click', (evento) => ponerPin(evento.latlng));

    if (valor) ponerPin(L.latLng(valor.latitude, valor.longitude));

    mapa.current = instancia;
    return () => {
      instancia.remove();
      mapa.current = null;
      marcador.current = null;
    };
    // Se monta UNA vez, con la lista de dependencias VACIA a proposito:
    // `valor` y `centro` solo se leen al montar, y quien manda sobre el
    // marcador a partir de ahi es el propio mapa. Con ellos en la lista, el
    // mapa se desmontaria y volveria a montarse en cada arrastre.
  }, []);

  /*
   * Si cambia el centro —porque el cliente escribio otra ciudad— el mapa se
   * mueve, PERO SOLO SI AUN NO HAY PIN. Mover la vista despues de que
   * alguien haya marcado su puerta le quitaria de la pantalla lo que acaba
   * de hacer.
   */
  useEffect(() => {
    if (mapa.current && !marcador.current) {
      mapa.current.setView([centro.lat, centro.lon], 13);
    }
  }, [centro.lat, centro.lon]);

  return (
    <div
      ref={contenedor}
      role="application"
      aria-label={descripcion}
      className="h-64 w-full rounded-lg border border-slate-300 dark:border-slate-600"
      style={{ borderColor: valor ? COLOR_MARCA : undefined }}
    />
  );
}
