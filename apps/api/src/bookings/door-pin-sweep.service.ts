import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { HORAS_DE_VIDA_DEL_PIN } from '@freshness/types';
import { PrismaService } from '../database/prisma.service';

/**
 * EL BORRADO, EN UNA SOLA CADENA Y EXPORTADA.
 *
 * ========================================================================
 * SE EXPORTA PARA QUE LA PRUEBA USE ESTA MISMA, NO UNA COPIA
 * ========================================================================
 * Esta regla existe dos veces: aqui en SQL, y en `finDeLaVidaDelPin` en
 * TypeScript, que es la que decide si un pin se puede leer. No hay forma de
 * que compartan codigo —una la ejecuta Postgres y la otra Node—, asi que lo
 * unico que impide que se separen es una prueba que las compare con las
 * mismas fechas.
 *
 * Si la prueba escribiera su propia copia del SQL, compararia dos cosas que
 * ella misma mantiene de acuerdo y no probaria nada. Usando esta constante,
 * cambiar el SQL de aqui cambia lo que la prueba ejecuta.
 */
export const SQL_BORRAR_PINES_VENCIDOS = `
  UPDATE "bookings"
     SET "doorPinLatitude" = NULL, "doorPinLongitude" = NULL
   WHERE "doorPinLatitude" IS NOT NULL
     AND COALESCE("completedAt", "cancelledAt", "scheduledEnd")
         < NOW() - ($1 * INTERVAL '1 hour')
`;

/** Cada cuanto pasa. Ver `onModuleInit`. */
const CADA_MS = 30 * 60_000;

/** Retraso de la primera pasada tras arrancar, para no competir con el arranque. */
const RETRASO_INICIAL_MS = 90_000;

/**
 * BORRADO DE LOS PINES DE PUERTA VENCIDOS
 * =======================================
 * La otra mitad de la promesa que se le hace al cliente al reservar: que lo
 * que marco en el mapa se borra cuando el trabajo termina.
 *
 * ========================================================================
 * NO ES LA UNICA DEFENSA, Y POR ESO SE PUEDE DORMIR TRANQUILO
 * ========================================================================
 * Un barrido puede fallar en silencio: la API caida un fin de semana, una
 * excepcion que nadie mira, el proceso reiniciandose a mitad de pasada. Si
 * esto fuera lo unico, un fallo asi dejaria el dato vivo DESPUES de haber
 * prometido lo contrario, y nadie se enteraria.
 *
 * Por eso la caducidad se aplica TAMBIEN al leer (`door-pin.helper.ts`): un
 * pin vencido no lo puede devolver nadie aunque su fila siga ahi. Este
 * servicio es el que la borra de verdad; el otro es el que garantiza que,
 * mientras tanto, no la ve nadie.
 *
 * ========================================================================
 * BORRA, NO ELIGE
 * ========================================================================
 * Igual que la purga de auditoria: no hay endpoint, no se invoca desde
 * fuera, no admite parametros. Solo mira la hora. Nadie puede pedirle que
 * haga desaparecer el pin de una reserva concreta.
 *
 * NO ESCRIBE AUDITORIA, y ahi si se separa de la purga de auditoria. Aquella
 * borra el historial —el hueco hay que explicarlo— y esta borra un dato que
 * el cliente pidio que se borrara. Anotar «se borro el pin de la reserva X»
 * en un registro que se guarda un ano convertiria el borrado en otro rastro
 * del mismo hecho. Lo que si queda es la cuenta en el log del servidor:
 * cuantos, sin decir de quien.
 */
@Injectable()
export class DoorPinSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DoorPinSweepService.name);

  private temporizador: NodeJS.Timeout | null = null;
  private arranque: NodeJS.Timeout | null = null;
  /** Evita que dos pasadas se solapen si una tarda mas que el intervalo. */
  private enCurso = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.arranque = setTimeout(() => {
      void this.pasada();
      this.temporizador = setInterval(() => void this.pasada(), CADA_MS);
      this.temporizador.unref?.();
    }, RETRASO_INICIAL_MS);
    this.arranque.unref?.();

    this.logger.log(
      `Borrado de pines de puerta cada 30 min, ${HORAS_DE_VIDA_DEL_PIN} h despues del trabajo`,
    );
  }

  onModuleDestroy(): void {
    if (this.arranque) clearTimeout(this.arranque);
    if (this.temporizador) clearInterval(this.temporizador);
  }

  /**
   * Borra en una sola sentencia los pines que ya vencieron.
   *
   * ======================================================================
   * LA MISMA REGLA QUE `finDeLaVidaDelPin`, ESCRITA EN SQL
   * ======================================================================
   * `COALESCE(completedAt, cancelledAt, scheduledEnd) + 24 h`. Que este
   * duplicada —aqui y en el contrato de TypeScript— no es un descuido: una
   * la aplica Postgres y la otra el servidor al leer, y no hay forma de que
   * compartan codigo. Hay una prueba de punta a punta que las compara con
   * las mismas fechas para que no se separen.
   *
   * SE HACE EN SQL Y NO LEYENDO Y ACTUALIZANDO FILA A FILA porque entre la
   * lectura y la escritura podria colarse un cambio de estado, y entonces
   * se borraria el pin de un trabajo que acaba de reprogramarse.
   */
  private async pasada(): Promise<void> {
    if (this.enCurso || !this.prisma.isConnected) return;
    this.enCurso = true;

    try {
      const borrados = await this.prisma.db.$executeRawUnsafe(
        SQL_BORRAR_PINES_VENCIDOS,
        HORAS_DE_VIDA_DEL_PIN,
      );

      // La cuenta, nunca de quien. Un cero no se registra: seria ruido cada
      // media hora durante toda la vida del sistema.
      if (borrados > 0) {
        this.logger.log(`Pines de puerta borrados: ${borrados}`);
      }
    } catch (error) {
      /*
       * NO SE PROPAGA. Esto corre en un temporizador, sin nadie esperando:
       * una excepcion aqui tumbaria el proceso entero de la API por no haber
       * podido borrar un punto en un mapa. Se anota y se reintenta en media
       * hora, y mientras tanto la caducidad al leer sigue tapando el dato.
       */
      this.logger.error(
        `No se pudieron borrar los pines vencidos: ${error instanceof Error ? error.message : 'error desconocido'}`,
      );
    } finally {
      this.enCurso = false;
    }
  }
}
