import { Injectable } from '@nestjs/common';
import {
  ERROR_DOWN_THRESHOLD,
  ERROR_FINGERPRINTS_MAX,
  ERROR_HISTORY_MINUTES,
  ERROR_WINDOW_MINUTES,
  huellaDelError,
  type ApiErrorReport,
  type ApiErrorSample,
  type SystemCheck,
} from '@freshness/types';
import type { ErrorAnotado, ErrorRecorder } from '../common/filters/error-recorder';

/**
 * QUIEN LLEVA LA CUENTA DE LO QUE REVIENTA
 * ========================================
 * La pieza que le faltaba a la alarma. `SystemChecksService` contesta cinco
 * preguntas sobre el ESTADO del sistema y las cinco pueden decir «todo bien»
 * mientras una ruta devuelve 500 en cada peticion. Esto cuenta esos 500 y
 * los convierte en una sexta pregunta, para que suene el mismo telefono.
 *
 * ========================================================================
 * EN MEMORIA, Y ES LA DECISION IMPORTANTE DEL ARCHIVO
 * ========================================================================
 * Lo natural seria una tabla. No, y por una razon concreta de este sitio:
 * ESTO CORRE DENTRO DEL MANEJADOR DE ERRORES. El dia que la base no
 * responda, cada peticion acabara en 500 y cada 500 intentaria escribir una
 * fila en la base que no responde. O sea: justo cuando mas falta hace, no
 * funcionaria, y encima multiplicaria por dos las conexiones agotadas.
 *
 * Un contador en memoria no puede fallar por nada de eso. Es el mismo
 * patron, y por el mismo motivo, que `SweepHeartbeatService`.
 *
 * LO QUE SE PAGA: al reiniciarse el proceso —cada despliegue— la cuenta
 * vuelve a cero. Se acepta porque el aviso ya se mando cuando paso; lo que
 * se pierde es el historial de la pantalla, no la alarma. Guardarlo de
 * verdad es una tabla, y una tabla pertenece a B3, no aqui.
 *
 * ========================================================================
 * LA MEMORIA ESTA ACOTADA POR LOS DOS LADOS
 * ========================================================================
 * Un bucle de peticiones raras —o un robot buscando agujeros— podria inventar
 * huellas sin parar. Hay dos topes: `ERROR_FINGERPRINTS_MAX` huellas
 * distintas (se tira la mas antigua) y un cubo por minuto para la ventana,
 * que se poda. Lo que no se pierde nunca es el CONTADOR: que haya mas
 * huellas de las que caben no hace que los fallos dejen de contarse.
 */

/** Lo que se recuerda de cada huella. */
interface Rastro {
  /** El ultimo codigo con el que se respondio a esa huella. */
  status: number;
  /** Cuantas veces, en lo que se conserva. */
  veces: number;
  /** La ultima vez. */
  ultimaMs: number;
}

@Injectable()
export class ErrorMonitorService implements ErrorRecorder {
  /** Huella -> lo que se sabe de ella. Para la pantalla del panel. */
  private readonly huellas = new Map<string, Rastro>();

  /**
   * Minuto -> cuantos fallos hubo en el. Para la cifra de la ventana.
   *
   * Por minutos y no por evento: sesenta numeros en vez de una lista que
   * crece con cada fallo. Una tormenta de diez mil errores en una hora
   * ocupa exactamente lo mismo que uno solo.
   */
  private readonly porMinuto = new Map<number, number>();

  /**
   * Anota un fallo. NUNCA LANZA: ver `ErrorRecorder`.
   *
   * Los 4xx no se cuentan, y esa es la linea que mantiene esto util. Un 404
   * de un robot buscando `/wp-login.php`, un 429 de alguien que pulsa dos
   * veces o un 400 de un formulario a medio rellenar no son fallos del
   * sistema: son peticiones que no tenian que funcionar. Contarlas haria que
   * la alarma sonara todos los dias y, a las dos semanas, que nadie la
   * leyera. Exactamente el final que tuvo el log.
   */
  anotar(entrada: ErrorAnotado): void {
    if (entrada.status < 500) return;

    const ahoraMs = Date.now();
    const huella = huellaDelError(entrada);

    const previo = this.huellas.get(huella);
    // Se borra y se vuelve a poner para que el Map quede ordenado por
    // antiguedad: asi, al desalojar, el primero es el mas viejo.
    this.huellas.delete(huella);
    this.huellas.set(huella, {
      status: entrada.status,
      veces: (previo?.veces ?? 0) + 1,
      ultimaMs: ahoraMs,
    });

    const minuto = Math.floor(ahoraMs / 60_000);
    this.porMinuto.set(minuto, (this.porMinuto.get(minuto) ?? 0) + 1);

    this.podar(ahoraMs);
  }

