import { describe, expect, it } from 'vitest';
import { detectImageFormat, stripImageMetadata } from './strip-image-metadata';

/**
 * QUITAR EL GPS DE LA FOTO DE LA CASA DE UN CLIENTE
 * ================================================
 * Una foto de movil lleva dentro las coordenadas del sitio donde se tomo. El
 * permiso que firma el cliente dice que no se mostrara su calle ni su numero,
 * y el encuadre se cuida para que no salga la placa. Publicar el archivo con
 * su direccion exacta escrita dentro deja todo ese cuidado en nada.
 *
 * Las imagenes se construyen aqui byte a byte, a proposito. Un archivo de
 * prueba binario no se puede leer en una revision: nadie sabria si de verdad
 * lleva un EXIF dentro, ni donde. Asi la prueba dice que contiene cada
 * imagen y se ve en el diff.
 */

/** La marca que se busca despues: si sobrevive, el GPS tambien habria sobrevivido. */
const GPS = [0x47, 0x50, 0x53, 0x5f, 0x41, 0x51, 0x55, 0x49]; // "GPS_AQUI"

function bytes(...trozos: (number | number[])[]): Uint8Array {
  return Uint8Array.from(trozos.flat());
}

/** Dos bytes en el orden de JPEG y PNG: el mas significativo primero. */
function u16(valor: number): number[] {
  return [(valor >> 8) & 0xff, valor & 0xff];
}

function u32(valor: number): number[] {
  return [(valor >>> 24) & 0xff, (valor >>> 16) & 0xff, (valor >>> 8) & 0xff, valor & 0xff];
}

/** Cuatro bytes en el orden de RIFF: el menos significativo primero. */
function u32le(valor: number): number[] {
  return [valor & 0xff, (valor >>> 8) & 0xff, (valor >>> 16) & 0xff, (valor >>> 24) & 0xff];
}

function etiqueta(texto: string): number[] {
  return [...texto].map((caracter) => caracter.charCodeAt(0));
}

/** Un segmento de JPEG: marcador, longitud (que se cuenta a si misma) y carga. */
function segmento(marcador: number, carga: number[]): number[] {
  return [0xff, marcador, ...u16(carga.length + 2), ...carga];
}

/** Si una secuencia de bytes aparece dentro de otra. */
function contiene(donde: Uint8Array, que: number[]): boolean {
  return [...donde].join(',').includes(que.join(','));
}

/* ------------------------------------------------------------------------ */
/*  Que formatos se aceptan                                                  */
/* ------------------------------------------------------------------------ */

