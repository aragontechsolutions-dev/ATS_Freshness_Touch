import type {
  QuoteDistance,
  QuoteLine,
  QuoteRequest,
  QuoteResponse,
  QuoteTotals,
} from '@freshness/types';
import { defaultPricingConfig, type PricingConfig } from './config';
import { calculateDeposit } from './deposit';
import { percentOfCents, roundCents } from './money';
import { calculateTravel } from './travel';
import { resolveZone } from './zones';

/** Datos que el motor NO calcula: se los inyecta quien lo llama (API). */
export interface QuoteContext {
  /** Identificador del presupuesto (uuid). Se inyecta para que el motor sea puro. */
  quoteId: string;
  /** Momento de emision. Se inyecta para poder testear con fechas fijas. */
  now: Date;
  /** Distancia ya resuelta por el proveedor correspondiente. */
  distance: Omit<QuoteDistance, 'zone'>;
  config?: PricingConfig;
}

const DISCLAIMERS = {
  estimate: 'quote.disclaimer.estimate',
  deposit: 'quote.disclaimer.deposit',
  taxExempt: 'quote.disclaimer.taxExempt',
  validity: 'quote.disclaimer.validity',
  distanceEstimated: 'quote.disclaimer.distanceEstimated',
} as const;

const MANUAL_REVIEW_REASONS = {
  commercial: 'quote.review.commercialWalkthrough',
  outOfRange: 'quote.review.outOfServiceArea',
  /**
   * Se atiende, pero tan lejos que el precio se da en persona.
   *
   * Es distinto de `outOfRange` y la diferencia le importa mucho a quien lo
   * lee: «no vamos» y «vamos, te llamamos con el precio» son dos respuestas
   * opuestas para el cliente.
   */
  farZone: 'quote.review.farZone',
  outOfState: 'quote.review.outOfState',
  largeProperty: 'quote.review.largeProperty',
  /**
   * El servicio existe, pero no en esa cadencia.
   *
   * Una limpieza profunda no se contrata cada semana: la casa ya esta
   * profunda. Es distinto de «este servicio no tiene precio automatico», y
   * la diferencia le importa a quien lo lee: aqui la salida es elegir otra
   * frecuencia, no esperar una llamada.
   */
  frequencyUnavailable: 'quote.review.frequencyUnavailable',
} as const;

/**
 * Calcula un presupuesto completo. Funcion PURA: mismas entradas => misma
 * salida. No accede a red, reloj ni base de datos.
 *
 * Orden de calculo (importa para el resultado):
 *   1. Servicio, segun cadencia: el mayor entre el importe plano y el
 *      precio por pie cuadrado.
 *   2. Extras.
 *   3. Traslado: las millas que pasan del radio libre, ida y vuelta.
 *   4. Impuesto (0 en Georgia para servicios de limpieza).
 *   5. Deposito: una cifra fija, acotada al total.
 *
 * YA NO HAY PASO DE DESCUENTO. La recurrencia dejo de ser un porcentaje
 * sobre el precio puntual y paso a ser su propia tarifa: se anuncia «120 a
 * la semana», no «185 menos un 35%».
 */
