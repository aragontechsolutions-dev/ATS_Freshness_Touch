import { Module } from '@nestjs/common';
import { BusinessSettingsController } from './business-settings.controller';
import { BusinessSettingsService } from './business-settings.service';
import { PricingConfigService } from './pricing-config.service';
import { PricingRatesService } from './pricing-rates.service';
import { ServiceAreaService } from './service-area.service';

/**
 * Los servicios se exportan porque los necesitan varios sitios ademas de los
 * endpoints publicos: el motor de agenda (para el horario), el cotizador y
 * las reservas (para el area de servicio) y el panel (para editarlo todo).
 */
@Module({
  controllers: [BusinessSettingsController],
  providers: [
    BusinessSettingsService,
    ServiceAreaService,
    PricingRatesService,
    PricingConfigService,
  ],
  exports: [BusinessSettingsService, ServiceAreaService, PricingRatesService, PricingConfigService],
})
export class SettingsModule {}
