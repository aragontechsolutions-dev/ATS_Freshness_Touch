import { z } from 'zod';
import { QuoteAddOnInputSchema } from './quote';

/**
 * EL AJUSTE DE CAMPO
 * ==================
 * Lo que el equipo encuentra al llegar no siempre es lo que el cliente
 * reservó. Una casa de «900 pies» que son 1.300. Un «limpiar el horno» que
 * son tres neveras. No siempre es mala fe —mucha gente no sabe cuántos pies
 * cuadrados tiene su casa— pero el trabajo es otro, y hoy no hay forma de
 * decirlo.
 *
 * ========================================================================
 * LA DECISION QUE SOSTIENE TODO: EL AJUSTE NO CAMBIA LA RESERVA
 * ========================================================================
 * Lo que el líder manda es LO QUE ENCONTRO, no un precio nuevo. Queda como
 * una propuesta colgada de la reserva, con la diferencia ya calculada, y la
 * reserva SIGUE INTACTA hasta que coordinación la aprueba desde el panel.
 *
 * Las tres razones, por orden de peso:
 *
 *   1. EL CERO DE MAS. Teclear 13000 donde iban 1300 es el error más
 *      probable de toda esta pantalla, y se teclea de pie, con una mano. Si
 *      re-tarifara solo, ese error sería la factura del cliente.
 *   2. NADIE HA HABLADO CON EL CLIENTE. Subirle el precio sin avisar es la
 *      forma más rápida de perderlo, y de que la discusión acabe costando
 *      más que la diferencia.
 *   3. EL PRECIO PACTADO ES UNA FOTOGRAFIA, y hasta hoy no había en todo el
 *      sistema un solo sitio capaz de moverla. Que el primero sea el móvil
 *      de quien está en la puerta, sin revisión, sería invertir el orden de
 *      las cautelas.
 *
 * El trabajo, mientras tanto, se hace igual. El ajuste no bloquea nada.
 */

/**
 * En qué estado está una propuesta.
 *
 * `SUPERSEDED` existe porque el líder puede corregirse: si manda una segunda
 * propuesta, la primera no se borra —era lo que creyó ver, y eso también es
 * información— sino que queda sustituida. Borrarla dejaría un hueco donde
 * antes había una cifra, que es justo lo que no se quiere al revisar algo.
 */
export const FIELD_ADJUSTMENT_STATES = ['PROPOSED', 'APPLIED', 'REJECTED', 'SUPERSEDED'] as const;
export const FieldAdjustmentStateSchema = z.enum(FIELD_ADJUSTMENT_STATES);
export type FieldAdjustmentState = z.infer<typeof FieldAdjustmentStateSchema>;

/**
 * LO QUE EL LIDER PUEDE CORREGIR.
 *
 * ========================================================================
 * EL TIPO DE SERVICIO NO ESTA AQUI, Y NO ES UN OLVIDO
 * ========================================================================
 * Convertir una estándar en profunda es el cambio más caro del catálogo —de
 * 120 a 250 $ o más— y además CAMBIARIA LA LISTA DE TAREAS BAJO LOS PIES DEL
 * EQUIPO a media limpieza, porque la lista sale del servicio de la reserva.
 * Esa conversación la tiene coordinación con el cliente, no se decide en una
 * puerta.
 *
 * Tampoco están la fecha, la dirección ni el cliente: nada de eso se
 * «encuentra» al llegar a una casa.
 *
 * TODOS LOS CAMPOS SON OPCIONALES y significan «esto es distinto de lo
 * contratado». Lo que no se manda se queda como estaba: un líder que solo
 * corrige los pies cuadrados no tiene que repetir el resto.
 */
export const FieldAdjustmentInputSchema = z
  .strictObject({
    /** Los pies cuadrados de verdad. Mismos topes que al reservar. */
    squareFeet: z.int().min(200).max(20000).optional(),
    bedrooms: z.int().min(0).max(12).optional(),
    bathrooms: z.int().min(0).max(12).optional(),

    /**
     * Los extras tal como son de verdad, LA LISTA ENTERA y no un parche.
     *
     * Es la misma decisión que el equipo de un trabajo: se manda el conjunto
     * porque «quitar un extra» y «no mencionarlo» son indistinguibles en un
     * parche, y esa ambigüedad acaba cobrando algo que nadie pidió.
     */
    addOns: z.array(QuoteAddOnInputSchema).max(20).optional(),

    /**
     * Por qué. Lo lee una persona que no estuvo allí y que va a tener que
     * llamar al cliente: sin esto, un «1.300» a secas no se puede defender
     * por teléfono.
     */
    note: z.string().trim().min(1).max(1000),
  })
  .refine(
    (value) =>
      value.squareFeet !== undefined ||
      value.bedrooms !== undefined ||
      value.bathrooms !== undefined ||
      value.addOns !== undefined,
    {
      /*
       * Una propuesta que no corrige nada es solo una nota, y para eso no
       * hace falta mover un precio ni avisar a coordinación.
       */
      message: 'admin.errorAdjustmentEmpty',
      path: ['squareFeet'],
    },
  )
  .refine(
    (value) => new Set(value.addOns?.map((a) => a.code) ?? []).size === (value.addOns?.length ?? 0),
    {
      message: 'No se puede repetir el mismo extra',
      path: ['addOns'],
    },
  );
