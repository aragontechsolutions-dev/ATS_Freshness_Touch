import { Injectable } from '@nestjs/common';

/**
 * EL LATIDO DE LOS BARRIDOS
 * =========================
 * Hay cuatro procesos que corren solos cada cierto tiempo: borrar pines de
 * puerta vencidos, mandar recordatorios, geocodificar direcciones y purgar el
 * registro de auditoria.
 *
 * ========================================================================
 * UN BARRIDO MUERTO NO SE QUEJA
 * ========================================================================
 * Y ese es exactamente el problema. Si el temporizador no se arranca, o una
 * excepcion lo mata, o el proceso se reinicia justo antes de registrarlo, el
 * sistema entero sigue respondiendo con total normalidad. Las reservas
 * entran, el panel abre, los precios salen. Solo que los recordatorios dejan
 * de llegar y los pines no se borran, y de eso nadie se entera hasta que un
 * cliente pregunta por que no le avisaron.
 *
 * Esto pone un pulso: cada barrido avisa cuando pasa, y si deja de avisar se
 * nota.
 *
 * ========================================================================
 * EN MEMORIA, Y ESTA BIEN QUE ASI SEA
 * ========================================================================
 * No se guarda en la base de datos a proposito, y no es por ahorrar:
 *
 *   - Si el proceso se reinicio, los temporizadores son nuevos y el historial
 *     del proceso anterior no dice nada del actual.
 *   - Escribir en la base cada media hora para vigilar los barridos anade
 *     escrituras cuyo unico proposito es vigilar, y la primera que fallaria
 *     en una caida de base de datos es justo esta.
 *   - Lo que se quiere saber es «¿este proceso, ahora mismo, sigue
 *     barriendo?». Esa pregunta es sobre el proceso vivo.
 *
 * SE REGISTRA AL ARRANCAR, NO AL PRIMER PASE. Un barrido apagado —las pruebas
 * los apagan con el intervalo a cero— NO se registra, asi que no aparece como
 * atrasado. Lo contrario llenaria las pruebas de alarmas falsas, y una alarma
 * falsa repetida es como se aprende a ignorar las alarmas.
 */

/** Los barridos que hay. Si se anade uno nuevo, se anade aqui. */
export const BARRIDOS = [
  'doorPin',
  'reminders',
  'geocoding',
  'auditPurge',
  'removalDeadlines',
  'expiredHolds',
  'recurringSeries',
  'notificationRetries',
  'galleryConsents',
] as const;
export type Barrido = (typeof BARRIDOS)[number];

/**
 * Cuanto se tolera de retraso antes de darlo por parado.
 *
 * DOS VECES EL INTERVALO MAS UN MARGEN, y no «el intervalo justo». Una pasada
 * puede tardar, el servidor puede estar ocupado, y un reloj que avisa al
 * primer segundo de retraso avisa todos los dias. Con el doble, para saltar
 * tiene que haberse perdido una pasada entera.
 */
const MARGEN_MS = 120_000;

function limite(intervaloMs: number): number {
  return intervaloMs * 2 + MARGEN_MS;
}

interface Pulso {
  intervaloMs: number;
  ultimoMs: number;
}

export interface BarridoAtrasado {
  barrido: Barrido;
  /** Minutos enteros desde el ultimo latido. Solo para el log, nunca sale de la API. */
  minutosSinPasar: number;
}

@Injectable()
export class SweepHeartbeatService {
  private readonly pulsos = new Map<Barrido, Pulso>();

  /**
   * Un barrido declara que se ha puesto en marcha y cada cuanto va a pasar.
   *
   * El arranque cuenta como primer latido: si no, todos saldrian atrasados
   * durante los primeros minutos de vida del proceso, que es justo cuando
   * mas se mira el panel despues de un despliegue.
   */
  registrar(barrido: Barrido, intervaloMs: number, ahoraMs: number = Date.now()): void {
    this.pulsos.set(barrido, { intervaloMs, ultimoMs: ahoraMs });
  }

  /** Un barrido acaba de pasar. */
  anotar(barrido: Barrido, ahoraMs: number = Date.now()): void {
    const pulso = this.pulsos.get(barrido);
    // Si no estaba registrado no se inventa un intervalo: sin saber cada
    // cuanto deberia pasar, no hay forma de decir si va tarde.
    if (!pulso) return;

    this.pulsos.set(barrido, { ...pulso, ultimoMs: ahoraMs });
  }

  /** Los que llevan demasiado sin pasar. Vacio cuando todo va bien. */
  atrasados(ahoraMs: number = Date.now()): BarridoAtrasado[] {
    const tarde: BarridoAtrasado[] = [];

    for (const [barrido, pulso] of this.pulsos) {
      const silencio = ahoraMs - pulso.ultimoMs;
      if (silencio > limite(pulso.intervaloMs)) {
        tarde.push({ barrido, minutosSinPasar: Math.floor(silencio / 60_000) });
      }
    }

    return tarde;
  }

  /** Cuantos barridos estan en marcha. Cero significa que no hay ninguno vigilado. */
  get vigilados(): number {
    return this.pulsos.size;
  }
}
