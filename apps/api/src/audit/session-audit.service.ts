import { Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedStaff, StaffRole } from '@freshness/types';
import { TtlCache } from '../common/ttl-cache';
import { AuditService } from './audit.service';

/**
 * Cuanto se recuerda que una sesion ya se registro.
 *
 * Doce horas cubre una jornada entera con margen. Mas alla, si alguien sigue
 * con la misma sesion al dia siguiente, se escribe una segunda fila: es
 * preferible una entrada de mas a perder el rastro de un acceso.
 */
const MEMORIA_MS = 12 * 60 * 60 * 1000;

/**
 * Tope de sesiones recordadas a la vez. Con una plantilla de decenas de
 * personas sobra de largo, y pone techo a la memoria pase lo que pase.
 */
const MAXIMO_SESIONES = 2_000;

/**
 * QUIEN ENTRO Y CUANDO
 * --------------------
 * Esto parece un `INSERT` y no lo es. El problema esta en DONDE engancharlo.
 *
 * La API no ve el inicio de sesion: el panel pide el token directamente a
 * Supabase desde el navegador, y aqui solo llega ese token ya emitido. Lo
 * unico observable es «esta peticion trae una sesion que antes no habiamos
 * visto».
 *
 * Y ahi esta la trampa: `/admin/session` se llama al cargar el panel Y CADA
 * VEZ QUE LA PESTANA RECUPERA EL FOCO. Registrar sin mas produciria cien
 * filas al dia por persona por cambiar de pestana, y el registro dejaria de
 * servir para lo unico que se pide de el: saber quien entro y cuando.
 *
 * LA SOLUCION es deduplicar por el identificador de SESION del token, no por
 * el token ni por la persona. Ese identificador dura lo que dura la sesion
 * aunque el token se refresque cada hora, asi que una fila por acceso real.
 *
 * SE RECUERDA EN MEMORIA, no consultando la base de datos. Comprobar en la
 * tabla en cada peticion anadiria una consulta al camino critico de TODAS
 * las llamadas del panel para no escribir nada el 99,9% de las veces. El
 * precio de la memoria es que al reiniciar el servidor se olvida y se
 * escribe una fila de mas por sesion viva; en Render eso es una vez al
 * desplegar, y una entrada duplicada no estropea nada.
 */
@Injectable()
export class SessionAuditService {
  private readonly logger = new Logger(SessionAuditService.name);

  private readonly vistas = new TtlCache<true>(MEMORIA_MS, MAXIMO_SESIONES);

  constructor(private readonly audit: AuditService) {}

  /**
   * Registra un acceso, si es la primera vez que se ve esta sesion.
   *
   * NO ESPERA Y NO PUEDE FALLAR HACIA FUERA. Corre en la guarda, delante de
   * cada peticion del panel: si esto tardara, el panel entero tardaria, y si
   * lanzara, dejaria fuera a alguien que si tiene permiso por un fallo al
   * escribir una fila de registro. Un acceso sin anotar es malo; un acceso
   * bloqueado por no poder anotarlo es peor.
   */
  recordOpened(staff: AuthenticatedStaff, sessionId: string | null, ip: string | null): void {
    // Sin identificador de sesion no hay forma de deduplicar, y registrar
    // cada peticion seria peor que no registrar nada.
    if (!sessionId) return;
    if (this.vistas.get(sessionId)) return;

    // Se marca ANTES de escribir: si dos peticiones entran a la vez, solo
    // una llega hasta aqui. Si la escritura falla, se pierde esa fila, que
    // es justo lo que queremos frente a escribirla mil veces.
    this.vistas.set(sessionId, true);

    void this.audit
      .record({
        staff,
        surface: 'PANEL',
        action: 'session.opened',
        entityType: 'session',
        /*
         * El identificador de sesion NO se guarda como `entityId` ni en la
         * metadata. Es un secreto de sesion en vigor: quien leyera el
         * registro tendria material para intentar suplantarla. Solo se usa
         * en memoria para no repetir la fila.
         */
        entityId: null,
        metadata: { role: staff.role },
        ipAddress: ip,
      })
      .catch((error: unknown) => {
        this.logger.error(
          `No se pudo registrar el acceso de ${staff.email}: ` +
            (error instanceof Error ? error.message : 'error desconocido'),
        );
      });
  }

  /**
   * Registra un intento con credenciales validas pero rol insuficiente.
   *
   * Es la senal mas util del modulo para seguridad: el personal no anda
   * probando puertas que sabe cerradas, asi que varias de estas seguidas
   * significan o una cuenta comprometida o alguien fisgoneando.
   *
   * A diferencia del acceso, esto NO se deduplica: cada intento cuenta, y
   * justamente su repeticion es la informacion.
   */
  recordDenied(
    staff: AuthenticatedStaff,
    required: readonly StaffRole[],
    path: string,
    ip: string | null,
  ): void {
    void this.audit
      .record({
        staff,
        surface: 'PANEL',
        action: 'session.denied',
        entityType: 'session',
        entityId: null,
        metadata: { path, role: staff.role, required: [...required] },
        ipAddress: ip,
      })
      .catch((error: unknown) => {
        this.logger.error(
          `No se pudo registrar el acceso denegado de ${staff.email}: ` +
            (error instanceof Error ? error.message : 'error desconocido'),
        );
      });
  }
}
