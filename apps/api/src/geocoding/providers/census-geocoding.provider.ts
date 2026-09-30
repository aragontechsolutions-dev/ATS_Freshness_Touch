import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import type { GeocodeQuery, GeocodeResult } from '@freshness/types';
import type { GeocodingProvider } from '../geocoding.types';

/**
 * GEOCODIFICADOR DEL CENSO DE ESTADOS UNIDOS
 * ==========================================
 * El servicio oficial del gobierno federal. Gratuito, sin clave de API, sin
 * limite practico para el volumen de una empresa de limpieza, y solo para
 * direcciones de Estados Unidos — que es justo donde opera Freshness Touch.
 *
 * Que no haya clave importa mas de lo que parece: no hay nada que rotar, ni
 * que filtrar en un despliegue, ni que se pueda gastar si alguien lo usa de
 * mas.
 *
 * ========================================================================
 * PRECISION: INTERPOLA SOBRE LA CALLE, NO DA EL PORTAL
 * ========================================================================
 * Esto NO es un detalle tecnico: decide como se lee un fichaje.
 *
 * El Censo no tiene la posicion de cada edificio. Tiene los tramos de calle
 * (TIGER/Line) con el rango de numeros de cada tramo, y coloca el punto
 * INTERPOLANDO: si el tramo va del 100 al 200 y buscas el 150, te da el
 * punto medio del tramo. Por eso este proveedor devuelve siempre
 * `INTERPOLATED` y nunca `ROOFTOP`: seria mentir sobre la calidad del dato.
 *
 * QUE SIGNIFICA EN METROS. En una calle urbana corta el error son unas
 * decenas de metros. En una manzana rural larga de Georgia pueden ser
 * cientos. Consecuencia practica: el umbral de «esta en la casa» tiene que
 * ser GENEROSO —del orden de un par de cientos de metros—, no de veinte.
 *
 * Sigue sirviendo para lo que se pidio, que es distinguir «llego a la casa»
 * de «fichó desde su propia casa a 30 kilometros». No sirve para discutir si
 * estaba en el portal o en la acera de enfrente, y no se debe usar para eso.
 *
 * ========================================================================
 * SIN PROBAR CONTRA EL SERVICIO REAL
 * ========================================================================
 * Este adaptador se escribio contra la API documentada y se probo con
 * respuestas reales capturadas, pero el entorno de desarrollo no tiene
 * salida a `geocoding.geo.census.gov`, asi que la primera llamada de verdad
 * ocurrira ya en el despliegue. Mismo caso que el proveedor de Google.
 *
 * COMO COMPROBARLO en cuanto este desplegado: guarda una direccion conocida
 * y mira en el registro que las coordenadas caen donde deben. Si el
 * geocodificador estuviera mal, la guardia del contrato rechazaria el
 * resultado y la direccion se quedaria sin coordenadas — nunca guardaria un
 * punto equivocado en silencio.
 */

/**
 * La respuesta del Censo, solo con lo que se usa.
 *
 * `.loose()` a proposito: la respuesta trae muchos mas campos —componentes
 * de la direccion, identificadores TIGER, el lado de la calle— y no se
 * quieren enumerar todos solo para que la validacion no falle el dia que
 * anadan uno.
 */
const CensusCoordinatesSchema = z.object({
  /**
   * OJO CON EL ORDEN: `x` ES LONGITUD E `y` ES LATITUD.
   *
   * Es la convencion cartografica (x = eje horizontal = longitud), y es la
   * inversa de como se escriben las coordenadas al hablar («33.7, -84.4»).
   * Invertirlas no da ningun error: manda cada casa de Georgia al oceano
   * Indico, frente a Somalia, con unas coordenadas perfectamente validas.
   *
   * Hay una prueba con una respuesta real de Atlanta que falla si alguien
   * las cambia de sitio.
   */
  x: z.number(),
  y: z.number(),
});

const CensusMatchSchema = z
  .object({
    matchedAddress: z.string(),
    coordinates: CensusCoordinatesSchema,
  })
  .loose();

