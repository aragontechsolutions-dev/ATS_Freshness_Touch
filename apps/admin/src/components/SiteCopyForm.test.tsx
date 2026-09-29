import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SITE_COPY_SHORT_MAX,
  type AdminSiteCopy,
  type SiteCopy,
  type SiteCopyKey,
} from '@freshness/types';
import '../i18n';

/**
 * LA PANTALLA DE LOS TEXTOS DE LA WEB
 * -----------------------------------
 * Aqui no se configuran ajustes: se redactan COMPROMISOS. Lo que se escriba
 * es lo que un cliente va a reclamar.
 *
 * Se comprueba lo que no se ve leyendo el componente:
 *
 *   1. QUE UN CAMPO VACIO SE GUARDE COMO `null`, NO COMO CADENA VACIA. Es la
 *      diferencia entre «deja el texto de siempre» y «deja un hueco en
 *      blanco en la portada».
 *   2. QUE AVISE DEL IDIOMA A MEDIAS MIENTRAS SE TECLEA. Nadie deja una
 *      promesa a medias a proposito; se escribe el ingles, se deja el
 *      espanol para luego y se olvida. A partir de ahi la web promete dos
 *      cosas distintas.
 *   3. QUE EL TEXTO ACTUAL SE VEA. Sin el, un campo vacio no dice nada: no
 *      se sabe que frase esta publicada ni que queda si no se escribe.
 *   4. QUE UN TEXTO DEMASIADO LARGO NO SALGA HACIA LA API.
 */

const fetchSiteCopy = vi.fn<() => Promise<AdminSiteCopy>>();
const saveSiteCopy = vi.fn<(c: SiteCopy) => Promise<AdminSiteCopy>>();

vi.mock('../lib/api', () => ({
  fetchSiteCopy: () => fetchSiteCopy(),
  saveSiteCopy: (c: SiteCopy) => saveSiteCopy(c),
  ApiClientError: class ApiClientError extends Error {},
}));

