import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PricingConfig } from '@freshness/pricing';
import type { Env } from '../common/config/env';
import { buildPricingConfig } from '../common/pricing-config';
import { ServiceAreaService } from './service-area.service';

/**
 * LA CONFIGURACION DE PRECIOS VIGENTE
 * -----------------------------------
 * Une tres cosas que viven en sitios distintos y tienen que verse como una:
 *
 *   - Las tarifas, que son decision comercial y viven en el paquete de
 *     precios.
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
  ) {}

  async current(): Promise<PricingConfig> {
    return {
      ...buildPricingConfig(this.config),
      zones: await this.serviceArea.zoneRules(),
    };
  }
}
