import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DistanceModule } from '../distance/distance.module';
import { SchedulingModule } from '../scheduling/scheduling.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [ConfigModule, DistanceModule, SchedulingModule],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