export type FieldAdjustmentInput = z.infer<typeof FieldAdjustmentInputSchema>;

/** Lo contratado y lo encontrado, lado a lado. Es como se lee una propuesta. */
export const FieldAdjustmentValuesSchema = z.strictObject({
  squareFeet: z.int(),
  bedrooms: z.int(),
  bathrooms: z.int(),
  addOns: z.array(QuoteAddOnInputSchema),
});
export type FieldAdjustmentValues = z.infer<typeof FieldAdjustmentValuesSchema>;

/**
 * Una propuesta, tal como se lee.
 *
 * LLEVA LAS DOS COLUMNAS —lo contratado y lo encontrado— Y NO SOLO LO NUEVO.
 * Quien decide necesita ver el salto, no el destino: «1.300» no dice nada;
 * «900 → 1.300» dice que alguien se equivocó en 400 pies, y «900 → 13.000»
 * dice que alguien se comió una tecla.
 */
export const FieldAdjustmentSchema = z.strictObject({
  id: z.uuid(),
  state: FieldAdjustmentStateSchema,

  /** Lo que decía la reserva cuando se propuso el ajuste. */
  booked: FieldAdjustmentValuesSchema,
  /** Lo que el equipo encontró. */
  found: FieldAdjustmentValuesSchema,

  note: z.string(),

  /** Quién lo propuso, por su nombre de pila, y cuándo. */
  proposedByFirstName: z.string(),
  proposedAt: z.iso.datetime(),

  /**
   * LA DIFERENCIA, EN CENTAVOS. Positiva si el trabajo sale más caro.
   *
   * `null` cuando no se puede calcular: una casa por encima del último tramo
   * de la tabla no tiene precio automático (`pricing-size-bands.ts`), y
   * entonces el importe lo pone coordinación a mano. No es un error, y por
   * eso no es un cero: un cero diría «no cambia nada», que es lo contrario.
   */
  differenceCents: z.int().nullable(),
  /** El total que tendría la reserva si se aprueba. `null` por lo mismo. */
  newTotalCents: z.int().nullable(),

  /**
   * POR QUE no hay precio automático, cuando no lo hay.
   *
   * ========================================================================
   * SIETE MOTIVOS, Y CASI NUNCA ES EL TAMAÑO
   * ========================================================================
   * El motor se niega a dar precio por zona lejana, fuera de Georgia, casa
   * por encima de la tabla, cadencia que ese servicio no ofrece, comercial,
   * fuera del área o propiedad grande. La primera versión del panel los
   * juntaba todos en «este tamaño no tiene precio automático».
   *
   * **Casi nunca es el tamaño.** El más frecuente con diferencia es la ZONA:
   * fuera de las 35 millas del área metropolitana, Georgia entera se atiende
   * sin precio automático por diseño (`docs/17-area-de-servicio.md`). Decirle
   * a quien decide que el problema es el tamaño le hace buscar donde no es.
   *
   * Es una clave de traducción, no una frase.
   */
  noPriceReason: z.string().nullable(),

  /**
   * Si el total lo TECLEO una persona en vez de calcularlo el motor.
   *
   * Se marca porque un total calculado y uno tecleado valen lo mismo en la
   * factura y NO valen lo mismo al revisar las cuentas de un mes: ante un
   * importe raro, lo primero que se pregunta es si lo puso el sistema o
   * alguien.
   */
  manualPrice: z.boolean(),

  /** Quién resolvió y cuándo, si ya está resuelta. */
  resolvedByFirstName: z.string().nullable(),
  resolvedAt: z.iso.datetime().nullable(),
  /** Por qué se rechazó. Solo en `REJECTED`. */
  resolutionNote: z.string().nullable(),
});
export type FieldAdjustment = z.infer<typeof FieldAdjustmentSchema>;

/**
 * LA MISMA PROPUESTA, TAL COMO LA VE EL EQUIPO DE LIMPIEZA: SIN IMPORTES.
 *
 * ========================================================================
 * NO ES UNA SIMPLIFICACION, ES LA REGLA DE `my-jobs.ts` APLICADA AQUI
 * ========================================================================
 * La pantalla de limpieza no lleva NINGUN importe —ni total, ni depósito, ni
 * desglose— y el motivo está escrito desde la Etapa 2: saber lo que paga cada
 * casa es como empiezan las comparaciones entre compañeros y las
 * conversaciones con el cliente que no tocan.
 *
 * Un ajuste de campo es justo el sitio donde esa regla más falta hace. Si el
 * responsable viera «+40 $» al reportar que la casa es más grande, la
 * siguiente frase previsible en esa puerta es «esto le va a costar cuarenta
 * dólares más», dicha por quien no decide los precios y antes de que nadie lo
 * haya aprobado.
 *
 * Así que reporta lo que ve, y lo que cuesta lo dice coordinación. El
 * contrato lo hace imposible de otra forma: aquí no hay donde poner una
 * cifra.
 */
