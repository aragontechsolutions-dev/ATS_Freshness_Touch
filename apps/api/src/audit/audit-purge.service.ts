import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../common/config/env';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from './audit.service';

/** Filas por vuelta. Ver el comentario de `borrarLote`. */
const TAMANO_DEL_LOTE = 1000;

/** Tope de vueltas por pasada, para que una purga no monopolice la base. */
const LOTES_POR_PASADA = 50;

/** Retraso de la primera pasada tras arrancar. Ver `onModuleInit`. */
const RETRASO_INICIAL_MS = 60_000;

/**
 * PURGA DEL REGISTRO DE AUDITORIA
 * -------------------------------
 * Borra las entradas mas antiguas que la retencion configurada (un ano por
 * defecto). Es el UNICO borrado de todo el modulo, y por eso hay que dejar
 * claro en que se diferencia de poder borrar filas:
 *
 *   - NO ELIGE. Borra por antiguedad y nada mas. No hay parametro de accion,
 *     ni de persona, ni de reserva. Nadie puede pedirle que haga desaparecer
 *     lo que hizo el martes.
 *   - NO SE INVOCA DESDE FUERA. No hay endpoint. Corre sola con el reloj.
 *   - DEJA CONSTANCIA DE SI MISMA. Cuando borra algo, escribe una entrada
 *     diciendo cuantas y hasta que fecha. Sin ella, un hueco en el historial
 *     es indistinguible de un borrado a mano, que es justo la duda que la
 *     auditoria existe para despejar.
 *
 * POR QUE BORRAR Y NO GUARDARLO TODO. Estas filas llevan direcciones IP y el
 * detalle de los movimientos del personal. Guardar mas de lo que hace falta
 * no es mas seguro: es mas superficie que proteger si alguien entra.
 */
@Injectable()
export class AuditPurgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditPurgeService.name);

  private temporizador: NodeJS.Timeout | null = null;
  private arranque: NodeJS.Timeout | null = null;
  /** Evita que dos pasadas se solapen si una tarda mas que el intervalo. */
  private enCurso = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    const dias = this.config.get('AUDIT_RETENTION_DAYS', { infer: true });
    const horas = this.config.get('AUDIT_PURGE_HOURS', { infer: true });

    if (dias === 0 || horas === 0) {
      this.logger.log('Purga de auditoria desactivada');
      return;
    }

    /*
     * HAY UNA PASADA AL ARRANCAR, y no es por impaciencia.
     *
     * El intervalo son 24 horas y este proceso se reinicia en cada
     * despliegue. Con solo el intervalo, en una semana de varios despliegues
     * diarios la purga no llegaria a ejecutarse NUNCA y la retencion seria
     * una promesa escrita en la documentacion y en ningun sitio mas.
     *
     * Va con un minuto de retraso para no competir con el arranque, que es
     * cuando la API tiene que empezar a responder.
     */
    this.arranque = setTimeout(() => void this.ejecutar(), RETRASO_INICIAL_MS);
    this.arranque.unref();

    /*
     * `unref` para que el temporizador no impida que el proceso termine. Sin
     * el, cerrar la aplicacion se queda esperando al siguiente disparo.
     */
    this.temporizador = setInterval(() => void this.ejecutar(), horas * 3_600_000);
    this.temporizador.unref();

    this.logger.log(`Purga de auditoria cada ${horas} h, reteniendo ${dias} dias`);
  }

  onModuleDestroy(): void {
    if (this.arranque) clearTimeout(this.arranque);
    if (this.temporizador) clearInterval(this.temporizador);
    this.arranque = null;
    this.temporizador = null;
  }

  /**
   * Una pasada. Devuelve cuantas entradas se borraron.
   *
   * Es publico porque las pruebas lo llaman directamente: depender del reloj
   * para comprobar la logica haria las pruebas lentas y fragiles.
   *
   * NUNCA LANZA. Lo invoca un temporizador sin nadie escuchando: una
   * excepcion aqui seria un rechazo de promesa sin capturar, que en Node
   * puede tumbar el proceso entero. La API se caeria por un fallo al borrar
   * filas viejas.
   */
  async ejecutar(now: Date = new Date()): Promise<number> {
    const dias = this.config.get('AUDIT_RETENTION_DAYS', { infer: true });
    if (dias === 0) return 0;

    if (this.enCurso) {
      this.logger.warn('La purga anterior sigue en curso: se salta esta pasada');
      return 0;
    }

    this.enCurso = true;

    try {
      const limite = new Date(now.getTime() - dias * 86_400_000);
      let borradas = 0;

      /*
       * SE BORRA POR LOTES, no de un `DELETE` unico.
       *
       * Un borrado de cien mil filas en una sola sentencia mantiene la
       * transaccion abierta durante segundos y bloquea las inserciones: con
       * la auditoria escribiendose dentro de las transacciones de negocio,
       * eso no es una consulta lenta, es el panel entero parado.
       *
       * Tambien hay tope de vueltas. Lo que no entre hoy se recoge manana:
       * la retencion es de un ano, unas horas mas no cambian nada.
       */
      for (let vuelta = 0; vuelta < LOTES_POR_PASADA; vuelta += 1) {
        const lote = await this.borrarLote(limite);
        borradas += lote;
        if (lote < TAMANO_DEL_LOTE) break;
      }

      if (borradas > 0) {
        await this.anotar(borradas, limite);
        this.logger.log(
          `Purga de auditoria: ${borradas} entrada(s) anteriores a ${limite.toISOString()}`,
        );
      }

      return borradas;
    } catch (error) {
      this.logger.error(
        `La purga de auditoria fallo: ` +
          (error instanceof Error ? error.message : 'error desconocido'),
      );
      return 0;
    } finally {
      this.enCurso = false;
    }
  }

  /**
   * Borra hasta `TAMANO_DEL_LOTE` entradas anteriores al limite.
   *
   * Va en SQL y no en `deleteMany` porque Prisma no admite limitar cuantas
   * filas borra, y ese limite es justo el punto de hacerlo por lotes. La
   * subconsulta usa el indice de `createdAt`, asi que no recorre la tabla.
   *
   * El limite viaja como PARAMETRO, nunca interpolado: aunque hoy salga de
   * una variable de entorno numerica y no de nadie de fuera, una fecha
   * pegada a mano en una cadena es la forma en que estas cosas empiezan.
   */
  private async borrarLote(limite: Date): Promise<number> {
    return this.prisma.db.$executeRaw`
      DELETE FROM "audit_logs"
      WHERE "id" IN (
        SELECT "id" FROM "audit_logs"
        WHERE "createdAt" < ${limite}
        ORDER BY "createdAt" ASC
        LIMIT ${TAMANO_DEL_LOTE}
      )
    `;
  }

  /**
   * Deja constancia de la propia purga.
   *
   * Va FUERA del borrado y sin transaccion compartida a proposito: si no se
   * pudiera anotar, lo que ya esta borrado sigue borrado, y volver a
   * intentarlo no lo devuelve. Se prefiere una purga anotada en el log del
   * servidor a una excepcion que tumba el barrido.
   */
  private async anotar(borradas: number, limite: Date): Promise<void> {
    try {
      await this.audit.record({
        staff: null,
        surface: 'SYSTEM',
        action: 'audit.purged',
        entityType: 'audit',
        entityId: null,
        metadata: { deleted: borradas, olderThan: limite.toISOString() },
      });
    } catch {
      // `AuditService` ya lo ha escrito en el log del servidor.
    }
  }
}
