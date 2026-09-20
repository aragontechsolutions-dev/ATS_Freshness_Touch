import {
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  UnauthorizedException,
  type RawBodyRequest,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { API_ERROR_CODES } from '@freshness/types';
import type { Request } from 'express';
import { WEBHOOK_ROUTE } from '../common/body-parsers';
import { PaymentsService } from './payments.service';
import { WebhookSignatureError } from './payments.types';
import { WebhooksService } from './webhooks.service';

@Controller(WEBHOOK_ROUTE)
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly webhooks: WebhooksService,
    private readonly payments: PaymentsService,
  ) {}

  /**
   * Recibe los avisos del proveedor de pago.
   *
   * SEGURIDAD
   * - Es un endpoint publico, sin autenticacion: el proveedor no puede
   *   iniciar sesion. Lo que lo protege es la FIRMA del cuerpo, que solo puede
   *   calcular quien conoce el secreto compartido. Sin ella, cualquiera podria
   *   enviar "el deposito se autorizo" y confirmar reservas no pagadas.
   * - La firma se comprueba ANTES de tocar la base de datos.
   * - Limite de peticiones propio y holgado: el proveedor envia rafagas
   *   legitimas cuando se recupera de una caida, pero sigue sin poder
   *   inundarnos.
   * - La respuesta nunca dice si el evento se reconocio o no: un atacante que
   *   probara firmas no obtendria ninguna pista.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ global: { limit: 300, ttl: 60_000 }, quotes: { limit: 300, ttl: 60_000 } })
  async receive(@Req() request: RawBodyRequest<Request>): Promise<{ received: true }> {
    const signature = request.headers[this.payments.webhookSignatureHeader];

    if (!request.rawBody) {
      // Solo puede ocurrir si alguien cambia la configuracion de lectura del
      // cuerpo: sin los bytes originales la firma no se puede comprobar, y
      // aceptar el evento a ciegas seria peor que rechazarlo.
      this.logger.error('El cuerpo original no esta disponible: revisa applyBodyParsers');
      throw new UnauthorizedException({
        code: API_ERROR_CODES.WEBHOOK_SIGNATURE_INVALID,
        messageKey: 'calculator.errorGeneric',
      });
    }

    try {
      const event = this.webhooks.parse(
        request.rawBody,
        typeof signature === 'string' ? signature : undefined,
      );
      await this.webhooks.handle(event);
    } catch (error) {
      if (error instanceof WebhookSignatureError) {
        this.logger.warn(`Evento de pago rechazado: ${error.message}`);
        throw new UnauthorizedException({
          code: API_ERROR_CODES.WEBHOOK_SIGNATURE_INVALID,
          messageKey: 'calculator.errorGeneric',
        });
      }
      // Cualquier otro fallo sale como 500 para que el proveedor reintente.
      throw error;
    }

    // Siempre la misma respuesta, procesado o duplicado.
    return { received: true };
  }
}
