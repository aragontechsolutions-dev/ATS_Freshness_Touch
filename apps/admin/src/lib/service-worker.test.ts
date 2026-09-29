import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ============================================================================
 * LO QUE EL SERVICE WORKER PUEDE Y NO PUEDE GUARDAR
 * ============================================================================
 * El panel sirve datos con sesion: direcciones de clientes, telefonos, codigos
 * de puertas, importes. Un service worker que guardara respuestas de la API
 * las dejaria en el disco del movil, FUERA de la sesion:
 *
 *   - seguirian ahi despues de cerrar sesion;
 *   - en un movil compartido las veria la siguiente persona;
 *   - y limpieza veria trabajos que ya no son suyos.
 *
 * Esa regla vive en `vite.config.ts` y se cumple hoy, pero es de las que se
 * rompen sin querer: basta que alguien anada un `runtimeCaching` para que los
 * trabajos "se vean mas rapido". Esta prueba lo convierte en un fallo.
 *
 * SE LEE LA CONFIGURACION, NO EL COMPILADO. Comprobar el `sw.js` generado
 * exigiria compilar el panel entero antes de cada prueba —medio minuto— y la
 * prueba se saltaria en cuanto alguien tuviera prisa. La configuracion es la
 * fuente de la regla, y es la que alguien editaria.
 * ============================================================================
 */

const CONFIG = join(import.meta.dirname, '../../vite.config.ts');

function configuracion(): string {
  return readFileSync(CONFIG, 'utf8');
}

describe('el service worker del panel', () => {
  it('existe la configuracion que se va a comprobar', () => {
    // Si el archivo se renombrara, las pruebas de abajo pasarian sin mirar nada.
    expect(existsSync(CONFIG)).toBe(true);
    expect(configuracion()).toContain('VitePWA');
  });

  it('NO cachea respuestas de la API en ejecucion', () => {
    /*
     * `runtimeCaching` es la unica forma de que una respuesta de la API acabe
     * en la cache del service worker. Mientras no exista, no puede pasar.
     */
    expect(
      configuracion(),
      'Anadir runtimeCaching deja datos con sesion en el disco del movil, ' +
        'fuera de la sesion y visibles para quien coja el telefono despues',
    ).not.toMatch(/runtimeCaching\s*:/);
  });

  it('solo guarda tipos de archivo del armazon', () => {
    /*
     * El patron decide que entra. Estos son archivos que el compilador genera
     * con huella en el nombre e identicos para cualquiera: no dicen nada de
     * nadie. Si apareciera `json` aqui, una respuesta guardada de la API
     * podria colarse.
     */
    const patron = /globPatterns:\s*\[\s*'([^']+)'/.exec(configuracion());
    expect(patron?.[1]).toBe('**/*.{js,css,html,woff2,png,svg}');
  });

  it('las peticiones a la API nunca se responden con el HTML del armazon', () => {
    // Sin esta lista, una llamada a /api/... sin conexion devolveria el HTML
    // del panel con un 200, y el cliente intentaria interpretarlo como JSON.
    expect(configuracion()).toMatch(/navigateFallbackDenylist:\s*\[\/\^\\\/api\\\//);
  });

  it('la version nueva se ofrece, no se impone', () => {
    /*
     * `skipWaiting` activaria el service worker nuevo al instante y recargaria
     * la pagina, borrando el formulario que alguien estuviera rellenando de
     * pie en casa de un cliente.
     */
    const config = configuracion();
    expect(config).toMatch(/registerType:\s*'prompt'/);
    expect(config).toMatch(/skipWaiting:\s*false/);
    expect(config).toMatch(/clientsClaim:\s*false/);
  });

  it('no se activa en desarrollo', () => {
    // Un service worker vivo mientras se programa sirve archivos viejos y
    // hace perder tardes persiguiendo cambios que si estaban hechos.
    expect(configuracion()).toMatch(/devOptions:\s*\{[^}]*enabled:\s*false/s);
  });
});
