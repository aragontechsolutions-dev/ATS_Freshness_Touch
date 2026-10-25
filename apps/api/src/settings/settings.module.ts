import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { BusinessSettingsController } from './business-settings.controller';
import { BusinessSettingsService } from './business-settings.service';
import { PricingConfigService } from './pricing-config.service';
import { PricingRatesService } from './pricing-rates.service';
import { ServiceAreaService } from './service-area.service';
import { CompanyLocationService } from './company-location.service';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';
import { SiteCopyController } from './site-copy.controller';
import { SiteCopyService } from './site-copy.service';

/**
 * Los servicios se exportan porque los necesitan varios sitios ademas de los
 * endpoints publicos: el motor de agenda (para el horario), el cotizador y
 * las reservas (para el area de servicio) y el panel (para editarlo todo).
 */
@Module({
  imports: [StorageModule],
  controllers: [BusinessSettingsController, SiteCopyController, GalleryController],
  providers: [
    BusinessSettingsService,
    SiteCopyService,
    GalleryService,
    ServiceAreaService,
    CompanyLocationService,
    PricingRatesService,
    PricingConfigService,
  ],
  exports: [
    BusinessSettingsService,
    SiteCopyService,
    GalleryService,
    ServiceAreaService,
    CompanyLocationService,
    PricingRatesService,
    PricingConfigService,
  ],
})
export class SettingsModule {}
