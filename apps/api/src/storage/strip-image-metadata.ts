/**
 * QUITAR LOS METADATOS DE UNA IMAGEN, SIN RECODIFICARLA
 * ====================================================
 * Una foto hecha con un movil lleva dentro, en un bloque aparte de los
 * pixeles, LAS COORDENADAS GPS del sitio donde se tomo. Tambien la fecha, el
 * modelo del telefono, su numero de serie en algunas marcas, y a veces el
 * nombre del propietario.
 *
 * ========================================================================
 * POR QUE ESTO NO ES UN DETALLE
 * ========================================================================
 * Las fotos de esta galeria son el interior de la casa de un cliente. El
 * permiso que firma dice que no se mostrara su calle ni su numero, y el
 * encuadre se cuida para que no salga la placa. Y despues se publicaria un
 * archivo con su direccion EXACTA escrita dentro, legible con cualquier visor
 * de propiedades.
 *
 * Es el mismo criterio que ya rige en el fichaje de los empleados: de su
 * ubicacion solo se guarda LA DISTANCIA, nunca las coordenadas
 * (`docs/25-fichaje-con-ubicacion.md`). Seria incoherente proteger eso y
 * publicar las coordenadas de la casa del cliente.
 *
 * ========================================================================
 * POR QUE A MANO Y NO CON UNA LIBRERIA DE IMAGENES
 * ========================================================================
 * Lo habitual seria recodificar con `sharp`, que de paso borra todo. Pero
 * `sharp` es una dependencia NATIVA con script de instalacion, y este
 * repositorio tiene los scripts de instalacion cerrados a proposito.
 * Abrirlos amplia la superficie de suministro y mete un binario nativo en el
 * arranque de la API.
 *
 * Esto es TypeScript puro, sin dependencias: no recodifica los pixeles, solo
 * reconstruye el contenedor dejando fuera los bloques de metadatos. Es
 * determinista, se puede probar byte a byte y no anade nada al arranque.
 *
 * LO QUE SI SE CONSERVA, Y POR QUE:
 *
 *   - El perfil de color (ICC). No dice nada de nadie y, sin el, una foto
 *     editada en un movil moderno se publica con los colores lavados.
 *   - La cabecera JFIF de JPEG, que algunos decodificadores veteranos
 *     esperan y que solo contiene la densidad de puntos.
 *
 * LO QUE SE VA, SIEMPRE: EXIF (donde vive el GPS), XMP, IPTC, los comentarios
 * libres, las marcas de los programas de edicion y la fecha de modificacion
 * de PNG.
 */

export type ImageFormat = 'jpeg' | 'png' | 'webp';

export type StripResult =
  | { ok: true; format: ImageFormat; bytes: Uint8Array }
  | { ok: false; reason: 'unsupported' | 'malformed' };

/** Lo unico que se acepta. Deducido de los bytes, nunca de lo que diga el cliente. */
export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }

  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && PNG.every((byte, i) => bytes[i] === byte)) return 'png';

  if (bytes.length >= 12 && texto(bytes, 0, 4) === 'RIFF' && texto(bytes, 8, 4) === 'WEBP') {
    return 'webp';
  }

  return null;
}

/**
 * La imagen sin metadatos.
 *
 * EL FORMATO SE DEDUCE DE LOS BYTES, no de la extension ni del tipo que
 * declare quien sube. Lo contrario seria confiar en el cliente justo en la
 * decision de como interpretar sus propios bytes: bastaria con llamar `.jpg`
 * a otra cosa para saltarse el tratamiento.
 */
export function stripImageMetadata(bytes: Uint8Array): StripResult {
  const format = detectImageFormat(bytes);
  if (format === null) return { ok: false, reason: 'unsupported' };

  const limpio =
    format === 'jpeg'
      ? limpiarJpeg(bytes)
      : format === 'png'
        ? limpiarPng(bytes)
        : limpiarWebp(bytes);

  return limpio === null ? { ok: false, reason: 'malformed' } : { ok: true, format, bytes: limpio };
}

/* ------------------------------------------------------------------------ */
/*  JPEG                                                                     */
/* ------------------------------------------------------------------------ */

