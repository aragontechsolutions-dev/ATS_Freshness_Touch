/**
 * EL PUERTO DEL ALMACEN PRIVADO
 * -----------------------------
 * Para lo que NO se ensena: hoy, la prueba de un permiso de imagen —el
 * escaneo del papel firmado, el PDF del correo—, que lleva el nombre del
 * cliente, la direccion de su casa y su firma.
 *
 * ========================================================================
 * POR QUE ES UN PUERTO APARTE Y NO UN METODO MAS EN `ImageStorage`
 * ========================================================================
 * Fijate en lo que NO tiene: `publicUrl`. No es un olvido.
 *
 * El almacen de la galeria es publico de lectura, y su puerto ofrece una
 * direccion con la que cualquiera pinta la imagen. Si los dos almacenes
 * compartieran puerto, pedir la direccion publica de un documento firmado
 * seria una linea de codigo igual de facil de escribir que las demas — y
 * nada, ni una revision ni una prueba, avisaria de que acaba de publicarse
 * la firma de un cliente.
 *
 * Separandolos, ESE ERROR NO SE PUEDE ESCRIBIR: el metodo no existe. La
 * unica forma de sacar estos bytes es `download`, que los devuelve al
 * servidor, que a su vez los sirve detras de la sesion del panel.
 *
 * Es la misma idea que separar `MyJob` del resto del modelo para que una
 * cifra de dinero no pueda llegar a la pantalla de quien limpia.
 */

export const DOCUMENT_STORAGE = Symbol('DOCUMENT_STORAGE');

export interface UploadDocumentRequest {
  /** La ruta dentro del almacen. La compone el servidor, nunca quien sube. */
  path: string;
  bytes: Uint8Array;
  contentType: string;
}

export type UploadDocumentResult = { ok: true } | { ok: false; reason: string };

export interface DocumentStorage {
  /** Si hay almacen configurado. Sin el, guardar una prueba da un 503. */
  readonly configured: boolean;

  upload(request: UploadDocumentRequest): Promise<UploadDocumentResult>;

  /**
   * Los bytes, para servirlos desde la API.
   *
   * `null` si no estan: un archivo que el almacen perdio no puede tumbar la
   * pantalla de permisos, que tiene que seguir dejando revocar.
   */
  download(path: string): Promise<Uint8Array | null>;

  /**
   * Borra sin fallar nunca, igual que el almacen de imagenes.
   *
   * Aqui el motivo es el contrario que alli, y por eso conviene decirlo: un
   * documento huerfano en un almacen privado no se ve en ninguna parte. Lo
   * que no puede pasar es que un fallo del almacen impida sustituir una
   * prueba equivocada por la correcta.
   */
  remove(paths: readonly string[]): Promise<void>;
}
