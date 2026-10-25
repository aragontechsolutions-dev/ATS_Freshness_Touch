/**
 * EL PUERTO DEL ALMACEN DE IMAGENES
 * ---------------------------------
 * Lo unico que el resto del sistema sabe hacer con una imagen: guardarla,
 * borrarla y saber con que direccion se pinta.
 *
 * Detras hay dos implementaciones —Supabase Storage y una en memoria para
 * desarrollo y pruebas— y ningun otro sitio del codigo conoce a ninguna de
 * las dos, igual que con los pagos y con la geocodificacion.
 */

export const IMAGE_STORAGE = Symbol('IMAGE_STORAGE');

export interface UploadRequest {
  /** La ruta dentro del almacen. La compone el servidor, nunca quien sube. */
  path: string;
  bytes: Uint8Array;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export type UploadResult = { ok: true } | { ok: false; reason: string };

export interface ImageStorage {
  /** Si hay almacen configurado. Sin el, subir una foto se rechaza con un 503. */
  readonly configured: boolean;

  upload(request: UploadRequest): Promise<UploadResult>;

  /**
   * Borra del almacen las rutas que se le pasen.
   *
   * NO FALLA NUNCA, Y ESO ES DELIBERADO. Se llama al retirar una foto, y lo
   * que no puede pasar es que un fallo del almacen impida retirarla de la
   * web: el cliente revoco su permiso y lo que importa es que deje de verse.
   * Un archivo huerfano es un problema de limpieza; una foto que sigue
   * publicada despues de pedir que la quiten es un problema legal.
   */
  remove(paths: readonly string[]): Promise<void>;

  /** La direccion con la que el navegador la pide, o `null` si no hay almacen. */
  publicUrl(path: string): string | null;
}
