import { z } from 'zod';
import { AddOnCodeSchema, ServiceTypeSchema } from './enums';

/**
 * LAS TARIFAS, EDITABLES DESDE EL PANEL
 * -------------------------------------
 * Hasta ahora vivian en `packages/pricing/src/config.ts`, asi que subir un
 * precio exigia un despliegue. Esta es la pieza que faltaba para cerrar la
 * configuracion.
 *
 * ES LA MAS DELICADA DE TODAS, Y NO POR EL FORMULARIO. Un precio equivocado
 * no rompe nada: cotiza, cobra y factura, con la cifra mal. No hay pantalla
 * roja que avise. Por eso este contrato hace dos cosas que los otros no
 * necesitaban:
 *
 *   1. PONE TOPES A TODO. El fallo realista no es un precio negativo, es un
 *      CERO DE MAS: teclear 120000 donde iban 12000. Un tope por campo lo
 *      atrapa en el momento; sin el, se descubre en la primera factura.
 *
 *   2. RECHAZA LO QUE NO SIGNIFICA NADA, aunque cada numero por separado sea
 *      valido. Un descuento mensual mayor que el semanal es dinero perdido
 *      en cada reserva recurrente y nadie lo nota leyendo la tabla.
 *
 * LO QUE NO SE PUEDE EDITAR, Y POR QUE:
 *
 *   - EL SERVICIO COMERCIAL. No tiene precio automatico —se visita y se
 *     propone a mano—, asi que cualquier cifra que se pusiera no se usaria
 *     jamas. Un campo que no hace nada es peor que ninguno.
 *   - SI UN EXTRA ES PLANO O POR UNIDAD. Cambiarlo cambia el significado de
 *     su cantidad maxima y el de cada linea de cada presupuesto anterior.
 *     Es una decision de producto, no un precio.
 *   - LAS DURACIONES. Afectan a la agenda, no al importe. Meterlas en el
 *     mismo formulario esconderia el cambio caro entre veinte campos que
 *     casi nunca se tocan.
 *   - EL IMPUESTO. En Georgia la limpieza esta exenta por ley, no por
 *     decision de la empresa.
 */

/* -------------------------------------------------------------------------- */
/*  Que servicios se editan                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Los servicios con precio automatico, que son los unicos que tiene sentido
 * tarifar. `COMMERCIAL` se queda fuera a proposito: ver la cabecera.
 */
export const EDITABLE_SERVICE_TYPES = [
  'STANDARD',
  'DEEP',
  'MOVE_IN_OUT',
  'POST_CONSTRUCTION',
  'AIRBNB_TURNOVER',
] as const;

export const EditableServiceTypeSchema = z.enum(EDITABLE_SERVICE_TYPES);
export type EditableServiceType = z.infer<typeof EditableServiceTypeSchema>;

/**
 * GUARDIA DE COMPILACION: si manana se anade un servicio, esto deja de
 * compilar hasta que alguien decida si se tarifa desde el panel o se queda
 * en el codigo como el comercial.
 *
 * Sin esto, un servicio nuevo se quedaria callado con las tarifas del codigo
 * para siempre y nadie lo echaria de menos hasta ver una factura rara.
 */
type ServicioSinClasificar = Exclude<
  z.infer<typeof ServiceTypeSchema>,
  EditableServiceType | 'COMMERCIAL'
>;
const _todosClasificados: ServicioSinClasificar extends never ? true : never = true;
void _todosClasificados;

/* -------------------------------------------------------------------------- */
/*  Topes                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * LOS TOPES SON LA GUARDIA PRINCIPAL DE TODO ESTE ARCHIVO.
 *
 * Estan puestos un orden de magnitud por encima de cualquier cifra sensata
 * del sector, no pegados a los precios actuales: un tope demasiado ajustado
 * obliga a tocar el codigo para subir un precio, que es exactamente lo que
 * esta etapa viene a evitar.
 */
const MAX_CARGO_CENTS = 1_000_000; // 10 000 $: ninguna limpieza domestica se acerca
const MAX_POR_HABITACION_CENTS = 100_000; // 1 000 $ por dormitorio o bano
const MAX_CENTS_POR_PIE = 100; // 1 $ el pie cuadrado
const MAX_EXTRA_CENTS = 100_000; // 1 000 $ un extra
const MAX_CANTIDAD_EXTRA = 100;
/** Mas de la mitad de descuento es pagar por limpiar. */
const MAX_DESCUENTO_PORCENTAJE = 50;
/** El mismo tope que el area de servicio: Georgia de punta a punta. */
const MAX_RADIO_MILLAS = 500;

