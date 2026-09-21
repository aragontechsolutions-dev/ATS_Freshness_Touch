import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { BookingActionsService } from './booking-actions.service';
import { BookingActionsController, BookingsAdminController } from './bookings-admin.controller';
import { BookingsAdminService } from './bookings-admin.service';
import { SessionController } from './session.controller';

@Module({
  imports: [PaymentsModule],
  controllers: [SessionController, BookingsAdminController, BookingActionsController],
  providers: [BookingsAdminService, BookingActionsService],
})
export class AdminModule {}
