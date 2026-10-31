import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GALLERY_UNCOVERED_GRACE_DAYS } from '@freshness/types';
import type { Env } from '../common/config/env';
import { SweepHeartbeatService } from '../health/sweep-heartbeat.service';
import { StaffNotificationsService } from '../staff-notifications/staff-notifications.service';
import { GalleryService } from './gallery.service';

/** Retraso de la primera pasada tras arrancar, para no competir con el arranque. */
const RETRASO_INICIAL_MS = 240_000;

/**
 * LAS FOTOS QUE SE QUEDARON EN EL LIMBO
 * =====================================
 * Avisa a administracion cuando hay piezas guardadas en la galeria que
 * ningun permiso ampara y que llevan ahi mas de unos dias.
 *
 * ========================================================================
 * EL FALLO QUE TAPA ES SILENCIOSO POR DISENO
 * ========================================================================
 * La galeria publica es una LISTA BLANCA: solo sale lo que tiene un permiso
 * firmado y en pie. Esa regla es la que impide publicar la casa de alguien
 * sin su permiso, y no se toca.
 *
 * Lo que trae de serie es que una pieza sin permiso NO DA ERROR. Se sube, se
 * guarda, se ve en el panel, y no aparece en la web. Quien la subio cree que
 * ya esta puesta; nadie recibe nada; la foto se queda ahi para siempre.
 *
 * La pantalla de la galeria ya lo dice —«hay N piezas que no se estan
 * publicando»— pero hay que abrirla para leerlo, y justamente no se abre
 * cuando se cree que el trabajo ya esta hecho. Es la misma historia que el
 * log que nadie leia (`docs/47`): el motivo tiene que venir a buscarte.
 *
 * ========================================================================
 * NO AVISA EL PRIMER DIA
 * ========================================================================
 * El orden normal de trabajo es subir la foto y anotar el permiso despues, a
 * veces al dia siguiente, cuando el cliente contesta. Avisar el mismo dia
 * convertiria el aviso en parte del procedimiento, y lo que suena siempre se
 * deja de leer. Ver `GALLERY_UNCOVERED_GRACE_DAYS`.
 *
 * ========================================================================
 * Y NO REPITE
 * ========================================================================
 * Esto no avisa de un HECHO, avisa de un ESTADO, y un estado sigue siendo
 * verdad en la pasada siguiente. Antes de dejar nada en la bandeja se mira
 * si ya hay un aviso de esta clase en la ventana actual.
 */
@Injectable()
export class GalleryConsentSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GalleryConsentSweepService.name);

  private temporizador: NodeJS.Timeout | null = null;
  private enCurso = false;

  constructor(
    private readonly gallery: GalleryService,
    private readonly bandeja: StaffNotificationsService,
    private readonly latidos: SweepHeartbeatService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    const horas = this.config.get('GALLERY_CONSENT_SWEEP_HOURS', { infer: true });

    if (horas === 0) {
      this.logger.log(
        'Vigilancia de piezas sin permiso desactivada (GALLERY_CONSENT_SWEEP_HOURS=0)',
      );
      return;
    }

    const cadaMs = horas * 3_600_000;
    this.latidos.registrar('galleryConsents', cadaMs);

    this.temporizador = setInterval(() => void this.pasada(), cadaMs);
    this.temporizador.unref();

    setTimeout(() => void this.pasada(), RETRASO_INICIAL_MS).unref();
  }

  onModuleDestroy(): void {
    if (this.temporizador !== null) clearInterval(this.temporizador);
  }

  /**
   * Una pasada. Publica para que las pruebas no dependan del reloj.
   *
   * Devuelve cuantas piezas encontro olvidadas, que es lo que permite probar
   * la regla sin espiar la bandeja.
   *
   * ======================================================================
   * `ahora` SOLO MIDE LA EDAD DE LAS PIEZAS. EL ANTIRREBOTE USA EL RELOJ DE
   * VERDAD, Y LA DIFERENCIA LA ENCONTRO UNA PRUEBA
   * ======================================================================
   * En produccion los dos relojes son el mismo y esto no se nota. En una
   * prueba que adelanta `ahora` una semana para envejecer una foto, si la
   * ventana del antirrebote se calculara con ese `ahora`, se estaria
   * preguntando «¿hay avisos de dentro de una semana?» contra filas que la
   * base sella con la hora real. Nunca encontraria ninguno, y el aviso se
   * repetiria en cada pasada.
   *
   * Lo que se simula es la EDAD DE UNA FOTO; lo que ya se aviso no se
   * simula, porque esta escrito en la tabla con la hora del servidor.
   */
  async pasada(ahora: Date = new Date()): Promise<number> {
    if (this.enCurso) return 0;
    this.enCurso = true;

    try {
      const cuantas = await this.gallery.sinPermisoDesdeHace(GALLERY_UNCOVERED_GRACE_DAYS, ahora);

      /* El latido es del barrido, no de las fotos: hora real siempre. */
      this.latidos.anotar('galleryConsents', Date.now());

      if (cuantas === 0) return 0;

      /*
       * La ventana del antirrebote es la del propio barrido: como mucho un
       * aviso por pasada, y un reinicio no vuelve a avisar porque lo que se
       * mira es la tabla y no la memoria.
       */
      const horas = this.config.get('GALLERY_CONSENT_SWEEP_HOURS', { infer: true });
      const desde = new Date(Date.now() - Math.max(horas, 1) * 3_600_000);

      if (await this.bandeja.hayRecientes('gallery.uncovered', desde)) return cuantas;

      await this.bandeja.emitir({
        kind: 'gallery.uncovered',
        /*
         * CUANTAS Y CUANTOS DIAS, nada mas. Ni la ruta de la foto ni de que
         * casa es: la bandeja se mira en un movil y para decidir que hay que
         * abrir la galeria no hace falta saber de quien era la cocina.
         */
        params: { count: cuantas, days: GALLERY_UNCOVERED_GRACE_DAYS },
      });

      return cuantas;
    } catch (error) {
      /*
       * NO SE PROPAGA: corre en un temporizador y sin nadie esperando. Una
       * excepcion aqui tumbaria el proceso de la API por no haber podido
       * contar unas fotos.
       */
      this.logger.error(
        'No se pudieron comprobar las piezas sin permiso: ' +
          (error instanceof Error ? error.message : 'error desconocido'),
      );
      return 0;
    } finally {
      this.enCurso = false;
    }
  }
}
