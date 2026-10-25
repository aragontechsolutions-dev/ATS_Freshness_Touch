import { Injectable } from '@nestjs/common';
import type {
  DocumentStorage,
  UploadDocumentRequest,
  UploadDocumentResult,
} from '../document-storage.types';

/**
 * EL ALMACEN PRIVADO DE DESARROLLO
 * --------------------------------
 * Guarda los documentos en memoria. Sirve para levantar el proyecto entero
 * sin cuenta de Supabase, igual que el proveedor de pagos simulado permite
 * probar la reserva sin Stripe.
 *
 * A diferencia del de imagenes, este SI FUNCIONA DE VERDAD en desarrollo: lo
 * que se sube se puede volver a descargar. Alli las direcciones no cargaban
 * nada a proposito, para que se viera el hueco; aqui no hay ninguna direccion
 * que ensenar —los bytes los sirve la API— y dejarlo roto solo impediria
 * probar la pantalla. Lo que se pierde es el contenido al reiniciar, que en
 * desarrollo es lo correcto.
 */
@Injectable()
export class MemoryDocumentStorageProvider implements DocumentStorage {
  readonly configured = true;

  private readonly guardados = new Map<string, Uint8Array>();

  upload(request: UploadDocumentRequest): Promise<UploadDocumentResult> {
    this.guardados.set(request.path, request.bytes);
    return Promise.resolve({ ok: true });
  }

  download(path: string): Promise<Uint8Array | null> {
    return Promise.resolve(this.guardados.get(path) ?? null);
  }

  remove(paths: readonly string[]): Promise<void> {
    for (const path of paths) this.guardados.delete(path);
    return Promise.resolve();
  }

  /** Solo para las pruebas: que rutas hay guardadas ahora mismo. */
  get rutas(): string[] {
    return [...this.guardados.keys()];
  }
}
