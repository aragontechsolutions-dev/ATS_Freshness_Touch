import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  GeocodeQuerySchema,
  isUsableGeocodeResult,
  type AddressCoordinates,
  type GeocodeResult,
} from '@freshness/types';
import { PrismaService } from '../database/prisma.service';
import { GEOCODING_PROVIDER, type GeocodingProvider } from './geocoding.types';

/**
 * GEOCODIFICACION DE LAS DIRECCIONES
 * ==================================
 * Resuelve donde cae una casa en el mapa y lo guarda en su ficha.
 *
 * UNA DIRECCION SE GEOCODIFICA UNA VEZ. Una casa no se mueve, asi que
 * consultar el servicio en cada uso seria pagar —en tiempo, y en cuota si
 * algun dia se cambia a un proveedor de pago— por la misma respuesta. El
 * resultado queda en la ficha con su procedencia y su fecha, igual que ya se
 * cachea la distancia desde la base de operaciones.
 *
 * NADA DE ESTO PUEDE ROMPER NADA. Ni una sola de las operaciones de aqui
 * lanza hacia arriba:
 *
 *   - si el servicio no responde, la direccion se queda sin coordenadas;
 *   - si devuelve una coincidencia fuera del estado, se rechaza y tampoco se
 *     guarda;
 *   - y en los dos casos el barrido lo reintentara mas tarde.
 *
 * El motivo es concreto: esto cuelga de la creacion de reservas, que es el
 * camino del dinero. Una reserva NO puede fallar porque un servicio del
 * gobierno federal este lento.
 */
