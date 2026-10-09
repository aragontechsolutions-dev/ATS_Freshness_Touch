import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * EL PIN DE LA PUERTA NO ENTRA EN EL MOTOR DE PRECIOS
 * ===================================================
 * Esta prueba no comprueba un calculo: comprueba que CIERTO CODIGO NO
 * EXISTE. Es rara a proposito, y el motivo es de seguridad.
 *
 * ========================================================================
 * EL FRAUDE QUE IMPIDE
 * ========================================================================
 * Desde la Etapa 3.9 el cliente marca en un mapa donde esta su puerta. Es
 * util para que el equipo encuentre la casa y es inofensivo MIENTRAS NO
 * TOQUE EL DINERO.
 *
 * Hoy la distancia —y con ella el recargo por milla y la zona— sale del
 * CODIGO POSTAL. El dia que alguien, con toda su buena intencion, piense
 * «ya que tenemos las coordenadas exactas, calculemos la distancia con
 * ellas, que es mas preciso», habra abierto esto:
 *
 *   el cliente arrastra el pin hacia Atlanta y se cobra menos.
 *
 * Un fraude de un gesto, sin herramientas, desde el movil, que no deja mas
 * rastro que un punto en un mapa. Y lo peor: el sistema no lo vería como un
 * ataque, sino como una cotizacion correcta.
 *
 * Un comentario que diga «no hagas esto» no lo impide. Esto si: en cuanto
 * el motor importe el pin, esta prueba se pone roja y hay que venir aqui a
 * leer por que.
 *
 * ========================================================================
 * SI ALGUN DIA HAY QUE HACERLO DE VERDAD
 * ========================================================================
 * La forma segura NO es usar el pin del cliente, sino la coordenada
 * GEOCODIFICADA de la direccion (`addresses.latitude/longitude`), que la
 * resuelve un servicio externo a partir de lo que el cliente escribio y
 * que el cliente no puede arrastrar. Esta prueba lo permite: solo prohibe
 * el pin.
 */

const DIRECTORIO = new URL('.', import.meta.url).pathname;

/** Los archivos del motor, sin las pruebas. */
function fuentesDelMotor(): string[] {
  return readdirSync(DIRECTORIO)
    .filter((nombre) => nombre.endsWith('.ts') && !nombre.endsWith('.test.ts'))
    .map((nombre) => join(DIRECTORIO, nombre));
}

describe('el motor de precios y el pin de la puerta', () => {
  it('NO IMPORTA NADA DEL PIN', () => {
    const culpables = fuentesDelMotor().filter((ruta) => {
      const fuente = readFileSync(ruta, 'utf8');
      return /\bdoor-pin\b|\bDoorPin\b|\bdoorPin\b/.test(fuente);
    });

    expect(
      culpables,
      'El motor de precios no puede ver el pin del cliente: podria arrastrarlo ' +
        'hacia Atlanta y pagarse un descuento. Lee la cabecera de este archivo.',
    ).toEqual([]);
  });

  it('y LO QUE CALCULA DINERO no lee coordenadas de ninguna clase', () => {
    /*
     * Mas amplio que lo anterior a proposito: copiar los dos numeros a otro
     * nombre —`lat`, `punto`, `ubicacion`— esquivaria la prueba de arriba
     * sin esquivar el problema.
     *
     * ====================================================================
     * POR QUE `config.ts` QUEDA FUERA, Y NO ES UNA EXCEPCION COMODA
     * ====================================================================
     * Ahi viven unas coordenadas legitimas: las de LA SEDE DE LA EMPRESA
     * (`baseOfOperations`), que centran el mapa de zonas. No son las del
     * cliente, no las elige el cliente y no las puede arrastrar: las pone
     * ADMIN desde el panel (`docs/17` §7).
     *
     * La diferencia que importa no es «coordenadas si o no», es QUIEN LAS
     * CONTROLA. Las de la empresa son nuestras; el pin es del cliente.
     *
     * Lo que se vigila aqui son los archivos que de verdad producen la
     * cifra. Si manana uno de ellos necesita coordenadas, que sea una
     * decision que alguien tome viniendo a leer esto.
     */
    const QUE_CALCULAN_DINERO = [
      'engine.ts',
      'travel.ts',
      'zones.ts',
      'mileage.ts',
      'deposit.ts',
      'money.ts',
      'rates.ts',
    ];

    const culpables = fuentesDelMotor()
      .filter((ruta) => QUE_CALCULAN_DINERO.includes(ruta.split('/').pop() ?? ''))
      .filter((ruta) => {
        const fuente = readFileSync(ruta, 'utf8');
        // Solo codigo: un comentario que lo mencione no es usarlo.
        const sinComentarios = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        return /\blatitude\b|\blongitude\b|\blat\b|\blon\b|\blng\b/.test(sinComentarios);
      });

    expect(culpables).toEqual([]);
  });

  it('y la lista de archivos vigilados no se ha quedado vieja', () => {
    /*
     * La prueba de arriba vigila una lista escrita a mano, y una lista
     * escrita a mano se queda vieja en cuanto alguien añade un archivo: el
     * motor crecería y la guardia seguiría en verde mirando a otro lado.
     *
     * Esto no obliga a vigilarlo todo —`config.ts` y `catalog.ts` son
     * declaraciones, no calculos— pero si obliga a que añadir un archivo
     * nuevo sea una decision consciente.
     */
    const CONOCIDOS = [
      'catalog.ts',
      'config.ts',
      'deposit.ts',
      'duration.ts',
      'engine.ts',
      'index.ts',
      'mileage.ts',
      'money.ts',
      'rates.ts',
      'size-bands.ts',
      'travel.ts',
      'zones.ts',
    ];

    const actuales = fuentesDelMotor()
      .map((ruta) => ruta.split('/').pop() ?? '')
      .sort();

    expect(
      actuales.filter((n) => !CONOCIDOS.includes(n)),
      'Hay un archivo nuevo en el motor de precios. Decide si calcula dinero: ' +
        'si lo hace, añadelo a QUE_CALCULAN_DINERO; si no, a CONOCIDOS.',
    ).toEqual([]);
  });
});