  /**
   * La sexta pregunta: ¿ha reventado algo en la ultima hora?
   *
   * Tres respuestas y no dos, porque a un 500 suelto y a veinte no se
   * responde igual: el primero es algo que mirar hoy, los veinte son algo
   * roto ahora mismo. Si la fila y el aviso dijeran lo mismo en los dos
   * casos, el aviso no ayudaria a decidir.
   */
  comprobacion(ahoraMs: number = Date.now()): SystemCheck {
    const enVentana = this.enVentana(ahoraMs);

    if (enVentana === 0) return { id: 'errors', state: 'ok', detailKey: null, count: null };

    return {
      id: 'errors',
      state: enVentana >= ERROR_DOWN_THRESHOLD ? 'down' : 'degraded',
      detailKey: enVentana >= ERROR_DOWN_THRESHOLD ? 'errors.many' : 'errors.recent',
      count: enVentana,
    };
  }

  /**
   * El informe para el panel: QUE fallo, no solo cuanto.
   *
   * Es la diferencia entre esta pantalla y el aviso de Telegram. El aviso
   * dice que hay que mirar; esto dice donde, sin tener que entrar a Render.
   */
  informe(ahoraMs: number = Date.now()): ApiErrorReport {
    this.podar(ahoraMs);

    const samples: ApiErrorSample[] = [...this.huellas.entries()]
      .map(([fingerprint, rastro]) => ({
        fingerprint,
        status: rastro.status,
        count: rastro.veces,
        lastAt: new Date(rastro.ultimaMs).toISOString(),
      }))
      // De lo mas reciente a lo mas antiguo: lo que acaba de pasar es lo
      // que se esta buscando cuando se abre esta pantalla.
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt));

    return {
      windowMinutes: ERROR_WINDOW_MINUTES,
      inWindow: this.enVentana(ahoraMs),
      historyMinutes: ERROR_HISTORY_MINUTES,
      samples,
      checkedAt: new Date(ahoraMs).toISOString(),
    };
  }

  /** Olvida todo. Solo las pruebas. */
  reset(): void {
    this.huellas.clear();
    this.porMinuto.clear();
  }

  /* ---------------------------------------------------------------------- */

  /** Cuantos fallos en los ultimos `ERROR_WINDOW_MINUTES` minutos. */
  private enVentana(ahoraMs: number): number {
    const desde = Math.floor(ahoraMs / 60_000) - ERROR_WINDOW_MINUTES;

    let total = 0;
    for (const [minuto, cuantos] of this.porMinuto) {
      if (minuto > desde) total += cuantos;
    }

    return total;
  }

  /**
   * Tira lo viejo y lo que no cabe.
   *
   * Se poda al anotar y al informar, no con un temporizador: un barrido mas
   * seria una pieza mas que puede morirse en silencio —y entonces habria que
   * vigilarla, que es como empiezan estas cosas— para ahorrar un recorrido
   * de sesenta numeros.
   */
  private podar(ahoraMs: number): void {
    const minutoAhora = Math.floor(ahoraMs / 60_000);

    for (const minuto of this.porMinuto.keys()) {
      if (minuto <= minutoAhora - ERROR_WINDOW_MINUTES) this.porMinuto.delete(minuto);
    }

    const caduca = ahoraMs - ERROR_HISTORY_MINUTES * 60_000;
    for (const [huella, rastro] of this.huellas) {
      if (rastro.ultimaMs < caduca) this.huellas.delete(huella);
    }

    // El Map esta ordenado por antiguedad (ver `anotar`), asi que el primero
    // que devuelve el iterador es siempre el mas viejo.
    while (this.huellas.size > ERROR_FINGERPRINTS_MAX) {
      const masVieja = this.huellas.keys().next().value;
      if (masVieja === undefined) break;
      this.huellas.delete(masVieja);
    }
  }
}