const CargoSchema = z.number().int().min(0).max(MAX_CARGO_CENTS);

/* -------------------------------------------------------------------------- */
/*  Las piezas                                                                */
/* -------------------------------------------------------------------------- */

/**
 * El precio de un servicio.
 *
 * `centsPerSquareFoot` ADMITE DECIMALES y el resto no. No es un descuido:
 * los demas son importes que se cobran tal cual, y medio centavo no existe.
 * Este se multiplica por los pies cuadrados antes de redondear, asi que 3,5
 * es una tarifa perfectamente normal —y la diferencia entre 3 y 4 en una
 * casa de 2 000 pies son veinte dolares—.
 */
export const EditableServiceRateSchema = z
  .strictObject({
    baseCents: CargoSchema,
    perBedroomCents: z.number().int().min(0).max(MAX_POR_HABITACION_CENTS),
    perBathroomCents: z.number().int().min(0).max(MAX_POR_HABITACION_CENTS),
    centsPerSquareFoot: z.number().min(0).max(MAX_CENTS_POR_PIE),
    minimumCents: CargoSchema,
  })
  .refine((tarifa) => tarifa.minimumCents > 0, {
    /*
     * UN MINIMO DE CERO CONVIERTE EL SERVICIO EN GRATIS para una casa
     * pequena sin extras. El motor aplica el minimo como suelo; sin suelo,
     * el suelo es cero.
     */
    /*
     * EL MENSAJE ES UNA CLAVE DE TRADUCCION, no una frase. Es la misma
     * leccion que dejaron los ajustes del negocio: un mensaje escrito en el
     * contrato acaba apareciendo en espanol en un panel en ingles, porque
     * el contrato no sabe quien lo esta leyendo.
     */
    message: 'admin.rates.errMinimumZero',
    path: ['minimumCents'],
  });
export type EditableServiceRate = z.infer<typeof EditableServiceRateSchema>;

/**
 * El precio de un extra.
 *
 * No lleva `unit`: ver la cabecera. La cantidad maxima si es editable porque
 * es un limite operativo —cuantas ventanas se pueden hacer en una visita— y
 * eso cambia con el tamano del equipo.
 */
export const EditableAddOnRateSchema = z.strictObject({
  unitAmountCents: z.number().int().min(0).max(MAX_EXTRA_CENTS),
  maxQuantity: z.number().int().min(1).max(MAX_CANTIDAD_EXTRA),
});
export type EditableAddOnRate = z.infer<typeof EditableAddOnRateSchema>;

/**
 * Descuentos por recurrencia.
 *
 * `ONE_TIME` es literalmente cero y no un campo: un servicio que no se
 * repite no tiene descuento por repetirse. Dejarlo editable solo permitiria
 * ponerle uno por error.
 */
export const FrequencyDiscountsSchema = z
  .strictObject({
    weeklyPercent: z.number().int().min(0).max(MAX_DESCUENTO_PORCENTAJE),
    biweeklyPercent: z.number().int().min(0).max(MAX_DESCUENTO_PORCENTAJE),
    monthlyPercent: z.number().int().min(0).max(MAX_DESCUENTO_PORCENTAJE),
  })
  .refine((d) => d.weeklyPercent >= d.biweeklyPercent && d.biweeklyPercent >= d.monthlyPercent, {
    /*
     * A MAS FRECUENCIA, MAS DESCUENTO. Al reves cada numero es valido por
     * separado y el conjunto no significa nada: quien se compromete a una
     * limpieza semanal pagaria proporcionalmente mas que quien viene una vez
     * al mes. Se pierde dinero en cada reserva recurrente y no lo delata
     * ninguna pantalla.
     */
    message: 'admin.rates.errDiscountOrder',
    path: ['weeklyPercent'],
  });
export type FrequencyDiscounts = z.infer<typeof FrequencyDiscountsSchema>;

/**
 * La regla del deposito: lo que se RETIENE en la tarjeta al reservar, que no
 * es lo que se cobra.
 */
