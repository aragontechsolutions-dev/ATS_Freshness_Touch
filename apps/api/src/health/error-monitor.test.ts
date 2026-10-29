import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ERROR_DOWN_THRESHOLD,
  ERROR_FINGERPRINTS_MAX,
  ERROR_WINDOW_MINUTES,
} from '@freshness/types';
import { ErrorMonitorService } from './error-monitor.service';

/**
 * EL CONTADOR DE ERRORES
 * ======================
 * Se prueba con el reloj falso porque lo que hay que demostrar es lo que
 * pasa CON EL TIEMPO: que la ventana se cierra, que el historial aguanta mas
 * que la ventana y que la memoria no crece sin limite. Esperar una hora de
 * verdad no es una opcion, y depender del reloj real haria una prueba que
 * falla sola un martes.
 */

const falloEn = (ruta: string | undefined, nombre = 'TypeError') => ({
  status: 500,
  method: 'GET',
  routePath: ruta,
  errorName: nombre,
});

describe('el contador de errores del servidor', () => {
  let monitor: ErrorMonitorService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T10:00:00.000Z'));
    monitor = new ErrorMonitorService();
  });

  describe('que se cuenta y que no', () => {
    it('sin fallos la comprobacion dice que esta bien, y sin cifra', () => {
      const check = monitor.comprobacion();

      expect(check).toEqual({ id: 'errors', state: 'ok', detailKey: null, count: null });
    });

    it('un 500 deja la comprobacion «a medias», con la cifra', () => {
      monitor.anotar(falloEn('/api/v1/bookings'));

      const check = monitor.comprobacion();

      expect(check.state).toBe('degraded');
      expect(check.detailKey).toBe('errors.recent');
      expect(check.count).toBe(1);
    });

    it(`a partir de ${ERROR_DOWN_THRESHOLD} pasa a «no funciona»`, () => {
      /*
       * La diferencia no es cosmetica: a un 500 suelto se le mira hoy, y a
       * veinte se le mira ahora. Si la fila y el aviso dijeran lo mismo en
       * los dos casos, no ayudarian a decidir cual de las dos cosas es.
       */
      for (let i = 0; i < ERROR_DOWN_THRESHOLD; i += 1) {
        monitor.anotar(falloEn('/api/v1/bookings'));
      }

      const check = monitor.comprobacion();

      expect(check.state).toBe('down');
      expect(check.detailKey).toBe('errors.many');
      expect(check.count).toBe(ERROR_DOWN_THRESHOLD);
    });

    it('UN 404 NO SE CUENTA, ni un 429, ni un 400', () => {
      /*
       * ESTA ES LA PRUEBA QUE MANTIENE LA ALARMA UTIL. Un robot buscando
       * `/wp-login.php`, alguien que pulsa dos veces o un formulario a medio
       * rellenar no son fallos del sistema: son peticiones que no tenian que
       * funcionar. Contarlas haria sonar la alarma todos los dias, y a las
       * dos semanas nadie la leeria. El mismo final que tuvo el log.
       */
      for (const status of [400, 401, 403, 404, 409, 413, 429]) {
        monitor.anotar({ ...falloEn('/api/v1/bookings'), status });
      }

      expect(monitor.comprobacion().state).toBe('ok');
      expect(monitor.informe().samples).toHaveLength(0);
    });

    it('un 503 si, que tambien es nuestro', () => {
      monitor.anotar({ ...falloEn('/api/v1/bookings'), status: 503 });

      expect(monitor.comprobacion().state).toBe('degraded');
      expect(monitor.informe().samples[0]?.status).toBe(503);
    });
  });

  describe('la ventana se cierra sola', () => {
    it(`pasados ${ERROR_WINDOW_MINUTES} minutos sin fallos vuelve a «esta bien»`, () => {
      monitor.anotar(falloEn('/api/v1/bookings'));
      expect(monitor.comprobacion().state).toBe('degraded');

      vi.advanceTimersByTime((ERROR_WINDOW_MINUTES + 1) * 60_000);

      /*
       * Y entonces la alarma manda su «resuelto», que AQUI SIGNIFICA «ya no
       * pasa», no «esta arreglado». Es la unica lectura rara de esta etapa y
       * se eligio a sabiendas: la alternativa era un boton de «visto» en el
       * panel, o sea un estado mas que guardar y una pantalla mas que
       * atender.
       */
      expect(monitor.comprobacion().state).toBe('ok');
    });

    it('pero el panel sigue viendo el fallo de hace horas', () => {
      /*
       * A proposito, y es la razon de que haya dos plazos: quien abre el
       * panel por la manana tiene que poder ver el fallo de las tres de la
       * madrugada, aunque la alarma ya dijera «resuelto» a las cuatro.
       */
      monitor.anotar(falloEn('/api/v1/bookings'));

      vi.advanceTimersByTime(5 * 3_600_000);

      const informe = monitor.informe();

      expect(informe.inWindow).toBe(0);
      expect(informe.samples).toHaveLength(1);
      expect(informe.samples[0]?.count).toBe(1);
    });

    it('un dia despues ya no se guarda', () => {
      monitor.anotar(falloEn('/api/v1/bookings'));

      vi.advanceTimersByTime(25 * 3_600_000);

      expect(monitor.informe().samples).toHaveLength(0);
    });
  });

  describe('como se agrupa', () => {
    it('el mismo fallo en la misma ruta es UNA linea con su cuenta', () => {
      for (let i = 0; i < 3; i += 1) monitor.anotar(falloEn('/api/v1/bookings'));

      const informe = monitor.informe();

      expect(informe.samples).toHaveLength(1);
      expect(informe.samples[0]?.count).toBe(3);
      expect(informe.inWindow).toBe(3);
    });

    it('rutas distintas o clases de error distintas son lineas distintas', () => {
      monitor.anotar(falloEn('/api/v1/bookings'));
      monitor.anotar(falloEn('/api/v1/quote'));
      monitor.anotar(falloEn('/api/v1/bookings', 'PrismaClientKnownRequestError'));

      expect(monitor.informe().samples).toHaveLength(3);
    });

    it('lo mas reciente va primero', () => {
      monitor.anotar(falloEn('/api/v1/bookings'));
      vi.advanceTimersByTime(60_000);
      monitor.anotar(falloEn('/api/v1/quote'));

      const informe = monitor.informe();

      expect(informe.samples[0]?.fingerprint).toContain('/api/v1/quote');
    });

    it('LA RUTA REAL NO ENTRA: lo que se guarda es el patron', () => {
      /*
       * La defensa de verdad esta en `@freshness/types` y alli se prueba con
       * URLs reales. Esto comprueba que el contador la usa: si alguien
       * cambiara `anotar` para guardar la cadena tal cual, el panel —que es
       * una pantalla de navegador— empezaria a ensenar identificadores de
       * reservas.
       */
      monitor.anotar(falloEn('/api/v1/bookings/8f2c1a94-1d3e-4f55-9b77-2c0a5e6d7f88'));

      expect(monitor.informe().samples[0]?.fingerprint).toBe('GET desconocida TypeError');
    });
  });

  describe('la memoria esta acotada', () => {
    it(`no guarda mas de ${ERROR_FINGERPRINTS_MAX} huellas distintas`, () => {
      for (let i = 0; i < ERROR_FINGERPRINTS_MAX + 20; i += 1) {
        monitor.anotar(falloEn(`/api/v1/ruta-${'x'.repeat(i % 5)}`, `Error${i}`));
      }

      expect(monitor.informe().samples.length).toBeLessThanOrEqual(ERROR_FINGERPRINTS_MAX);
    });

    it('pero la cifra de la ventana NO se pierde por eso', () => {
      /*
       * Importa el orden de gravedad: que no quepan todas las huellas es una
       * molestia para diagnosticar; que la cuenta mienta hacia abajo seria
       * una alarma que no suena.
       */
      const total = ERROR_FINGERPRINTS_MAX + 20;
      for (let i = 0; i < total; i += 1) {
        monitor.anotar(falloEn('/api/v1/bookings', `Error${i}`));
      }

      expect(monitor.comprobacion().count).toBe(total);
    });
  });
});
