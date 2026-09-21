import { Module } from '@nestjs/common';
import { BookingsAdminController } from './bookings-admin.controller';
import { BookingsAdminService } from './bookings-admin.service';
import { SessionController } from './session.controller';

@Module({
  controllers: [SessionController, BookingsAdminController],
  providers: [BookingsAdminService],
})
export class AdminModule {}
