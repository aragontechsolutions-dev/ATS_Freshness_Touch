import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { CatalogResponse, QuoteRequest, QuoteResponse } from '@freshness/types';
import { buildCatalog, calculateQuote } from '@freshness/pricing';
import { DistanceService } from '../distance/distance.service';
import { PricingConfigService } from '../settings/pricing-config.service';

/**
 * Orquesta una cotizacion: resuelve la distancia y aplica el motor de precios.
 *
 * El calculo vive SIEMPRE en el servidor. El navegador solo muestra el
 * resultado: si los precios se calcularan en el front, cualquiera podria
 * manipularlos desde las herramientas de desarrollo antes de reservar.
 */
@Injectable()
export class QuotesService {
  constructor(
    private readonly distance: DistanceService,
    /*
     * La configuracion se pide EN CADA LLAMADA, no una vez al arrancar. El
     * area de servicio se edita desde el panel, y guardarla en el
     * constructor significaria que un cambio no se ve hasta reiniciar el
     * servidor. La cache del area evita que esto cueste una consulta.
     */
    private readonly pricing: PricingConfigService,
  ) {}

  async estimate(request: QuoteRequest, now: Date = new Date()): Promise<QuoteResponse> {
    const distance = await this.distance.resolve(
      request.destination.postalCode,
      request.destination.state,
    );

    return calculateQuote(request, {
      quoteId: randomUUID(),
      now,
      distance,
      config: await this.pricing.current(),
    });
  }

  async getCatalog(now: Date = new Date()): Promise<CatalogResponse> {
    return buildCatalog(now, await this.pricing.current());
  }
}
