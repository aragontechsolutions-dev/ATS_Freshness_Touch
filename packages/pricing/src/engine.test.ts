import { describe, expect, it } from 'vitest';
import type { QuoteRequest } from '@freshness/types';
import { calculateQuote, type QuoteContext } from './engine';
import { defaultPricingConfig } from './config';

const NOW = new Date('2026-09-20T12:00:00.000Z');
const QUOTE_ID = '11111111-2222-4333-8444-555555555555';

function buildRequest(overrides: Partial<QuoteRequest> = {}): QuoteRequest {
  return {
    service: 'STANDARD',
    frequency: 'ONE_TIME',
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1800,
    addOns: [],
    destination: { postalCode: '30303', state: 'GA' },
    locale: 'en',
    ...overrides,
  };
}

function buildContext(miles: number, overrides: Partial<QuoteContext> = {}): QuoteContext {
  return {
    quoteId: QUOTE_ID,
    now: NOW,
    distance: {
      miles,
      durationMinutes: Math.round(miles * 1.8),
      provider: 'mock',
      estimated: true,
      cached: false,
    },
    ...overrides,
  };
}

describe('calculateQuote - servicio base', () => {
  it('calcula base + habitaciones + banos + pies cuadrados', () => {
    const quote = calculateQuote(buildRequest(), buildContext(10));

    // 6500 + 3*1200 + 2*1500 + 3.0*1800 = 18500 centavos = 185.00 USD
    expect(quote.totals.serviceCents).toBe(18500);
    expect(quote.totals.totalCents).toBe(18500);
    expect(quote.totals.taxCents).toBe(0);
  });

  it('aplica el minimo facturable con una linea de ajuste visible', () => {
    const quote = calculateQuote(
      buildRequest({ service: 'AIRBNB_TURNOVER', bedrooms: 0, bathrooms: 1, squareFeet: 200 }),
      buildContext(5),
    );

    // 5500 + 0 + 1500 + 2.2*200 = 7440 -> minimo 9000
    const adjustment = quote.lines.find((line) => line.code === 'SERVICE_MINIMUM_ADJUSTMENT');
    expect(adjustment?.amountCents).toBe(1560);
    expect(quote.totals.serviceCents).toBe(9000);
  });

  it('la suma de las lineas siempre cuadra con el total', () => {
    const quote = calculateQuote(
      buildRequest({
        service: 'DEEP',
        frequency: 'BIWEEKLY',
        addOns: [
          { code: 'INSIDE_OVEN', quantity: 1 },
          { code: 'INTERIOR_WINDOWS', quantity: 8 },
        ],
      }),
      buildContext(42),
    );

    const sum = quote.lines.reduce((acc, line) => acc + line.amountCents, 0);
    expect(sum).toBe(quote.totals.totalCents);
    expect(Number.isInteger(quote.totals.totalCents)).toBe(true);
  });
});

describe('calculateQuote - extras', () => {
  it('cobra los extras planos una sola vez aunque se pida mas cantidad', () => {
    const quote = calculateQuote(
      buildRequest({ addOns: [{ code: 'INSIDE_FRIDGE', quantity: 5 }] }),
      buildContext(10),
    );

    const line = quote.lines.find((item) => item.code === 'ADDON_INSIDE_FRIDGE');
    expect(line?.quantity).toBe(1);
    expect(quote.totals.addOnsCents).toBe(3500);
  });

  it('limita los extras por unidad a su cantidad maxima', () => {
    const quote = calculateQuote(
      buildRequest({ addOns: [{ code: 'INTERIOR_WINDOWS', quantity: 999 }] }),
      buildContext(10),
    );

    const line = quote.lines.find((item) => item.code === 'ADDON_INTERIOR_WINDOWS');
    expect(line?.quantity).toBe(defaultPricingConfig.addOns.INTERIOR_WINDOWS.maxQuantity);
    expect(line?.amountCents).toBe(40 * 600);
  });
});

describe('calculateQuote - descuento por recurrencia', () => {
  it('descuenta el porcentaje sobre servicio + extras', () => {
    const quote = calculateQuote(buildRequest({ frequency: 'WEEKLY' }), buildContext(10));

    // 15% de 18500 = 2775
    expect(quote.totals.discountCents).toBe(2775);
    expect(quote.totals.totalCents).toBe(18500 - 2775);
  });

  it('NO descuenta el recargo por desplazamiento', () => {
    const quote = calculateQuote(buildRequest({ frequency: 'WEEKLY' }), buildContext(45));

    // zona C: recargo 5000, que no entra en la base del descuento
    expect(quote.totals.discountCents).toBe(2775);
    expect(quote.totals.surchargesCents).toBe(5000);
    expect(quote.totals.totalCents).toBe(18500 - 2775 + 5000);
  });

  it('no genera linea de descuento en servicios puntuales', () => {
    const quote = calculateQuote(buildRequest({ frequency: 'ONE_TIME' }), buildContext(10));
    expect(quote.lines.some((line) => line.kind === 'DISCOUNT')).toBe(false);
  });
});

