import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  destinoDeNavegacion,
  enlaceAppleMaps,
  enlaceGoogleMaps,
  esDispositivoApple,
  type DestinoDeTrabajo,
} from './navegacion';

/**
 * EL ENLACE QUE LLEVA AL EQUIPO HASTA LA PUERTA
 * =============================================
 * Un enlace mal construido aqui no da un error: da un boton que, pulsado con
 * el coche en marcha, abre un mapa en el sitio equivocado o no abre nada.
 */

const SIN_PIN: DestinoDeTrabajo = {
  addressLine1: '123 East Church St',
  city: 'Monroe',
  state: 'GA',
  postalCode: '30655',
  doorPin: null,
};

const CON_PIN: DestinoDeTrabajo = {
  ...SIN_PIN,
  doorPin: { latitude: 33.794722, longitude: -83.713333 },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

/* -------------------------------------------------------------------------- */

describe('a donde se navega', () => {
  it('SIN PIN, a la direccion: es el caso normal', () => {
    /*
     * Marcar el pin es opcional y la mayoria de clientes no lo hara. Si el
     * boton solo funcionara con pin, la mayoria de los trabajos se quedaria
     * sin navegacion, que es exactamente lo que pasaba antes de esta etapa.
     */
    expect(destinoDeNavegacion(SIN_PIN)).toBe('123 East Church St, Monroe, GA 30655');
  });

  it('CON PIN, a las coordenadas que marco el cliente', () => {
    // Las marco porque el geocodificador interpola sobre el tramo de via y
    // en una carretera comarcal deja la casa a cientos de metros.
    expect(destinoDeNavegacion(CON_PIN)).toBe('33.794722,-83.713333');
  });

  it('si el pin caduco, se vuelve a la direccion sola', () => {
    // El pin se borra 24 h despues del trabajo. La pantalla no puede dar por
    // hecho que lo que habia ayer sigue estando.
    expect(destinoDeNavegacion({ ...CON_PIN, doorPin: null })).toContain('East Church');
  });
});

describe('lo que NO puede entrar en la URL', () => {
  it('el piso o apartamento se queda fuera', () => {
    /*
     * «Apto 3B» no mueve el edificio de sitio, y algunos geocodificadores
     * fallan la coincidencia entera si se lo mandas. Misma regla que ya
     * aplica `GeocodeQuerySchema`.
     *
     * Se comprueba por el TIPO: `addressLine2` no entra en
     * `DestinoDeTrabajo`, asi que anadirlo manana exige tocar la firma.
     */
    const conPiso = { ...SIN_PIN, addressLine2: 'Apt 3B' };

    expect(enlaceGoogleMaps(conPiso)).not.toContain('3B');
    expect(enlaceAppleMaps(conPiso)).not.toContain('3B');
  });

  it('LAS INSTRUCCIONES DE ACCESO, JAMAS', () => {
    /*
     * LA PRUEBA QUE MAS IMPORTA DE ESTE ARCHIVO.
     *
     * `accessNotes` lleva el codigo de la puerta, donde esta la llave o si
     * hay un perro suelto. Una URL acaba en el historial del navegador, en
     * los registros del servicio de mapas y en el menu de «compartir» del
     * movil: tres sitios donde ese dato no puede estar.
     */
    const conSecreto = { ...SIN_PIN, accessNotes: 'Door code 4821, key under the mat' };

    for (const enlace of [enlaceGoogleMaps(conSecreto), enlaceAppleMaps(conSecreto)]) {
      expect(enlace).not.toContain('4821');
      expect(enlace).not.toMatch(/code|key|mat/i);
    }
  });

  it('y tampoco el nombre ni el telefono del cliente', () => {
    const conCliente = { ...SIN_PIN, customerFirstName: 'Henry', customerPhone: '+14045550123' };

    expect(enlaceGoogleMaps(conCliente)).not.toContain('Henry');
    expect(enlaceGoogleMaps(conCliente)).not.toContain('4045550123');
  });
});

describe('los enlaces', () => {
  it('Google Maps abre la ruta, no una chincheta', () => {
    // `?q=` ENSENA el sitio y deja dos toques mas por hacer. `dir/` navega.
    const enlace = enlaceGoogleMaps(SIN_PIN);

    expect(enlace).toContain('google.com/maps/dir/');
    expect(enlace).toContain('travelmode=driving');
    expect(enlace).not.toContain('?q=');
  });

  it('Apple Maps tambien, y en coche', () => {
    expect(enlaceAppleMaps(SIN_PIN)).toContain('maps.apple.com');
    expect(enlaceAppleMaps(SIN_PIN)).toContain('dirflg=d');
  });

  it('NO SE MANDA EL ORIGEN: la ubicacion de la empleada no viaja', () => {
    /*
     * De donde sale lo pone la aplicacion de mapas con la ubicacion del
     * propio movil. Es lo que mantiene en pie la regla de la etapa 3.3: la
     * ubicacion del empleado no se guarda ni se transmite en ningun sitio.
     */
    for (const enlace of [enlaceGoogleMaps(CON_PIN), enlaceAppleMaps(CON_PIN)]) {
      expect(enlace).not.toMatch(/origin|saddr/);
    }
  });

  it('la direccion va codificada, no pegada en crudo', () => {
    // Sin codificar, los espacios y las comas rompen la URL y el mapa abre
    // en un sitio cualquiera.
    expect(enlaceGoogleMaps(SIN_PIN)).not.toContain(' ');
    expect(enlaceGoogleMaps(SIN_PIN)).toContain('123%20East%20Church');
  });
});

describe('detectar el dispositivo', () => {
  function conNavegador(userAgent: string, platform = '', maxTouchPoints = 0): void {
    vi.stubGlobal('navigator', { userAgent, platform, maxTouchPoints });
  }

  it('reconoce un iPhone', () => {
    conNavegador('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15');
    expect(esDispositivoApple()).toBe(true);
  });

  it('y un iPad moderno, que se hace pasar por un Mac', () => {
    /*
     * Desde iPadOS 13 un iPad se presenta como un Mac de escritorio. Lo
     * delata que tenga pantalla tactil. Sin esto, a quien usa un iPad no le
     * saldria nunca el boton de Apple Maps.
     */
    conNavegador('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5);
    expect(esDispositivoApple()).toBe(true);
  });

  it('NO confunde un Android con un iPhone', () => {
    conNavegador('Mozilla/5.0 (Linux; Android 16; Pixel 10) AppleWebKit/537.36', 'Linux armv8l');
    expect(esDispositivoApple()).toBe(false);
  });

  it('ni un Mac de escritorio sin pantalla tactil', () => {
    conNavegador('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0);
    expect(esDispositivoApple()).toBe(false);
  });

  it('y sin navegador no revienta', () => {
    // Las pruebas y el renderizado en servidor corren sin `navigator`.
    vi.stubGlobal('navigator', undefined);
    expect(esDispositivoApple()).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */

const PANTALLA = readFileSync(join(import.meta.dirname, '../pages/MyJobs.tsx'), 'utf8');

describe('la pantalla de limpieza', () => {
  it('usa el ayudante y no una URL escrita a mano', () => {
    // Escrita a mano, la regla del pin-o-direccion y la codificacion
    // acabarian duplicadas, y una de las dos copias se quedaria atras.
    expect(PANTALLA).toContain('enlaceGoogleMaps(job)');
    expect(PANTALLA).toContain('enlaceAppleMaps(job)');
  });

  it('EL DE GOOGLE SE PINTA SIEMPRE; el de Apple solo se anade', () => {
    /*
     * Si la deteccion decidiera CUAL se ensena, un fallo dejaria a alguien
     * conduciendo con un boton que no abre nada. Asi los dos fallos posibles
     * son inofensivos: sobra un boton, o queda el de Google.
     */
    const bloque = PANTALLA.slice(
      PANTALLA.indexOf('enlaceGoogleMaps(job)'),
      PANTALLA.indexOf("t('admin.myJobs.appleMaps')"),
    );

    // El de Google aparece ANTES de cualquier condicion de plataforma.
    expect(bloque.indexOf('enlaceGoogleMaps(job)')).toBeLessThan(bloque.indexOf('enApple &&'));
  });

  it('NINGUN enlace de la pantalla lleva las instrucciones de acceso', () => {
    /*
     * El codigo de la puerta y donde esta la llave no pueden acabar en una
     * URL: el historial del navegador, los registros del servicio de mapas y
     * el menu de «compartir» del movil son tres sitios donde ese dato no
     * puede estar. Se revisa cada `href` del archivo, no solo los nuevos.
     *
     * EL TELEFONO DEL CLIENTE SI PUEDE IR, y esta comprobado que va: el
     * boton de llamar es un `tel:` a proposito, porque quien esta en la
     * puerta a las ocho y no le abren necesita poder llamar sin pasar por la
     * oficina. Un `tel:` no sale del movil; una URL de mapas si.
     */
    const hrefs = PANTALLA.match(/href=\{[^}]*\}/g) ?? [];

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href).not.toContain('accessNotes');
      expect(href).not.toContain('customerNotes');
    }

    // Y el de llamar sigue ahi: si desapareciera, esta prueba pasaria sola
    // sin que nadie se enterara de que el equipo se quedo sin telefono.
    expect(hrefs.some((href) => href.includes('customerPhone'))).toBe(true);
  });
});
