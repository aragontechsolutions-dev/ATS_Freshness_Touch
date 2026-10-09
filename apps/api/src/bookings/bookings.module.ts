import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DistanceModule } from '../distance/distance.module';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { PaymentsModule } from '../payments/payments.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { SettingsModule } from '../settings/settings.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { DoorPinSweepService } from './door-pin-sweep.service';

@Module({
  imports: [
    ConfigModule,
    DistanceModule,
    GeocodingModule,
    SchedulingModule,
    PaymentsModule,
    SettingsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService, DoorPinSweepService],
})
export class BookingsModule {}
