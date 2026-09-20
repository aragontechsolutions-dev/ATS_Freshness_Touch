import { Injectable } from '@nestjs/common';
import type { DistanceProvider, DistanceQuery, DistanceResult } from '../distance.types';

/**
 * PROVEEDOR SIMULADO DE DISTANCIA
 * -------------------------------
 * Permite desarrollar, demostrar y testear el cotizador sin contratar la API
 * de Google y sin gastar cuota. NO usar en produccion: los valores son
 * aproximaciones por prefijo de codigo postal, no rutas reales.
 *
 * Propiedades que si garantiza:
 *  - Determinismo: el mismo codigo postal devuelve siempre la misma distancia
 *    (imprescindible para que un cliente no vea precios distintos al recargar).
 *  - Realismo suficiente: los prefijos de Georgia caen en rangos verosimiles,
 *    de modo que se pueden probar todas las zonas (A, B, C, D y fuera de area).
 */
@Injectable()
export class MockDistanceProvider implements DistanceProvider {
  readonly name = 'mock' as const;

  /** Millas aproximadas desde el centro de Atlanta por prefijo de ZIP. */
  private static readonly PREFIX_MILES: Record<string, number> = {
    '303': 8, // Atlanta ciudad
    '302': 14, // Decatur, Stone Mountain
    '300': 26, // Alpharetta, Roswell, norte del area metropolitana
    '301': 22, // Marietta, Kennesaw
    '304': 45, // Noroeste de Georgia
    '305': 52, // Gainesville
    '306': 66, // Athens
    '307': 78, // Noroeste lejano
    '308': 92, // Augusta
    '309': 88, // Este de Georgia
    '310': 85, // Macon
    '312': 96, // Milledgeville
    '313': 165, // Sur de Georgia
    '314': 250, // Savannah
    '315': 210, // Waycross
    '316': 175, // Albany
    '317': 120, // Columbus area
    '318': 105, // Columbus
    '319': 145, // Valdosta area
    '398': 190,
    '399': 230,
  };

  async resolve(query: DistanceQuery): Promise<DistanceResult> {
    const miles = MockDistanceProvider.estimateMiles(query.destinationPostalCode, query.state);

    return {
      miles,
      // Modelo simple de trafico urbano: ~1.7 minutos por milla mas arranque.
      durationMinutes: Math.round(miles * 1.7 + 8),
      provider: this.name,
      estimated: true,
    };
  }

  /** Expuesto como estatico para poder testear la heuristica sin instanciar Nest. */
  static estimateMiles(postalCode: string, state: string): number {
    const prefix = postalCode.slice(0, 3);
    const base = MockDistanceProvider.PREFIX_MILES[prefix];

    if (base === undefined) {
      // Fuera de los prefijos conocidos: valor determinista y claramente lejano.
      const hashed = MockDistanceProvider.hash(`${state}:${postalCode}`) % 120;
      return Number((60 + hashed).toFixed(1));
    }

    // Variacion estable dentro del prefijo para que dos ZIP vecinos no sean identicos.
    const spread = (MockDistanceProvider.hash(postalCode) % 700) / 100 - 3.5; // [-3.5, +3.5)
    return Number(Math.max(1, base + spread).toFixed(1));
  }

  /** Hash entero simple y estable (FNV-1a de 32 bits). */
  private static hash(value: string): number {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash;
  }
}
