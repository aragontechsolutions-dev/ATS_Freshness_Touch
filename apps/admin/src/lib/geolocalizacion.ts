import type { ClockInLocation } from '@freshness/types';

/**
 * PEDIR LA UBICACION AL FICHAR
 * ============================
 * Envuelve la API de geolocalizacion del navegador para que la pantalla no
 * tenga que saber nada de ella.
 *
 * ========================================================================
 * NUNCA FALLA. DEVUELVE «NO PUDE», Y LA PANTALLA SIGUE
 * ========================================================================
 * No lanza en ningun caso, y no es pereza: el fichaje no se bloquea por falta
 * de ubicacion, asi que un error aqui no tiene a quien avisar. Los sotanos no
 * tienen GPS, hay zonas rurales de Georgia sin cobertura, y un movil se queda
 * sin bateria a media manana. En todos esos casos la llegada se registra
 * igual, anotando POR QUE no hubo ubicacion.
 *
 * ========================================================================
 * Y NO PIDE PERMISO ANTES DE HORA
 * ========================================================================
 * Esto se llama al pulsar «He llegado», NUNCA al abrir la pantalla. El
 * navegador muestra su propio dialogo de permiso la primera vez, y que
 * aparezca al abrir la aplicacion —sin que la persona haya hecho nada que lo
 * justifique— es la forma mas rapida de que le de a «Bloquear» para siempre.
 * Pedido justo al fichar, el dialogo tiene un porque evidente.
 */

/**
 * Cuanto se espera al GPS.
 *
 * Diez segundos es un compromiso medido: una primera lectura en frio, en la
 * calle, tarda tipicamente entre dos y ocho segundos. Menos de diez
 * descartaria lecturas buenas que estaban a punto de llegar; mas dejaria a
 * alguien mirando un boton girando en la puerta de una casa, y esa persona
 * pulsaria otra vez o cerraria la aplicacion.
 */
const ESPERA_MS = 10_000;

/**
 * Se acepta una lectura de hasta un minuto de antigüedad.
 *
 * Quien acaba de llegar a una casa no se ha movido en el ultimo minuto, asi
 * que una lectura reciente de la cache del navegador vale igual y llega al
 * instante en vez de encender el GPS otra vez.
 */
const ANTIGUEDAD_ACEPTABLE_MS = 60_000;

/**
 * Lo que se le manda a la API: o una ubicacion, o el motivo de no tenerla.
 *
 * Los dos unicos motivos que existen aqui son los que el movil puede saber.
 * `RECORDED` y `NO_HOUSE` los decide el servidor y no caben en este tipo.
 */
export type ResultadoUbicacion =
  { location: ClockInLocation } | { locationState: 'DENIED' | 'UNAVAILABLE' };

export function ubicacionParaFichar(): Promise<ResultadoUbicacion> {
  /*
   * Ni siquiera existe la API: un navegador muy viejo, o —lo mas probable en
   * la practica— la pagina servida sin HTTPS. Los navegadores retiran la
   * geolocalizacion en contextos no seguros.
   */
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({ locationState: 'UNAVAILABLE' });
  }

  return new Promise<ResultadoUbicacion>((resolve) => {
    /*
     * UNA SOLA RESPUESTA, PASE LO QUE PASE.
     *
     * `getCurrentPosition` deberia llamar a un callback o al otro, pero con
     * el tiempo de espera propio de abajo hay dos fuentes de respuesta. Si las
     * dos llegaran, la segunda llamada a `resolve` se ignora en silencio y el
     * fichaje se mandaria con lo primero que llego — que es justo el tipo de
     * carrera que produce un dato equivocado sin que nada falle.
     */
    let respondido = false;
    const responder = (resultado: ResultadoUbicacion): void => {
      if (respondido) return;
      respondido = true;
      clearTimeout(temporizador);
      resolve(resultado);
    };

    /*
     * EL TIEMPO DE ESPERA PROPIO, ADEMAS DEL DEL NAVEGADOR.
     *
     * `timeout` en las opciones deberia bastar, pero hay navegadores moviles
     * en los que no dispara nunca si el permiso esta concedido y el GPS no
     * responde: la promesa se queda colgada y el boton girando para siempre.
     * Con este, lo peor que pasa es que se ficha sin ubicacion.
     */
    const temporizador = setTimeout(
      () => responder({ locationState: 'UNAVAILABLE' }),
      ESPERA_MS + 1_000,
    );

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        responder({
          /*
           * SOLO TRES NUMEROS, ESCRITOS UNO A UNO.
           *
           * `posicion.coords` trae tambien altitud, rumbo y velocidad. No se
           * copia el objeto entero a proposito: escribir los campos a mano es
           * lo que garantiza que no viaje al servidor nada que no haga falta.
           * El contrato de la API los rechazaria, pero mas vale no mandarlos.
           */
          location: {
            latitude: posicion.coords.latitude,
            longitude: posicion.coords.longitude,
            accuracyMeters: posicion.coords.accuracy,
          },
        });
      },
      (error) => {
        /*
         * `PERMISSION_DENIED` es 1. Se distingue porque es lo decidido por la
         * persona, y el resto —posicion no disponible, tiempo agotado— son
         * fallos tecnicos que no debe parecer que alguien eligio.
         */
        responder({
          locationState: error.code === error.PERMISSION_DENIED ? 'DENIED' : 'UNAVAILABLE',
        });
      },
      {
        /*
         * `enableHighAccuracy` enciende el GPS en vez de estimar por red.
         * Gasta mas bateria, y aqui esta justificado: una estimacion por wifi
         * en una zona residencial se equivoca en cientos de metros, que es
         * justo el margen en el que hay que decidir si alguien esta en la
         * casa.
         */
        enableHighAccuracy: true,
        timeout: ESPERA_MS,
        maximumAge: ANTIGUEDAD_ACEPTABLE_MS,
      },
    );
  });
}
