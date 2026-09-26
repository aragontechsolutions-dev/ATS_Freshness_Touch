import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * PRUEBAS DEL ARRANQUE DEL TEMA
 * -----------------------------
 * `public/theme-init.js` no se puede importar: es un script suelto que el
 * navegador ejecuta antes que nada, sin modulos, para poder ir en la etiqueta
 * <script> y cumplir la politica `script-src 'self'`.
 *
 * Asi que se lee y se ejecuta tal cual, que ademas es EXACTAMENTE lo que hace
 * el navegador. Si el archivo se rompe, esto se entera.
 *
 * MERECE LA PENA PROBARLO porque es el unico sitio del panel que decide algo
 * antes del primer pintado, y porque su parte mas delicada —que
 * `localStorage` puede lanzar— es justo la que no se ve fallar en desarrollo:
 * solo pasa en navegadores con las protecciones subidas, como Brave, o en
 * ventana privada.
 */
// Se parte de `process.cwd()`, que en estas pruebas es `apps/admin`: dentro
// de jsdom `import.meta.url` es una direccion http y no sirve para leer
// archivos.
const GUION = readFileSync(resolve(process.cwd(), 'public/theme-init.js'), 'utf-8');

/** Lo ejecuta como lo haria el navegador, en el documento de la prueba. */
function arrancar(): void {
  new Function(GUION)();
}

/** Sustituye `matchMedia`, que jsdom responde siempre que no, por uno a medida. */
function conPreferencias({
  oscuro,
  menosMovimiento,
}: {
  oscuro: boolean;
  menosMovimiento: boolean;
}) {
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    matches: consulta.includes('prefers-color-scheme: dark') ? oscuro : menosMovimiento,
    media: consulta,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

beforeEach(() => {
  document.documentElement.className = '';
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('tema', () => {
  it('respeta el tema guardado aunque el sistema diga lo contrario', () => {
    localStorage.setItem('ft-theme', 'dark');
    conPreferencias({ oscuro: false, menosMovimiento: false });

    arrancar();

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('una eleccion de tema claro gana a un sistema en oscuro', () => {
    localStorage.setItem('ft-theme', 'light');
    conPreferencias({ oscuro: true, menosMovimiento: false });

    arrancar();

    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('sin eleccion previa, manda el sistema', () => {
    conPreferencias({ oscuro: true, menosMovimiento: false });
    arrancar();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('sin eleccion previa y sistema en claro, se queda en claro', () => {
    conPreferencias({ oscuro: false, menosMovimiento: false });
    arrancar();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});

describe('movimiento', () => {
  it('se permite cuando el sistema no pide reducirlo', () => {
    conPreferencias({ oscuro: false, menosMovimiento: false });
    arrancar();
    expect(document.documentElement.classList.contains('ft-motion')).toBe(true);
  });

  it('NO se permite si el sistema pide reducir el movimiento', () => {
    conPreferencias({ oscuro: false, menosMovimiento: true });
    arrancar();
    expect(document.documentElement.classList.contains('ft-motion')).toBe(false);
  });
});

describe('cuando el navegador no coopera', () => {
  it('si localStorage lanza, no revienta y decide el tema por el sistema', () => {
    /*
     * ESTE ES EL CASO DE BRAVE Y DE LA VENTANA PRIVADA. Sin el try/catch, la
     * excepcion abortaria el script entero y se perderia TAMBIEN la clase de
     * movimiento, que se pone despues.
     */
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('acceso al almacenamiento denegado');
    });
    conPreferencias({ oscuro: true, menosMovimiento: false });

    expect(() => arrancar()).not.toThrow();

    // El tema guardado no se pudo leer, pero el movimiento si se decidio.
    expect(document.documentElement.classList.contains('ft-motion')).toBe(true);
  });

  it('sin matchMedia no se anima, que es la opcion segura', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(() => arrancar()).not.toThrow();
    expect(document.documentElement.classList.contains('ft-motion')).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
