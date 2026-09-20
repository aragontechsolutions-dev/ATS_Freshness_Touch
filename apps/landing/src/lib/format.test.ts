import { describe, expect, it } from 'vitest';
import { formatCents, formatCentsCompact, formatMiles } from './format';

describe('formato de moneda', () => {
  it('convierte centavos a dolares en ingles', () => {
    expect(formatCents(18500, 'en')).toBe('$185.00');
    expect(formatCents(0, 'en')).toBe('$0.00');
  });

  it('muestra los descuentos como importe negativo', () => {
    expect(formatCents(-2775, 'en')).toBe('-$27.75');
  });

  it('no pierde centavos al formatear', () => {
    expect(formatCents(3578, 'en')).toBe('$35.78');
  });

  it('la version compacta omite los decimales', () => {
    expect(formatCentsCompact(12000, 'en')).toBe('$120');
  });

  it('formatea millas sin decimales', () => {
    expect(formatMiles(23.8, 'en')).toBe('24');
  });
});
