import { Controller, Get, Query, UsePipes } from '@nestjs/common';
import {
  AvailabilityRequestSchema,
  type AvailabilityRequest,
  type AvailabilityResponse,
} from '@freshness/types';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AvailabilityService } from './availability.service';

@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  /**
   * Franjas disponibles para un dia y un trabajo concretos.
   *
   * Necesita los datos del servicio porque la duracion decide que huecos
   * caben: una limpieza profunda de una casa grande no entra donde si entra
   * una rotacion de Airbnb.
   */
  @Get()
  @UsePipes(new ZodValidationPipe<AvailabilityRequest>(AvailabilityRequestSchema))
  getAvailability(@Query() request: AvailabilityRequest): Promise<AvailabilityResponse> {
    return this.availability.getAvailability(request);
  }
}
