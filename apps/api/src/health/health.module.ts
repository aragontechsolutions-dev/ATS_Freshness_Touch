import { Global, Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { HealthController } from './health.controller';
import { SystemHealthController } from './system-health.controller';
import { SystemAlertService } from './system-alert.service';
import { SweepHeartbeatService } from './sweep-heartbeat.service';
import { SystemChecksService } from './system-checks.service';

/**
 * ESTADO DEL SISTEMA
 * ------------------
 * Las dos sondas publicas (`/health` y `/health/ready`) y el diagnostico
 * detallado que leen el panel y la alarma.
 *
 * ========================================================================
 * ES GLOBAL POR EL LATIDO, NO POR COMODIDAD
 * ========================================================================
 * `SweepHeartbeatService` lo usan cuatro barridos que viven en cuatro
 * modulos distintos (reservas, avisos, geocodificacion y auditoria). La
 * alternativa seria importar este modulo en los cuatro, y como la auditoria
 * ya es global y este necesita leer las tarifas, eso crea un enredo de
 * importaciones cruzadas para compartir un unico mapa en memoria.
 *
 * El mismo patron que `DatabaseModule`, `AuditModule` y `NotificationsModule`
 * ya usan en este proyecto.
 */
@Global()
@Module({
  // Para leer de donde salen las tarifas vigentes. No al reves: `settings`
  // no sabe nada de esto.
  imports: [SettingsModule],
  controllers: [HealthController, SystemHealthController],
  providers: [SweepHeartbeatService, SystemChecksService, SystemAlertService],
  exports: [SweepHeartbeatService, SystemChecksService, SystemAlertService],
})
export class HealthModule {}
