import { z } from 'zod';

/**
 * EL AREA DE SERVICIO, EDITABLE DESDE EL PANEL
 * --------------------------------------------
 * Hasta ahora las zonas vivian en un archivo del codigo: ampliar la cobertura
 * o mover un recargo exigia un despliegue. Ahora se editan desde el panel,
 * que es donde esa decision se toma de verdad.
 *
 * DOS CONCEPTOS QUE NO SON EL MISMO, y confundirlos es el error que este
 * contrato existe para impedir:
 *
 *   - ATENDIDA: vamos a esa casa.
 *   - CON PRECIO AUTOMATICO: el cotizador dice la cifra al instante.
 *
 * Cubrir todo Georgia significa atender hasta unas 300 millas. A esa
 * distancia el traslado —unas ocho horas de coche ida y vuelta— pesa mucho
 * mas que la limpieza, y ninguna tabla de recargos acierta a ciegas. Por eso
 * las zonas lejanas se atienden PERO SIN precio automatico: el cotizador
 * recoge la solicitud y el precio se da en persona.
 *
 * QUE SE PUEDE EDITAR Y QUE NO. Los limites, los recargos y si cada zona da
 * precio automatico. El conjunto de codigos NO: se guarda en cada reserva, y
 * si se pudieran inventar zonas el historico acabaria lleno de codigos que ya
 * no significan nada.
 */

/**
 * Los codigos que se pueden configurar.
 *
 * `OUT_OF_RANGE` queda fuera a proposito: no es una zona que se configure,
 * es lo que hay MAS ALLA de la ultima. Ofrecerla para editar invitaria a
 * marcarla como atendida, que es una contradiccion con nombre propio.
 */
export const EditableZoneCodeSchema = z.enum(['A', 'B', 'C', 'D', 'E']);
export type EditableZoneCode = z.infer<typeof EditableZoneCodeSchema>;

/** El orden canonico. `A` es la mas cercana. */
export const ZONE_ORDER = EditableZoneCodeSchema.options;

/**
 * Tope duro de distancia, en millas.
 *
 * Georgia mide unas 300 millas de punta a punta desde Atlanta. 500 deja
 * margen de sobra y pone un techo a lo que se puede teclear por error: sin
 * el, un cero de mas convierte el area de servicio en medio pais.
 */
export const MAX_ZONE_MILES = 500;

/**
 * UNA ZONA YA NO LLEVA RECARGO.
 *
 * Los tenia —25, 50 y 75 dolares por franja— y se quitaron: dos casas
 * separadas por una milla podian pagar veinticinco dolares de diferencia
 * por caer a un lado u otro de una raya que el cliente no ve. Ahora el
 * traslado se cobra POR MILLA (ver `pricing-rates.ts`), y lo unico que
 * deciden las zonas es hasta donde se va y hasta donde el precio sale solo.
 */
export const ServiceAreaZoneSchema = z.strictObject({
  code: EditableZoneCodeSchema,
  /** Limite superior en millas, inclusive. */
  maxMiles: z.int().min(1).max(MAX_ZONE_MILES),
  instantQuote: z.boolean(),
});
export type ServiceAreaZone = z.infer<typeof ServiceAreaZoneSchema>;

