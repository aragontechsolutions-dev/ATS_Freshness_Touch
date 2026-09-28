import { describe, expect, it } from 'vitest';
import {
  CompanyLocationSchema,
  DEFAULT_COMPANY_LOCATION,
  type CompanyLocationInput,
} from './company-location';
import { ServiceAreaSettingsSchema, DEFAULT_SERVICE_AREA } from './service-area';

/**
 * LA UBICACION DE LA EMPRESA
 * --------------------------
 * Es el origen desde el que se mide cada distancia, cada traslado y cada
 * zona. Un error aqui NO ROMPE NADA: recentra el area de servicio y
 * recalcula todos los precios en silencio. Por eso se prueba con los
 * dedazos reales —un signo cambiado, un digito de mas— y no con casos
 * inventados.
 */

const VALIDA: CompanyLocationInput = { ...DEFAULT_COMPANY_LOCATION };

describe('donde puede estar la base', () => {
  it('la de partida vale', () => {
    expect(CompanyLocationSchema.safeParse(VALIDA).success).toBe(true);
  });

  it('acepta cualquier punto dentro de Georgia', () => {
    // Savannah: la empresa puede mudarse dentro del estado sin tocar codigo.
    const savannah = { ...VALIDA, latitude: 32.0809, longitude: -81.0912, city: 'Savannah' };

    expect(CompanyLocationSchema.safeParse(savannah).success).toBe(true);
  });

  it('rechaza el signo cambiado en la longitud', () => {
    /*
     * EL DEDAZO CLASICO. Con +84 en vez de -84 la base acaba en el Tibet, y
     * cada cliente de Atlanta pasa a estar a miles de millas: todos los
     * presupuestos saldrian fuera de area sin que nada fallara.
     */
    const alOtroLado = { ...VALIDA, longitude: 84.388 };

    expect(CompanyLocationSchema.safeParse(alOtroLado).success).toBe(false);
  });

  it('rechaza latitud y longitud intercambiadas', () => {
    const cambiadas = { ...VALIDA, latitude: -84.388, longitude: 33.749 };

    expect(CompanyLocationSchema.safeParse(cambiadas).success).toBe(false);
  });

  it('rechaza un punto en otro estado', () => {
    // Chattanooga esta a 110 millas de Atlanta pero no es Georgia.
    const tennessee = { ...VALIDA, latitude: 35.0456, longitude: -85.3097 };

    expect(CompanyLocationSchema.safeParse(tennessee).success).toBe(false);
  });

  it('rechaza un estado que no sea Georgia', () => {
    /*
     * El motor compara el estado del cliente con este para decidir si queda
     * fuera de estado. Con 'FL' aqui, TODOS los clientes de Georgia
     * saldrian fuera y ninguno recibiria precio.
     */
    expect(CompanyLocationSchema.safeParse({ ...VALIDA, state: 'FL' }).success).toBe(false);
  });

  it('un campo de mas se rechaza, no se ignora', () => {
    const conSobra = { ...VALIDA, nombre: 'Oficina central' };

    expect(CompanyLocationSchema.safeParse(conSobra).success).toBe(false);
  });
});

describe('las zonas, sin la B', () => {
  it('el area de partida son dos: A y C', () => {
    expect(DEFAULT_SERVICE_AREA.zones.map((zona) => zona.code)).toEqual(['A', 'C']);
    expect(ServiceAreaSettingsSchema.safeParse(DEFAULT_SERVICE_AREA).success).toBe(true);
  });

  it('se permite saltarse un codigo: A y C es valido', () => {
    /*
     * Es lo que hace falta para retirar la B sin reutilizar su codigo. Hay
     * reservas guardadas con zona B que significan «hasta 60 millas con
     * precio automatico»; renombrar la C a B las volveria ambiguas.
     */
    const conSalto = {
      zones: [
        { code: 'A' as const, maxMiles: 35, instantQuote: true },
        { code: 'D' as const, maxMiles: 325, instantQuote: false },
      ],
    };

    expect(ServiceAreaSettingsSchema.safeParse(conSalto).success).toBe(true);
  });

  it('pero NO se permite ponerlos al reves', () => {
    const alReves = {
      zones: [
        { code: 'C' as const, maxMiles: 35, instantQuote: true },
        { code: 'A' as const, maxMiles: 325, instantQuote: false },
      ],
    };

    expect(ServiceAreaSettingsSchema.safeParse(alReves).success).toBe(false);
  });

  it('ni repetir el mismo codigo', () => {
    const repetido = {
      zones: [
        { code: 'A' as const, maxMiles: 35, instantQuote: true },
        { code: 'A' as const, maxMiles: 325, instantQuote: false },
      ],
    };

    expect(ServiceAreaSettingsSchema.safeParse(repetido).success).toBe(false);
  });
});
