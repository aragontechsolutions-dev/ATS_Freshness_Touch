import { describe, expect, it } from 'vitest';
import { calculateTravel } from './travel';
import { defaultPricingConfig } from './config';
import { resolveMileageRate } from './mileage';

const HOY = new Date('2026-09-27T12:00:00Z');
const TARIFA = resolveMileageRate(HOY).centsPerMile;

/**
 * EL TRASLADO
 * -----------
 * Lo que antes eran escalones —25, 50 y 75 dolares por franja— ahora son
 * millas contadas. La prueba que mas importa es la que demuestra que EL
 * ESCALON YA NO EXISTE: era el motivo del cambio.
 */
describe('calculateTravel', () => {
  it('dentro del radio no cobra nada', () => {
    for (const millas of [0, 10, 35]) {
      expect(calculateTravel(millas, defaultPricingConfig, HOY).amountCents).toBe(0);
    }
  });

  it('cobra ida y vuelta de las millas que sobran', () => {
    const traslado = calculateTravel(45, defaultPricingConfig, HOY);

    // 10 millas de exceso, ida y vuelta.
    expect(traslado.billableMiles).toBe(20);
    expect(traslado.amountCents).toBe(Math.round(20 * TARIFA));
  });

  it('NO HAY ESCALON: una milla mas cuesta una milla mas', () => {
    /*
     * ES EL MOTIVO DEL CAMBIO. Con franjas, dos casas separadas por una
     * milla podian pagar veinticinco dolares de diferencia por caer a un
     * lado u otro de una raya que el cliente no ve.
     */
    const antes = calculateTravel(50, defaultPricingConfig, HOY).amountCents;
    const despues = calculateTravel(51, defaultPricingConfig, HOY).amountCents;

    expect(despues - antes).toBe(Math.round(2 * TARIFA));
  });

  it('usa la tarifa del IRS vigente cuando no hay una propia', () => {
    const vieja = calculateTravel(45, defaultPricingConfig, new Date('2025-06-01T00:00:00Z'));

    expect(vieja.centsPerMile).toBe(70);
    expect(defaultPricingConfig.travel.centsPerMile).toBeNull();
  });

  it('respeta una tarifa propia si se configura', () => {
    const config = {
      ...defaultPricingConfig,
      travel: { ...defaultPricingConfig.travel, centsPerMile: 100 },
    };
    const traslado = calculateTravel(45, config, HOY);

    expect(traslado.centsPerMile).toBe(100);
    expect(traslado.amountCents).toBe(2000);
  });

  it('el importe siempre es un entero de centavos', () => {
    for (const millas of [36, 37.5, 99.9, 324]) {
      const { amountCents } = calculateTravel(millas, defaultPricingConfig, HOY);
      expect(Number.isInteger(amountCents)).toBe(true);
    }
  });
});
