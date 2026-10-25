import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CatalogAddOnSchema,
  CatalogLimitsSchema,
  CatalogServiceSchema,
  CatalogZoneSchema,
} from './catalog';
import { GallerySchema, PublicGallerySchema } from './gallery';

/**
 * LO QUE LEE LA WEB TOLERA CAMPOS NUEVOS; LO QUE SE GUARDA, NO
 * ===========================================================
 * En este paquete casi todo es `strictObject`: rechaza las claves que no
 * conoce. Para lo que se GUARDA y para lo que el panel ESCRIBE es lo
 * correcto — una clave mal escrita no puede quedarse en la base sin salir
 * nunca en la web.
 *
 * ========================================================================
 * PARA LO QUE EL NAVEGADOR LEE ES UN FALLO, Y COSTO UN INCIDENTE
 * ========================================================================
 * La web y la API se despliegan POR SEPARADO. Entre un despliegue y otro hay
 * una ventana —minutos, o lo que tarde alguien en recargar— en la que una web
 * vieja habla con una API nueva.
 *
 * Si en esa ventana la API devuelve un campo que el contrato de la web no
 * conoce, un contrato estricto descarta la respuesta ENTERA. No es que falte
 * el campo nuevo: es que desaparece la seccion completa. Y en silencio,
 * porque el sitio esta programado para no romperse cuando la API no responde.
 *
 * PASO DE VERDAD. La API empezo a devolver las fotos de la galeria; los
 * navegadores con la version anterior de la web recibieron `photos` y
 * `posterUrl`, claves que su contrato no conocia, y la seccion de antes y
 * despues dejo de pintarse —videos incluidos— sin un solo error visible. Se
 * descubrio porque alguien pregunto por que no se veian las fotos.
 *
 * Esta prueba ata las dos mitades para que no se vuelva a mezclar: lo que se
 * lee ignora lo que no conoce, y lo que se guarda sigue siendo estricto.
 */

describe('lo que la web LEE ignora los campos que no conoce', () => {
  it('la galeria publica, aunque traiga un campo de una API mas nueva', () => {
    const deUnaApiMasNueva = {
      videos: [
        {
          videoId: 'dQw4w9WgXcQ',
          title: { en: 'Kitchen', es: 'Cocina' },
          posterUrl: null,
          duracionSegundos: 42, // el campo que todavia no existe
        },
      ],
      photos: [
        {
          url: 'https://ejemplo.supabase.co/x.jpg',
          title: { en: null, es: null },
          anchoPx: 1920, // y otro
        },
      ],
      destacado: 'videos', // y uno de primer nivel
    };

    const parsed = PublicGallerySchema.safeParse(deUnaApiMasNueva);

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    // Lo conocido llega entero; lo demas simplemente no esta.
    expect(parsed.data.videos[0]?.videoId).toBe('dQw4w9WgXcQ');
    expect(parsed.data.photos[0]?.url).toBe('https://ejemplo.supabase.co/x.jpg');
    expect(parsed.data.photos).toHaveLength(1);
  });

  it.each([
    [
      'un servicio del catalogo',
      CatalogServiceSchema,
      {
        code: 'STANDARD',
        instantQuote: true,
        // `z.record` sobre una enumeracion las exige todas.
        rates: {
          ONE_TIME: { fromCents: 18500 },
          WEEKLY: { fromCents: 12000 },
          BIWEEKLY: { fromCents: 13500 },
          MONTHLY: { fromCents: 15000 },
        },
        fromCents: 12000,
        novedad: true,
      },
    ],
    [
      'un extra',
      CatalogAddOnSchema,
      {
        code: 'INSIDE_FRIDGE',
        unit: 'FLAT',
        unitAmountCents: 2500,
        maxQuantity: 1,
        novedad: true,
      },
    ],
    [
      'una zona',
      CatalogZoneSchema,
      {
        code: 'A',
        maxMiles: 35,
        serviceable: true,
        instantQuote: true,
        surchargePerMileCents: 0,
        novedad: true,
      },
    ],
    [
      'los limites',
      CatalogLimitsSchema,
      {
        bedrooms: { min: 1, max: 6 },
        bathrooms: { min: 1, max: 5 },
        squareFeet: { min: 500, max: 6000 },
        addOnsMax: 5,
        novedad: true,
      },
    ],
  ])('%s', (_caso, schema, payload) => {
    expect(schema.safeParse(payload).success).toBe(true);
  });

  /*
   * El catalogo entero se comprueba leyendo el archivo y no construyendo un
   * objeto de prueba: tiene objetos escritos EN LINEA —la base de
   * operaciones, los limites de cada medida— que no se pueden validar por
   * separado, y son exactamente los que alguien ampliaria sin pensar.
   */
  it('y ninguna parte del catalogo ha vuelto a ser estricta', () => {
    const fuente = readFileSync(join(import.meta.dirname, 'catalog.ts'), 'utf8');

    /*
     * Sin los comentarios, porque la cabecera del archivo EXPLICA por que no
     * es estricto — y nombrarlo haria fallar la prueba. Seria la peor clase
     * de prueba: la que obliga a borrar el comentario que dice por que
     * existe.
     */
    const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

    expect(codigo).not.toContain('strictObject');
  });
});

describe('lo que se GUARDA sigue rechazando lo que no conoce', () => {
  /*
   * La otra mitad, y no es simetrica por capricho: aqui el que manda es el
   * panel, no una version desplegada por separado. Una clave mal escrita que
   * se guardara no saldria nunca en la web, y nadie entenderia por que.
   */
  it('la galeria guardada rechaza una clave inventada', () => {
    expect(GallerySchema.safeParse({ videos: [], photos: [], destacado: 'x' }).success).toBe(false);
  });

  it('y una clave inventada dentro de un video', () => {
    expect(
      GallerySchema.safeParse({
        videos: [{ videoId: 'dQw4w9WgXcQ', title: { en: null, es: null }, duracion: 42 }],
      }).success,
    ).toBe(false);
  });

  it('y dentro de una foto', () => {
    expect(
      GallerySchema.safeParse({
        photos: [
          {
            path: 'photos/0123456789abcdef0123456789abcdef.jpg',
            title: { en: null, es: null },
            ancho: 1920,
          },
        ],
      }).success,
    ).toBe(false);
  });
});
