import type { QuoteDeposit } from '@freshness/types';
import type { PricingConfig } from './config';
import { resolveMileageRate } from './mileage';
import { clamp, roundCents } from './money';

/**
 * DEPOSITO POR DESPLAZAMIENTO
 * ---------------------------
 * Objetivo de negocio: si el cliente cancela cuando el equipo ya salio, la
 * empresa recupera al menos el combustible y el tiempo de traslado.
 *
 * Formula:
 *   millasFacturables = max(0, millas - radioLibre) * (ida y vuelta ? 2 : 1)
 *   deposito = limitar(base + millasFacturables * tarifaIRS, minimo, maximo)
 *
 * La tarifa por milla es la del IRS vigente en la fecha del presupuesto, lo
 * que da una justificacion objetiva y defendible ante el cliente.
 *
 * El deposito se RETIENE (autorizacion), no se cobra, y se acredita contra
 * el total al finalizar el trabajo.
 */
export function calculateDeposit(miles: number, config: PricingConfig, now: Date): QuoteDeposit {
  const rate = resolveMileageRate(now);
  const excessMiles = Math.max(0, miles - config.deposit.freeRadiusMiles);
  const billableMiles = config.deposit.roundTrip ? excessMiles * 2 : excessMiles;

  const rawCents = roundCents(config.deposit.baseCents + billableMiles * rate.centsPerMile);
  const amountCents = clamp(rawCents, config.deposit.minCents, config.deposit.maxCents);

  return {
    amountCents,
    baseCents: config.deposit.baseCents,
    freeRadiusMiles: config.deposit.freeRadiusMiles,
    billableMiles: Number(billableMiles.toFixed(2)),
    mileageRateCentsPerMile: rate.centsPerMile,
    capped: rawCents > config.deposit.maxCents,
    appliedToTotal: true,
  };
}