describe('el formato se deduce de los bytes', () => {
  it('reconoce JPEG, PNG y WebP', () => {
    expect(detectImageFormat(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
    expect(detectImageFormat(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
    expect(detectImageFormat(bytes(etiqueta('RIFF'), u32le(100), etiqueta('WEBP')))).toBe('webp');
  });

  /*
   * EL TIPO QUE DECLARA QUIEN SUBE NO SE MIRA EN NINGUN MOMENTO.
   *
   * Creerselo seria confiar en el cliente justo en la decision de como
   * interpretar sus propios bytes: bastaria con llamar `.jpg` a un SVG —que
   * es un documento que puede llevar JavaScript dentro— para colarlo en un
   * bucket publico.
   */
  it('un SVG disfrazado de foto no pasa', () => {
    const svg = bytes(etiqueta('<svg xmlns="http://www.w3.org/2000/svg"><script/>'));

    expect(detectImageFormat(svg)).toBeNull();
    expect(stripImageMetadata(svg)).toEqual({ ok: false, reason: 'unsupported' });
  });

  it.each([
    ['vacio', []],
    ['un texto', etiqueta('hola')],
    ['un PDF', [0x25, 0x50, 0x44, 0x46]],
    ['un GIF', etiqueta('GIF89a')],
    ['un RIFF que no es WebP', [...etiqueta('RIFF'), ...u32le(4), ...etiqueta('AVI ')]],
  ])('rechaza %s', (_caso, datos) => {
    expect(detectImageFormat(bytes(datos))).toBeNull();
  });
});

/* ------------------------------------------------------------------------ */
/*  JPEG                                                                     */
/* ------------------------------------------------------------------------ */

/** Los datos comprimidos de la prueba, que tienen que salir intactos. */
const DATOS_JPEG = [0xff, 0xda, ...u16(12), 0x01, 0x01, 0x00, 0x11, 0x22, 0x33, 0x44, 0x55];

/**
 * Un JPEG con todo lo que suele traer una foto de movil:
 * la cabecera JFIF, un EXIF con el GPS, un perfil de color, un comentario
 * libre y un bloque IPTC.
 */
function jpegDeMovil(): Uint8Array {
  return bytes(
    [0xff, 0xd8], //                                   SOI
    segmento(0xe0, [...etiqueta('JFIF'), 0x00, 0x01, 0x02]), // APP0, se queda
    segmento(0xe1, [...etiqueta('Exif'), 0x00, 0x00, ...GPS]), // APP1, se va
    segmento(0xe2, [...etiqueta('ICC_PROFILE'), 0x00, 0x99]), // APP2, se queda
    segmento(0xed, [...etiqueta('Photoshop 3.0'), 0x00, ...GPS]), // APP13, se va
    segmento(0xfe, etiqueta('hecha en casa de Fulanito')), //     comentario, se va
    segmento(0xdb, [0x00, 0x10, 0x20]), //             tabla de cuantizacion, se queda
    segmento(0xc0, [0x08, 0x00, 0x10, 0x00, 0x10, 0x01]), //      SOF0, se queda
    DATOS_JPEG,
    [0xff, 0xd9], //                                   EOI
  );
}

describe('JPEG', () => {
  it('el GPS desaparece', () => {
    const original = jpegDeMovil();
    expect(contiene(original, GPS)).toBe(true);

    const limpio = stripImageMetadata(original);
    expect(limpio.ok).toBe(true);
    if (!limpio.ok) return;

    expect(contiene(limpio.bytes, GPS)).toBe(false);
  });

  it('el comentario libre tambien, con el nombre que lleve dentro', () => {
    const limpio = stripImageMetadata(jpegDeMovil());
    if (!limpio.ok) throw new Error('no limpio');

    expect(contiene(limpio.bytes, etiqueta('Fulanito'))).toBe(false);
    expect(contiene(limpio.bytes, etiqueta('Photoshop'))).toBe(false);
    expect(contiene(limpio.bytes, etiqueta('Exif'))).toBe(false);
  });

  it('se queda la cabecera JFIF y el perfil de color', () => {
    const limpio = stripImageMetadata(jpegDeMovil());
    if (!limpio.ok) throw new Error('no limpio');

    // JFIF porque algunos decodificadores veteranos la esperan, y el perfil
    // porque sin el una foto de movil se publica con los colores lavados.
    expect(contiene(limpio.bytes, etiqueta('JFIF'))).toBe(true);
    expect(contiene(limpio.bytes, etiqueta('ICC_PROFILE'))).toBe(true);
  });

  it('la imagen sigue siendo un JPEG completo', () => {
    const limpio = stripImageMetadata(jpegDeMovil());
    if (!limpio.ok) throw new Error('no limpio');

    const b = limpio.bytes;
    expect([b[0], b[1]]).toEqual([0xff, 0xd8]); //                SOI
    expect([b[b.length - 2], b[b.length - 1]]).toEqual([0xff, 0xd9]); // EOI
    expect(contiene(b, [0xff, 0xc0])).toBe(true); //              SOF0
    expect(contiene(b, [0xff, 0xdb])).toBe(true); //              tabla
  });

  it('los pixeles no se tocan: salen byte a byte como entraron', () => {
    // No se recodifica nada. Si esto cambiara, la galeria perderia calidad en
    // cada subida sin que nadie lo pidiera.
    const limpio = stripImageMetadata(jpegDeMovil());
    if (!limpio.ok) throw new Error('no limpio');

    expect(contiene(limpio.bytes, DATOS_JPEG)).toBe(true);
  });

  /*
   * LA TRAMPA DE LOS DATOS COMPRIMIDOS.
   *
   * Dentro de los datos de una imagen aparecen bytes `FF` por puro azar, y
   * un `FF E1` ahi NO es un segmento EXIF: es parte de los pixeles. Un
   * limpiador que siguiera buscando marcadores despues del inicio de los
   * datos recortaria un trozo de la imagen y la corromperia, y solo en
   * algunas fotos: el peor fallo posible, porque pasaria las pruebas con
   * cualquier imagen que no tuviera esa combinacion.
   */
  it('un FF E1 dentro de los pixeles no se confunde con un EXIF', () => {
    const pixelesConTrampa = [0xff, 0xda, ...u16(8), 0x01, 0x00, 0xff, 0xe1, 0x00, 0x7f];

    const original = bytes(
      [0xff, 0xd8],
      segmento(0xc0, [0x08, 0x00, 0x10, 0x00, 0x10, 0x01]),
      pixelesConTrampa,
      [0xff, 0xd9],
    );

    const limpio = stripImageMetadata(original);
    if (!limpio.ok) throw new Error('no limpio');

    expect(contiene(limpio.bytes, pixelesConTrampa)).toBe(true);
    expect(limpio.bytes).toEqual(original);
  });

  it('limpiar dos veces da lo mismo', () => {
    const una = stripImageMetadata(jpegDeMovil());
    if (!una.ok) throw new Error('no limpio');
    const otra = stripImageMetadata(una.bytes);
    if (!otra.ok) throw new Error('no limpio');

    expect(otra.bytes).toEqual(una.bytes);
  });

  it.each([
    ['un segmento que declara mas de lo que hay', bytes([0xff, 0xd8], [0xff, 0xe1], u16(9999))],
    ['sin marcador de fin', bytes([0xff, 0xd8], segmento(0xdb, [0x00]))],
    [
      'basura donde tocaba un marcador',
      bytes([0xff, 0xd8], segmento(0xdb, [0x00]), [0x41, 0x42, 0x43]),
    ],
    ['una longitud imposible', bytes([0xff, 0xd8], [0xff, 0xe1, 0x00, 0x00])],
  ])('rechaza %s en vez de devolver algo roto', (_caso, datos) => {
    // Devolver una imagen a medias seria peor que rechazarla: se publicaria.
    expect(stripImageMetadata(datos)).toEqual({ ok: false, reason: 'malformed' });
  });
});

/* ------------------------------------------------------------------------ */
/*  PNG                                                                      */
/* ------------------------------------------------------------------------ */

const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Un trozo de PNG: longitud, tipo, datos y los cuatro bytes de comprobacion. */
function trozoPng(tipo: string, datos: number[]): number[] {
  return [...u32(datos.length), ...etiqueta(tipo), ...datos, 0xde, 0xad, 0xbe, 0xef];
}

function pngConExif(): Uint8Array {
  return bytes(
    FIRMA_PNG,
    trozoPng('IHDR', [...u32(16), ...u32(16), 0x08, 0x02, 0x00, 0x00, 0x00]),
    trozoPng('eXIf', GPS),
    trozoPng('tEXt', etiqueta('Author\u0000Fulanito')),
    trozoPng('iTXt', etiqueta('Comment\u0000casa de Fulanito')),
    trozoPng('tIME', [0x07, 0xea, 0x0a, 0x19, 0x0c, 0x00, 0x00]),
    trozoPng('IDAT', [0x78, 0x9c, 0x01, 0x02, 0x03]),
    trozoPng('IEND', []),
  );
}

describe('PNG', () => {
  it('el GPS y el texto libre desaparecen', () => {
    const limpio = stripImageMetadata(pngConExif());
    expect(limpio.ok).toBe(true);
    if (!limpio.ok) return;

    expect(contiene(limpio.bytes, GPS)).toBe(false);
    expect(contiene(limpio.bytes, etiqueta('Fulanito'))).toBe(false);
    expect(contiene(limpio.bytes, etiqueta('eXIf'))).toBe(false);
    expect(contiene(limpio.bytes, etiqueta('tEXt'))).toBe(false);
    expect(contiene(limpio.bytes, etiqueta('iTXt'))).toBe(false);
  });

  it('la fecha de modificacion tambien se va', () => {
    // Dice a que hora se edito la foto de esa casa. No aporta nada y situa.
    const limpio = stripImageMetadata(pngConExif());
    if (!limpio.ok) throw new Error('no limpio');

    expect(contiene(limpio.bytes, etiqueta('tIME'))).toBe(false);
  });

  it('la cabecera y los pixeles se quedan, y el archivo acaba en IEND', () => {
    const limpio = stripImageMetadata(pngConExif());
    if (!limpio.ok) throw new Error('no limpio');

    expect(contiene(limpio.bytes, etiqueta('IHDR'))).toBe(true);
    expect(contiene(limpio.bytes, etiqueta('IDAT'))).toBe(true);
    expect(texto(limpio.bytes, limpio.bytes.length - 8, 4)).toBe('IEND');
  });

  /*
   * Los trozos que se quedan se copian byte a byte, asi que su comprobacion
   * de integridad sigue valiendo. Si alguien «optimizara» esto reescribiendo
   * los datos sin recalcular la comprobacion, el navegador rechazaria la
   * imagen entera.
   */
  it('los trozos que se quedan llevan su comprobacion intacta', () => {
    const limpio = stripImageMetadata(pngConExif());
    if (!limpio.ok) throw new Error('no limpio');

    expect(contiene(limpio.bytes, [0xde, 0xad, 0xbe, 0xef])).toBe(true);
  });

  it.each([
    ['sin IEND', bytes(FIRMA_PNG, trozoPng('IHDR', [0x00]))],
    ['un trozo que declara mas de lo que hay', bytes(FIRMA_PNG, u32(9999), etiqueta('eXIf'))],
  ])('rechaza %s', (_caso, datos) => {
    expect(stripImageMetadata(datos)).toEqual({ ok: false, reason: 'malformed' });
  });
});

/* ------------------------------------------------------------------------ */
/*  WebP                                                                     */
/* ------------------------------------------------------------------------ */

/** Un trozo de RIFF: tipo, tamano y datos, alineado a par. */
function trozoWebp(tipo: string, datos: number[]): number[] {
  const relleno = datos.length % 2 === 1 ? [0x00] : [];
  return [...etiqueta(tipo), ...u32le(datos.length), ...datos, ...relleno];
}

/**
 * Las banderas del VP8X con cuatro cosas encendidas: perfil de color (0x20),
 * canal alfa (0x10), EXIF (0x08) y XMP (0x04).
 *
 * Las dos primeras estan ahi a proposito: son las que TIENEN que sobrevivir.
 * Si se apagaran de mas, una foto con transparencia se publicaria con un
 * fondo negro y nadie sabria por que.
 */
const VP8X_CON_METADATOS = [0x3c, 0x00, 0x00, 0x00, 0x0f, 0x00, 0x00, 0x0f, 0x00, 0x00];

function webpConExif(): Uint8Array {
  const cuerpo = [
    ...trozoWebp('VP8X', VP8X_CON_METADATOS),
    ...trozoWebp('VP8 ', [0x01, 0x02, 0x03, 0x04]),
    ...trozoWebp('EXIF', GPS),
    ...trozoWebp('XMP ', etiqueta('<x>casa de Fulanito</x>')),
  ];

  return bytes(etiqueta('RIFF'), u32le(4 + cuerpo.length), etiqueta('WEBP'), cuerpo);
}

describe('WebP', () => {
  it('el GPS y el XMP desaparecen', () => {
    const limpio = stripImageMetadata(webpConExif());
    expect(limpio.ok).toBe(true);
    if (!limpio.ok) return;

    expect(contiene(limpio.bytes, GPS)).toBe(false);
    expect(contiene(limpio.bytes, etiqueta('Fulanito'))).toBe(false);
    expect(contiene(limpio.bytes, etiqueta('EXIF'))).toBe(false);
    expect(contiene(limpio.bytes, etiqueta('XMP '))).toBe(false);
  });

  it('los pixeles se quedan', () => {
    const limpio = stripImageMetadata(webpConExif());
    if (!limpio.ok) throw new Error('no limpio');

    expect(contiene(limpio.bytes, etiqueta('VP8 '))).toBe(true);
    expect(contiene(limpio.bytes, [0x01, 0x02, 0x03, 0x04])).toBe(true);
  });

  /*
   * LAS DOS BANDERAS QUE HAY QUE APAGAR.
   *
   * El VP8X declara que trozos opcionales trae el archivo. Quitar los datos y
   * dejar la bandera encendida deja un archivo que anuncia un EXIF que ya no
   * existe: hay decodificadores a los que eso no les gusta, y el resultado
   * seria una imagen que carga en unos navegadores y no en otros. La peor
   * clase de fallo, porque parece que funciona.
   */
  it('las banderas de EXIF y XMP del VP8X quedan apagadas', () => {
    const limpio = stripImageMetadata(webpConExif());
    if (!limpio.ok) throw new Error('no limpio');

    // 12 de la cabecera RIFF + 8 de la cabecera del trozo = el primer dato.
    const banderas = limpio.bytes[20];
    expect(banderas).toBeDefined();
    expect((banderas ?? 0) & 0x08).toBe(0); // EXIF
    expect((banderas ?? 0) & 0x04).toBe(0); // XMP
    // El perfil de color y el canal alfa se quedan como estaban.
    expect((banderas ?? 0) & 0x30).toBe(0x30);
  });

  /*
   * El tamano del RIFF es el tamano DECLARADO del contenedor. Dejarlo con el
   * valor de antes anunciaria mas bytes de los que hay, y un decodificador
   * estricto lo daria por truncado.
   */
  it('el tamano declarado del contenedor se reescribe', () => {
    const limpio = stripImageMetadata(webpConExif());
    if (!limpio.ok) throw new Error('no limpio');

    const declarado =
      (limpio.bytes[4] ?? 0) +
      (limpio.bytes[5] ?? 0) * 0x100 +
      (limpio.bytes[6] ?? 0) * 0x10000 +
      (limpio.bytes[7] ?? 0) * 0x1000000;

    // Cuenta desde justo despues del propio campo: el archivo menos `RIFF` y
    // menos los cuatro bytes del tamano.
    expect(declarado).toBe(limpio.bytes.length - 8);
  });

  it('un WebP simple, sin metadatos, sale igual que entro', () => {
    const cuerpo = trozoWebp('VP8 ', [0x11, 0x22, 0x33, 0x44]);
    const original = bytes(etiqueta('RIFF'), u32le(4 + cuerpo.length), etiqueta('WEBP'), cuerpo);

    const limpio = stripImageMetadata(original);
    if (!limpio.ok) throw new Error('no limpio');

    expect(limpio.bytes).toEqual(original);
  });

  it('rechaza un trozo que declara mas de lo que hay', () => {
    const original = bytes(
      etiqueta('RIFF'),
      u32le(100),
      etiqueta('WEBP'),
      etiqueta('VP8 '),
      u32le(9999),
    );

    expect(stripImageMetadata(original)).toEqual({ ok: false, reason: 'malformed' });
  });
});

/** Los cuatro caracteres que empiezan en `offset`. Solo para las aserciones. */
function texto(bytes: Uint8Array, offset: number, largo: number): string {
  let salida = '';
  for (let i = 0; i < largo; i += 1) salida += String.fromCharCode(bytes[offset + i] ?? 0);
  return salida;
}