describe('calculateQuote - zonas y deposito', () => {
  it('zona A no tiene recargo y el deposito es solo la base', () => {
    const quote = calculateQuote(buildRequest(), buildContext(12));

    expect(quote.distance.zone).toBe('A');
    expect(quote.totals.surchargesCents).toBe(0);
    expect(quote.deposit.amountCents).toBe(3000);
    expect(quote.deposit.billableMiles).toBe(0);
  });

  it('zona C cobra recargo y deposito por millas (ida y vuelta, tarifa IRS)', () => {
    const quote = calculateQuote(buildRequest(), buildContext(45));

    // exceso 25 millas -> 50 millas ida y vuelta -> 3000 + 50*76 = 6800
    expect(quote.distance.zone).toBe('C');
    expect(quote.totals.surchargesCents).toBe(5000);
    expect(quote.deposit.billableMiles).toBe(50);
    expect(quote.deposit.mileageRateCentsPerMile).toBe(76);
    expect(quote.deposit.amountCents).toBe(6800);
  });

  it('el deposito nunca supera el total del trabajo', () => {
    const quote = calculateQuote(
      buildRequest({ service: 'AIRBNB_TURNOVER', bedrooms: 0, bathrooms: 1, squareFeet: 200 }),
      buildContext(55),
    );

    expect(quote.deposit.amountCents).toBeLessThanOrEqual(quote.totals.totalCents);
    expect(quote.balanceDueAtServiceCents).toBeGreaterThanOrEqual(0);
  });

  it('el saldo pendiente es siempre total menos deposito', () => {
    const quote = calculateQuote(buildRequest(), buildContext(45));
    expect(quote.balanceDueAtServiceCents).toBe(
      quote.totals.totalCents - quote.deposit.amountCents,
    );
  });
});

describe('calculateQuote - revision manual', () => {
  it('marca fuera de area y no cotiza mas alla del radio maximo', () => {
    const quote = calculateQuote(buildRequest(), buildContext(80));

    expect(quote.distance.zone).toBe('OUT_OF_RANGE');
    expect(quote.manualReview.required).toBe(true);
    expect(quote.manualReview.reasonKeys).toContain('quote.review.outOfServiceArea');
    expect(quote.totals.totalCents).toBe(0);
    expect(quote.deposit.amountCents).toBe(0);
    expect(quote.lines).toHaveLength(0);
  });

  it('el servicio comercial no recibe precio instantaneo', () => {
    const quote = calculateQuote(buildRequest({ service: 'COMMERCIAL' }), buildContext(10));

    expect(quote.manualReview.required).toBe(true);
    expect(quote.manualReview.reasonKeys).toContain('quote.review.commercialWalkthrough');
    expect(quote.totals.totalCents).toBe(0);
  });

  it('marca propiedades muy grandes para revision, pero igual las cotiza', () => {
    const quote = calculateQuote(buildRequest({ squareFeet: 9000 }), buildContext(10));

    expect(quote.manualReview.required).toBe(true);
    expect(quote.manualReview.reasonKeys).toContain('quote.review.largeProperty');
    expect(quote.totals.totalCents).toBeGreaterThan(0);
  });

  it('marca destinos fuera de Georgia', () => {
    const quote = calculateQuote(
      buildRequest({ destination: { postalCode: '35203', state: 'AL' } }),
      buildContext(10),
    );

    expect(quote.manualReview.reasonKeys).toContain('quote.review.outOfState');
  });
});

describe('calculateQuote - metadatos', () => {
  it('es exento de impuesto en Georgia', () => {
    const quote = calculateQuote(buildRequest(), buildContext(10));

    expect(quote.tax.exempt).toBe(true);
    expect(quote.tax.ratePercent).toBe(0);
    expect(quote.totals.taxCents).toBe(0);
    expect(quote.disclaimerKeys).toContain('quote.disclaimer.taxExempt');
  });

  it('caduca a los 7 dias', () => {
    const quote = calculateQuote(buildRequest(), buildContext(10));
    expect(quote.expiresAt).toBe('2026-09-27T12:00:00.000Z');
  });

  it('es determinista: las mismas entradas producen el mismo presupuesto', () => {
    const request = buildRequest({ frequency: 'MONTHLY' });
    const first = calculateQuote(request, buildContext(30));
    const second = calculateQuote(request, buildContext(30));
    expect(first).toEqual(second);
  });
});
