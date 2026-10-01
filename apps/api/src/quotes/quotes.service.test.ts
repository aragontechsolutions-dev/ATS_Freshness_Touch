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

    /*
     * 16000 la estandar quincenal de una casa de 1.800 pies —la fila de
     * 1.800 de la tabla— mas 5000 el horno. El traslado no suma: 12 millas
     * caen dentro de las 35 incluidas.
     */
    expect(quote.totals.totalCents).toBe(21_000);
    expect(quote.distance.zone).toBe('A');
    expect(quote.travel.amountCents).toBe(0);
    // La garantia es fija y sale del total, no se suma a el.
    expect(quote.deposit.amountCents).toBe(3500);
    // 21000 el total menos los 3500 de la garantia.
    expect(quote.balanceDueAtServiceCents).toBe(17_500);
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

    expect(quote.distance.zone).toBe('C');
    expect(quote.manualReview.required).toBe(true);
    expect(quote.manualReview.reasonKeys).toContain('quote.review.farZone');
    expect(quote.totals.totalCents).toBe(0);
  });

  it('pasadas las 35 millas el traslado se cobra, ida y vuelta', async () => {
    // 50 millas: 15 de exceso, 30 facturables a 76 centavos = 22,80 $.
    const service = new QuotesService(fakeDistance(50), fakePricing);
    const quote = await service.estimate(request, new Date('2026-09-20T12:00:00Z'));

    expect(quote.distance.zone).toBe('B');
    expect(quote.travel.billableMiles).toBe(30);
    expect(quote.travel.amountCents).toBe(2280);
    expect(quote.totals.surchargesCents).toBe(2280);
    expect(quote.totals.totalCents).toBe(21_000 + 2280);
    // La garantia no crece con el viaje: sigue siendo la misma cifra fija.
    expect(quote.deposit.amountCents).toBe(3500);
  });

  it('publica un catalogo coherente con el motor de precios', async () => {
    const service = new QuotesService(fakeDistance(12), fakePricing);
    const catalog = await service.getCatalog(new Date('2026-09-20T12:00:00Z'));

    expect(catalog.baseOfOperations.city).toBe('Atlanta');
    /*
     * TRES, no seis: desde la etapa 3.4 la post-obra, el cambio de Airbnb y
     * el comercial no se ofrecen, y el catalogo no publica lo que no se
     * puede contratar.
     */
    expect(catalog.services).toHaveLength(3);
    expect(catalog.addOns.length).toBeGreaterThan(0);
    expect(catalog.tax.exempt).toBe(true);
    expect(catalog.deposit.amountCents).toBe(3500);

    /*
     * El catalogo resuelve la tarifa por milla antes de publicarla: el sitio
     * no tiene por que saber que detras hay una tabla del IRS con fechas de
     * vigencia, solo cuanto cuesta la milla hoy.
     */
    expect(catalog.travel.freeRadiusMiles).toBe(35);
    expect(catalog.travel.centsPerMile).toBe(76);
  });
});
