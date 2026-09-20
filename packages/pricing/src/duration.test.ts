import { describe, expect, it } from 'vitest';
import { estimateDurationMinutes } from './duration';
import { defaultPricingConfig } from './config';

describe('estimacion de duracion', () => {
  it('una limpieza estandar de 3 habitaciones y 2 banos ocupa media jornada', () => {
    // 45 + 3*15 + 2*20 + 0.02*1800 = 166 -> se redondea a 180
    const minutes = estimateDurationMinutes({
      service: 'STANDARD',
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1800,
      addOns: [],
    });

    expect(minutes).toBe(180);
  });

  it('la limpieza profunda de la misma casa lleva bastante mas', () => {
    const estandar = estimateDurationMinutes({
      service: 'STANDARD',
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1800,
      addOns: [],
    });
    const profunda = estimateDurationMinutes({
      service: 'DEEP',
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1800,
      addOns: [],
    });

    expect(profunda).toBeGreaterThan(estandar);
  });

  it('los extras suman tiempo', () => {
    const sinExtras = estimateDurationMinutes({
      service: 'STANDARD',
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 1000,
      addOns: [],
    });
    const conExtras = estimateDurationMinutes({
      service: 'STANDARD',
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 1000,
      addOns: [
        { code: 'INSIDE_OVEN', quantity: 1 },
        { code: 'INTERIOR_WINDOWS', quantity: 10 },
      ],
    });

    expect(conExtras).toBeGreaterThan(sinExtras);
  });

  it('un extra plano no suma mas tiempo aunque se pida varias veces', () => {
    const una = estimateDurationMinutes({
      service: 'STANDARD',
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 1000,
      addOns: [{ code: 'INSIDE_FRIDGE', quantity: 1 }],
    });
    const cinco = estimateDurationMinutes({
      service: 'STANDARD',
      bedrooms: 2,
      bathrooms: 1,
      squareFeet: 1000,
      addOns: [{ code: 'INSIDE_FRIDGE', quantity: 5 }],
    });

    expect(cinco).toBe(una);
  });

  it('siempre redondea hacia arriba a bloques de 30 minutos', () => {
    const casos: { bedrooms: number; bathrooms: number; squareFeet: number }[] = [
      { bedrooms: 1, bathrooms: 1, squareFeet: 600 },
      { bedrooms: 2, bathrooms: 2, squareFeet: 1450 },
      { bedrooms: 4, bathrooms: 3, squareFeet: 2675 },
      { bedrooms: 5, bathrooms: 4, squareFeet: 3900 },
    ];

    for (const caso of casos) {
      const minutes = estimateDurationMinutes({ service: 'DEEP', addOns: [], ...caso });
      // Reservar de mas y terminar antes es preferible a encadenar retrasos.
      expect(minutes % 30).toBe(0);
    }
  });

  it('nunca baja del minimo ni supera el maximo', () => {
    const minimo = estimateDurationMinutes({
      service: 'AIRBNB_TURNOVER',
      bedrooms: 0,
      bathrooms: 0,
      squareFeet: 200,
      addOns: [],
    });
    expect(minimo).toBe(defaultPricingConfig.durationMinMinutes);

    const maximo = estimateDurationMinutes({
      service: 'POST_CONSTRUCTION',
      bedrooms: 12,
      bathrooms: 12,
      squareFeet: 20000,
      addOns: [],
    });
    expect(maximo).toBe(defaultPricingConfig.durationMaxMinutes);
  });

  it('el servicio comercial no tiene duracion estimable: se agenda a mano', () => {
    const minutes = estimateDurationMinutes({
      service: 'COMMERCIAL',
      bedrooms: 0,
      bathrooms: 2,
      squareFeet: 5000,
      addOns: [],
    });
    expect(minutes).toBe(0);
  });

  it('es determinista', () => {
    const input = {
      service: 'MOVE_IN_OUT' as const,
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1600,
      addOns: [{ code: 'GARAGE' as const, quantity: 1 }],
    };
    expect(estimateDurationMinutes(input)).toBe(estimateDurationMinutes(input));
  });
});
