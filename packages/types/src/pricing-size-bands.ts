import { z } from 'zod';

/**
 * LA TABLA DE PRECIOS POR TAMANO DE CASA
 * ======================================
 * Una fila por tramo de pies cuadrados, con los precios de ese tramo. Es la
 * misma forma que la hoja de calculo del cliente, y eso es deliberado: quien
 * mantiene los precios piensa en filas de una tabla, no en formulas.
 *
 * ========================================================================
 * SUSTITUYE AL MODELO DE «PLANO + CENTAVOS POR PIE»
 * ========================================================================
 * Hasta ahora el precio salia de un importe plano y, en la profunda, unos
 * centavos por pie cuadrado. Era una formula, y la formula NO describe lo
 * que cobra esta empresa: sus precios suben a saltos, los saltos no son
 * regulares, y hay tramos donde el precio se queda quieto mientras la casa
 * crece. Ninguna recta pasa por esos puntos.
 *
 * Con la tabla, lo que esta escrito es exactamente lo que se cobra.
 *
 * ========================================================================
 * EL TRAMO ES UN TOPE, Y SE SUBE AL SIGUIENTE
 * ========================================================================
 * `maxSquareFeet` es el tope del tramo, inclusive. Una casa toma EL PRIMER
 * tramo cuyo tope llega o supera su tamano:
 *
 *     casa de 1.000 pies  ->  tramo de 1.200
 *     casa de 1.200 pies  ->  tramo de 1.200
 *     casa de 1.201 pies  ->  tramo de 1.400
 *
 * Importa porque la tabla del cliente tiene huecos —de 900 salta a 1.200— y
 * sin esta regla una casa de 1.000 pies no tendria precio. Subir al
 * siguiente tramo nunca cobra de menos, que es el lado correcto del error
 * cuando hay que elegir uno.
 *
 * ========================================================================
 * POR ENCIMA DEL ULTIMO TRAMO NO HAY PRECIO AUTOMATICO
 * ========================================================================
 * La tabla acaba en algun tamano. Una casa mas grande NO se tarifa
 * extrapolando: la tabla no dice que la progresion continue, y a ese tamano
 * el error se multiplica. Se recoge la solicitud y el precio se da tras ver
 * la casa, por el mismo camino que las zonas lejanas.
 */

const MAX_CENTS = 2_000_000; // 20.000 $, techo de cordura por celda.
const MAX_PIES = 100_000;

/**
 * Un tramo de tamano con sus precios.
 *
 * LAS TRES CADENCIAS DE LA ESTANDAR, Y NINGUNA PUNTUAL. La limpieza estandar
 * se vende solo como plan recurrente; quien quiere una limpieza suelta
 * contrata la profunda. Es lo que dice la tabla del cliente, y es practica
 * habitual del sector —la primera limpieza de una casa siempre es profunda—.
 *
 * LA PROFUNDA Y LAS DOS DE MUDANZA COMPARTEN PRECIO, en una sola columna:
 * es el mismo trabajo con distinto nombre segun por que se pida.
 */
export const PricingSizeBandSchema = z.strictObject({
  /** Tope del tramo en pies cuadrados, inclusive. */
  maxSquareFeet: z.int().min(1).max(MAX_PIES),

  /** Profunda, mudanza de entrada y mudanza de salida. Siempre puntual. */
  deepCents: z.int().min(0).max(MAX_CENTS),

  /** Estandar contratada una vez al mes. */
  standardMonthlyCents: z.int().min(0).max(MAX_CENTS),
  /** Estandar cada dos semanas. */
  standardBiweeklyCents: z.int().min(0).max(MAX_CENTS),
  /** Estandar cada semana. */
  standardWeeklyCents: z.int().min(0).max(MAX_CENTS),

  /**
   * El extra de ventanas y gabinetes interiores, que tambien crece con la
   * casa. Horno y nevera no estan aqui porque son planos: limpiar un horno
   * cuesta lo mismo en un apartamento que en una mansion.
   */
  windowsAndCabinetsCents: z.int().min(0).max(MAX_CENTS),
});
export type PricingSizeBand = z.infer<typeof PricingSizeBandSchema>;

