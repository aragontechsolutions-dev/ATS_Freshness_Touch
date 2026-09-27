import { z } from 'zod';

/**
 * Catalogo de servicios ofrecidos por Freshness Touch.
 * COMMERCIAL no recibe precio instantaneo: la practica del sector es
 * hacer una visita/walkthrough previa y emitir una propuesta (RFP).
 */
export const ServiceTypeSchema = z.enum([
  'STANDARD',
  'DEEP',
  'MOVE_IN_OUT',
  'POST_CONSTRUCTION',
  'AIRBNB_TURNOVER',
  'COMMERCIAL',
]);
export type ServiceType = z.infer<typeof ServiceTypeSchema>;

/** Frecuencia del servicio. Los recurrentes reciben descuento. */
export const FrequencySchema = z.enum(['ONE_TIME', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']);
export type Frequency = z.infer<typeof FrequencySchema>;

/** Extras contratables sobre el servicio base. */
export const AddOnCodeSchema = z.enum([
  'INSIDE_FRIDGE',
  'INSIDE_OVEN',
  'INSIDE_CABINETS',
  'INTERIOR_WINDOWS',
  'LAUNDRY',
  'BASEMENT',
  'GARAGE',
  'PET_HAIR',
  'PATIO',
  'BED_LINENS',
]);
export type AddOnCode = z.infer<typeof AddOnCodeSchema>;

/** Un extra se cobra plano o por unidad (ventanas, cargas de ropa, camas...). */
export const AddOnUnitSchema = z.enum(['FLAT', 'PER_UNIT']);
export type AddOnUnit = z.infer<typeof AddOnUnitSchema>;

/**
 * Zonas de servicio por distancia desde la base de operaciones.
 * OUT_OF_RANGE = fuera del radio maximo: no se cotiza automaticamente.
 */
/**
 * Las zonas de servicio, de la mas cercana a la mas lejana.
 *
 * `E` cubre el resto de Georgia y se atiende SIN PRECIO AUTOMATICO: a esa
 * distancia el traslado pesa mas que el propio trabajo, asi que el precio se
 * da en persona. Ver `service-area.ts`.
 *
 * El conjunto es FIJO aunque los limites y los recargos se editen desde el
 * panel. El motivo es que este codigo se guarda en cada reserva: si alguien
 * pudiera inventarse zonas, el historico acabaria lleno de codigos que ya no
 * significan nada. Se editan los numeros, no el catalogo.
 */
export const ServiceZoneSchema = z.enum(['A', 'B', 'C', 'D', 'E', 'OUT_OF_RANGE']);
export type ServiceZone = z.infer<typeof ServiceZoneSchema>;

/** Naturaleza de cada linea del presupuesto. DISCOUNT lleva importe negativo. */
export const QuoteLineKindSchema = z.enum([
  'SERVICE_BASE',
  'ADD_ON',
  'SURCHARGE',
  'DISCOUNT',
  'TAX',
]);
export type QuoteLineKind = z.infer<typeof QuoteLineKindSchema>;

/** Proveedor que resolvio la distancia. "mock" = calculo simulado local. */
export const DistanceProviderNameSchema = z.enum(['mock', 'google']);
export type DistanceProviderName = z.infer<typeof DistanceProviderNameSchema>;

/** Idiomas soportados por la plataforma. */
export const LocaleSchema = z.enum(['en', 'es']);
export type Locale = z.infer<typeof LocaleSchema>;