/**
 * Un JPEG es una sucesion de segmentos `FF xx`, cada uno con su longitud, y
 * al final los datos comprimidos.
 *
 * Los metadatos viven en los segmentos de aplicacion `APPn` (`FF E0` a
 * `FF EF`) y en los comentarios (`FF FE`):
 *
 *   - `APP1`  EXIF —aqui esta el GPS— y tambien XMP.
 *   - `APP13` IPTC, que lleva autor, descripcion y a veces localizacion.
 *   - `APP14` marcas de Adobe.
 *   - `FF FE` comentario libre: lo que el programa de edicion quiera.
 *
 * Se conservan `APP0` (JFIF) y `APP2` (perfil de color).
 *
 * SE COPIA TAL CUAL HASTA EL FINAL EN CUANTO EMPIEZAN LOS DATOS (`FF DA`):
 * desde ahi ya no hay segmentos que interpretar, y seguir buscando marcadores
 * dentro de datos comprimidos es como se corrompe una imagen —un `FF` dentro
 * de los datos no es un marcador—.
 */
function limpiarJpeg(bytes: Uint8Array): Uint8Array | null {
  const trozos: Uint8Array[] = [bytes.subarray(0, 2)]; // SOI
  let i = 2;

  while (i < bytes.length) {
    if (bytes[i] !== 0xff) return null; // Donde tocaba un marcador no hay uno.

    // Los rellenos `FF FF` son legales entre segmentos.
    let marcador = bytes[i + 1];
    while (marcador === 0xff && i + 1 < bytes.length) {
      i += 1;
      marcador = bytes[i + 1];
    }
    if (marcador === undefined) return null;

    // Marcadores sin carga: fin de imagen y reinicios.
    if (marcador === 0xd9) {
      trozos.push(bytes.subarray(i));
      return unir(trozos);
    }

    // A partir del inicio de los datos se copia el resto sin interpretar.
    if (marcador === 0xda) {
      trozos.push(bytes.subarray(i));
      return unir(trozos);
    }

    const longitud = leer16(bytes, i + 2);
    if (longitud === null || longitud < 2) return null;

    const fin = i + 2 + longitud;
    if (fin > bytes.length) return null;

    const esApp = marcador >= 0xe0 && marcador <= 0xef;
    const esComentario = marcador === 0xfe;
    const seQueda = !esComentario && (!esApp || marcador === 0xe0 || marcador === 0xe2);

    if (seQueda) trozos.push(bytes.subarray(i, fin));

    i = fin;
  }

  // Sin marcador de fin: el archivo esta truncado.
  return null;
}

/* ------------------------------------------------------------------------ */
/*  PNG                                                                      */
/* ------------------------------------------------------------------------ */

/**
 * Un PNG es la firma de ocho bytes y luego trozos de
 * `longitud | tipo | datos | comprobacion`.
 *
 * Los metadatos estan en trozos con nombre propio, y se van todos:
 *
 *   - `eXIf`  el bloque EXIF entero, con el GPS dentro.
 *   - `tEXt`, `zTXt`, `iTXt`  texto libre: autor, descripcion, programa.
 *   - `tIME`  la fecha de la ultima modificacion.
 *
 * Los demas se copian **byte a byte**, asi que su comprobacion de integridad
 * sigue siendo valida sin recalcular nada.
 */
const PNG_FUERA = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

function limpiarPng(bytes: Uint8Array): Uint8Array | null {
  const trozos: Uint8Array[] = [bytes.subarray(0, 8)]; // La firma.
  let i = 8;

  while (i < bytes.length) {
    const longitud = leer32(bytes, i);
    if (longitud === null) return null;

    const tipo = texto(bytes, i + 4, 4);
    if (tipo === null) return null;

    // longitud + tipo + datos + comprobacion
    const fin = i + 4 + 4 + longitud + 4;
    if (fin > bytes.length) return null;

    if (!PNG_FUERA.has(tipo)) trozos.push(bytes.subarray(i, fin));

    i = fin;

    if (tipo === 'IEND') return unir(trozos);
  }

  return null;
}

/* ------------------------------------------------------------------------ */
/*  WebP                                                                     */
/* ------------------------------------------------------------------------ */

/**
 * Un WebP es un contenedor RIFF: `RIFF | tamano | WEBP` y luego trozos de
 * `tipo | tamano | datos`, cada uno alineado a par.
 *
 * Fuera van `EXIF` y `XMP `.
 *
 * ========================================================================
 * Y ADEMAS HAY QUE APAGAR DOS BITS, O LA IMAGEN QUEDA MINTIENDO
 * ========================================================================
 * En el formato extendido, el primer trozo (`VP8X`) tiene unas banderas que
 * declaran que trozos opcionales trae el archivo. Si se quitan los datos pero
 * se deja la bandera encendida, el archivo declara un EXIF que ya no existe.
 * Hay decodificadores a los que eso no les gusta, y el resultado seria una
 * imagen que no carga en algunos navegadores y si en otros, que es la peor
 * clase de fallo.
 *
 * Tambien hay que REESCRIBIR EL TAMANO del RIFF: es el tamano declarado del
 * contenedor, y dejarlo con el valor de antes anunciaria mas bytes de los que
 * hay.
 */