const CensusResponseSchema = z
  .object({
    result: z
      .object({
        addressMatches: z.array(CensusMatchSchema),
      })
      .loose(),
  })
  .loose();

export interface CensusGeocodingOptions {
  timeoutMs: number;
}

@Injectable()
export class CensusGeocodingProvider implements GeocodingProvider {
  readonly name = 'census' as const;
  private readonly logger = new Logger(CensusGeocodingProvider.name);
  private static readonly ENDPOINT =
    'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';

  constructor(private readonly options: CensusGeocodingOptions) {}

  async locate(query: GeocodeQuery): Promise<GeocodeResult | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const url = new URL(CensusGeocodingProvider.ENDPOINT);
      url.searchParams.set('address', direccionEnUnaLinea(query));
      /*
       * `Public_AR_Current` es el conjunto de datos vigente. Hay versiones
       * fechadas (`Public_AR_Census2020`, etc.) que sirven para reproducir
       * un resultado antiguo; aqui interesa el actual, porque las calles
       * nuevas de una urbanizacion reciente solo estan en el.
       */
      url.searchParams.set('benchmark', 'Public_AR_Current');
      url.searchParams.set('format', 'json');

      /*
       * `redirect: 'error'` NO ES PARANOIA GRATUITA.
       *
       * Lo que sale en esta peticion es el domicilio de un cliente. El
       * destino es una constante de este archivo, con lo que no hay forma de
       * que nadie lo cambie desde fuera... salvo una: que el servicio
       * responda con una redireccion. `fetch` las sigue por defecto y sin
       * avisar, y la direccion acabaria en un servidor que nadie eligio.
       *
       * Con esto, una redireccion es un fallo limpio: la direccion se queda
       * sin coordenadas y queda anotado abajo. Es el intercambio correcto
       * —perder una geocodificacion pesa mucho menos que mandar el domicilio
       * de un cliente a un sitio desconocido—, pero conviene saberlo: si en
       * produccion NADA se geocodifica nunca, esto es una de las dos cosas
       * que hay que mirar en el registro (la otra es el cortafuegos de
       * salida). No se pudo probar contra el servicio real desde aqui.
       */
      const response = await fetch(url, { signal: controller.signal, redirect: 'error' });

      if (!response.ok) {
        this.logger.warn(`El geocodificador del Censo respondio ${response.status}`);
        return null;
      }

      const parsed = CensusResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        this.logger.warn('Respuesta del Censo con formato inesperado');
        return null;
      }

      const [match] = parsed.data.result.addressMatches;
      if (!match) {
        /*
         * No es un error: el Censo no encontro la direccion. Pasa con
         * urbanizaciones muy nuevas y con direcciones mal escritas. Se avisa
         * SIN el texto de la direccion: es el domicilio de un cliente y no
         * tiene por que quedar en los registros del servidor.
         */
        this.logger.log(`El Censo no encontro la direccion del codigo postal ${query.postalCode}`);
        return null;
      }

      return {
        // y = latitud, x = longitud. Ver el comentario del esquema.
        latitude: match.coordinates.y,
        longitude: match.coordinates.x,
        precision: 'INTERPOLATED',
        matchedAddress: match.matchedAddress.slice(0, 300),
        provider: this.name,
      };
    } catch (error) {
      /*
       * Tampoco lanza. El servicio caido o lento no puede impedir que se
       * cree una reserva; la direccion se queda sin coordenadas y el barrido
       * lo reintentara mas tarde.
       */
      this.logger.warn(
        `Fallo al consultar el geocodificador del Censo: ` +
          `${error instanceof Error ? error.name : 'desconocido'}`,
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * La direccion en la unica linea que espera el servicio.
 *
 * Sin `line2`: «Apto 3B» no mueve el edificio de sitio y hace fallar
 * coincidencias que de otro modo salen bien.
 */
function direccionEnUnaLinea(query: GeocodeQuery): string {
  return `${query.line1}, ${query.city}, ${query.state} ${query.postalCode}`;
}
