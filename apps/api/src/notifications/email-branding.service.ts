import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../common/config/env';

/**
 * LA MARCA DE LOS CORREOS
 * -----------------------
 * Hoy es un solo dato —de donde se descarga el logotipo— y aun asi tiene su
 * propio servicio, por dos motivos:
 *
 *   1. LO NECESITAN TRES SITIOS: los avisos de reservas, la invitacion al
 *      personal y la recuperacion de contrasena. Resolverlo en cada uno
 *      significaba tres constructores pidiendo la configuracion para leer la
 *      misma variable, y tres sitios que actualizar el dia que la marca de
 *      un correo sea algo mas que una imagen.
 *
 *   2. LAS PLANTILLAS SIGUEN SIENDO PURAS. No leen el entorno: reciben lo
 *      que tienen que pintar. Se prueban pasandoles un objeto, sin nada que
 *      preparar antes.
 *
 * Se resuelve UNA VEZ, al arrancar, porque el entorno no cambia en caliente.
 * No es el caso del area de servicio, que si se edita desde el panel y por
 * eso se resuelve en cada peticion.
 */
@Injectable()
export class EmailBrandingService {
  /** Direccion publica del logotipo, o `null` si este despliegue no tiene. */
  readonly logoUrl: string | null;

  constructor(config: ConfigService<Env, true>) {
    this.logoUrl = config.get('EMAIL_LOGO_URL', { infer: true }) ?? null;
  }
}
