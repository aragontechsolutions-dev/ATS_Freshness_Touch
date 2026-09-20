import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

interface HealthResponse {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
}

/**
 * Sonda de salud para el proveedor de hosting (Render) y para monitorizacion.
 *
 * No expone version, dependencias ni datos internos: un endpoint de salud
 * publico que revela detalles del stack facilita el trabajo a un atacante.
 */
@Controller('health')
@SkipThrottle()
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
