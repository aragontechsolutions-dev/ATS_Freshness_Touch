import type { AddOnCode, AddOnUnit, Frequency, ServiceType, ServiceZone } from '@freshness/types';

/**
 * CONFIGURACION COMERCIAL DE FRESHNESS TOUCH
 * ------------------------------------------
 * Este archivo es el unico lugar donde viven los precios. Cambiar una tarifa
 * aqui la cambia en la API, en el sitio web y en los tests.
 *
 * Las cifras iniciales se derivan de los rangos de mercado de Georgia
 * (limpieza estandar 120-250 USD, profunda 180-700, mudanza 160-750,
 * post-obra 280-900, Airbnb 90-320) y deben ser revisadas y firmadas por
 * la direccion de la empresa antes de salir a produccion.
 *
 * Todos los importes en CENTAVOS enteros.
 */

export interface ServiceRate {
  /** Cargo fijo de apertura del servicio. */
  baseCents: number;
  perBedroomCents: number;
  perBathroomCents: number;
  /** Centavos por pie cuadrado (admite decimales; el total se redondea). */
  centsPerSquareFoot: number;
  /** Importe minimo facturable del servicio. */
  minimumCents: number;
  /** false = requiere visita previa y propuesta manual (comercial). */
  instantQuote: boolean;
}

export interface AddOnRate {
  unit: AddOnUnit;
  unitAmountCents: number;
  maxQuantity: number;
}

export interface ZoneRule {
  code: ServiceZone;
  /** Limite superior en millas (inclusive). null = sin limite. */
  maxMiles: number | null;
  surchargeCents: number;
  serviceable: boolean;
}

export interface DepositRule {
  /** Componente fijo del deposito. */
  baseCents: number;
  /** Millas sin recargo alrededor de la base de operaciones. */
  freeRadiusMiles: number;
  /** Se cobra ida y vuelta de las millas que exceden el radio libre. */
  roundTrip: boolean;
  minCents: number;
  maxCents: number;
}

export interface PricingConfig {
  currency: 'USD';
  baseOfOperations: { city: string; state: string; postalCode: string };
  services: Record<ServiceType, ServiceRate>;
  addOns: Record<AddOnCode, AddOnRate>;
  /** Descuento por recurrencia, en porcentaje sobre servicio + extras. */
  frequencyDiscountPercent: Record<Frequency, number>;
  zones: readonly ZoneRule[];
  deposit: DepositRule;
  /** Impuesto sobre ventas. En Georgia la limpieza esta exenta: 0. */
  taxRatePercent: number;
  taxExempt: boolean;
  taxReasonKey: string;
  /** Dias de validez del presupuesto. */
  validityDays: number;
  /** Por encima de estos pies cuadrados se exige revision humana. */
  manualReviewSquareFeetThreshold: number;
  limits: {
    bedrooms: { min: number; max: number };
    bathrooms: { min: number; max: number };
    squareFeet: { min: number; max: number };
    addOnsMax: number;
  };
}

export const defaultPricingConfig: PricingConfig = {
  currency: 'USD',
  baseOfOperations: { city: 'Atlanta', state: 'GA', postalCode: '30303' },

  services: {
    STANDARD: {
      baseCents: 6500,
      perBedroomCents: 1200,
      perBathroomCents: 1500,
      centsPerSquareFoot: 3.0,
      minimumCents: 12000,
      instantQuote: true,
    },
    DEEP: {
      baseCents: 9500,
      perBedroomCents: 2000,
      perBathroomCents: 2500,
      centsPerSquareFoot: 5.5,
      minimumCents: 18000,
      instantQuote: true,
    },
    MOVE_IN_OUT: {
      baseCents: 11000,
      perBedroomCents: 2200,
      perBathroomCents: 2800,
      centsPerSquareFoot: 6.5,
      minimumCents: 19000,
      instantQuote: true,
    },
    POST_CONSTRUCTION: {
      baseCents: 16000,
      perBedroomCents: 2800,
      perBathroomCents: 3500,
      centsPerSquareFoot: 9.5,
      minimumCents: 28000,
      instantQuote: true,
    },
    AIRBNB_TURNOVER: {
      baseCents: 5500,
      perBedroomCents: 1200,
      perBathroomCents: 1500,
      centsPerSquareFoot: 2.2,
      minimumCents: 9000,
      instantQuote: true,
    },
    COMMERCIAL: {
      baseCents: 0,
      perBedroomCents: 0,
      perBathroomCents: 0,
      centsPerSquareFoot: 0,
      minimumCents: 0,
      instantQuote: false,
    },
  },

  addOns: {
    INSIDE_FRIDGE: { unit: 'FLAT', unitAmountCents: 3500, maxQuantity: 1 },
    INSIDE_OVEN: { unit: 'FLAT', unitAmountCents: 3500, maxQuantity: 1 },
    INSIDE_CABINETS: { unit: 'FLAT', unitAmountCents: 4500, maxQuantity: 1 },
    INTERIOR_WINDOWS: { unit: 'PER_UNIT', unitAmountCents: 600, maxQuantity: 40 },
    LAUNDRY: { unit: 'PER_UNIT', unitAmountCents: 2000, maxQuantity: 6 },
    BASEMENT: { unit: 'FLAT', unitAmountCents: 4000, maxQuantity: 1 },
    GARAGE: { unit: 'FLAT', unitAmountCents: 4500, maxQuantity: 1 },
    PET_HAIR: { unit: 'FLAT', unitAmountCents: 3000, maxQuantity: 1 },
    PATIO: { unit: 'FLAT', unitAmountCents: 2500, maxQuantity: 1 },
    BED_LINENS: { unit: 'PER_UNIT', unitAmountCents: 1000, maxQuantity: 10 },
  },

  frequencyDiscountPercent: {
    ONE_TIME: 0,
    WEEKLY: 15,
    BIWEEKLY: 10,
    MONTHLY: 5,
  },

  /**
   * Zonas por distancia. El recargo cubre el tiempo de traslado improductivo:
   * el objetivo operativo del sector es mantener el transporte por debajo del
   * 15% de las horas pagadas.
   */
  zones: [
    { code: 'A', maxMiles: 20, surchargeCents: 0, serviceable: true },
    { code: 'B', maxMiles: 35, surchargeCents: 2500, serviceable: true },
    { code: 'C', maxMiles: 50, surchargeCents: 5000, serviceable: true },
    { code: 'D', maxMiles: 60, surchargeCents: 7500, serviceable: true },
    { code: 'OUT_OF_RANGE', maxMiles: null, surchargeCents: 0, serviceable: false },
  ],

  deposit: {
    baseCents: 3000,
    freeRadiusMiles: 20,
    roundTrip: true,
    minCents: 3000,
    maxCents: 12000,
  },

  taxRatePercent: 0,
  taxExempt: true,
  taxReasonKey: 'quote.tax.gaExempt',

  validityDays: 7,
  manualReviewSquareFeetThreshold: 6000,

  limits: {
    bedrooms: { min: 0, max: 12 },
    bathrooms: { min: 0, max: 12 },
    squareFeet: { min: 200, max: 20000 },
    addOnsMax: 20,
  },
};
