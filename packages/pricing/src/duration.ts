import type { AddOnCode, ServiceType } from '@freshness/types';
import { defaultPricingConfig, type PricingConfig } from './config';
import { clamp } from './money';

export interface DurationInput {
  service: ServiceType;
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  addOns: { code: AddOnCode; quantity: number }[];
}

/**
 * Estima cuanto dura el trabajo en el domicilio.
 *
 * Sirve para dos cosas distintas y ambas importan:
 *   1. Decidir que huecos caben en la agenda. Una limpieza profunda de una
 *      casa grande no entra en el mismo espacio que una rotacion de Airbnb.
 *   2. No prometerle al cliente una hora de fin imposible de cumplir.
 *
 * Se redondea SIEMPRE hacia arriba al siguiente bloque de 30 minutos: es
 * preferible reservar de mas y terminar antes que encadenar retrasos durante
 * todo el dia.
 *
 * El servicio comercial devuelve 0: se cotiza y se agenda a mano tras la
 * visita, asi que no tiene duracion estimable.
 */
export function estimateDurationMinutes(
  input: DurationInput,
  config: PricingConfig = defaultPricingConfig,
): number {
  const rate = config.durations[input.service];

  // Los servicios sin tarifa de tiempo (comercial) no se agendan solos.
  if (!config.services[input.service].instantQuote) {
    return 0;
  }

  const serviceMinutes =
    rate.baseMinutes +
    rate.perBedroomMinutes * input.bedrooms +
    rate.perBathroomMinutes * input.bathrooms +
    rate.minutesPerSquareFoot * input.squareFeet;

  const addOnMinutes = input.addOns.reduce((total, addOn) => {
    const perUnit = config.addOnMinutes[addOn.code];
    const unit = config.addOns[addOn.code];
    const quantity = unit.unit === 'FLAT' ? 1 : Math.min(addOn.quantity, unit.maxQuantity);
    return total + perUnit * quantity;
  }, 0);

  const total = serviceMinutes + addOnMinutes;
  const rounded =
    Math.ceil(total / config.durationRoundingMinutes) * config.durationRoundingMinutes;

  return clamp(rounded, config.durationMinMinutes, config.durationMaxMinutes);
}
