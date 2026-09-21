import { Module } from '@nestjs/common';
import { BusinessSettingsController } from './business-settings.controller';
import { BusinessSettingsService } from './business-settings.service';

/**
 * El servicio se exporta porque lo necesitan dos sitios ademas del endpoint
 * publico: el motor de agenda (para saber el horario) y el panel (para
 * editarlo).
 */
@Module({
  controllers: [BusinessSettingsController],
  providers: [BusinessSettingsService],
  exports: [BusinessSettingsService],
})
export class SettingsModule {}
