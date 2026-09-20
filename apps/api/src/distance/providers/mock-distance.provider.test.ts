import { describe, expect, it } from 'vitest';
import { MockDistanceProvider } from './mock-distance.provider';

const provider = new MockDistanceProvider();

function resolve(postalCode: string, state = 'GA') {
  return provider.resolve({ originPostalCode: '30303', destinationPostalCode: postalCode, state });
}

describe('MockDistanceProvider', () => {
  it('es determinista: el mismo ZIP devuelve siempre lo mismo', async () => {
    const first = await resolve('30022');
    const second = await resolve('30022');
    expect(first).toEqual(second);
  });

  it('se marca siempre como estimacion', async () => {
    const result = await resolve('30303');
    expect(result.estimated).toBe(true);
    expect(result.provider).toBe('mock');
  });

  it('coloca el area metropolitana de Atlanta en la zona cercana', async () => {
    const result = await resolve('30303');
    expect(result.miles).toBeLessThan(20);
  });

  it('coloca ciudades lejanas fuera del area de servicio', async () => {
    const savannah = await resolve('31401');
    expect(savannah.miles).toBeGreaterThan(60);
  });

  it('diferencia codigos postales del mismo prefijo', async () => {
    const a = await resolve('30301');
    const b = await resolve('30349');
    expect(a.miles).not.toBe(b.miles);
  });

  it('nunca devuelve distancias negativas ni duraciones nulas', async () => {
    for (const zip of ['30303', '39901', '00000', '31234', '30022']) {
      const result = await resolve(zip);
      expect(result.miles).toBeGreaterThan(0);
      expect(result.durationMinutes).toBeGreaterThan(0);
    }
  });
});
