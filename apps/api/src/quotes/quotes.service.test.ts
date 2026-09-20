import { describe, expect, it } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { QuoteRequest } from '@freshness/types';
import type { Env } from '../common/config/env';
import type { DistanceService, ResolvedDistance } from '../distance/distance.service';
import { QuotesService } from './quotes.service';

const envValues: Partial<Record<keyof Env, unknown>> = {
  COMPANY_BASE_CITY: 'Atlanta',
  COMPANY_BASE_STATE: 'GA',
  COMPANY_BASE_POSTAL_CODE: '30303',
};

const fakeConfig = {
  get: (key: keyof Env) => envValues[key],
} as unknown as ConfigService<Env, true>;

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
    const service = new QuotesService(fakeDistance(12), fakeConfig);
    const quote = await service.estimate(request, new Date('2026-09-20T12:00:00Z'));

    // 18500 servicio + 3500 extra - 10% descuento = 19800
    expect(quote.totals.totalCents).toBe(19800);
    expect(quote.distance.zone).toBe('A');
    expect(quote.deposit.amountCents).toBe(3000);
    expect(quote.balanceDueAtServiceCents).toBe(16800);
  });

  it('genera un identificador distinto por presupuesto', async () => {
    const service = new QuotesService(fakeDistance(12), fakeConfig);
    const first = await service.estimate(request);
    const second = await service.estimate(request);

    expect(first.quoteId).not.toBe(second.quoteId);
  });

  it('marca revision manual cuando el destino esta fuera del radio', async () => {
    const service = new QuotesService(fakeDistance(95), fakeConfig);
    const quote = await service.estimate(request);

    expect(quote.manualReview.required).toBe(true);
    expect(quote.totals.totalCents).toBe(0);
  });

  it('publica un catalogo coherente con el motor de precios', () => {
    const service = new QuotesService(fakeDistance(12), fakeConfig);
    const catalog = service.getCatalog(new Date('2026-09-20T12:00:00Z'));

    expect(catalog.baseOfOperations.city).toBe('Atlanta');
    expect(catalog.services).toHaveLength(6);
    expect(catalog.addOns.length).toBeGreaterThan(0);
    expect(catalog.tax.exempt).toBe(true);
    expect(catalog.deposit.mileageRateCentsPerMile).toBe(76);
  });
});
