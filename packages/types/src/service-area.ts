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
   * LOS CODIGOS VAN EN ORDEN, PERO SE PERMITEN SALTOS.
   *
   * En orden porque el motor recorre la lista y se queda con la primera
   * zona cuyo limite alcanza la distancia: desordenada, asignaria la zona
   * equivocada sin fallar por ningun sitio.
   *
   * CON SALTOS PORQUE UN CODIGO RETIRADO NO SE REAPROVECHA. Al quitar la
   * zona B —las 60 millas con precio automatico— el area quedo en A y C, y
   * la tentacion era renombrar la C a B para que fueran seguidas. No se
   * hizo: el codigo de zona SE GUARDA EN CADA RESERVA, y hay reservas
   * antiguas con zona B que significan «hasta 60 millas, con precio
   * automatico». Si B pasara a ser «el resto de Georgia, a mano», una
   * consulta sobre el pasado mezclaria trabajos a 50 millas con trabajos a
   * 250 y nada avisaria de la mezcla.
   *
   * Lo que si se sigue impidiendo es repetir un codigo o ponerlos al reves.
   */
  .refine(
    ({ zones }) => {
      const posiciones = zones.map((zona) => ZONE_ORDER.indexOf(zona.code));
      return posiciones.every((actual, i) => i === 0 || actual > (posiciones[i - 1] ?? -1));
    },
    {
      message: 'Las zonas deben ir en orden: A, luego B, luego C...',
      path: ['zones'],
    },
  )
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
 * El area de partida: DOS ZONAS.
 *
 *   A  hasta 35 millas — el radio que no cobra traslado
 *   C  hasta 325       — el resto de Georgia: se atiende, sin precio automatico
 *
 * Las 35 de la zona A son el radio sin recargo, y no es casualidad: la
 * frontera que el cliente nota es «me cobras el viaje o no», asi que la
 * zona y el radio tienen que coincidir. Pasado ese circulo, el motor de
 * distancia cobra las millas reales.
 *
 * Las 325 cubren Georgia entera: el punto mas lejano del estado desde
 * Atlanta esta a 275 millas, asi que esa zona se dibuja con el contorno
 * real y no como un circulo.
 *
 * POR QUE FALTA LA B. Eran 60 millas con precio automatico, y desaparecio:
 * el traslado ya se cobra por milla desde las 35, asi que una banda
 * intermedia no decidia nada. Su codigo NO se reutiliza —ver la regla de
 * los saltos, mas arriba—: esta escrito en reservas que ya existen.
 *
 * `B`, `D` y `E` siguen en el enumerado por lo mismo.
 */
export const DEFAULT_SERVICE_AREA: ServiceAreaSettings = {
  zones: [
    { code: 'A', maxMiles: 35, instantQuote: true },
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
