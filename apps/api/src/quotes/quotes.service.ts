import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { CatalogResponse, QuoteRequest, QuoteResponse } from '@freshness/types';
import { buildCatalog, calculateQuote, type PricingConfig } from '@freshness/pricing';
import type { Env } from '../common/config/env';
import { buildPricingConfig } from '../common/pricing-config';
import { DistanceService } from '../distance/distance.service';

/**
 * Orquesta una cotizacion: resuelve la distancia y aplica el motor de precios.
 *
 * El calculo vive SIEMPRE en el servidor. El navegador solo muestra el
 * resultado: si los precios se calcularan en el front, cualquiera podria
 * manipularlos desde las herramientas de desarrollo antes de reservar.
 */
@Injectable()
export class QuotesService {
  private readonly pricingConfig: PricingConfig;

  constructor(
    private readonly distance: DistanceService,
    config: ConfigService<Env, true>,
  ) {
    this.pricingConfig = buildPricingConfig(config);
  }

  async estimate(request: QuoteRequest, now: Date = new Date()): Promise<QuoteResponse> {
    const distance = await this.distance.resolve(
      request.destination.postalCode,
      request.destination.state,
    );

    return calculateQuote(request, {
      quoteId: randomUUID(),
      now,
      distance,
      config: this.pricingConfig,
    });
  }

  getCatalog(now: Date = new Date()): CatalogResponse {
    return buildCatalog(now, this.pricingConfig);
  }
}
