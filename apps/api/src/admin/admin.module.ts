import { Module } from '@nestjs/common';
import { JOB_CHECKLIST_CATALOG } from '@freshness/types';
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
import { FieldAdjustmentsService } from './field-adjustments.service';
import { JOB_CHECKLIST_CATALOG_TOKEN } from './job-checklist.helper';
import { MyJobsController } from './my-jobs.controller';
import { PasswordRecoveryController } from './password-recovery.controller';
import { PasswordRecoveryService } from './password-recovery.service';
import { MyJobsService } from './my-jobs.service';
import { SessionController } from './session.controller';
import { SupabaseInviteProvider } from './providers/supabase-invite.provider';
import { StaffAdminController } from './staff-admin.controller';
import { StaffAdminService } from './staff-admin.service';
import { STAFF_INVITE_PROVIDER } from './staff-invite.types';
import {
  NotificationSettingsController,
  PricingRatesAdminController,
  CompanyLocationAdminController,
  ServiceAreaAdminController,
  SiteCopyAdminController,
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
    ServiceAreaAdminController,
    CompanyLocationAdminController,
    PricingRatesAdminController,
    SiteCopyAdminController,
    AssignmentsController,
    StaffListController,
    StaffAdminController,
    MyJobsController,
    /*
     * PUBLICO, sin sesion y fuera de `/admin`: quien no puede entrar no
     * tiene con que identificarse. Vive en este modulo igualmente porque
     * necesita el proveedor de invitaciones que se configura aqui abajo,
     * y duplicar esa fabrica era la otra opcion.
     */
    PasswordRecoveryController,
  ],
  providers: [
    BookingsAdminService,
    BookingActionsService,
    AssignmentsService,
    StaffAdminService,
    MyJobsService,
    FieldAdjustmentsService,
    PasswordRecoveryService,
    {
      /*
       * EL CATALOGO DE TAREAS DE LA LISTA DE VERIFICACION.
       *
       * Entra por la puerta de delante y no importado a pelo dentro de los
       * servicios, igual que el proveedor de pagos o el de geocodificacion.
       * El motivo esta en `job-checklist.helper.ts`: el catalogo de verdad
       * esta vacio mientras las plantillas del cliente esten pendientes de
       * transcribir, y sin este token el camino de ESCRITURA —marcar una
       * tarea— no se podria probar de punta a punta en absoluto.
       *
       * En produccion es siempre el catalogo real. Lo unico que lo sustituye
       * son las pruebas, con tres tareas de mentira y el mismo codigo debajo.
       */
      provide: JOB_CHECKLIST_CATALOG_TOKEN,
      useValue: JOB_CHECKLIST_CATALOG,
    },
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
