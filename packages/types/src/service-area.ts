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

/** Tope del recargo. Mil dolares por un traslado no es un recargo, es una errata. */
export const MAX_ZONE_SURCHARGE_CENTS = 100_000;

export const ServiceAreaZoneSchema = z.strictObject({
  code: EditableZoneCodeSchema,
  /** Limite superior en millas, inclusive. */
  maxMiles: z.int().min(1).max(MAX_ZONE_MILES),
  /**
   * Recargo por traslado. SIEMPRE cero en las zonas sin precio automatico:
   * no hay precio que recargar, y dejar un numero ahi haria creer que se
   * cobra algo que nadie cobra.
   */
  surchargeCents: z.int().nonnegative().max(MAX_ZONE_SURCHARGE_CENTS),
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
  /* Un recargo en una zona sin precio automatico no se cobra nunca. */
  .refine(({ zones }) => zones.every((zona) => zona.instantQuote || zona.surchargeCents === 0), {
    message: 'Una zona sin precio automatico no puede llevar recargo',
    path: ['zones'],
  });

export type ServiceAreaSettings = z.infer<typeof ServiceAreaSettingsSchema>;
export type ServiceAreaSettingsInput = z.input<typeof ServiceAreaSettingsSchema>;

/**
 * El area de partida.
 *
 * Las cuatro primeras son EXACTAMENTE las que ya estaban escritas en el
 * codigo: esta etapa amplia la cobertura, no cambia ningun precio vigente.
 *
 * `E` es lo nuevo y llega hasta las 325 millas, que cubre Georgia entera
 * desde Atlanta —Savannah queda sobre las 250 y la esquina sureste sobre las
 * 300—. Sin precio automatico, por lo dicho arriba.
 */
export const DEFAULT_SERVICE_AREA: ServiceAreaSettings = {
  zones: [
    { code: 'A', maxMiles: 20, surchargeCents: 0, instantQuote: true },
    { code: 'B', maxMiles: 35, surchargeCents: 2500, instantQuote: true },
    { code: 'C', maxMiles: 50, surchargeCents: 5000, instantQuote: true },
    { code: 'D', maxMiles: 60, surchargeCents: 7500, instantQuote: true },
    { code: 'E', maxMiles: 325, surchargeCents: 0, instantQuote: false },
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
