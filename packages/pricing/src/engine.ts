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
  outOfState: 'quote.review.outOfState',
  largeProperty: 'quote.review.largeProperty',
} as const;

/**
 * Calcula un presupuesto completo. Funcion PURA: mismas entradas => misma
 * salida. No accede a red, reloj ni base de datos.
 *
 * Orden de calculo (importa para el resultado):
 *   1. Servicio base (con ajuste al minimo facturable).
 *   2. Extras.
 *   3. Descuento por recurrencia, sobre servicio + extras (nunca sobre el
 *      recargo de desplazamiento: ese coste es real y no se descuenta).
 *   4. Recargo por zona.
 *   5. Impuesto (0 en Georgia para servicios de limpieza).
 *   6. Deposito por distancia, acotado ademas al total (nunca se retiene
 *      mas dinero del que cuesta el trabajo).
 */
export function calculateQuote(request: QuoteRequest, context: QuoteContext): QuoteResponse {
  const config = context.config ?? defaultPricingConfig;
  const service = config.services[request.service];
  const zone = resolveZone(context.distance.miles, config);

  const lines: QuoteLine[] = [];
  const manualReviewReasons: string[] = [];

  if (!service.instantQuote) {
    manualReviewReasons.push(MANUAL_REVIEW_REASONS.commercial);
  }
  if (!zone.serviceable) {
    manualReviewReasons.push(MANUAL_REVIEW_REASONS.outOfRange);
  }
  if (request.destination.state !== config.baseOfOperations.state) {
    manualReviewReasons.push(MANUAL_REVIEW_REASONS.outOfState);
  }
  if (request.squareFeet > config.manualReviewSquareFeetThreshold) {
    manualReviewReasons.push(MANUAL_REVIEW_REASONS.largeProperty);
  }

  const quotable = service.instantQuote && zone.serviceable;

  // --- 1. Servicio base -----------------------------------------------------
  let serviceCents = 0;
  if (quotable) {
    const computed = roundCents(
      service.baseCents +
        service.perBedroomCents * request.bedrooms +
        service.perBathroomCents * request.bathrooms +
        service.centsPerSquareFoot * request.squareFeet,
    );

    lines.push({
      code: `SERVICE_${request.service}`,
      kind: 'SERVICE_BASE',
      labelKey: `quote.line.service.${request.service}`,
      labelParams: {
        bedrooms: request.bedrooms,
        bathrooms: request.bathrooms,
        squareFeet: request.squareFeet,
      },
      quantity: 1,
      unitAmountCents: computed,
      amountCents: computed,
    });
    serviceCents = computed;

    if (computed < service.minimumCents) {
      const adjustment = service.minimumCents - computed;
      lines.push({
        code: 'SERVICE_MINIMUM_ADJUSTMENT',
        kind: 'SERVICE_BASE',
        labelKey: 'quote.line.minimumAdjustment',
        labelParams: { minimum: service.minimumCents / 100 },
        quantity: 1,
        unitAmountCents: adjustment,
        amountCents: adjustment,
      });
      serviceCents = service.minimumCents;
    }
  }

  // --- 2. Extras ------------------------------------------------------------
  let addOnsCents = 0;
  if (quotable) {
    for (const requested of request.addOns) {
      const rate = config.addOns[requested.code];
      const quantity = rate.unit === 'FLAT' ? 1 : Math.min(requested.quantity, rate.maxQuantity);
      const amount = rate.unitAmountCents * quantity;

      lines.push({
        code: `ADDON_${requested.code}`,
        kind: 'ADD_ON',
        labelKey: `quote.line.addOn.${requested.code}`,
        labelParams: { quantity },
        quantity,
        unitAmountCents: rate.unitAmountCents,
        amountCents: amount,
      });
      addOnsCents += amount;
    }
  }

  // --- 3. Descuento por recurrencia ----------------------------------------
  const discountPercent = quotable ? config.frequencyDiscountPercent[request.frequency] : 0;
  let discountCents = 0;
  if (discountPercent > 0) {
    discountCents = percentOfCents(serviceCents + addOnsCents, discountPercent);
    if (discountCents > 0) {
      lines.push({
        code: `DISCOUNT_${request.frequency}`,
        kind: 'DISCOUNT',
        labelKey: `quote.line.discount.${request.frequency}`,
        labelParams: { percent: discountPercent },
        quantity: 1,
        unitAmountCents: -discountCents,
        amountCents: -discountCents,
      });
    }
  }

  // --- 4. Recargo por zona --------------------------------------------------
  let surchargesCents = 0;
  if (quotable && zone.surchargeCents > 0) {
    surchargesCents = zone.surchargeCents;
    lines.push({
      code: `ZONE_SURCHARGE_${zone.code}`,
      kind: 'SURCHARGE',
      labelKey: 'quote.line.zoneSurcharge',
      labelParams: { zone: zone.code, miles: Math.round(context.distance.miles) },
      quantity: 1,
      unitAmountCents: zone.surchargeCents,
      amountCents: zone.surchargeCents,
    });
  }

  // --- 5. Impuesto ----------------------------------------------------------
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

  // --- 6. Deposito ----------------------------------------------------------
  const rawDeposit = calculateDeposit(context.distance.miles, config, context.now);
  const deposit = quotable
    ? {
        ...rawDeposit,
        // Nunca retener mas de lo que cuesta el trabajo.
        amountCents: Math.min(rawDeposit.amountCents, totals.totalCents),
        capped: rawDeposit.capped || rawDeposit.amountCents > totals.totalCents,
      }
    : { ...rawDeposit, amountCents: 0, capped: false };

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
      bedrooms: request.bedrooms,
      bathrooms: request.bathrooms,
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
    balanceDueAtServiceCents: totals.totalCents - deposit.amountCents,
    manualReview: {
      required: manualReviewReasons.length > 0,
      reasonKeys: manualReviewReasons,
    },
    disclaimerKeys,
  };
}
