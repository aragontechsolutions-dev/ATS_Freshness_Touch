import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { applyPricingRates, type PricingConfig } from '@freshness/pricing';
import type { Env } from '../common/config/env';
import { buildPricingConfig } from '../common/pricing-config';
import { PricingRatesService } from './pricing-rates.service';
import { ServiceAreaService } from './service-area.service';

/**
 * LA CONFIGURACION DE PRECIOS VIGENTE
 * -----------------------------------
 * Une tres cosas que viven en sitios distintos y tienen que verse como una:
 *
 *   - LAS TARIFAS, que desde la etapa 2.22 tambien se editan desde el panel
 *     y viven en la base, versionadas.
 *   - La base de operaciones, que es del despliegue y viene del entorno.
 *   - EL AREA DE SERVICIO, que ahora se edita desde el panel y por tanto
 *     vive en la base de datos.
 *
 * POR QUE UN SERVICIO Y NO LA FUNCION DE ANTES. `buildPricingConfig` se
 * llamaba UNA VEZ en el constructor de cada servicio. Con las zonas en la
 * base eso ya no vale: un cambio desde el panel no se veria hasta reiniciar
 * el servidor. Aqui se resuelve por peticion, y la cache del area de
 * servicio evita que eso cueste una consulta cada vez.
 *
 * Y va en un solo sitio por lo mismo que antes: el cotizador y las reservas
 * TIENEN que calcular con la misma configuracion. Si cada uno se la montara
 * por su cuenta, un dia darian precios distintos para la misma casa y nadie
 * sabria cual es el bueno.
 */
@Injectable()
export class PricingConfigService {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly serviceArea: ServiceAreaService,
    private readonly rates: PricingRatesService,
  ) {}

  async current(): Promise<PricingConfig> {
    const [tarifas, zones] = await Promise.all([
      this.rates.current(),
      this.serviceArea.zoneRules(),
    ]);

    return {
      ...applyPricingRates(buildPricingConfig(this.config), tarifas.rates),
      /*
       * LA VERSION VIENE DE LAS TARIFAS, no del codigo. Es lo que se guarda
       * en cada cotizacion y en cada reserva, y lo que permite volver a
       * leer con que precios se calculo. Dejar aqui la del codigo habria
       * hecho que todas las cotizaciones dijeran lo mismo aunque los
       * precios hubieran cambiado diez veces.
       */
      version: tarifas.version,
      zones,
    };
  }

  /**
   * La configuracion tal y como estuvo en una version concreta.
   *
   * Para reproducir un presupuesto antiguo. `null` si esa version no esta
   * guardada, que le pasa a cualquier cotizacion anterior a esta etapa cuya
   * tabla nunca llego a escribirse.
   *
   * EL AREA DE SERVICIO NO SE RECONSTRUYE, y hay que decirlo: las zonas no
   * se versionan, asi que esto reproduce los PRECIOS de entonces con las
   * zonas de HOY. Para revisar una factura es lo que importa —el recargo
   * por zona ya esta escrito en la reserva—, pero no es un viaje completo
   * en el tiempo.
   */
  async atVersion(version: string): Promise<PricingConfig | null> {
    const tarifas = await this.rates.atVersion(version);
    if (!tarifas) return null;

    return {
      ...applyPricingRates(buildPricingConfig(this.config), tarifas),
      version,
      zones: await this.serviceArea.zoneRules(),
    };
  }
}
