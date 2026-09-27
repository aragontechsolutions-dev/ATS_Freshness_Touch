import { describe, expect, it } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { QuoteRequest } from '@freshness/types';
import type { Env } from '../common/config/env';
import type { DistanceService, ResolvedDistance } from '../distance/distance.service';
import { buildPricingConfig } from '../common/pricing-config';
import type { PricingConfigService } from '../settings/pricing-config.service';
import { QuotesService } from './quotes.service';

const envValues: Partial<Record<keyof Env, unknown>> = {
  COMPANY_BASE_CITY: 'Atlanta',
  COMPANY_BASE_STATE: 'GA',
  COMPANY_BASE_POSTAL_CODE: '30303',
};

const fakeConfig = {
  get: (key: keyof Env) => envValues[key],
} as unknown as ConfigService<Env, true>;

/**
 * El area de servicio ya no esta escrita en el codigo: se lee de la base en
 * cada peticion. Aqui se dobla con la de partida, que es exactamente la que
 * habia antes en el archivo de tarifas, para que estas pruebas sigan
 * comprobando el motor y no el almacenamiento.
 */
const fakePricing = {
  current: () => Promise.resolve(buildPricingConfig(fakeConfig)),
} as unknown as PricingConfigService;

function fakeDistance(miles: number): DistanceService {
  return {
    resolve: async (): Promise<ResolvedDistance> => ({
      miles,
      durationMinutes: Math.round(miles * 1.7),
      provider: 'mock',
      estimated: true,
      cached: false,
    }),
  } as unknown as DistanceService;
}

const request: QuoteRequest = {
  service: 'STANDARD',
  frequency: 'BIWEEKLY',
  bedrooms: 3,
  bathrooms: 2,
  squareFeet: 1800,
  addOns: [{ code: 'INSIDE_OVEN', quantity: 1 }],
  destination: { postalCode: '30303', state: 'GA' },
  locale: 'en',
};

describe('QuotesService', () => {
  it('combina distancia y motor de precios en un presupuesto completo', async () => {
    const service = new QuotesService(fakeDistance(12), fakePricing);
    const quote = await service.estimate(request, new Date('2026-09-20T12:00:00Z'));

    // 18500 servicio + 3500 extra - 10% descuento = 19800
    expect(quote.totals.totalCents).toBe(19800);
    expect(quote.distance.zone).toBe('A');
    expect(quote.deposit.amountCents).toBe(3000);
    expect(quote.balanceDueAtServiceCents).toBe(16800);
  });

  it('genera un identificador distinto por presupuesto', async () => {
    const service = new QuotesService(fakeDistance(12), fakePricing);
    const first = await service.estimate(request);
    const second = await service.estimate(request);

    expect(first.quoteId).not.toBe(second.quoteId);
  });

  /*
   * A 95 millas ya NO se esta fuera de area: la empresa opera en todo
   * Georgia. Se atiende, pero el precio se da en persona.
   */
  it('a distancia larga se atiende sin precio automatico', async () => {
    const service = new QuotesService(fakeDistance(95), fakePricing);
    const quote = await service.estimate(request);

    expect(quote.distance.zone).toBe('E');
    expect(quote.manualReview.required).toBe(true);
    expect(quote.manualReview.reasonKeys).toContain('quote.review.farZone');
    expect(quote.totals.totalCents).toBe(0);
  });

  it('publica un catalogo coherente con el motor de precios', async () => {
    const service = new QuotesService(fakeDistance(12), fakePricing);
    const catalog = await service.getCatalog(new Date('2026-09-20T12:00:00Z'));

    expect(catalog.baseOfOperations.city).toBe('Atlanta');
    expect(catalog.services).toHaveLength(6);
    expect(catalog.addOns.length).toBeGreaterThan(0);
    expect(catalog.tax.exempt).toBe(true);
    expect(catalog.deposit.mileageRateCentsPerMile).toBe(76);
  });
});
