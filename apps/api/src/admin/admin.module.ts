import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsModule } from '../notifications/notifications.module';
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
import { MyJobsController } from './my-jobs.controller';
import { MyJobsService } from './my-jobs.service';
import { SessionController } from './session.controller';
import { SupabaseInviteProvider } from './providers/supabase-invite.provider';
import { StaffAdminController } from './staff-admin.controller';
import { StaffAdminService } from './staff-admin.service';
import { STAFF_INVITE_PROVIDER } from './staff-invite.types';
import {
  NotificationSettingsController,
  SettingsAdminController,
} from './settings-admin.controller';
import type { Env } from '../common/config/env';

@Module({
  imports: [PaymentsModule, SettingsModule, NotificationsModule],
  controllers: [
    SessionController,
    BookingsAdminController,
    BookingActionsController,
    SettingsAdminController,
    NotificationSettingsController,
    AssignmentsController,
    StaffListController,
    StaffAdminController,
    MyJobsController,
  ],
  providers: [
    BookingsAdminService,
    BookingActionsService,
    AssignmentsService,
    StaffAdminService,
    MyJobsService,
    {
      /*
       * La capacidad de invitar se DERIVA de la configuracion en vez de
       * elegirse con una variable propia. Si la clave de servicio esta, se
       * puede invitar; si no, no.
       *
       * Asi no existe ningun "proveedor simulado de invitaciones" que alguien
       * pueda dejar activo en produccion por descuido: eso vincularia fichas
       * a cuentas inventadas que parecen tener acceso y no lo tienen. Las
       * pruebas apuntan SUPABASE_URL a un servidor de mentira y recorren el
       * mismo codigo que produccion.
       */
      provide: STAFF_INVITE_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new SupabaseInviteProvider({
          url: config.get('SUPABASE_URL', { infer: true }) ?? null,
          serviceRoleKey: config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true }) ?? null,
          redirectTo: config.get('SUPABASE_INVITE_REDIRECT_URL', { infer: true }) ?? null,
          timeoutMs: config.get('AUTH_TIMEOUT_MS', { infer: true }),
        }),
    },
  ],
})
export class AdminModule {}
