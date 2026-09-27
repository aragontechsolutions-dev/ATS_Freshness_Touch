import type { QuoteTravel } from '@freshness/types';
import type { PricingConfig } from './config';
import { resolveMileageRate } from './mileage';
import { roundCents } from './money';

/**
 * EL COSTE DEL TRASLADO
 * ---------------------
 *   millasFacturables = max(0, millas - radioLibre) * (ida y vuelta ? 2 : 1)
 *   recargo           = millasFacturables * centavosPorMilla
 *
 * DENTRO DEL RADIO NO SE COBRA NADA, y es una promesa comercial, no un
 * descuento: «vamos hasta 35 millas sin cobrarte el viaje» se dice en una
 * frase y se entiende.
 *
 * POR MILLA Y NO POR ESCALONES. Antes habia franjas con recargos fijos —25,
 * 50, 75 dolares—, asi que dos casas separadas por una milla podian pagar
 * veinticinco dolares de diferencia por caer a un lado u otro de una raya
 * que el cliente no ve. Contando millas, el salto no existe.
 *
 * LA TARIFA POR DEFECTO ES LA DEL IRS, y eso no es pereza: es una cifra
 * oficial y publicada, asi que ante un cliente que discute el recargo hay
 * algo que ensenar que no se ha inventado la empresa. Se puede fijar una
 * propia desde el panel.
 */
export function calculateTravel(miles: number, config: PricingConfig, now: Date): QuoteTravel {
  const centsPerMile = config.travel.centsPerMile ?? resolveMileageRate(now).centsPerMile;

  const excessMiles = Math.max(0, miles - config.travel.freeRadiusMiles);
  const billableMiles = config.travel.roundTrip ? excessMiles * 2 : excessMiles;

  return {
    freeRadiusMiles: config.travel.freeRadiusMiles,
    billableMiles: Number(billableMiles.toFixed(2)),
    centsPerMile,
    amountCents: roundCents(billableMiles * centsPerMile),
  };
}
