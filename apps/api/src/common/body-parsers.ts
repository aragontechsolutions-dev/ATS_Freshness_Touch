import type { NestExpressApplication } from '@nestjs/platform-express';
import { json, raw } from 'express';
import type { Request, Response } from 'express';
import { GALLERY_PHOTO_MAX_BYTES, GALLERY_PHOTO_TYPES } from '@freshness/types';

/** Ruta del webhook de pagos, relativa al prefijo de la API. */
export const WEBHOOK_ROUTE = 'payments/webhook';

/** Ruta de subida de imagenes de la galeria, relativa al prefijo de la API. */
export const GALLERY_IMAGES_ROUTE = 'admin/gallery/images';

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
 *  2. El de las imagenes de la galeria, que recibe los BYTES DE LA IMAGEN tal
 *     cual, sin envoltorio de formulario. Asi no hace falta ninguna libreria
 *     de multipart: el panel manda el archivo como cuerpo y el tipo en la
 *     cabecera. El limite es el mismo que el del bucket, 5 MB, y solo acepta
 *     los tres tipos de imagen; cualquier otro tipo en esa ruta no llega
 *     siquiera a leerse.
 *
 *  3. El general, de 16 KB. Una cotizacion valida ocupa menos de 1 KB, asi que
 *     sobra margen y se evita que alguien sature el servidor con cuerpos
 *     enormes.
 *
 * El orden importa: Express aplica el primero que encaja con la ruta y marca
 * el cuerpo como leido, de modo que el siguiente no vuelve a procesarlo.
 */
export function applyBodyParsers(app: NestExpressApplication, apiPrefix: string): void {
  app.use(`/${apiPrefix}/${WEBHOOK_ROUTE}`, json({ limit: '64kb', verify: captureRawBody }));

  /*
   * El tipo declarado aqui solo decide QUE PETICIONES SE LEEN, no que se
   * acepta: lo que de verdad decide si los bytes son una imagen son los
   * propios bytes, y eso se comprueba despues. Esto es la primera puerta, la
   * que evita cargar 5 MB de cualquier cosa en memoria.
   */
  app.use(
    `/${apiPrefix}/${GALLERY_IMAGES_ROUTE}`,
    raw({ type: [...GALLERY_PHOTO_TYPES], limit: GALLERY_PHOTO_MAX_BYTES }),
  );

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
