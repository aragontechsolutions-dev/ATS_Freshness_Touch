import { describe, expect, it } from 'vitest';
import {
  ApiErrorReportSchema,
  ERROR_DOWN_THRESHOLD,
  ERROR_HISTORY_MINUTES,
  ERROR_SIN_NOMBRE,
  ERROR_WINDOW_MINUTES,
  ErrorFingerprintSchema,
  RUTA_DESCONOCIDA,
  huellaDelError,
} from './error-monitor';

describe('la huella de un error del servidor', () => {
  it('se monta con el metodo, el patron de la ruta y la clase del error', () => {
    const huella = huellaDelError({
      method: 'POST',
      routePath: '/api/v1/bookings',
      errorName: 'PrismaClientKnownRequestError',
    });

    expect(huella).toBe('POST /api/v1/bookings PrismaClientKnownRequestError');
    expect(ErrorFingerprintSchema.safeParse(huella).success).toBe(true);
  });

  it('agrupa dos peticiones distintas a la misma ruta en una sola huella', () => {
    /*
     * Es la razon de ser del campo. El patron lleva `:id`, no el
     * identificador, asi que mil reservas que fallan por lo mismo son UNA
     * linea en el panel y un problema que arreglar, no mil.
     */
    const uno = huellaDelError({
      method: 'GET',
      routePath: '/api/v1/admin/bookings/:bookingId',
      errorName: 'TypeError',
    });
    const otro = huellaDelError({
      method: 'GET',
      routePath: '/api/v1/admin/bookings/:bookingId',
      errorName: 'TypeError',
    });

    expect(uno).toBe(otro);
  });

  it('la barra final no parte en dos la huella del mismo fallo', () => {
    expect(
      huellaDelError({ method: 'GET', routePath: '/api/v1/quote/', errorName: 'TypeError' }),
    ).toBe(huellaDelError({ method: 'GET', routePath: '/api/v1/quote', errorName: 'TypeError' }));
  });

  it('un metodo que no es de la lista se nombra OTRO', () => {
    const huella = huellaDelError({ method: 'TRACE', routePath: '/x', errorName: 'TypeError' });

    expect(huella).toBe('OTRO /x TypeError');
    expect(ErrorFingerprintSchema.safeParse(huella).success).toBe(true);
  });

  it('sin ruta —la excepcion ocurrio antes de resolverla— dice que no se sabe', () => {
    /*
     * Pasa con un cuerpo demasiado grande o un JSON roto: Express todavia no
     * ha decidido que ruta era. Decir «no se sabe» es la respuesta honesta;
     * deducirla de la URL es precisamente lo que no se puede hacer.
     */
    expect(
      huellaDelError({ method: 'POST', routePath: undefined, errorName: 'BadRequestException' }),
    ).toBe(`POST ${RUTA_DESCONOCIDA} BadRequestException`);
  });
});

describe('las rutas de verdad de esta API sobreviven al saneado', () => {
  /*
   * LA OTRA MITAD DE LA PRUEBA ANTERIOR, Y HACE IGUAL DE FALTA.
   *
   * Un saneado demasiado estricto no es seguro, es inutil: si todas las
   * rutas acabaran en `desconocida`, el panel ensenaria una sola linea que
   * dice «algo fallo en alguna parte» y habria que volver al log de Render,
   * que es justo lo que esto viene a evitar.
   */
  it.each([
    '/api/v1/bookings',
    '/api/v1/quote',
    '/api/v1/admin/bookings/:bookingId',
    '/api/v1/admin/bookings/:bookingId/assignments',
    '/api/v1/admin/my-jobs',
    '/api/v1/admin/staff-directory',
    '/api/v1/admin/system-health',
    '/api/v1/admin/notification-settings',
    '/api/v1/webhooks/stripe',
    '/health/ready',
    '/',
  ])('%s se conserva tal cual', (ruta) => {
    const huella = huellaDelError({ method: 'GET', routePath: ruta, errorName: 'TypeError' });

    expect(huella).toBe(`GET ${ruta} TypeError`);
    expect(ErrorFingerprintSchema.safeParse(huella).success).toBe(true);
  });
});

