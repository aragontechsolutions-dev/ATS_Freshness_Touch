import { describe, expect, it } from 'vitest';
import { TtlCache } from './ttl-cache';

describe('TtlCache', () => {
  it('devuelve el valor guardado antes de caducar', () => {
    const cache = new TtlCache<number>(1000, 10);
    cache.set('a', 42, 0);
    expect(cache.get('a', 500)).toBe(42);
  });

  it('descarta el valor una vez caducado', () => {
    const cache = new TtlCache<number>(1000, 10);
    cache.set('a', 42, 0);
    expect(cache.get('a', 1001)).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('nunca supera el numero maximo de entradas', () => {
    const cache = new TtlCache<number>(10_000, 3);
    for (let index = 0; index < 10; index += 1) {
      cache.set(`k${index}`, index, 0);
    }
    expect(cache.size).toBe(3);
  });

  it('evicta primero la entrada mas antigua', () => {
    const cache = new TtlCache<number>(10_000, 2);
    cache.set('viejo', 1, 0);
    cache.set('medio', 2, 0);
    cache.set('nuevo', 3, 0);

    expect(cache.get('viejo', 0)).toBeUndefined();
    expect(cache.get('nuevo', 0)).toBe(3);
  });

  it('con TTL 0 la cache queda desactivada', () => {
    const cache = new TtlCache<number>(0, 10);
    cache.set('a', 1, 0);
    expect(cache.get('a', 0)).toBeUndefined();
  });
});
