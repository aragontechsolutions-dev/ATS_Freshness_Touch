import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { AvailabilityController } from './availability.controller';
import { AvailabilityService } from './availability.service';

@Module({
  // La agenda necesita el horario vigente, que vive en la configuracion.
  imports: [SettingsModule],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class SchedulingModule {}
