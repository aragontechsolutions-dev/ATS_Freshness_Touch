import { Global, Module } from '@nestjs/common';
import { StaffNotificationsController } from './staff-notifications.controller';
import { StaffNotificationsService } from './staff-notifications.service';

/**
 * GLOBAL a proposito, por el mismo motivo que el modulo de avisos: las
 * notificaciones se emiten desde sitios muy distintos —el webhook del
 * proveedor de pago, la pantalla de permisos, el flujo de reserva— y obligar
 * a cada modulo a importar este seria una invitacion a que alguien escriba
 * en la tabla por su cuenta.
 */
@Global()
@Module({
  controllers: [StaffNotificationsController],
  providers: [StaffNotificationsService],
  exports: [StaffNotificationsService],
})
export class StaffNotificationsModule {}
