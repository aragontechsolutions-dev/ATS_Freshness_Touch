import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { whatsappHref } from '@freshness/types';

/**
 * DESDE LA ETAPA 3.16 EL SITIO SE ESCRIBE, NO SE LLAMA
 * ====================================================
 * Todos los botones de contacto del sitio publico abren WhatsApp. El motivo
 * no es estetico:
 *
 *   - Un enlace `tel:` en un ordenador abre Skype, Teams o directamente
 *     nada, segun lo que tenga registrado el sistema.
 *   - De noche, o desde el trabajo, nadie llama. Y quien no llama, se va.
 *   - Y sobre todo NO DEJA RASTRO. Un cliente que no llega a llamar es un
 *     cliente del que la empresa nunca se entero. En las zonas lejanas
 *     —donde los trabajos son mas grandes— eso es justo lo que pasaba.
 *
 * Esta prueba vigila que nadie reintroduzca un `tel:` por costumbre.
 */

const RAIZ = join(import.meta.dirname, '..');

/**
 * El archivo SIN COMENTARIOS.
 *
 * Hace falta porque los comentarios de esta etapa explican por que ya no hay
 * enlaces `tel:`, y sin quitarlos la prueba se senalaria a si misma: estaria
 * prohibiendo documentar la decision que vigila.
 */
function soloCodigo(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Todo el codigo del sitio publico, archivo a archivo, sin comentarios. */
function fuentesDelSitio(): { ruta: string; texto: string }[] {
  const encontrados: { ruta: string; texto: string }[] = [];

  const recorrer = (dir: string): void => {
    for (const entrada of readdirSync(dir)) {
      const completa = join(dir, entrada);

      if (statSync(completa).isDirectory()) {
        recorrer(completa);
        continue;
      }

      if (!/\.tsx?$/.test(entrada) || entrada.includes('.test.')) continue;
      encontrados.push({ ruta: completa, texto: soloCodigo(readFileSync(completa, 'utf8')) });
    }
  };

  recorrer(RAIZ);
  return encontrados;
}

const FUENTES = fuentesDelSitio();

const CALCULADORA = soloCodigo(readFileSync(join(RAIZ, 'sections/QuoteCalculator.tsx'), 'utf8'));

/* -------------------------------------------------------------------------- */

describe('ya no quedan enlaces de llamada', () => {
  it('ningun archivo del sitio construye un `tel:`', () => {
    const culpables = FUENTES.filter(({ texto }) => texto.includes('tel:')).map(({ ruta }) => ruta);

    expect(culpables).toEqual([]);
  });

  it('ni queda el ayudante que los generaba', () => {
    // `phoneHref` se retiro del contrato en la etapa 3.16. Si alguien lo
    // reintroduce, esta prueba lo dice antes de que vuelva a un boton.
    const culpables = FUENTES.filter(({ texto }) => texto.includes('phoneHref')).map(
      ({ ruta }) => ruta,
    );

    expect(culpables).toEqual([]);
  });
});

describe('los enlaces de WhatsApp', () => {
  it('salen del ayudante del contrato, no escritos a mano', () => {
    /*
     * `wa.me` exige el numero SIN signos. Escrito a mano, el primero que
     * copie el numero con el «+» delante deja un boton que abre WhatsApp con
     * un error en vez del chat. El ayudante quita los signos en un solo
     * sitio y tiene su propia prueba.
     */
    const aMano = FUENTES.filter(({ texto }) => texto.includes('wa.me')).map(({ ruta }) => ruta);

    expect(aMano).toEqual([]);
  });

  it('se abren en otra pestana SIN dejar acceso a esta', () => {
    /*
     * `target="_blank"` sin `rel="noopener"` le da a la pagina destino una
     * referencia a `window.opener`, con la que puede redirigir esta pestana
     * a donde quiera. Aqui el destino es WhatsApp y no va a hacerlo, pero es
     * una regla que no admite excepciones: la excepcion se copia.
     */
    for (const { ruta, texto } of FUENTES) {
      const aperturas = texto.split('target="_blank"').length - 1;
      if (aperturas === 0) continue;

      const protegidas = texto.split('rel="noopener noreferrer"').length - 1;
      expect(protegidas, `${ruta} abre ${aperturas} pestanas`).toBe(aperturas);
    }
  });
});

describe('el mensaje que lleva el boton de la propuesta', () => {
  it('va con el codigo postal y el tamano dentro', () => {
    // Sin esto el cliente llega al chat con un «hola» y la empresa tiene que
    // empezar preguntando lo que el visitante ya habia tecleado.
    expect(CALCULADORA).toContain('calculator.whatsappQuote');
    expect(CALCULADORA).toContain('quote.input.destination.postalCode');
    expect(CALCULADORA).toContain('quote.input.squareFeet');
  });

  it('y NUNCA con datos personales', () => {
    /*
     * El cotizador no los tiene —el nombre, el correo y la direccion se
     * piden al reservar—, y este mensaje sale hacia un servicio de terceros.
     * Si algun dia alguien tiene a mano la ficha del cliente aqui, que sea
     * una decision y no un descuido.
     */
    const bloque = CALCULADORA.slice(
      CALCULADORA.indexOf('calculator.whatsappQuote'),
      CALCULADORA.indexOf('whatsappCta'),
    );

    expect(bloque).not.toMatch(/email|customer|addressLine|\bname\b|phone/i);
  });
});

describe('sin numero configurado no hay boton roto', () => {
  it('el ayudante devuelve null y la interfaz esconde el enlace', () => {
    expect(whatsappHref({ whatsapp: null, phone: null })).toBeNull();

    // Y todos los sitios que lo pintan comprueban antes que hay algo.
    const pintan = FUENTES.filter(({ texto }) => texto.includes('WhatsAppIcon')).filter(
      ({ texto, ruta }) => !ruta.endsWith('Icons.tsx') && !texto.includes('whatsapp'),
    );

    expect(pintan.map(({ ruta }) => ruta)).toEqual([]);
  });
});
