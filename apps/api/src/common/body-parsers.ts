import type { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';
import type { Request, Response } from 'express';

/** Ruta del webhook de pagos, relativa al prefijo de la API. */
export const WEBHOOK_ROUTE = 'payments/webhook';

/**
 * LECTURA DEL CUERPO DE LAS PETICIONES
 * ------------------------------------
 * Vive aqui, y no suelto en main.ts, porque las pruebas de punta a punta
 * levantan la aplicacion por su cuenta: si cada sitio configurase sus propios
 * limites, las pruebas dejarian de comprobar lo que de verdad corre en
 * produccion.
 *
 * Dos lectores, en este orden:
 *
 *  1. El del webhook, con un limite mas holgado. Un evento de pago trae el
 *     objeto completo del proveedor y no cabe siempre en el limite general.
 *
 *  2. El general, de 16 KB. Una cotizacion valida ocupa menos de 1 KB, asi que
 *     sobra margen y se evita que alguien sature el servidor con cuerpos
 *     enormes.
 *
 * El orden importa: Express aplica el primero que encaja con la ruta y marca
 * el cuerpo como leido, de modo que el siguiente no vuelve a procesarlo.
 */
export function applyBodyParsers(app: NestExpressApplication, apiPrefix: string): void {
  app.use(`/${apiPrefix}/${WEBHOOK_ROUTE}`, json({ limit: '64kb', verify: captureRawBody }));

  // El `rawBody: true` con el que se crea la aplicacion hace que este lector
  // guarde tambien los bytes originales, igual que el anterior.
  app.useBodyParser('json', { limit: '16kb' });
}

/**
 * Guarda los bytes tal y como llegaron.
 *
 * La firma del webhook se calcula sobre esos bytes exactos: volver a serializar
 * el JSON cambiaria el orden de las claves o los espacios y la firma dejaria
 * de cuadrar, aunque el contenido fuese identico.
 */
function captureRawBody(req: Request, _res: Response, buffer: Buffer): void {
  if (Buffer.isBuffer(buffer)) {
    (req as Request & { rawBody?: Buffer }).rawBody = buffer;
  }
}