/**
 * La tabla entera.
 *
 * ========================================================================
 * LAS DOS UNICAS INVARIANTES, Y POR QUE NO HAY UNA TERCERA
 * ========================================================================
 * 1. Los tramos van en orden y sin repetirse. Sin esto la busqueda del
 *    tramo daria resultados distintos segun como estuviera ordenada la
 *    tabla, que es la clase de fallo que nadie encuentra.
 *
 * 2. Mas compromiso no cuesta mas: semanal <= quincenal <= mensual, dentro
 *    de cada tramo. Es la promesa comercial de la empresa, y al reves seria
 *    castigar al cliente que mas se compromete.
 *
 * NO SE EXIGE QUE EL PRECIO SUBA CON EL TAMANO, y no es un olvido: LA TABLA
 * REAL DEL CLIENTE NO LO CUMPLE. En su hoja, la estandar mensual de 900
 * pies cuesta 160 $ y la de 1.200 cuesta 150 $ —la casa mas grande es mas
 * barata—. Parece una errata suya, pero no es nuestra para corregirla en
 * silencio: una invariante asi rechazaria sus propios precios y le
 * impediria guardarlos desde el panel.
 */
export const PricingSizeBandsSchema = z
  .array(PricingSizeBandSchema)
  .min(1)
  .max(80)
  .superRefine((bandas, ctx) => {
    for (let i = 1; i < bandas.length; i += 1) {
      const actual = bandas[i];
      const anterior = bandas[i - 1];
      if (!actual || !anterior) continue;

      if (actual.maxSquareFeet <= anterior.maxSquareFeet) {
        ctx.addIssue({
          code: 'custom',
          path: [i, 'maxSquareFeet'],
          /*
           * CLAVE DE TRADUCCION, NO TEXTO. Los mensajes de este contrato se
           * ensenan tal cual en la pantalla de Tarifas, y el panel es
           * bilingue: un literal en castellano saldria en castellano a quien
           * tiene el panel en ingles.
           */
          message: 'admin.rates.errBandOrder',
        });
      }
    }

    bandas.forEach((banda, i) => {
      if (
        banda.standardWeeklyCents > banda.standardBiweeklyCents ||
        banda.standardBiweeklyCents > banda.standardMonthlyCents
      ) {
        ctx.addIssue({
          code: 'custom',
          path: [i],
          message: 'admin.rates.errFrequencyOrder',
        });
      }
    });
  });

/**
 * El tramo que le toca a una casa, o `null` si se sale de la tabla.
 *
 * `null` NO ES UN ERROR: significa «esta casa no se tarifa sola», y quien
 * llama debe tratarlo como el caso de la zona lejana —se recoge la solicitud
 * y el precio se da despues—, nunca como un fallo.
 *
 * Una casa mas pequena que el primer tramo SI entra: paga el primero, que es
 * el minimo de la tabla. Lo que no se puede hacer es inventar precios por
 * encima del ultimo.
 */
export function sizeBandFor(
  bandas: readonly PricingSizeBand[],
  squareFeet: number,
): PricingSizeBand | null {
  /*
   * El primero cuyo tope alcanza. Depende de que la tabla este ordenada, y
   * de eso se encarga la invariante del esquema: una tabla desordenada no se
   * puede guardar.
   */
  return bandas.find((banda) => squareFeet <= banda.maxSquareFeet) ?? null;
}

/** El tamano maximo que la tabla sabe tarifar. */
export function maxPricedSquareFeet(bandas: readonly PricingSizeBand[]): number {
  return bandas[bandas.length - 1]?.maxSquareFeet ?? 0;
}
