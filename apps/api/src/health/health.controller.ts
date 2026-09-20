import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../database/prisma.service';

interface HealthResponse {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
}

interface ReadinessResponse {
  /** "ready" cuando todo lo necesario responde; "degraded" si falta algo. */
  status: 'ready' | 'degraded';
  database: 'connected' | 'disconnected' | 'not_configured';
}

/**
 * Dos sondas distintas, con proposito distinto:
 *
 *  - /health        VIDA. Responde si el proceso esta en pie. Es la que mira
 *                   Render: NO debe depender de la base de datos, porque si
 *                   dependiera, una caida de Supabase provocaria reinicios en
 *                   bucle de una API que en realidad sigue dando precios.
 *
 *  - /health/ready  DISPONIBILIDAD. Dice que partes funcionan. Sirve para
 *                   monitorizacion y para diagnosticar sin entrar al servidor.
 *
 * Ninguna revela version, dependencias ni rutas internas: un endpoint publico
 * que describe el stack le facilita el trabajo a un atacante.
 */
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  // Siempre 200: es un informe de estado, no un error. Quien monitoriza lee
  // el cuerpo; devolver 503 aqui haria que Render lo interpretara como caida.
  @HttpCode(HttpStatus.OK)
  async readiness(): Promise<ReadinessResponse> {
    if (!this.prisma.configured) {
      return { status: 'degraded', database: 'not_configured' };
    }

    const alive = await this.prisma.ping();
    return {
      status: alive ? 'ready' : 'degraded',
      database: alive ? 'connected' : 'disconnected',
    };
  }
}
