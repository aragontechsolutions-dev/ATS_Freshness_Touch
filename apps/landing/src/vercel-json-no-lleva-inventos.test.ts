import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `vercel.json` NO ADMITE CLAVES INVENTADAS
 * =========================================
 * Esta prueba existe porque **tiré el despliegue del sitio público** con ella.
 *
 * ==========================================================================
 * QUÉ PASÓ
 * ==========================================================================
 * Al declarar el `Content-Type` del `sitemap.xml` quise dejar escrito por qué,
 * y JSON no tiene comentarios. Así que inventé una clave `_comentario` dentro
 * de cada entrada de `headers`, pensando que lo que no se reconoce se ignora.
 *
 * No se ignora. El archivo declara `"$schema":
 * "https://openapi.vercel.sh/vercel.json"` y **Vercel valida la configuración
 * de forma estricta**: una propiedad que no está en el esquema no es un aviso,
 * es un error, y el despliegue falla **antes de compilar nada**.
 *
 * Lo delató que el proyecto `landing` fallara y el `admin` no: lo único que
 * los distingue en ese cambio era este archivo.
 *
 * ==========================================================================
 * POR QUÉ NINGÚN PASO DE CI LO VIO
 * ==========================================================================
 * Y es la parte que importa: **`vercel.json` no lo lee nada nuestro.**
 * `format:check` lo da por bueno porque es JSON válido; `lint`, `typecheck`,
 * `test` y `build` no lo miran siquiera. Los seis pasos estaban en verde con
 * el despliegue roto.
 *
 * Quien lo valida es Vercel, en el despliegue — es decir, después. Esto
 * adelanta esa validación a los pasos que ya se ejecutan.
 *
 * ==========================================================================
 * QUÉ COMPRUEBA, Y QUÉ NO
 * ==========================================================================
 * No reimplementa el esquema de Vercel: comprueba las claves de las secciones
 * que este proyecto usa. Es lo que se puede mantener honestamente y cubre lo
 * que de verdad pasó — alguien añadiendo una clave que no existe para dejar
 * una nota.
 *
 * **Si hace falta explicar una regla, se explica en `docs/53`, no aquí.** Un
 * archivo de configuración sin comentarios es el precio de JSON.
 */

const VERCEL: unknown = JSON.parse(
  readFileSync(join(import.meta.dirname, '../vercel.json'), 'utf8'),
);

/** Lo que el esquema de Vercel admite en cada sitio que usa este proyecto. */
const CLAVES_RAIZ = new Set([
  '$schema',
  'framework',
  'installCommand',
  'buildCommand',
  'outputDirectory',
  'headers',
  'rewrites',
  'redirects',
  'cleanUrls',
  'trailingSlash',
  'regions',
  'functions',
  'crons',
  'git',
  'ignoreCommand',
  'devCommand',
  'public',
]);
const CLAVES_REGLA_CABECERA = new Set(['source', 'headers', 'has', 'missing']);
const CLAVES_CABECERA = new Set(['key', 'value']);
const CLAVES_REESCRITURA = new Set(['source', 'destination', 'has', 'missing', 'statusCode']);

function claves(valor: unknown): string[] {
  return typeof valor === 'object' && valor !== null ? Object.keys(valor) : [];
}

function ajenas(valor: unknown, permitidas: Set<string>): string[] {
  return claves(valor).filter((clave) => !permitidas.has(clave));
}

describe('vercel.json', () => {
  it('la prueba está leyendo el archivo de verdad', () => {
    // Si la ruta cambiara, el resto pasaría sin comprobar nada.
    expect(claves(VERCEL)).toContain('headers');
    expect(claves(VERCEL)).toContain('rewrites');
  });

  it('NO LLEVA NINGUNA CLAVE INVENTADA EN LA RAÍZ', () => {
    expect(ajenas(VERCEL, CLAVES_RAIZ)).toEqual([]);
  });

  it('NINGUNA REGLA DE CABECERAS LLEVA CLAVES INVENTADAS', () => {
    /*
     * EL FALLO QUE ESTA PRUEBA IMPIDE, y es exactamente el que ocurrió: una
     * clave `_comentario` dentro de una entrada de `headers` tira el
     * despliegue entero, con los seis pasos de CI en verde.
     */
    const reglas = (VERCEL as { headers?: unknown[] }).headers ?? [];
    const malas = reglas.flatMap((regla) =>
      ajenas(regla, CLAVES_REGLA_CABECERA).map((clave) => `headers[]: ${clave}`),
    );

    expect(malas).toEqual([]);
  });

  it('cada cabecera es solo `key` y `value`', () => {
    const reglas = (VERCEL as { headers?: { headers?: unknown[] }[] }).headers ?? [];
    const malas = reglas.flatMap((regla) =>
      (regla.headers ?? []).flatMap((cabecera) =>
        ajenas(cabecera, CLAVES_CABECERA).map((clave) => `header: ${clave}`),
      ),
    );

    expect(malas).toEqual([]);
  });

  it('las reescrituras tampoco', () => {
    const reglas = (VERCEL as { rewrites?: unknown[] }).rewrites ?? [];
    const malas = reglas.flatMap((regla) =>
      ajenas(regla, CLAVES_REESCRITURA).map((clave) => `rewrites[]: ${clave}`),
    );

    expect(malas).toEqual([]);
  });

  it('el sitemap y el robots declaran su tipo de contenido', () => {
    /*
     * La razón por la que se tocó este archivo. Van declarados a mano porque
     * la regla general pone `X-Content-Type-Options: nosniff`, y con eso un
     * rastreador no puede recuperarse de un tipo mal declarado mirando el
     * contenido. Ver `docs/53` §14.
     */
    const reglas = (VERCEL as { headers: { source: string; headers: { key: string }[] }[] })
      .headers;
    const tipoDe = (ruta: string): boolean =>
      reglas.some(
        (regla) => regla.source === ruta && regla.headers.some((c) => c.key === 'Content-Type'),
      );

    expect(tipoDe('/sitemap.xml')).toBe(true);
    expect(tipoDe('/robots.txt')).toBe(true);
  });
});
