import { Body, Controller, HttpCode, HttpStatus, Post, UsePipes } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { BookingRequestSchema, type BookingRequest, type BookingResponse } from '@freshness/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { BookingsService } from './bookings.service';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  /**
   * Crea una reserva.
   *
   * Limite propio y mas estricto que el del cotizador: cada reserva escribe
   * en la base de datos y creara una retencion en la tarjeta, asi que el coste
   * de un abuso es mucho mayor que el de pedir precios.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ global: { limit: 5, ttl: 60_000 }, quotes: { limit: 5, ttl: 60_000 } })
  @UsePipes(new ZodValidationPipe<BookingRequest>(BookingRequestSchema))
  create(@Body() request: BookingRequest): Promise<BookingResponse> {
    return this.bookings.create(request);
  }
}
