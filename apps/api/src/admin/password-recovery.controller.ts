import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { PasswordRecoveryRequestSchema, type PasswordRecoveryRequest } from '@freshness/types';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RECOVERY_RATE_LIMIT, SKIP_QUOTE_THROTTLER } from '../common/throttling';
import { PasswordRecoveryService } from './password-recovery.service';

/**
 * PEDIR UN ENLACE PARA VOLVER A ENTRAR
 * ------------------------------------
 * ES PUBLICO, Y TIENE QUE SERLO: quien no puede entrar no tiene sesion con
 * la que pedir nada. Eso lo convierte en uno de los dos unicos sitios de la
 * API donde alguien sin credenciales provoca un correo, asi que carga con
 * tres guardias que no van juntas por casualidad.
 *
 *   1. LA RESPUESTA ES SIEMPRE LA MISMA. 202, sin cuerpo, tarde lo que
 *      tarde y exista o no la cuenta. El servicio ni siquiera puede
 *      devolver otra cosa: su firma es `void`.
 *
 *   2. HAY LIMITE POR IP. Cinco cada cuarto de hora. Cada peticion manda un
 *      correo a una persona real; sin tope, esto es una forma gratuita de
 *      inundar un buzon ajeno y de gastar la cuota de envio de la empresa.
 *      Va como override de ruta y no como limitador con nombre, por lo que
 *      explica `common/throttling.ts`.
 *
 *   3. EL DESTINO DEL ENLACE NO VIAJA EN LA PETICION. Lo pone el servidor
 *      desde su configuracion. Si lo eligiera quien llama, se podria pedir
 *      un enlace para el correo de otra persona apuntando a un sitio
 *      propio: llegaria a su buzon legitimo y, al abrirlo, entregaria la
 *      sesion. El contrato ni siquiera admite el campo.
 *
 * LO QUE NO LLEVA, Y ES DELIBERADO: ninguna comprobacion de que el correo
 * tenga forma de correo. Rechazar por formato seria una respuesta distinta
 * —un 400— con la que empezar a distinguir unas direcciones de otras.
 */
/*
 * Exento del limitador del cotizador, como el resto de lo que no cotiza. Sin
 * esto, quien hubiera usado el cotizador diez veces desde la misma conexion
 * —la de una oficina, por ejemplo— se encontraria con un 429 al intentar
 * recuperar su contrasena, que es el peor momento posible. El limite que
 * manda aqui es el de la linea de abajo.
 */
@SkipThrottle(SKIP_QUOTE_THROTTLER)
@Controller('password-recovery')
export class PasswordRecoveryController {
  constructor(private readonly recuperacion: PasswordRecoveryService) {}

  @Post()
  @Throttle({ global: RECOVERY_RATE_LIMIT })
  /*
   * 202 y no 200: «recibido, ya veremos». Es literalmente lo que pasa —el
   * correo se manda despues de responder a efectos de quien pregunta— y es
   * el unico codigo honesto para una operacion cuyo resultado no se cuenta.
   */
  @HttpCode(HttpStatus.ACCEPTED)
  request(
    @Body(new ZodValidationPipe(PasswordRecoveryRequestSchema)) body: PasswordRecoveryRequest,
    @Req() peticion: Request,
  ): void {
    /*
     * SE RESPONDE SIN ESPERAR, Y ESTO ES UNA GUARDIA MAS, NO UN ATAJO.
     *
     * Esperando, el tiempo de respuesta contaria lo que el cuerpo calla:
     * para un correo que no existe se vuelve tras una consulta, y para uno
     * que si, tras hablar con el proveedor de identidad y con el de correo.
     * Son cientos de milisegundos de diferencia, medibles con un cronometro
     * y suficientes para ir separando las direcciones que existen de las que
     * no. Toda la discrecion de los parrafos de arriba se caeria por ahi.
     *
     * Sin esperar, la respuesta tarda lo mismo siempre. Se puede hacer
     * porque `request` NO LANZA NUNCA —lo garantiza su propio try/catch— y
     * porque su resultado no le importa a nadie: si algo falla queda en el
     * registro del servidor, que es donde se mira.
     */
    void this.recuperacion.request(body.email, peticion.ip ?? null);
  }
}