const VP8X_EXIF = 0x08;
const VP8X_XMP = 0x04;

function limpiarWebp(bytes: Uint8Array): Uint8Array | null {
  const trozos: Uint8Array[] = [];
  let i = 12; // RIFF + tamano + WEBP

  while (i < bytes.length) {
    const tipo = texto(bytes, i, 4);
    if (tipo === null) return null;

    const tamano = leer32le(bytes, i + 4);
    if (tamano === null) return null;

    // Cada trozo se alinea a par: un tamano impar lleva un byte de relleno.
    const conRelleno = tamano + (tamano % 2);
    const fin = i + 8 + conRelleno;
    if (fin > bytes.length) return null;

    if (tipo === 'EXIF' || tipo === 'XMP ') {
      i = fin;
      continue;
    }

    if (tipo === 'VP8X') {
      // Copia propia: no se puede tocar un byte del original.
      const vp8x = Uint8Array.from(bytes.subarray(i, fin));
      const banderas = vp8x[8];
      if (banderas === undefined) return null;
      vp8x[8] = banderas & ~VP8X_EXIF & ~VP8X_XMP;
      trozos.push(vp8x);
    } else {
      trozos.push(bytes.subarray(i, fin));
    }

    i = fin;
  }

  if (trozos.length === 0) return null;

  const cuerpo = unir(trozos);

  // `RIFF` + tamano + `WEBP` + los trozos que quedan.
  const salida = new Uint8Array(12 + cuerpo.length);
  salida.set(bytes.subarray(0, 12), 0);
  salida.set(cuerpo, 12);

  // El tamano declarado cuenta desde justo despues del propio campo: son los
  // cuatro bytes de `WEBP` mas el cuerpo.
  escribir32le(salida, 4, 4 + cuerpo.length);

  return salida;
}

/* ------------------------------------------------------------------------ */
/*  Lectura de enteros y de etiquetas                                        */
/* ------------------------------------------------------------------------ */

/** Devuelven `null` en vez de leer fuera del array: el archivo esta truncado. */

function leer16(bytes: Uint8Array, offset: number): number | null {
  const a = bytes[offset];
  const b = bytes[offset + 1];
  return a === undefined || b === undefined ? null : (a << 8) | b;
}

function leer32(bytes: Uint8Array, offset: number): number | null {
  const a = bytes[offset];
  const b = bytes[offset + 1];
  const c = bytes[offset + 2];
  const d = bytes[offset + 3];
  if (a === undefined || b === undefined || c === undefined || d === undefined) return null;
  // Sin desplazamientos: `a << 24` pasaria a negativo con el bit alto puesto.
  return a * 0x1000000 + b * 0x10000 + c * 0x100 + d;
}

function leer32le(bytes: Uint8Array, offset: number): number | null {
  const a = bytes[offset];
  const b = bytes[offset + 1];
  const c = bytes[offset + 2];
  const d = bytes[offset + 3];
  if (a === undefined || b === undefined || c === undefined || d === undefined) return null;
  return d * 0x1000000 + c * 0x10000 + b * 0x100 + a;
}

function escribir32le(bytes: Uint8Array, offset: number, valor: number): void {
  bytes[offset] = valor & 0xff;
  bytes[offset + 1] = (valor >>> 8) & 0xff;
  bytes[offset + 2] = (valor >>> 16) & 0xff;
  bytes[offset + 3] = (valor >>> 24) & 0xff;
}

/** Los cuatro caracteres de una etiqueta, o `null` si no caben. */
function texto(bytes: Uint8Array, offset: number, largo: number): string | null {
  if (offset + largo > bytes.length) return null;

  let salida = '';
  for (let i = 0; i < largo; i += 1) {
    salida += String.fromCharCode(bytes[offset + i] ?? 0);
  }
  return salida;
}

function unir(trozos: readonly Uint8Array[]): Uint8Array {
  const total = trozos.reduce((suma, trozo) => suma + trozo.length, 0);
  const salida = new Uint8Array(total);

  let offset = 0;
  for (const trozo of trozos) {
    salida.set(trozo, offset);
    offset += trozo.length;
  }

  return salida;
}