export function calculateQuote(request: QuoteRequest, context: QuoteContext): QuoteResponse {
  const config = context.config ?? defaultPricingConfig;
  const service = config.services[request.service];
  const zone = resolveZone(context.distance.miles, config);

  const lines: QuoteLine[] = [];
  const manualReviewReasons: string[] = [];

  /*
   * La tarifa de ESTA cadencia. `null` significa que el servicio no se
   * ofrece asi, que no es lo mismo que no tener precio automatico.
   */
  const rate = service.byFrequency[request.frequency];

  if (!service.instantQuote) {
    manualReviewReasons.push(MANUAL_REVIEW_REASONS.commercial);
  } else if (rate === null) {
    manualReviewReasons.push(MANUAL_REVIEW_REASONS.frequencyUnavailable);
  }
  if (!zone.serviceable) {
    manualReviewReasons.push(MANUAL_REVIEW_REASONS.outOfRange);
  } else if (!zone.instantQuote) {
    // `else if`: o no se atiende, o se atiende sin precio. Las dos cosas a la
    // vez no significan nada, y decirselas juntas a un cliente menos.
    manualReviewReasons.push(MANUAL_REVIEW_REASONS.farZone);
  }
  if (request.destination.state !== config.baseOfOperations.state) {
    manualReviewReasons.push(MANUAL_REVIEW_REASONS.outOfState);
  }
  if (request.squareFeet > config.manualReviewSquareFeetThreshold) {
    manualReviewReasons.push(MANUAL_REVIEW_REASONS.largeProperty);
  }

  /*
   * Hacen falta las tres. `zone.instantQuote` es la nueva: permite cubrir
   * todo Georgia sin que el cotizador suelte una cifra para un traslado de
   * ocho horas que nadie ha calculado.
   */
  const quotable = service.instantQuote && rate !== null && zone.serviceable && zone.instantQuote;

  // --- 1. Servicio ----------------------------------------------------------
  let serviceCents = 0;
  if (quotable && rate !== null) {
    /*
     * EL MAYOR DE LOS DOS, no un umbral por tamano. Con un umbral —«hasta
     * 809 pies lo plano, por encima por pie»— aparece un escalon hacia
     * abajo: a 810 pies saldrian 243 $ y a 809, 250 $. Siete dolares mas
     * barata la casa mas grande, y nadie sabria explicarlo por telefono.
     */
    const porTamano =
      rate.centsPerSquareFoot === null
        ? 0
        : roundCents(rate.centsPerSquareFoot * request.squareFeet);
    const computed = Math.max(rate.flatCents, porTamano);

    lines.push({
      code: `SERVICE_${request.service}`,
      kind: 'SERVICE_BASE',
      labelKey: `quote.line.service.${request.service}`,
      /*
       * SOLO LO QUE ENTRA EN EL PRECIO. Las habitaciones y los banos no lo
       * mueven, asi que nombrarlos en la linea haria creer que si: quien lee
       * «3 hab / 2 banos · 185 $» da por hecho que con cuatro costaria mas.
       */
      labelParams: {
        squareFeet: request.squareFeet,
        frequency: request.frequency,
      },
      quantity: 1,
      unitAmountCents: computed,
      amountCents: computed,
    });
    serviceCents = computed;
  }

  // --- 2. Extras ------------------------------------------------------------
  let addOnsCents = 0;
  if (quotable) {
    for (const requested of request.addOns) {
      const extra = config.addOns[requested.code];
      /*
       * UN EXTRA RETIRADO NO SE COBRA, aunque venga en la peticion. Su
       * codigo sigue existiendo para poder releer presupuestos antiguos, y
       * sin esta linea alguien podria pedir por la API algo que el sitio ya
       * no ofrece —y que quiza el equipo ya no sabe hacer—.
       */
      if (!extra.offered) continue;

      const quantity = extra.unit === 'FLAT' ? 1 : Math.min(requested.quantity, extra.maxQuantity);
      const amount = extra.unitAmountCents * quantity;

      lines.push({
        code: `ADDON_${requested.code}`,
        kind: 'ADD_ON',
        labelKey: `quote.line.addOn.${requested.code}`,
        labelParams: { quantity },
        quantity,
        unitAmountCents: extra.unitAmountCents,
        amountCents: amount,
      });
      addOnsCents += amount;
    }
  }

  // --- 3. Traslado ----------------------------------------------------------
  /*
   * SE CALCULA SIEMPRE, tambien cuando no hay precio automatico: el desglose
   * sirve para que quien cotice a mano sepa cuantas millas se cobran.
   */
  const travel = calculateTravel(context.distance.miles, config, context.now);

  let surchargesCents = 0;
  if (quotable && travel.amountCents > 0) {
    surchargesCents = travel.amountCents;
    lines.push({
      code: 'TRAVEL_SURCHARGE',
      kind: 'SURCHARGE',
      labelKey: 'quote.line.travel',
      labelParams: {
        miles: Math.round(context.distance.miles),
        freeRadius: travel.freeRadiusMiles,
        billableMiles: travel.billableMiles,
      },
      quantity: 1,
      unitAmountCents: travel.amountCents,
      amountCents: travel.amountCents,
    });
  }

  /*
   * El descuento desaparece del calculo pero NO del contrato: los totales
   * lo siguen declarando en cero para que un presupuesto antiguo y uno
   * nuevo tengan la misma forma y se puedan comparar.
   */
  const discountCents = 0;

  // --- 4. Impuesto ----------------------------------------------------------
  const taxableCents = serviceCents + addOnsCents + surchargesCents - discountCents;
  const taxCents = config.taxExempt ? 0 : percentOfCents(taxableCents, config.taxRatePercent);
  if (taxCents > 0) {
    lines.push({
      code: 'SALES_TAX',
      kind: 'TAX',
      labelKey: 'quote.line.salesTax',
      labelParams: { percent: config.taxRatePercent },
      quantity: 1,
      unitAmountCents: taxCents,
      amountCents: taxCents,
    });
  }

  const totalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);

  const totals: QuoteTotals = {
    serviceCents,
    addOnsCents,
    surchargesCents,
    discountCents,
    taxCents,
    totalCents: Math.max(0, totalCents),
  };

  // --- 5. Deposito ----------------------------------------------------------
  /*
   * Sin precio automatico no hay nada que retener: no se sabe cuanto cuesta
   * el trabajo, asi que retener contra el no significa nada.
   */
  const deposit = quotable
    ? calculateDeposit(totals.totalCents, config)
    : { amountCents: 0, capped: false, appliedToTotal: true as const };

  const disclaimerKeys: string[] = [
    DISCLAIMERS.estimate,
    DISCLAIMERS.deposit,
    DISCLAIMERS.validity,
  ];
  if (config.taxExempt) {
    disclaimerKeys.push(DISCLAIMERS.taxExempt);
  }
  if (context.distance.estimated) {
    disclaimerKeys.push(DISCLAIMERS.distanceEstimated);
  }

  const expiresAt = new Date(context.now.getTime() + config.validityDays * 24 * 60 * 60 * 1000);

  return {
    quoteId: context.quoteId,
    generatedAt: context.now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    currency: config.currency,
    locale: request.locale,
    input: {
      service: request.service,
      frequency: request.frequency,
      squareFeet: request.squareFeet,
      destination: request.destination,
    },
    distance: { ...context.distance, zone: zone.code },
    lines,
    totals,
    tax: {
      ratePercent: config.taxRatePercent,
      exempt: config.taxExempt,
      reasonKey: config.taxReasonKey,
    },
    deposit,
    travel,
    balanceDueAtServiceCents: totals.totalCents - deposit.amountCents,
    manualReview: {
      required: manualReviewReasons.length > 0,
      reasonKeys: manualReviewReasons,
    },
    disclaimerKeys,
  };
}
