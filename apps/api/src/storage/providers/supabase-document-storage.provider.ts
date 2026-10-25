import { Injectable, Logger } from '@nestjs/common';
import type {
  DocumentStorage,
  UploadDocumentRequest,
  UploadDocumentResult,
} from '../document-storage.types';

export interface SupabaseDocumentStorageOptions {
  url: string | undefined;
  serviceRoleKey: string | undefined;
  bucket: string;
  timeoutMs: number;
}

/**
 * SUPABASE STORAGE, BUCKET PRIVADO
 * --------------------------------
 * El mismo servicio que guarda las fotos de la galeria, pero OTRO BUCKET y
 * con una diferencia que lo es todo: este NO es publico de lectura.
 *
 * Por eso aqui hay un `download` y no un `publicUrl`. Los bytes salen hacia
 * el servidor, que los sirve detras de la sesion del panel. No existe ninguna
 * direccion de este bucket que funcione pegada en un navegador, ni siquiera
 * una firmada de corta duracion: una direccion firmada que alguien copia
 * sigue abriendo el documento desde cualquier sitio, y para tres descargas al
 * ano no compensa esa puerta.
 *
 * SIN LIBRERIA DE SUPABASE, solo `fetch`, igual que el resto de adaptadores.
 */
@Injectable()
export class SupabaseDocumentStorageProvider implements DocumentStorage {
  private readonly logger = new Logger(SupabaseDocumentStorageProvider.name);

  constructor(private readonly options: SupabaseDocumentStorageOptions) {}

  get configured(): boolean {
    return Boolean(this.options.url) && Boolean(this.options.serviceRoleKey);
  }

  async upload(request: UploadDocumentRequest): Promise<UploadDocumentResult> {
    if (!this.options.url || !this.options.serviceRoleKey) {
      return { ok: false, reason: 'El almacen privado no esta configurado' };
    }

    const respuesta = await this.llamar('POST', request.path, {
      contentType: request.contentType,
      body: Buffer.from(request.bytes),
    });

    if (respuesta === null) return { ok: false, reason: 'el almacen no respondio' };

    if (!respuesta.ok) {
      /*
       * El codigo y el detalle, NUNCA la direccion a la que se llamo. No
       * lleva la clave dentro, pero registrar direcciones internas del
       * proyecto es el habito que en el adaptador de Telegram si habria
       * filtrado el token.
       */
      const detalle = await respuesta.text().catch(() => '');
      this.logger.error(
        `El almacen privado rechazo la subida (codigo ${String(respuesta.status)}): ` +
          detalle.slice(0, 200),
      );
      return { ok: false, reason: `codigo ${String(respuesta.status)}` };
    }

    return { ok: true };
  }

  async download(path: string): Promise<Uint8Array | null> {
    if (!this.options.url || !this.options.serviceRoleKey) return null;

    const respuesta = await this.llamar('GET', path);
    if (respuesta === null || !respuesta.ok) {
      if (respuesta !== null) {
        this.logger.warn(
          `El almacen privado no devolvio la prueba (codigo ${String(respuesta.status)}).`,
        );
      }
      return null;
    }

    return new Uint8Array(await respuesta.arrayBuffer());
  }

  async remove(paths: readonly string[]): Promise<void> {
    if (paths.length === 0) return;
    if (!this.options.url || !this.options.serviceRoleKey) return;

    const destino = new URL(`/storage/v1/object/${this.options.bucket}`, this.options.url);
    const controller = new AbortController();
    const temporizador = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const respuesta = await fetch(destino, {
        method: 'DELETE',
        headers: {
          apikey: this.options.serviceRoleKey,
          Authorization: `Bearer ${this.options.serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prefixes: [...paths] }),
        signal: controller.signal,
      });

      if (!respuesta.ok) {
        this.logger.warn(
          `El almacen privado no borro ${String(paths.length)} archivo(s) (codigo ` +
            `${String(respuesta.status)}). Quedan huerfanos, pero no se ven desde ninguna parte.`,
        );
      }
    } catch {
      this.logger.warn(
        `No se pudo contactar con el almacen privado para borrar ${String(paths.length)} ` +
          'archivo(s). Quedan huerfanos, pero no se ven desde ninguna parte.',
      );
    } finally {
      clearTimeout(temporizador);
    }
  }

  /** Una llamada al objeto, con su tiempo maximo. `null` si no respondio. */
  private async llamar(
    metodo: 'GET' | 'POST',
    path: string,
    cuerpo?: { contentType: string; body: Buffer },
  ): Promise<Response | null> {
    if (!this.options.url || !this.options.serviceRoleKey) return null;

    const destino = new URL(`/storage/v1/object/${this.options.bucket}/${path}`, this.options.url);
    const controller = new AbortController();
    const temporizador = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      return await fetch(destino, {
        method: metodo,
        headers: {
          apikey: this.options.serviceRoleKey,
          Authorization: `Bearer ${this.options.serviceRoleKey}`,
          ...(cuerpo
            ? {
                'Content-Type': cuerpo.contentType,
                /*
                 * El nombre lo pone el servidor y es nuevo cada vez, asi que
                 * una colision significa que algo va mal. Sobrescribir en
                 * silencio podria pisar la prueba de otro permiso.
                 */
                'x-upsert': 'false',
              }
            : {}),
        },
        ...(cuerpo ? { body: cuerpo.body } : {}),
        signal: controller.signal,
      });
    } catch (error) {
      const motivo =
        error instanceof Error && error.name === 'AbortError'
          ? 'el almacen no respondio a tiempo'
          : error instanceof Error
            ? error.message
            : 'error desconocido';
      this.logger.error(`El almacen privado fallo: ${motivo}`);
      return null;
    } finally {
      clearTimeout(temporizador);
    }
  }
}
