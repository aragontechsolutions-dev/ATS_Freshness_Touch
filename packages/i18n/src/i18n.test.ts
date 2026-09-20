import { describe, expect, it } from 'vitest';
import {
  AddOnCodeSchema,
  FrequencySchema,
  ServiceTypeSchema,
} from '@freshness/types';
import { en } from './en';
import { es } from './es';

/** Devuelve todas las rutas de claves hoja de un objeto de traduccion. */
function leafKeys(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      leafKeys(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [];
}

describe('recursos de traduccion', () => {
  it('ingles y espanol tienen exactamente las mismas claves', () => {
    const enKeys = leafKeys(en).sort();
    const esKeys = leafKeys(es).sort();

    expect(esKeys).toEqual(enKeys);
  });

  it('no hay textos vacios', () => {
    for (const [locale, resource] of Object.entries({ en, es })) {
      const empty = leafKeys(resource).filter((path) => {
        const value = path
          .split('.')
          .reduce<unknown>((acc, key) => (acc as Record<string, unknown>)[key], resource);
        return typeof value === 'string' && value.trim().length === 0;
      });
      expect(empty, `textos vacios en "${locale}"`).toEqual([]);
    }
  });

  it('cada servicio del catalogo tiene nombre, descripcion y etiqueta de linea', () => {
    for (const code of ServiceTypeSchema.options) {
      expect(en.services[code]?.name, code).toBeTruthy();
      expect(en.services[code]?.description, code).toBeTruthy();
      expect(en.quote.line.service[code], code).toBeTruthy();
    }
  });

  it('cada extra del catalogo tiene etiqueta en el formulario y en el desglose', () => {
    for (const code of AddOnCodeSchema.options) {
      expect(en.addOns[code], code).toBeTruthy();
      expect(en.quote.line.addOn[code], code).toBeTruthy();
    }
  });

  it('cada frecuencia tiene etiqueta y texto de descuento', () => {
    for (const code of FrequencySchema.options) {
      expect(en.frequency[code], code).toBeTruthy();
      expect(en.quote.line.discount[code], code).toBeTruthy();
    }
  });
});
