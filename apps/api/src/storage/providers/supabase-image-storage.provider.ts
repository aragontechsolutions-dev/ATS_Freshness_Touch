import { Injectable, Logger } from '@nestjs/common';
import type { ImageStorage, UploadRequest, UploadResult } from '../storage.types';

export interface SupabaseImageStorageOptions {
  url: string | undefined;
  serviceRoleKey: string | undefined;
  bucket: string;
  timeoutMs: number;
}

/**
 * SUPABASE STORAGE
 * ----------------
 * Sube y borra con la clave de servicio, que se salta las politicas de la
 * base. Por eso ESTO VIVE EN EL SERVIDOR Y NUNCA EN EL NAVEGADOR: una clave
 * de servicio en el panel seria una clave de administracion repartida a todo
 * el que abra la pagina.
 *
 * Y hay un segundo motivo, igual de importante: pasando por aqui se puede
 * quitar el EXIF, comprobar que los bytes son de verdad una imagen y dejar
 * rastro de quien subio que. Subiendo desde el navegador no se puede hacer
 * ninguna de las tres.
 *
 * SIN LIBRERIA DE SUPABASE, solo `fetch`, igual que el proveedor de
 * invitaciones. El cliente oficial arrastra su propia pila para tres
 * llamadas HTTP.
 */
@Injectable()
export class SupabaseImageStorageProvider implements ImageStorage {
  private readonly logger = new Logger(SupabaseImageStorageProvider.name);

  constructor(private readonly options: SupabaseImageStorageOptions) {}

  get configured(): boolean {
    return Boolean(this.options.url) && Boolean(this.options.serviceRoleKey);
  }

  async upload(request: UploadRequest): Promise<UploadResult> {
    if (!this.options.url || !this.options.serviceRoleKey) {
      return { ok: false, reason: 'El almacen de imagenes no esta configurado' };
    }

    const destino = new URL(
      `/storage/v1/object/${this.options.bucket}/${request.path}`,
      this.options.url,
    );

    const controller = new AbortController();
    const temporizador = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const respuesta = await fetch(destino, {
        method: 'POST',
        headers: {
          apikey: this.options.serviceRoleKey,
          Authorization: `Bearer ${this.options.serviceRoleKey}`,
          'Content-Type': request.contentType,
          /*
           * `upsert: false`: el nombre lo pone el servidor y es nuevo cada
           * vez, asi que una colision significa que algo va mal —no que haya
           * que sobrescribir—. Sobrescribir en silencio podria pisar la foto
           * de otra casa.
           */
          'x-upsert': 'false',
        },
        body: Buffer.from(request.bytes),
        signal: controller.signal,
      });

      if (!respuesta.ok) {
        const detalle = await respuesta.text().catch(() => '');
        /*
         * Se registra el codigo y el detalle, NUNCA la direccion a la que se
         * llamo. No lleva la clave dentro, pero registrar direcciones
         * internas del proyecto es el habito que en el adaptador de Telegram
         * si habria filtrado el token. Mas vale que la regla sea siempre la
         * misma.
         */
        this.logger.error(
          `Supabase Storage rechazo la subida (codigo ${String(respuesta.status)}): ` +
            detalle.slice(0, 200),
        );
        return { ok: false, reason: `codigo ${String(respuesta.status)}` };
      }

      return { ok: true };
    } catch (error) {
      const motivo =
        error instanceof Error && error.name === 'AbortError'
          ? 'el almacen no respondio a tiempo'
          : error instanceof Error
            ? error.message
            : 'error desconocido';

      this.logger.error(`No se pudo subir la imagen: ${motivo}`);
      return { ok: false, reason: motivo };
    } finally {
      clearTimeout(temporizador);
    }
  }

  /**
   * Borra sin fallar nunca.
   *
   * Se llama al retirar una foto. Lo que NO puede pasar es que un fallo del
   * almacen impida retirarla de la web: el cliente revoco su permiso y lo que
   * importa es que deje de verse. Un archivo huerfano es un problema de
   * limpieza; una foto que sigue publicada despues de pedir que la quiten es
   * un problema legal.
   */
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
          `El almacen no borro ${String(paths.length)} archivo(s) (codigo ` +
            `${String(respuesta.status)}). Quedan huerfanos, pero ya no se ven en la web.`,
        );
      }
    } catch {
      this.logger.warn(
        `No se pudo contactar con el almacen para borrar ${String(paths.length)} archivo(s). ` +
          'Quedan huerfanos, pero ya no se ven en la web.',
      );
    } finally {
      clearTimeout(temporizador);
    }
  }

  publicUrl(path: string): string | null {
    if (!this.options.url) return null;

    return new URL(
      `/storage/v1/object/public/${this.options.bucket}/${path}`,
      this.options.url,
    ).toString();
  }
}
