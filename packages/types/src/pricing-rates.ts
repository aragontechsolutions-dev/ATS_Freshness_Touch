import { z } from 'zod';
import { PricingSizeBandsSchema } from './pricing-size-bands';
import { ServiceTypeSchema } from './enums';

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
export const EDITABLE_SERVICE_TYPES = ['STANDARD', 'DEEP', 'MOVE_IN_OUT'] as const;

/**
 * Los que NO se tarifan porque no dan precio automatico: se visita la casa y
 * se propone. Estan aqui y no sueltos para que la guardia de compilacion de
 * abajo pueda comprobar que no falta ninguno.
 */
export const QUOTE_ONLY_SERVICE_TYPES = [
  'POST_CONSTRUCTION',
  'AIRBNB_TURNOVER',
  'COMMERCIAL',
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
  EditableServiceType | (typeof QUOTE_ONLY_SERVICE_TYPES)[number]
>;
const _todosClasificados: ServicioSinClasificar extends never ? true : never = true;
void _todosClasificados;

/* -------------------------------------------------------------------------- */
/*  Extras                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Los extras que se ofrecen hoy, y son los de las plantillas de trabajo.
 *
 * LOS RETIRADOS NO DESAPARECEN DEL ENUMERADO: su codigo esta escrito dentro
 * del JSON de cotizaciones y reservas que ya existen, y borrarlo haria
 * ilegible un presupuesto del mes pasado. Simplemente no se tarifan ni se
 * ofrecen.
 */
export const OFFERED_ADD_ON_CODES = ['INSIDE_OVEN', 'INSIDE_FRIDGE'] as const;

export const OfferedAddOnCodeSchema = z.enum(OFFERED_ADD_ON_CODES);
export type OfferedAddOnCode = z.infer<typeof OfferedAddOnCodeSchema>;

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
const MAX_TARIFA_CENTS = 1_000_000; // 10 000 $: ninguna limpieza domestica se acerca
const MAX_EXTRA_CENTS = 100_000; // 1 000 $ un extra
const MAX_CANTIDAD_EXTRA = 100;
/** El mismo tope que el area de servicio: Georgia de punta a punta. */
const MAX_RADIO_MILLAS = 500;
/** Cinco dolares la milla ya es mudanza, no limpieza. */
const MAX_CENTS_POR_MILLA = 500;

/* -------------------------------------------------------------------------- */
/*  Las piezas                                                                */
/* -------------------------------------------------------------------------- */

/*
 * EL PRECIO DE UN SERVICIO YA NO VIVE AQUI: ESTA EN LA TABLA POR TRAMOS.
 *
 * Hasta la etapa 3.4 cada servicio tenia, por cadencia, un importe plano y
 * unos centavos por pie cuadrado, y el precio era el mayor de los dos. Era
 * una formula, y la formula NO describe lo que cobra esta empresa: sus
 * precios suben a saltos irregulares y hay tramos donde se quedan quietos
 * mientras la casa crece. Ninguna recta pasa por esos puntos.
 *
 * Ahora el precio sale de `sizeBands`, una fila por tramo de tamano, que es
 * la misma forma que tiene la hoja de calculo del cliente. Ver
 * `pricing-size-bands.ts`.
 *
 * QUE CADENCIAS SE OFRECEN SIGUE SIENDO DECISION DE PRODUCTO y vive en el
 * codigo, no aqui: que la profunda no se contrate cada semana no es una
 * tarifa que alguien deba poder cambiar desde una pantalla.
 */

/** El precio de un extra. El tipo de unidad no es editable: es producto. */
export const EditableAddOnRateSchema = z.strictObject({
  unitAmountCents: z.number().int().min(0).max(MAX_EXTRA_CENTS),
  maxQuantity: z.number().int().min(1).max(MAX_CANTIDAD_EXTRA),
});
export type EditableAddOnRate = z.infer<typeof EditableAddOnRateSchema>;

/**
 * El coste del traslado.
 *
 * Dentro del radio no se cobra nada, y es una promesa comercial que se dice
 * en una frase. Por encima se cobran las millas que sobran, no un escalon:
 * con franjas, dos casas separadas por una milla podian pagar veinticinco
 * dolares de diferencia por caer a un lado u otro de una raya invisible.
 */
export const EditableTravelRuleSchema = z.strictObject({
  freeRadiusMiles: z.number().int().min(0).max(MAX_RADIO_MILLAS),
  roundTrip: z.boolean(),
  /**
   * `null` usa la tarifa vigente del IRS, que es una cifra oficial y
   * publicada: ante un cliente que discute el recargo hay algo que ensenar
   * que no se ha inventado la empresa.
   */
  centsPerMile: z.number().min(0).max(MAX_CENTS_POR_MILLA).nullable(),
});
export type EditableTravelRule = z.infer<typeof EditableTravelRuleSchema>;

/* -------------------------------------------------------------------------- */
/*  La tabla entera                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Todo lo editable, junto.
 *
 * VA ENTERA Y NO POR PIEZAS: las invariantes son sobre el CONJUNTO —que el
 * precio no suba al aumentar la frecuencia— y no se pueden comprobar sobre
 * un cambio suelto.
 */
export const PricingRatesSchema = z.strictObject({
  /**
   * LA TABLA DE PRECIOS POR TAMANO. Es el corazon de lo editable: una fila
   * por tramo de pies cuadrados, igual que la hoja del cliente.
   */
  sizeBands: PricingSizeBandsSchema,
  addOns: z.record(OfferedAddOnCodeSchema, EditableAddOnRateSchema),
  /**
   * Lo que se retiene al reservar, en centavos. Se descuenta del total: NO
   * es un cargo extra.
   */
  depositCents: z.number().int().min(1).max(MAX_TARIFA_CENTS),
  travel: EditableTravelRuleSchema,
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