vi.mock('./ToastProvider', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

/*
 * Las pruebas corren con los textos en INGLES: es el idioma por defecto de
 * i18n, porque `es.ts` se declara como `typeof en`. Por eso las aserciones
 * buscan cadenas en ingles aunque el codigo este comentado en espanol.
 */
const { SiteCopyForm } = await import('./SiteCopyForm');

const VACIO: AdminSiteCopy = { copy: {}, updatedAt: null, updatedBy: null };

const CON_GARANTIA: AdminSiteCopy = {
  copy: {
    'whyUs.guarantee.body': {
      en: 'Tell us within 48 hours and we come back.',
      es: 'Avisanos en 48 horas y volvemos.',
    },
  },
  updatedAt: '2026-09-29T12:00:00.000Z',
  updatedBy: 'Ada Jefa',
};

let contenedor: HTMLDivElement;
let root: Root;

async function montar(): Promise<void> {
  await act(async () => {
    root.render(<SiteCopyForm locale="es" onSessionLost={() => {}} />);
  });
}

/** El campo de una clave en un idioma. Los ids los pone el componente. */
function campo(clave: SiteCopyKey, idioma: 'en' | 'es'): HTMLInputElement | HTMLTextAreaElement {
  const id = `copy-${clave.replace(/\./g, '-')}-${idioma}`;
  const elemento = contenedor.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`);
  if (!elemento) throw new Error(`No encontre el campo ${id}`);
  return elemento;
}

function escribir(elemento: HTMLInputElement | HTMLTextAreaElement, valor: string): void {
  const prototipo =
    elemento instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototipo, 'value')?.set;
  setter?.call(elemento, valor);
  elemento.dispatchEvent(new Event('input', { bubbles: true }));
}

async function guardar(): Promise<void> {
  const form = contenedor.querySelector('form');
  await act(async () => {
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchSiteCopy.mockResolvedValue(VACIO);
  saveSiteCopy.mockImplementation((copy) =>
    Promise.resolve({ copy, updatedAt: '2026-09-29T13:00:00.000Z', updatedBy: 'Ada Jefa' }),
  );

  contenedor = document.createElement('div');
  document.body.append(contenedor);
  root = createRoot(contenedor);
});

afterEach(() => {
  act(() => root.unmount());
  contenedor.remove();
});

/* ======================================================================== */

describe('lo que se ve al abrir', () => {
  it('ensena el texto que hay ahora en el sitio, en los dos idiomas', async () => {
    await montar();

    /*
     * El texto de referencia sale del propio diccionario, con la misma clave
     * que se guarda. Si esto se rompiera, el campo vacio no diria nada.
     */
    expect(contenedor.textContent).toContain('Insured and bonded');
    expect(contenedor.textContent).toContain('Asegurados y afianzados');
  });

  it('agrupa las promesas y las preguntas por separado', async () => {
    await montar();

    expect(contenedor.textContent).toContain('Our promises');
    expect(contenedor.textContent).toContain('Frequently asked questions');
  });

  it('sin nada guardado dice que el sitio usa sus textos originales', async () => {
    await montar();
    expect(contenedor.textContent).toContain('original wording');
  });

  it('con algo guardado, los campos traen lo guardado y se ve quien lo hizo', async () => {
    fetchSiteCopy.mockResolvedValue(CON_GARANTIA);
    await montar();

    expect(campo('whyUs.guarantee.body', 'en').value).toBe(
      'Tell us within 48 hours and we come back.',
    );
    expect(contenedor.textContent).toContain('Ada Jefa');
  });
});

describe('la linea de referencia', () => {
  it('ensena lo PUBLICADO mientras se teclea, no lo que se esta escribiendo', async () => {
    /*
     * REGRESION. La primera version ensenaba el borrador en cuanto habia algo
     * escrito, asi que la referencia desaparecia justo cuando sirve: al
     * comparar la promesa nueva con la que esta publicada. La etiqueta decia
     * «ahora en el sitio» y mostraba lo que acababas de teclear.
     */
    await montar();
    escribir(campo('whyUs.insured.title', 'en'), 'Fully insured and bonded');
    await act(async () => {});

    expect(contenedor.textContent).toContain('Insured and bonded');
  });

  it('con un texto guardado, la referencia es ese y no el del codigo', async () => {
    // Lo que hay en el sitio es lo ultimo guardado, no lo que dice el codigo.
    fetchSiteCopy.mockResolvedValue(CON_GARANTIA);
    await montar();

    expect(contenedor.textContent).toContain('Tell us within 48 hours and we come back.');
  });
});

describe('como se agrupa la pantalla', () => {
  it('cada promesa lleva su titulo y su cuerpo juntos, con su rol', async () => {
    await montar();

    // Nadie piensa en «whyUs.insured.title»: piensa en «la promesa del seguro».
    expect(contenedor.querySelectorAll('article').length).toBe(10);
    expect(contenedor.textContent).toContain('Heading');
    expect(contenedor.textContent).toContain('Text');
  });

  it('las preguntas frecuentes se rotulan como pregunta y respuesta', async () => {
    await montar();
    expect(contenedor.textContent).toContain('Question');
    expect(contenedor.textContent).toContain('Answer');
  });
});

describe('guardar', () => {
  it('un campo vacio se manda como null, no como cadena vacia', async () => {
    /*
     * ES LA PRUEBA QUE MAS IMPORTA DE ESTA PANTALLA. Con la cadena vacia, el
     * contrato rechazaria el guardado entero; y si lo aceptara, la portada
     * saldria con un hueco en blanco en vez del texto de siempre.
     */
    await montar();
    escribir(campo('whyUs.insured.title', 'en'), 'Fully insured');
    await guardar();

    expect(saveSiteCopy).toHaveBeenCalledTimes(1);
    expect(saveSiteCopy.mock.calls[0]?.[0]['whyUs.insured.title']).toEqual({
      en: 'Fully insured',
      es: null,
    });
  });

  it('una clave sin nada escrito no viaja', async () => {
    await montar();
    escribir(campo('faq.q1.q', 'en'), 'Do I pay tax?');
    await guardar();

    const enviado = saveSiteCopy.mock.calls[0]?.[0] ?? {};
    expect(Object.keys(enviado)).toEqual(['faq.q1.q']);
  });

  it('recorta los espacios antes de mandar', async () => {
    await montar();
    escribir(campo('faq.q1.q', 'en'), '   Do I pay tax?   ');
    await guardar();

    expect(saveSiteCopy.mock.calls[0]?.[0]['faq.q1.q']?.en).toBe('Do I pay tax?');
  });

  it('sin cambios, el boton de guardar esta desactivado', async () => {
    await montar();
    const boton = contenedor.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(boton?.disabled).toBe(true);

    escribir(campo('faq.q1.q', 'en'), 'Algo');
    await act(async () => {});
    expect(contenedor.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(
      false,
    );
  });
});

describe('el aviso de idioma a medias', () => {
  it('aparece al escribir un idioma y dejar el otro vacio', async () => {
    await montar();
    expect(contenedor.textContent).not.toContain('written in one language only');

    escribir(campo('whyUs.guarantee.body', 'en'), 'Within 48 hours.');
    await act(async () => {});

    // Avisa mientras se teclea, no al guardar: es cuando aun se arregla sin volver.
    expect(contenedor.textContent).toContain('written in one language only');
    expect(contenedor.textContent).toContain('Missing in the other language');
  });

  it('desaparece al rellenar el segundo idioma', async () => {
    await montar();
    escribir(campo('whyUs.guarantee.body', 'en'), 'Within 48 hours.');
    await act(async () => {});
    escribir(campo('whyUs.guarantee.body', 'es'), 'En 48 horas.');
    await act(async () => {});

    expect(contenedor.textContent).not.toContain('written in one language only');
  });

  it('NO avisa por los textos que nadie ha tocado', async () => {
    // Veinte textos vacios no son veinte textos a medias: son cero.
    await montar();
    expect(contenedor.textContent).not.toContain('written in one language only');
  });

  it('avisar no impide guardar: un idioma a medias es valido, solo arriesgado', async () => {
    await montar();
    escribir(campo('whyUs.guarantee.body', 'en'), 'Within 48 hours.');
    await guardar();

    expect(saveSiteCopy).toHaveBeenCalledTimes(1);
  });
});

describe('los limites de largo', () => {
  it('avisa por cuanto se pasa un titulo', async () => {
    await montar();
    escribir(campo('whyUs.insured.title', 'en'), 'a'.repeat(SITE_COPY_SHORT_MAX + 7));
    await act(async () => {});

    expect(contenedor.textContent).toContain('Too long by 7');
  });

  it('un texto demasiado largo no sale hacia la API', async () => {
    await montar();
    escribir(campo('whyUs.insured.title', 'en'), 'a'.repeat(SITE_COPY_SHORT_MAX + 1));
    await guardar();

    expect(saveSiteCopy).not.toHaveBeenCalled();
    expect(contenedor.textContent).toContain('Check the fields marked below');
  });

  it('un cuerpo con el largo de un titulo pasado SI se acepta', async () => {
    // Comprueba que el tope corto no se esta aplicando a los cuerpos.
    await montar();
    escribir(campo('whyUs.insured.body', 'en'), 'a'.repeat(SITE_COPY_SHORT_MAX + 50));
    await guardar();

    expect(saveSiteCopy).toHaveBeenCalledTimes(1);
  });
});

describe('deshacer', () => {
  it('devuelve los campos a lo ultimo guardado', async () => {
    fetchSiteCopy.mockResolvedValue(CON_GARANTIA);
    await montar();

    escribir(campo('whyUs.guarantee.body', 'en'), 'Otra cosa');
    await act(async () => {});

    const deshacer = [...contenedor.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Undo changes'),
    );
    await act(async () => {
      deshacer?.click();
    });

    expect(campo('whyUs.guarantee.body', 'en').value).toBe(
      'Tell us within 48 hours and we come back.',
    );
  });
});