export const MyJobAdjustmentSchema = z.strictObject({
  id: z.uuid(),
  state: FieldAdjustmentStateSchema,
  booked: FieldAdjustmentValuesSchema,
  found: FieldAdjustmentValuesSchema,
  note: z.string(),
  proposedByFirstName: z.string(),
  proposedAt: z.iso.datetime(),
  /** Si se resolvió, cuándo. El importe no, y quién tampoco hace falta. */
  resolvedAt: z.iso.datetime().nullable(),
  /**
   * El motivo del rechazo SI llega al equipo, y es lo más importante de esta
   * pantalla: un rechazo mudo enseña a no volver a reportar nada.
   */
  resolutionNote: z.string().nullable(),
});
export type MyJobAdjustment = z.infer<typeof MyJobAdjustmentSchema>;

/** Quita los importes de una propuesta para mandársela al equipo. */
export function toMyJobAdjustment(ajuste: FieldAdjustment): MyJobAdjustment {
  return {
    id: ajuste.id,
    state: ajuste.state,
    booked: ajuste.booked,
    found: ajuste.found,
    note: ajuste.note,
    proposedByFirstName: ajuste.proposedByFirstName,
    proposedAt: ajuste.proposedAt,
    resolvedAt: ajuste.resolvedAt,
    resolutionNote: ajuste.resolutionNote,
  };
}

/** Lo que coordinación manda al resolver una propuesta. */
export const FieldAdjustmentDecisionSchema = z.strictObject({
  approve: z.boolean(),
  /**
   * Obligatorio al rechazar, y es deliberado: un rechazo sin motivo deja al
   * equipo sin saber si se equivocó al medir o si la empresa decidió comerse
   * la diferencia, y la próxima vez no lo reportará.
   */
  note: z.string().trim().max(1000).optional(),

  /**
   * EL TOTAL NUEVO, TECLEADO A MANO.
   *
   * ========================================================================
   * SOLO CUANDO EL MOTOR NO PUEDE DAR PRECIO, Y SOLO ADMINISTRACION
   * ========================================================================
   * Existe porque hay trabajos que NUNCA tendrán precio automático: todo lo
   * que está fuera de las 35 millas del área metropolitana —o sea, casi toda
   * Georgia— se atiende sin cotización automática por diseño. Sin esto, un
   * ajuste en una casa de Gainesville se queda sin poder resolverse para
   * siempre.
   *
   * El servidor lo RECHAZA cuando sí hay precio automático: dejar teclear un
   * importe encima del que calcula el motor convertiría la tabla de precios
   * en una sugerencia, y entonces dos casas iguales podrían costar cosas
   * distintas según quién aprobara el ajuste.
   *
   * El tope de 100.000 $ no es un límite de negocio: es el techo de cordura
   * que impide que un cero de más al teclear se convierta en la factura.
   */
  newTotalCents: z.int().min(0).max(10_000_000).optional(),
});
export type FieldAdjustmentDecision = z.infer<typeof FieldAdjustmentDecisionSchema>;

/** Si una propuesta necesita que alguien teclee el importe. */
export function needsManualPrice(ajuste: FieldAdjustment): boolean {
  return ajuste.state === 'PROPOSED' && ajuste.newTotalCents === null;
}

/** Si una propuesta sigue esperando decisión. */
export function isOpenAdjustment(ajuste: FieldAdjustment): boolean {
  return ajuste.state === 'PROPOSED';
}

/**
 * Si lo encontrado difiere de lo contratado en algo.
 *
 * Se usa para no guardar propuestas que no proponen nada: el líder abre la
 * pantalla, mira, ve que está todo bien y la cierra. Eso no es un ajuste.
 */
export function differsFromBooked(
  booked: FieldAdjustmentValues,
  found: FieldAdjustmentValues,
): boolean {
  if (
    booked.squareFeet !== found.squareFeet ||
    booked.bedrooms !== found.bedrooms ||
    booked.bathrooms !== found.bathrooms
  ) {
    return true;
  }

  return !mismosExtras(booked.addOns, found.addOns);
}

/** Dos listas de extras son iguales si tienen los mismos códigos y cantidades. */
function mismosExtras(
  a: readonly { code: string; quantity: number }[],
  b: readonly { code: string; quantity: number }[],
): boolean {
  if (a.length !== b.length) return false;

  const porCodigo = new Map(a.map((extra) => [extra.code, extra.quantity]));
  return b.every((extra) => porCodigo.get(extra.code) === extra.quantity);
}
