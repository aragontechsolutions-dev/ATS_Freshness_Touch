import { describe, expect, it } from 'vitest';
import { clamp, dollarsToCents, percentOfCents, roundCents } from './money';

describe('utilidades de dinero', () => {
  it('convierte dolares a centavos sin error de punto flotante', () => {
    expect(dollarsToCents(185.55)).toBe(18555);
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
  });

  it('calcula porcentajes en centavos enteros', () => {
    expect(percentOfCents(18500, 15)).toBe(2775);
    expect(percentOfCents(9999, 10)).toBe(1000);
    expect(Number.isInteger(percentOfCents(12345, 7))).toBe(true);
  });

  it('redondea y acota', () => {
    expect(roundCents(10.5)).toBe(11);
    expect(clamp(5, 10, 20)).toBe(10);
    expect(clamp(50, 10, 20)).toBe(20);
    expect(clamp(15, 10, 20)).toBe(15);
  });
});
