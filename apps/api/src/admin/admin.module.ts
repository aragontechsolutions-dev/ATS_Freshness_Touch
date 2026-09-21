import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { SettingsModule } from '../settings/settings.module';
import { BookingActionsService } from './booking-actions.service';
import { BookingActionsController, BookingsAdminController } from './bookings-admin.controller';
import { BookingsAdminService } from './bookings-admin.service';
import { SessionController } from './session.controller';
import {
  NotificationSettingsController,
  SettingsAdminController,
} from './settings-admin.controller';

@Module({
  imports: [PaymentsModule, SettingsModule],
  controllers: [
    SessionController,
    BookingsAdminController,
    BookingActionsController,
    SettingsAdminController,
    NotificationSettingsController,
  ],
  providers: [BookingsAdminService, BookingActionsService],
})
export class AdminModule {}