export const EditableDepositRuleSchema = z
  .strictObject({
    baseCents: CargoSchema,
    /** Millas sin recargo alrededor de la base de operaciones. */
    freeRadiusMiles: z.number().int().min(0).max(MAX_RADIO_MILLAS),
    /** Si se cobran las millas de ida y vuelta. */
    roundTrip: z.boolean(),
    minCents: CargoSchema,
    maxCents: CargoSchema,
  })
  .refine((d) => d.minCents <= d.maxCents, {
    /*
     * El deposito calculado se recorta a este intervalo. Con el minimo por
     * encima del maximo el recorte no tiene solucion, y lo que salga
     * dependera del orden en que se apliquen: un fallo que da cifras
     * distintas sin fallar por ningun sitio.
     */
    message: 'admin.rates.errDepositRange',
    path: ['minCents'],
  });
export type EditableDepositRule = z.infer<typeof EditableDepositRuleSchema>;

/* -------------------------------------------------------------------------- */
/*  La tabla entera                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Todo lo editable, junto.
 *
 * VA ENTERA Y NO POR PIEZAS. Igual que el area de servicio: las invariantes
 * son sobre el CONJUNTO —que el descuento semanal no baje del mensual— y no
 * se pueden comprobar sobre un cambio suelto.
 */
export const PricingRatesSchema = z.strictObject({
  services: z.record(EditableServiceTypeSchema, EditableServiceRateSchema),
  addOns: z.record(AddOnCodeSchema, EditableAddOnRateSchema),
  frequencyDiscounts: FrequencyDiscountsSchema,
  deposit: EditableDepositRuleSchema,
});
export type PricingRates = z.infer<typeof PricingRatesSchema>;

/* -------------------------------------------------------------------------- */
/*  Version                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * La version de una tabla de tarifas.
 *
 * SE GUARDA EN CADA COTIZACION Y EN CADA RESERVA, y esta vez de verdad sirve
 * para algo: cada version es una fila que se puede volver a leer. Hasta esta
 * etapa apuntaba a un archivo del codigo del que solo existia la version
 * actual, asi que un presupuesto de hace tres meses no se podia reproducir
 * aunque el esquema prometiera que si.
 *
 * El formato es `AAAA.MM.DD.n`, con `n` empezando en 1 cada dia. Se ordena
 * sola, se lee de un vistazo y dice cuando se cambio el precio sin abrir
 * nada.
 */
export const PRICING_VERSION_PATTERN = /^\d{4}\.\d{2}\.\d{2}\.\d+$/;

export const PricingVersionSchema = z.string().min(1).max(40);

/** La siguiente version de un dia, dadas las que ya existen de ese dia. */
export function nextPricingVersion(hoy: Date, existentes: readonly string[]): string {
  const dia = [
    hoy.getUTCFullYear(),
    String(hoy.getUTCMonth() + 1).padStart(2, '0'),
    String(hoy.getUTCDate()).padStart(2, '0'),
  ].join('.');

  /*
   * Se cuenta sobre las versiones QUE YA EXISTEN de ese dia en vez de sobre
   * un contador aparte. Un contador es otro estado que se puede desincronizar
   * de la tabla que numera; esto no puede.
   */
  const delDia = existentes.filter((v) => v.startsWith(`${dia}.`));
  const mayor = delDia.reduce((tope, v) => {
    const n = Number.parseInt(v.slice(dia.length + 1), 10);
    return Number.isFinite(n) && n > tope ? n : tope;
  }, 0);

  return `${dia}.${mayor + 1}`;
}

/* -------------------------------------------------------------------------- */
/*  Lo que ve el panel                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Las tarifas vigentes mas quien las puso y cuando.
 *
 * El nombre de quien las cambio se guarda COMO TEXTO en el momento del
 * cambio, no como una referencia a su ficha: quien subio un precio el año
 * pasado puede haber causado baja, y «lo cambió alguien que ya no está» no
 * sirve de nada cuando se revisa una factura.
 */
export const AdminPricingRatesSchema = z.strictObject({
  version: PricingVersionSchema,
  rates: PricingRatesSchema,
  updatedAt: z.string().nullable(),
  updatedBy: z.string().nullable(),
  /** Cuantas versiones hay guardadas. La pantalla lo enseña como contexto. */
  versionCount: z.number().int().min(0),
});
export type AdminPricingRates = z.infer<typeof AdminPricingRatesSchema>;
