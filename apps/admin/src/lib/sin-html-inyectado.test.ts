import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ============================================================================
 * EL PANEL TAMPOCO INYECTA HTML
 * ============================================================================
 * El sitio publico ya tiene esta misma guardia, y por el motivo evidente: ahi
 * se publica texto escrito desde el panel.
 *
 * AQUI EL MOTIVO ES MENOS EVIDENTE Y VALE LA PENA ESCRIBIRLO. Desde que los
 * textos de la web se editan, ese texto viaja tambien a la METADATA DE
 * AUDITORIA —se guarda el texto nuevo, que es lo que convierte el registro en
 * util— y el registro lo leen OTRAS personas de administracion.
 *
 * O sea: hay un camino por el que lo que escribe una cuenta acaba en la
 * pantalla de otra. Mientras se pinte entre llaves, React lo escapa y no pasa
 * nada. El dia que alguien use la prop que inyecta HTML en crudo para
 * "mejorar" como se ve un valor de la auditoria, una cuenta comprometida
 * pasaria a poder atacar a las demas desde dentro.
 *
 * Igual que en el sitio: se busca el USO de la prop (`=` o `:` detras), no la
 * palabra, para que se pueda seguir explicando la regla en los comentarios.
 * ============================================================================
 */

const RAIZ = join(import.meta.dirname, '..');
const USO_DE_HTML_EN_CRUDO = /dangerouslySetInnerHTML\s*[=:]/;

function fuentesDelPanel(): string[] {
  return globSync('**/*.{ts,tsx}', { cwd: RAIZ })
    .filter((ruta) => !ruta.endsWith('.test.ts') && !ruta.endsWith('.test.tsx'))
    .map((ruta) => join(RAIZ, ruta));
}

describe('el panel no inyecta HTML en ninguna parte', () => {
  it('ningun archivo inyecta HTML en crudo', () => {
    const culpables = fuentesDelPanel()
      .filter((ruta) => USO_DE_HTML_EN_CRUDO.test(readFileSync(ruta, 'utf8')))
      .map((ruta) => ruta.slice(RAIZ.length + 1));

    expect(
      culpables,
      'El texto que una cuenta escribe llega a la pantalla de otra a traves ' +
        'de la auditoria: inyectar HTML aqui convierte una cuenta comprometida ' +
        'en un ataque contra el resto del equipo',
    ).toEqual([]);
  });

  it('mira archivos de verdad, no una lista vacia', () => {
    const fuentes = fuentesDelPanel();
    expect(fuentes.length).toBeGreaterThan(20);
    expect(fuentes.some((ruta) => ruta.endsWith('components/AuditLog.tsx'))).toBe(true);
    expect(fuentes.some((ruta) => ruta.endsWith('components/SiteCopyForm.tsx'))).toBe(true);
  });
});