@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(GEOCODING_PROVIDER) private readonly provider: GeocodingProvider,
  ) {}

  /**
   * Las coordenadas de una direccion, resolviendolas si hace falta.
   *
   * Devuelve `null` cuando no se pudieron obtener, que quien llama debe
   * tratar como «esta direccion no tiene punto en el mapa», nunca como error.
   */
  async coordinatesFor(addressId: string): Promise<AddressCoordinates | null> {
    const guardadas = await this.stored(addressId);
    if (guardadas) return guardadas;

    return this.resolveAndStore(addressId);
  }

  /** Lo ya guardado, sin salir a ningun sitio. */
  async stored(addressId: string): Promise<AddressCoordinates | null> {
    try {
      const fila = await this.prisma.db.address.findUnique({
        where: { id: addressId },
        select: {
          latitude: true,
          longitude: true,
          geocodePrecision: true,
          geocodeProvider: true,
          geocodedAt: true,
        },
      });

      if (
        !fila ||
        fila.latitude === null ||
        fila.longitude === null ||
        fila.geocodePrecision === null ||
        fila.geocodedAt === null
      ) {
        return null;
      }

      return {
        latitude: fila.latitude,
        longitude: fila.longitude,
        precision: fila.geocodePrecision,
        /*
         * El proveedor se guarda como texto libre: si algun dia se retira un
         * proveedor del enumerado, las filas viejas deben seguir leyendose.
         * Lo que no encaje se marca como simulado, que es lo inocuo.
         */
        provider: fila.geocodeProvider === 'census' ? 'census' : 'mock',
        geocodedAt: fila.geocodedAt.toISOString(),
      };
    } catch (error) {
      this.logger.error(`No se pudieron leer las coordenadas de la direccion: ${mensaje(error)}`);
      return null;
    }
  }

  /**
   * Consulta el servicio y guarda el resultado.
   *
   * Publico porque lo llaman dos sitios: el enganche que se dispara al crear
   * una reserva y el barrido que recoge las que quedaron pendientes.
   */
  async resolveAndStore(addressId: string): Promise<AddressCoordinates | null> {
    let direccion;
    try {
      direccion = await this.prisma.db.address.findUnique({
        where: { id: addressId },
        select: { line1: true, city: true, state: true, postalCode: true },
      });
    } catch (error) {
      this.logger.error(`No se pudo leer la direccion a geocodificar: ${mensaje(error)}`);
      return null;
    }

    if (!direccion) return null;

    /*
     * La consulta pasa por el contrato antes de salir. Una direccion mal
     * formada —un codigo postal de cuatro digitos— gastaria una llamada para
     * no encontrar nada; asi se descarta antes y queda anotado.
     */
    const consulta = GeocodeQuerySchema.safeParse(direccion);
    if (!consulta.success) {
      this.logger.warn(
        `La direccion no tiene la forma que espera el geocodificador y se omite ` +
          `(codigo postal ${direccion.postalCode})`,
      );
      return null;
    }

    /*
     * EL CONTRATO DICE QUE EL PROVEEDOR NO LANZA, Y AUN ASI SE VIGILA AQUI.
     *
     * No es desconfianza gratuita: este metodo se llama desde la creacion de
     * reservas SIN esperarlo (`void resolveAndStore(...)`). Una promesa
     * rechazada que nadie recoge es un `unhandledRejection`, y en Node 22 eso
     * TUMBA EL PROCESO ENTERO. Es decir: un `fetch` que lanza por un camino
     * que no previmos no dejaria una direccion sin coordenadas, sino la API
     * caida — y con ella todas las reservas.
     *
     * Cumplir el contrato es tarea del proveedor; que incumplirlo no pueda
     * costar el servicio es tarea de aqui.
     */
    let resultado: GeocodeResult | null;
    try {
      resultado = await this.provider.locate(consulta.data);
    } catch (error) {
      this.logger.error(`El geocodificador fallo: ${mensaje(error)}`);
      return null;
    }

    if (!resultado) return null;

    /*
     * LA GUARDIA. Los geocodificadores no devuelven un error cuando no
     * encuentran la direccion: devuelven lo mas parecido. Hay una «Main
     * Street» en cada pueblo del pais, y una coincidencia equivocada llega
     * con coordenadas perfectamente validas en otro estado.
     *
     * Guardarla dejaria la casa en Ohio y a partir de ahi TODOS los fichajes
     * de ese cliente dirian «a 800 kilometros». El fichaje no fallaria:
     * mentiria. Mejor sin coordenadas que con las de otro sitio.
     */
    if (!isUsableGeocodeResult(resultado, consulta.data.state)) {
      this.logger.warn(
        `El geocodificador devolvio un punto fuera de ${consulta.data.state} para el ` +
          `codigo postal ${consulta.data.postalCode}; se descarta`,
      );
      return null;
    }

    return this.save(addressId, resultado);
  }

  private async save(
    addressId: string,
    resultado: GeocodeResult,
  ): Promise<AddressCoordinates | null> {
    const geocodedAt = new Date();

    try {
      await this.prisma.db.address.update({
        where: { id: addressId },
        data: {
          latitude: resultado.latitude,
          longitude: resultado.longitude,
          geocodePrecision: resultado.precision,
          geocodeProvider: resultado.provider,
          /*
           * SE GUARDA, PERO NO SE DEVUELVE. Ni aqui ni en `stored`: no forma
           * parte de `AddressCoordinates`.
           *
           * Es el domicilio de un cliente, y lo que consume estas
           * coordenadas es el fichaje, que las manda al movil de un
           * empleado. Ese empleado ya tiene la direccion del trabajo que
           * tiene asignado —la necesita para llegar—, pero no hay ninguna
           * razon para que la direccion viaje DOS veces por dos caminos
           * distintos. Aqui sirve para diagnosticar desde la base de datos,
           * y solo para eso.
           */
          geocodeMatchedAddress: resultado.matchedAddress,
          geocodedAt,
        },
      });
    } catch (error) {
      this.logger.error(`No se pudieron guardar las coordenadas: ${mensaje(error)}`);
      return null;
    }

    this.logger.log(
      `Direccion geocodificada por "${resultado.provider}" con precision ` +
        `${resultado.precision}`,
    );

    return {
      latitude: resultado.latitude,
      longitude: resultado.longitude,
      precision: resultado.precision,
      provider: resultado.provider,
      geocodedAt: geocodedAt.toISOString(),
    };
  }

  /**
   * Las direcciones que siguen sin coordenadas, para el barrido.
   *
   * Con tope: si el servicio estuvo caido una semana, el barrido no debe
   * intentar resolver quinientas de golpe. Va poco a poco, en cada pasada.
   */
  async pendingAddressIds(limit: number): Promise<string[]> {
    try {
      const filas = await this.prisma.db.address.findMany({
        where: { latitude: null },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });
      return filas.map((fila) => fila.id);
    } catch (error) {
      this.logger.error(`No se pudo listar lo pendiente de geocodificar: ${mensaje(error)}`);
      return [];
    }
  }
}

function mensaje(error: unknown): string {
  return error instanceof Error ? error.message : 'error desconocido';
}