export const ServiceAreaSettingsSchema = z
  .strictObject({
    zones: z.array(ServiceAreaZoneSchema).min(1).max(ZONE_ORDER.length),
  })
  /*
   * LOS CODIGOS VAN EN ORDEN Y SIN SALTOS: A, luego B, luego C...
   *
   * No es una mania de orden. El motor recorre la lista y se queda con la
   * primera zona cuyo limite alcanza la distancia, asi que una lista
   * desordenada asignaria la zona equivocada —y con ella el recargo
   * equivocado— sin fallar por ningun sitio.
   */
  .refine(({ zones }) => zones.every((zona, indice) => zona.code === ZONE_ORDER[indice]), {
    message: 'Las zonas deben ir en orden y sin saltos: A, B, C...',
    path: ['zones'],
  })
  /*
   * CADA ANILLO MAS LEJOS QUE EL ANTERIOR. Dos zonas con el mismo limite, o
   * una mas cercana detras de otra mas lejana, dejarian un tramo que nunca
   * se alcanza: un recargo configurado que no se aplica jamas.
   */
  .refine(
    ({ zones }) =>
      zones.every((zona, i) => i === 0 || zona.maxMiles > (zones[i - 1]?.maxMiles ?? 0)),
    { message: 'Cada zona debe llegar mas lejos que la anterior', path: ['zones'] },
  )
  /*
   * EL PRECIO AUTOMATICO NO VUELVE. Si a 50 millas hay que dar precio en
   * persona, a 200 tambien. Lo contrario describe un negocio que no existe y
   * deja al cotizador dando cifras mas lejos que donde ha dicho que no puede.
   */
  .refine(
    ({ zones }) => {
      const primeraSinPrecio = zones.findIndex((zona) => !zona.instantQuote);
      return primeraSinPrecio === -1 || zones.slice(primeraSinPrecio).every((z) => !z.instantQuote);
    },
    {
      message: 'Una vez que una zona deja de dar precio automatico, las siguientes tampoco pueden',
      path: ['zones'],
    },
  )
  /*
   * LA PRIMERA ZONA SIEMPRE DA PRECIO AUTOMATICO. Sin ella no habria
   * cotizador: el sitio pediria los datos para no dar ninguna cifra a
   * nadie, ni siquiera a quien vive al lado.
   */
  .refine(({ zones }) => zones[0]?.instantQuote === true, {
    message: 'La zona mas cercana tiene que dar precio automatico',
    path: ['zones'],
  });

export type ServiceAreaSettings = z.infer<typeof ServiceAreaSettingsSchema>;
export type ServiceAreaSettingsInput = z.input<typeof ServiceAreaSettingsSchema>;

/**
 * El area de partida: TRES BANDAS, no cinco anillos.
 *
 *   A  hasta 35 millas — dentro del radio que no cobra traslado
 *   B  hasta 60 millas — se cobra el traslado, el precio sigue saliendo solo
 *   C  hasta 325       — el resto de Georgia: se atiende, sin precio automatico
 *
 * Las 35 de la zona A son el radio sin recargo, y no es casualidad: la
 * frontera que el cliente nota es «me cobras el viaje o no», asi que la
 * zona y el radio tienen que coincidir. El dia que se muevan por separado,
 * el mapa dira una cosa y la factura otra.
 *
 * Las 325 cubren Georgia entera desde Atlanta: Savannah queda sobre las 250
 * y la esquina sureste sobre las 300.
 *
 * `D` y `E` siguen en el enumerado aunque no se usen: estan escritas en
 * reservas que ya existen.
 */
export const DEFAULT_SERVICE_AREA: ServiceAreaSettings = {
  zones: [
    { code: 'A', maxMiles: 35, instantQuote: true },
    { code: 'B', maxMiles: 60, instantQuote: true },
    { code: 'C', maxMiles: 325, instantQuote: false },
  ],
};

/** Hasta donde se llega, en millas. Lo que hay mas alla no se atiende. */
export function serviceRadiusMiles(area: ServiceAreaSettings): number {
  return area.zones.reduce((lejos, zona) => Math.max(lejos, zona.maxMiles), 0);
}

/** Hasta donde sale el precio solo. Cero si ninguna zona lo da. */
export function instantQuoteRadiusMiles(area: ServiceAreaSettings): number {
  return area.zones
    .filter((zona) => zona.instantQuote)
    .reduce((lejos, zona) => Math.max(lejos, zona.maxMiles), 0);
}

/**
 * La configuracion administrativa, con quien la cambio por ultima vez.
 *
 * Misma forma que la del negocio: la pantalla necesita poder decir «lo
 * cambio Fulanita el martes», que es la mitad del valor de poder editarlo.
 */
export const AdminServiceAreaSchema = z.strictObject({
  settings: ServiceAreaSettingsSchema,
  updatedAt: z.iso.datetime().nullable(),
  updatedBy: z.string().nullable(),
});
export type AdminServiceArea = z.infer<typeof AdminServiceAreaSchema>;
