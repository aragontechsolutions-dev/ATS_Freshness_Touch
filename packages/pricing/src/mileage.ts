/**
 * Tarifa de millaje del IRS (standard mileage rate), usada como ancla objetiva
 * para calcular el componente variable del deposito por desplazamiento.
 *
 * Fuente: tabla oficial del IRS. Se guarda con fechas de vigencia para que el
 * calculo sea historicamente correcto y auditable: un presupuesto emitido en
 * marzo de 2026 debe poder reproducirse con la tarifa vigente ese dia.
 *
 * IMPORTANTE: verificar esta tabla cada vez que el IRS publique una nueva
 * tarifa y anadir una entrada nueva (nunca editar las pasadas).
 */
export interface MileageRateEntry {
  /** Fecha de entrada en vigor, formato ISO YYYY-MM-DD. */
  effectiveFrom: string;
  /** Centavos por milla. */
  centsPerMile: number;
  /** Referencia de la fuente para auditoria. */
  source: string;
}

export const IRS_MILEAGE_RATES: readonly MileageRateEntry[] = [
  { effectiveFrom: '2025-01-01', centsPerMile: 70, source: 'IRS standard mileage rate 2025' },
  { effectiveFrom: '2026-01-01', centsPerMile: 72.5, source: 'IRS Notice 2026-10' },
  { effectiveFrom: '2026-07-01', centsPerMile: 76, source: 'IRS Notice 2026-10 (vigencia 1 jul 2026)' },
] as const;

/**
 * Devuelve la tarifa vigente en la fecha indicada.
 * Si la fecha es anterior a la primera entrada, usa la primera (fallback seguro).
 */
export function resolveMileageRate(date: Date): MileageRateEntry {
  const iso = date.toISOString().slice(0, 10);
  let current: MileageRateEntry = IRS_MILEAGE_RATES[0] as MileageRateEntry;
  for (const entry of IRS_MILEAGE_RATES) {
    if (entry.effectiveFrom <= iso) {
      current = entry;
    }
  }
  return current;
}
