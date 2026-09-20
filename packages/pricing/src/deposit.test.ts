import { describe, expect, it } from 'vitest';
import { calculateDeposit } from './deposit';
import { defaultPricingConfig } from './config';
import { resolveMileageRate, IRS_MILEAGE_RATES } from './mileage';

const config = defaultPricingConfig;

describe('calculateDeposit', () => {
  it('dentro del radio libre cobra solo la base', () => {
    const deposit = calculateDeposit(15, config, new Date('2026-09-20T00:00:00Z'));
    expect(deposit.amountCents).toBe(3000);
    expect(deposit.billableMiles).toBe(0);
    expect(deposit.capped).toBe(false);
  });

  it('cobra ida y vuelta de las millas que exceden el radio libre', () => {
    const deposit = calculateDeposit(30, config, new Date('2026-09-20T00:00:00Z'));
    // exceso 10 -> 20 millas facturables -> 3000 + 20*76 = 4520
    expect(deposit.billableMiles).toBe(20);
    expect(deposit.amountCents).toBe(4520);
  });

  it('respeta el tope maximo y lo senala', () => {
    const deposit = calculateDeposit(90, config, new Date('2026-09-20T00:00:00Z'));
    expect(deposit.amountCents).toBe(config.deposit.maxCents);
    expect(deposit.capped).toBe(true);
  });

  it('usa la tarifa IRS vigente en la fecha del presupuesto', () => {
    const before = calculateDeposit(40, config, new Date('2026-03-15T00:00:00Z'));
    const after = calculateDeposit(40, config, new Date('2026-08-15T00:00:00Z'));

    expect(before.mileageRateCentsPerMile).toBe(72.5);
    expect(after.mileageRateCentsPerMile).toBe(76);
    expect(after.amountCents).toBeGreaterThan(before.amountCents);
  });

  it('el importe siempre es un entero de centavos', () => {
    for (const miles of [0, 7.3, 21.4, 33.7, 49.9]) {
      const deposit = calculateDeposit(miles, config, new Date('2026-02-01T00:00:00Z'));
      expect(Number.isInteger(deposit.amountCents)).toBe(true);
    }
  });
});

describe('resolveMileageRate', () => {
  it('elige la ultima tarifa con vigencia anterior o igual a la fecha', () => {
    expect(resolveMileageRate(new Date('2025-06-01T00:00:00Z')).centsPerMile).toBe(70);
    expect(resolveMileageRate(new Date('2026-01-01T00:00:00Z')).centsPerMile).toBe(72.5);
    expect(resolveMileageRate(new Date('2026-06-30T00:00:00Z')).centsPerMile).toBe(72.5);
    expect(resolveMileageRate(new Date('2026-07-01T00:00:00Z')).centsPerMile).toBe(76);
  });

  it('las tarifas estan ordenadas cronologicamente', () => {
    const dates = IRS_MILEAGE_RATES.map((rate) => rate.effectiveFrom);
    expect([...dates].sort()).toEqual(dates);
  });
});
