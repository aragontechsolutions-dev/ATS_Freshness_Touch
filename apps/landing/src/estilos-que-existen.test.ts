import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * TODA CLASE `ft-` QUE SE USA TIENE QUE EXISTIR
 * =============================================
 * Las clases propias del sitio publico viven en `styles.css`. Tailwind no avisa de
 * nada si se escribe una que no existe: el navegador la ignora en silencio y
 * el elemento se pinta SIN ESTILO.
 *
 * ========================================================================
 * LO QUE PASA CUANDO FALLA, Y POR QUE NADIE LO VE
 * ========================================================================
 * Un boton con una clase inventada no sale roto ni descolocado: sale como
 * TEXTO NEGRO SUELTO. Se puede pulsar, hace lo que tiene que hacer, y nadie
 * lo denuncia como fallo — simplemente nadie lo pulsa, porque no parece un
 * boton.
 *
 * EN EL PANEL PASO TRES VECES, y las tres se descubrieron por casualidad:
 * `ft-btn-outline` en seis sitios, `ft-h2` en dos secciones y un `ft-btn` que
 * sobraba. Lo que fallaba se pintaba como texto negro suelto, se podia pulsar
 * y hacia lo que tenia que hacer — simplemente nadie lo pulsaba.
 *
 * Esta es la misma guardia para el sitio publico. Es una copia y no un
 * ayudante compartido A PROPOSITO: cada aplicacion tiene SU hoja de estilos,
 * y lo que se comprueba es que cada una case con la suya. Un ayudante
 * compartido tendria que recibir las dos rutas y seria mas largo que esto.
 *
 * Una errata de una letra hace lo mismo, y una clase que se renombra en
 * `styles.css` deja atras todos los sitios que la usaban. Esta prueba lo
 * convierte en un fallo de la integracion continua en vez de en algo que se
 * descubre cuando alguien pregunta por que ese boton no parece un boton.
 */

const RAIZ = import.meta.dirname;

const ESTILOS = readFileSync(join(RAIZ, 'styles.css'), 'utf8');

/** Las clases `ft-` que `styles.css` define de verdad. */
const DEFINIDAS = new Set(
  [...ESTILOS.matchAll(/\.(ft-[a-z0-9-]+)/g)].map((encontrado) => encontrado[1] ?? ''),
);

/** Todos los `.tsx` del sitio publico, a cualquier profundidad. */
function componentes(directorio: string): string[] {
  return readdirSync(directorio, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(directorio, entrada.name);
    if (entrada.isDirectory()) return componentes(ruta);
    return entrada.isFile() && entrada.name.endsWith('.tsx') ? [ruta] : [];
  });
}

/**
 * Las clases `ft-` que usa un archivo.
 *
 * Se buscan dentro de las cadenas de texto y se parten por espacios, en vez
 * de buscar `ft-` suelto en todo el archivo. El motivo es que `left-2` y
 * `shift-3` CONTIENEN «ft-2» y «ft-3»: buscando a lo bruto, la prueba
 * denunciaria clases que nadie ha escrito.
 */
function clasesUsadas(fuente: string): string[] {
  const cadenas = [...fuente.matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`/g)].map(
    (encontrado) => encontrado[1] ?? encontrado[2] ?? encontrado[3] ?? '',
  );

  return cadenas
    .flatMap((cadena) => cadena.split(/\s+/))
    .filter((trozo) => /^ft-[a-z0-9-]+$/.test(trozo));
}

describe('las clases propias del sitio publico', () => {
  it('styles.css define unas cuantas, asi que la prueba mira algo real', () => {
    // Si el fichero se moviera y esto leyera un vacio, el resto de la prueba
    // pasaria sin comprobar nada.
    expect(DEFINIDAS.size).toBeGreaterThan(10);
  });

  it('todas las que se usan existen en styles.css', () => {
    const inventadas = componentes(RAIZ).flatMap((ruta) =>
      clasesUsadas(readFileSync(ruta, 'utf8'))
        .filter((clase) => !DEFINIDAS.has(clase))
        .map((clase) => `${ruta.slice(RAIZ.length + 1)}: ${clase}`),
    );

    expect([...new Set(inventadas)]).toEqual([]);
  });
});
