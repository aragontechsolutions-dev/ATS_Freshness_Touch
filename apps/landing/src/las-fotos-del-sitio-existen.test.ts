import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * TODA FOTO QUE EL SITIO PIDE TIENE QUE EXISTIR, Y AL REVES
 * ========================================================
 * Las fotos de la portada, de los servicios, de «que incluye» y de la carta
 * de la fundadora viven en `public/fotos/` y se piden por una ruta escrita a
 * mano en el `.tsx`. Vite NO comprueba esas rutas: lo que hay en `public/` se
 * copia tal cual y nadie mira si alguien las pide.
 *
 * ==========================================================================
 * LO QUE PASA CUANDO FALLA, Y POR QUE NO SE VE EN LOS SEIS PASOS DE CI
 * ==========================================================================
 * Una ruta mal escrita no rompe la compilacion ni el `typecheck`: el
 * navegador pide el archivo, recibe un 404 y pinta el hueco. En la portada
 * eso es un rectangulo gris donde deberia estar la cara de la fundadora, en
 * la pagina que genera los ingresos, y solo se descubre abriendo el sitio.
 *
 * Es la misma clase de fallo que ya costo un despliegue con `vercel.json` y
 * una semana de SEO con el dominio canonico: lo que ningun paso de CI mira.
 *
 * ==========================================================================
 * TAMBIEN VIGILA EL LADO CONTRARIO: FOTOS QUE NADIE PIDE
 * ==========================================================================
 * Una imagen que se queda en `public/` despues de cambiar un diseno no da
 * error: se despliega, ocupa sitio y nadie se acuerda de por que esta. Con
 * esta mitad, quitarla del codigo obliga a quitarla del disco.
 */

const RAIZ = import.meta.dirname;
const CARPETA = join(RAIZ, '../public/fotos');

/** Todos los `.tsx` del sitio, a cualquier profundidad. */
function fuentes(directorio: string): string[] {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) return fuentes(ruta);
    return entrada.name.endsWith('.tsx') ? [ruta] : [];
  });
}

/** Las rutas `/fotos/…` que el codigo pide, sin repetir. */
const PEDIDAS = new Set(
  fuentes(RAIZ).flatMap((fichero) =>
    [...readFileSync(fichero, 'utf8').matchAll(/\/fotos\/([a-z0-9-]+\.webp)/g)].map(
      (encontrado) => encontrado[1] ?? '',
    ),
  ),
);

/** Lo que de verdad hay en la carpeta. */
const EN_DISCO = new Set(readdirSync(CARPETA).filter((nombre) => nombre.endsWith('.webp')));

describe('las fotos del sitio', () => {
  it('la prueba esta mirando la carpeta de verdad', () => {
    // Si la ruta cambiara, el resto pasaria sin comprobar nada.
    expect(EN_DISCO.size).toBeGreaterThan(0);
    expect(PEDIDAS.size).toBeGreaterThan(0);
  });

  it('TODA FOTO QUE SE PIDE EXISTE EN `public/fotos`', () => {
    const faltan = [...PEDIDAS].filter((nombre) => !EN_DISCO.has(nombre)).sort();

    expect(faltan, 'el navegador pintaria un hueco en su sitio').toEqual([]);
  });

  it('y ninguna foto se queda en la carpeta sin que nadie la pida', () => {
    const sobran = [...EN_DISCO].filter((nombre) => !PEDIDAS.has(nombre)).sort();

    expect(sobran, 'se despliegan y ocupan sitio sin salir en ninguna parte').toEqual([]);
  });

  it('CADA FOTO TIENE SU VERSION PEQUENA, que es la que descarga un movil', () => {
    /*
     * El `srcSet` de cada imagen ofrece dos anchos. Si faltara el pequeno, un
     * telefono se bajaria el grande: en la portada eso es 66 KB en vez de 28,
     * y es justo la imagen que Google cronometra para Core Web Vitals.
     *
     * Se comprueba por pares: toda foto grande tiene una hermana menor.
     */
    const anchos = new Map<string, number[]>();
    for (const nombre of EN_DISCO) {
      const partes = /^(.+)-(\d+)\.webp$/.exec(nombre);
      if (partes === null) continue;
      const base = partes[1] ?? '';
      anchos.set(base, [...(anchos.get(base) ?? []), Number(partes[2])]);
    }

    for (const [base, medidas] of anchos) {
      expect(medidas.length, `«${base}» deberia tener dos anchos, tiene ${medidas.length}`).toBe(2);
    }
  });

  it('NINGUNA PESA DEMASIADO para una pagina que se abre con datos moviles', () => {
    /*
     * El tope no es un capricho: una clienta mirando el movil en el coche con
     * cobertura mala abandona antes de que cargue. 120 KB es holgado para
     * WebP a estas medidas —la mas pesada hoy anda por 79— y deja margen para
     * cambiar una foto sin pelearse con la prueba, pero corta en seco el
     * descuido de arrastrar aqui un JPG de camara de 4 MB renombrado.
     */
    const pesadas = [...EN_DISCO]
      .map((nombre) => ({ nombre, kb: statSync(join(CARPETA, nombre)).size / 1024 }))
      .filter((foto) => foto.kb > 120)
      .map((foto) => `${foto.nombre}: ${Math.round(foto.kb)} KB`);

    expect(pesadas).toEqual([]);
  });

  it('la carpeta existe y no se ha movido', () => {
    expect(existsSync(CARPETA)).toBe(true);
  });
});
