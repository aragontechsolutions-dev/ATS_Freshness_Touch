import type { ConfigService } from '@nestjs/config';
import { defaultPricingConfig, type PricingConfig } from '@freshness/pricing';
import type { Env } from './config/env';

/**
 * Tarifas del proyecto con la base de operaciones tomada del entorno.
 *
 * La base es especifica del despliegue (puede cambiar si la empresa se muda),
 * mientras que las tarifas son decision comercial y viven en el paquete de
 * precios. Esta funcion une ambas y la usan por igual el cotizador y las
 * reservas, para que no puedan divergir.
 */
export function buildPricingConfig(config: ConfigService<Env, true>): PricingConfig {
  return {
    ...defaultPricingConfig,
    baseOfOperations: {
      city: config.get('COMPANY_BASE_CITY', { infer: true }),
      state: config.get('COMPANY_BASE_STATE', { infer: true }),
      postalCode: config.get('COMPANY_BASE_POSTAL_CODE', { infer: true }),
    },
  };
}
