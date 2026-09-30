import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../common/config/env';
import { GeocodingService } from './geocoding.service';

/**
 * BARRIDO DE GEOCODIFICACION
 * --------------------------
 * Cada pocos minutos pregunta lo mismo: ¿que direcciones siguen sin
 * coordenadas? Y las resuelve.
 *
 * POR QUE HACE FALTA, SI YA SE GEOCODIFICA AL RESERVAR. Porque ese intento
 * puede fallar, y su fallo es silencioso a proposito: el servicio del Censo
 * no responde, o tarda mas de la cuenta, y la reserva sigue adelante sin
 * coordenadas. Sin este barrido, esa direccion se quedaria sin punto en el
 * mapa PARA SIEMPRE, y los fichajes de ese cliente no registrarian distancia
 * nunca — sin que nadie se entere.
 *
 * Tambien recoge las direcciones que ya existian antes de que esto se
 * construyera, que al desplegar son todas.
 *
 * SIGUE EL MISMO PATRON QUE EL BARRIDO DE RECORDATORIOS, y por los mismos
 * motivos: no guarda estado en memoria, recalcula desde la base en cada
 * pasada, y va dentro de la API en vez de en un servicio de cron aparte.
 *
 * DE POCAS EN POCAS. Al desplegar puede haber cientos de direcciones sin
 * geocodificar. Resolverlas todas de golpe seria atacar a un servicio
 * publico gratuito; el tope por pasada las va resolviendo con calma, y como
 * nada depende de ello con urgencia, tardar unas horas no le cuesta nada a
 * nadie.
 */
@Injectable()
export class GeocodingSweepService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GeocodingSweepService.name);

  private temporizador: NodeJS.Timeout | null = null;
  /** Evita que dos pasadas se solapen si una tarda mas que el intervalo. */
  private enCurso = false;

  constructor(
    private readonly geocoding: GeocodingService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    const minutos = this.config.get('GEOCODING_SWEEP_MINUTES', { infer: true });

    if (minutos === 0) {
      // Cero lo apaga. Es lo que usan las pruebas, que llaman al barrido a
      // mano para no depender del reloj.
      this.logger.log('Barrido de geocodificacion desactivado (GEOCODING_SWEEP_MINUTES=0)');
      return;
    }

    /*
     * `unref` para que el temporizador no impida que el proceso termine. Sin
     * el, cerrar la aplicacion se queda esperando al siguiente disparo.
     */
    this.temporizador = setInterval(() => void this.ejecutar(), minutos * 60_000);
    this.temporizador.unref();

    this.logger.log(`Barrido de geocodificacion cada ${minutos} min`);
  }

  onModuleDestroy(): void {
    if (this.temporizador) clearInterval(this.temporizador);
  }

  /**
   * Una pasada. Publico para que las pruebas lo llamen sin esperar al reloj.
   *
   * Devuelve cuantas se resolvieron, que es lo unico que interesa medir.
   */
  async ejecutar(): Promise<number> {
    if (this.enCurso) {
      this.logger.warn('El barrido anterior sigue en curso; se salta esta pasada');
      return 0;
    }

    this.enCurso = true;
    try {
      const tope = this.config.get('GEOCODING_SWEEP_BATCH', { infer: true });
      const pendientes = await this.geocoding.pendingAddressIds(tope);
      if (pendientes.length === 0) return 0;

      let resueltas = 0;
      for (const addressId of pendientes) {
        /*
         * DE UNA EN UNA, NO EN PARALELO. Son llamadas a un servicio publico
         * gratuito: veinte peticiones simultaneas es justo la forma de que
         * te limiten. Y no hay ninguna prisa.
         */
        if (await this.geocoding.resolveAndStore(addressId)) resueltas += 1;
      }

      this.logger.log(`Barrido de geocodificacion: ${resueltas} de ${pendientes.length} resueltas`);
      return resueltas;
    } catch (error) {
      /*
       * Nunca lanza. Es una tarea de fondo: un fallo aqui no debe tumbar el
       * proceso ni dejar el temporizador roto para las siguientes pasadas.
       */
      this.logger.error(
        `El barrido de geocodificacion fallo: ` +
          `${error instanceof Error ? error.message : 'error desconocido'}`,
      );
      return 0;
    } finally {
      this.enCurso = false;
    }
  }
}