describe('la huella no puede llevar datos dentro', () => {
  /*
   * ESTA ES LA GUARDIA DE SEGURIDAD DEL ARCHIVO, hermana de la de
   * `system-health.test.ts`. Alli el detalle es una lista cerrada y basta.
   * Aqui no cabe una lista —las rutas son muchas y cambian— asi que lo que
   * protege es el saneado, y lo que lo demuestra es esta prueba.
   *
   * Lo que entra son cadenas REALES de este sistema.
   */
  it('una URL de verdad, con identificadores y cadena de consulta, no pasa', () => {
    const urlsReales = [
      '/api/v1/admin/bookings?email=cliente@ejemplo.com',
      '/api/v1/bookings/8f2c1a94-1d3e-4f55-9b77-2c0a5e6d7f88',
      '/api/v1/media/removal#token=abc123',
      '/api/v1/admin/customers?q=Maria+Gonzalez',
      '/api/v1/payments/pi_3ABCdefGHIjkl',
    ];

    for (const url of urlsReales) {
      const huella = huellaDelError({ method: 'GET', routePath: url, errorName: 'TypeError' });

      expect(huella, `deberia descartar: ${url}`).toBe(`GET ${RUTA_DESCONOCIDA} TypeError`);
    }
  });

  it('un mensaje de error de verdad no puede colarse por el nombre', () => {
    const mensajesReales = [
      "Can't reach database server at db.abcdefgh.supabase.co:5432",
      'No such payment_intent: pi_3ABC',
      'Raw query failed. Code: `42703`',
      'ECONNREFUSED 10.0.0.4:6543',
      'Invalid `prisma.booking.create()` invocation',
    ];

    for (const mensaje of mensajesReales) {
      const huella = huellaDelError({ method: 'GET', routePath: '/x', errorName: mensaje });

      expect(huella, `deberia descartar: ${mensaje}`).toBe(`GET /x ${ERROR_SIN_NOMBRE}`);
    }
  });

  it('y el esquema vuelve a rechazar lo que se montara a mano', () => {
    /*
     * El saneado se puede saltar escribiendo la cadena directamente. Por eso
     * el esquema existe aparte: es la segunda puerta, y la que vigila lo que
     * sale de la API hacia el panel.
     */
    const montadasAMano = [
      'GET /api/v1/bookings?email=a@b.com TypeError',
      'GET /x Error: no such customer',
      'GET /api/v1/bookings/abc Error con espacios',
      'get /x TypeError',
      'GET /x',
    ];

    for (const falsa of montadasAMano) {
      expect(ErrorFingerprintSchema.safeParse(falsa).success, `deberia rechazar: ${falsa}`).toBe(
        false,
      );
    }
  });
});

describe('las cifras de la ventana', () => {
  it('la alarma mira menos tiempo del que conserva la pantalla', () => {
    /*
     * A proposito: la alarma dice «ya no pasa» al cabo de una hora, pero
     * quien abre el panel por la manana tiene que poder ver el fallo de las
     * tres de la madrugada.
     */
    expect(ERROR_WINDOW_MINUTES).toBeLessThan(ERROR_HISTORY_MINUTES);
  });

  it('hace falta mas de un error para pasar de «mirar hoy» a «roto ahora»', () => {
    expect(ERROR_DOWN_THRESHOLD).toBeGreaterThan(1);
  });
});

describe('el informe que lee el panel', () => {
  const informe = {
    windowMinutes: ERROR_WINDOW_MINUTES,
    inWindow: 2,
    historyMinutes: ERROR_HISTORY_MINUTES,
    samples: [
      { fingerprint: 'POST /api/v1/bookings TypeError', status: 500, count: 2, lastAt: 'ahora' },
    ],
    checkedAt: new Date().toISOString(),
  };

  it('se lee entero', () => {
    const parsed = ApiErrorReportSchema.safeParse(informe);

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.samples).toHaveLength(1);
  });

  it('tolera campos que esta version del panel no conoce', () => {
    // La API y el panel se despliegan por separado: un campo nuevo no puede
    // dejar la tarjeta en blanco.
    const parsed = ApiErrorReportSchema.safeParse({
      ...informe,
      samples: [{ ...informe.samples[0], primeraVez: 'ayer' }],
      pico: 7,
    });

    expect(parsed.success).toBe(true);
  });

  it('descarta la huella que no entiende en vez de tirar el informe', () => {
    const parsed = ApiErrorReportSchema.safeParse({
      ...informe,
      samples: [
        { fingerprint: 'GET /x?email=a@b.com TypeError', status: 500, count: 1, lastAt: 'x' },
        informe.samples[0],
      ],
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.samples).toHaveLength(1);
    expect(parsed.data.samples[0]?.fingerprint).toBe('POST /api/v1/bookings TypeError');
  });

  it('no cuenta nada que no sea un error del servidor', () => {
    // Un 404 o un 429 no son fallos nuestros: son peticiones que no tenian
    // que funcionar. Contarlos convertiria la alarma en ruido.
    const parsed = ApiErrorReportSchema.safeParse({
      ...informe,
      samples: [{ ...informe.samples[0], status: 404 }],
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.samples).toHaveLength(0);
  });
});
