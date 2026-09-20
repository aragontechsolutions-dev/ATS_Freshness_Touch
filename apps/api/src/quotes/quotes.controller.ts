import { Body, Controller, Get, HttpCode, HttpStatus, Post, UsePipes } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  QuoteRequestSchema,
  type CatalogResponse,
  type QuoteRequest,
  type QuoteResponse,
} from '@freshness/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { QuotesService } from './quotes.service';

@Controller()
export class QuotesController {
  constructor(private readonly quotes: QuotesService) {}

  /**
   * Catalogo publico de servicios, extras, zonas y limites.
   * Lo consume el formulario del sitio web para no duplicar precios.
   */
  @Get('pricing/catalog')
  @SkipThrottle({ quotes: true })
  getCatalog(): CatalogResponse {
    return this.quotes.getCatalog();
  }

  /**
   * Cotizacion instantanea. Devuelve 200 (no 201) porque no crea ningun
   * recurso: la Etapa 1 no persiste nada, el presupuesto es efimero.
   */
  @Post('quotes/estimate')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe<QuoteRequest>(QuoteRequestSchema))
  estimate(@Body() request: QuoteRequest): Promise<QuoteResponse> {
    return this.quotes.estimate(request);
  }
}
