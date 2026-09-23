import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { SettingsModule } from '../settings/settings.module';
import { AssignmentsService } from './assignments.service';
import { BookingActionsService } from './booking-actions.service';
import {
  AssignmentsController,
  BookingActionsController,
  BookingsAdminController,
  StaffListController,
} from './bookings-admin.controller';
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
    AssignmentsController,
    StaffListController,
  ],
  providers: [BookingsAdminService, BookingActionsService, AssignmentsService],
})
export class AdminModule {}
