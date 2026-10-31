import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { en, es } from '@freshness/i18n';

/**
 * LA CAMPANA NO PUEDE TENER BOTONES QUE NO HACEN NADA
 * ===================================================
 * Esta prueba existe por un hueco real del PWA del equipo de limpieza,
 * documentado en `docs/51` como H5.
 *
 * ========================================================================
 * EL FALLO, Y POR QUE NADIE LO VIO
 * ========================================================================
 * `App.tsx` fijaba la pantalla del puesto de limpieza con una sola linea:
 *
 *     const actual: Vista = soloMisTrabajos ? 'myJobs' : vista;
 *
 * La campana SI se pinta para ese puesto y SI recibe sus avisos. Pero sus
 * dos acciones —«ver todas» y «abrir la reserva»— cambian `vista`, y con esa
 * linea `vista` no se miraba nunca. Resultado: dos botones que al pulsarlos
 * no hacian absolutamente nada.
 *
 * No daba error, no salia en ningun registro y no lo detecta ninguna prueba
 * de componente, porque cada pieza por separado funciona perfectamente. Solo
 * se ve mirando a la vez el enrutado y los botones, que es lo que hace esto.
 *
 * ========================================================================
 * POR QUE SE LEE EL FUENTE EN VEZ DE MONTAR `App.tsx`
 * ========================================================================
 * Montar el panel entero arrastra el cliente de Supabase, el de la API y
 * las nueve pantallas: una prueba lenta, fragil y que falla por motivos que
 * no tienen nada que ver con esto. El comportamiento que SI se puede probar
 * de verdad —el trabajo destacado— esta en
 * `pages/MyJobs.terminar.test.tsx`. Lo que queda aqui es vigilar que el
 * enrutado no vuelva a dejar la bandeja fuera.
 */

const APP_CRUDO = readFileSync(join(import.meta.dirname, 'App.tsx'), 'utf8');

/**
 * EL FUENTE SIN COMENTARIOS.
 *
 * Hace falta, y no es un adorno: `App.tsx` DOCUMENTA la linea que causaba el
 * fallo —«esta linea decia ...»— porque es lo que explica por que ahora hay
 * una lista. Buscando sobre el fuente crudo, la prueba se disparaba con su
 * propia explicacion y era imposible de pasar. Una guardia que un comentario
 * puede romper no vigila nada.
 *
 * Se quitan los bloques `/* *\/` y las lineas `//`. No hay ninguna direccion
 * web en este archivo, asi que lo segundo no puede partir una cadena por la
 * mitad.
 */
const APP = APP_CRUDO.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('el enrutado del puesto de limpieza', () => {
  it('NO VUELVE A FIJAR LA PANTALLA IGNORANDO `vista`', () => {
    /*
     * La linea exacta que causaba el fallo. Si alguien la reescribe
     * «simplificando», esto lo para.
     */
    expect(APP).not.toContain("soloMisTrabajos ? 'myJobs' : vista");
  });

  it('la bandeja de avisos ESTA entre las pantallas de limpieza', () => {
    const lista = /VISTAS_DE_LIMPIEZA: readonly Vista\[\] = \[([^\]]*)\]/.exec(APP);
    expect(lista).not.toBeNull();

    const vistas = (lista?.[1] ?? '').match(/'[a-zA-Z]+'/g) ?? [];
    expect(vistas).toContain("'myJobs'");
    expect(vistas).toContain("'notifications'");
  });

  it('las pantallas que ese puesto no puede abrir SIGUEN FUERA', () => {
    /*
     * Lo que se protege aqui no es seguridad —la API responde 403 a las tres
     * y a la ficha de una reserva— sino que no se añada una pantalla a la
     * lista «porque la campana la necesitaba» y acabe siendo otro boton que
     * no lleva a nada.
     */
    const lista = /VISTAS_DE_LIMPIEZA: readonly Vista\[\] = \[([^\]]*)\]/.exec(APP);
    const vistas = (lista?.[1] ?? '').match(/'[a-zA-Z]+'/g) ?? [];

    expect(vistas).not.toContain("'settings'");
    expect(vistas).not.toContain("'series'");
    expect(vistas).not.toContain("'privacy'");
    expect(vistas).not.toContain("'agenda'");
  });

  it('el aviso que senala una reserva pasa por UN SOLO sitio', () => {
    /*
     * La campana y la lista completa tienen que usar el mismo camino: con dos
     * caminos, uno acaba llevando a la ficha de la reserva —cerrada por rol—
     * y el otro al trabajo, y el fallo vuelve por la mitad que nadie toco.
     */
    const usos = APP.match(/onAbrirReserva=\{([^}]*)\}/g) ?? [];
    expect(usos.length).toBeGreaterThanOrEqual(2);
    for (const uso of usos) {
      expect(uso).toContain('abrirLoQueSenala');
    }
  });
});

describe('los textos de los dos botones', () => {
  it('existen en los dos idiomas', () => {
    /*
     * `openMyJob` y `back` son los que hacen que el boton diga a donde lleva
     * DE VERDAD para este puesto: a «Mis trabajos», no a la ficha de la
     * reserva. Sin ellos, i18next pinta la clave en crudo.
     */
    for (const idioma of [en, es]) {
      expect(idioma.admin.inbox.openMyJob.length).toBeGreaterThan(0);
      expect(idioma.admin.inbox.back.length).toBeGreaterThan(0);
    }
  });

  it('el destino por omision sigue siendo la ficha de la reserva', () => {
    /*
     * Para coordinacion y administracion nada cambia: si el valor por
     * omision pasara a ser el de limpieza, el panel diria «Ir a este
     * trabajo» a quien de verdad abre la ficha completa.
     */
    expect(readFileSync(join(import.meta.dirname, 'pages/Notifications.tsx'), 'utf8')).toContain(
      "abrirLabelKey = 'admin.inbox.openEntity'",
    );
  });
});
