import { Injectable } from '@nestjs/common';
import type { ImageStorage, UploadRequest, UploadResult } from '../storage.types';

/**
 * EL ALMACEN DE DESARROLLO
 * ------------------------
 * Guarda las imagenes en memoria y las sirve con una direccion inventada.
 * Sirve para levantar el proyecto entero sin cuenta de Supabase, igual que el
 * proveedor de pagos simulado permite probar el flujo de reserva sin Stripe.
 *
 * LAS DIRECCIONES QUE DEVUELVE NO CARGAN NINGUNA IMAGEN. Es a proposito: en
 * desarrollo se ve el hueco de la foto y queda claro que no hay almacen de
 * verdad. Fingir que funciona es como se despliega a produccion creyendo que
 * las fotos estan subidas.
 */
@Injectable()
export class MemoryImageStorageProvider implements ImageStorage {
  readonly configured = true;

  private readonly guardadas = new Map<string, Uint8Array>();

  upload(request: UploadRequest): Promise<UploadResult> {
    this.guardadas.set(request.path, request.bytes);
    return Promise.resolve({ ok: true });
  }

  remove(paths: readonly string[]): Promise<void> {
    for (const path of paths) this.guardadas.delete(path);
    return Promise.resolve();
  }

  publicUrl(path: string): string {
    return `http://localhost:3001/almacen-de-desarrollo/${path}`;
  }

  /** Solo para las pruebas: que hay guardado ahora mismo. */
  contenido(path: string): Uint8Array | undefined {
    return this.guardadas.get(path);
  }

  get rutas(): string[] {
    return [...this.guardadas.keys()];
  }
}
