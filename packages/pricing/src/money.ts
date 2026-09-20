/**
 * Utilidades de dinero.
 *
 * REGLA DEL PROYECTO: todo importe monetario se representa como un ENTERO de
 * centavos. Nunca se usan numeros decimales para dinero, porque la aritmetica
 * de punto flotante produce errores de redondeo acumulativos
 * (0.1 + 0.2 !== 0.3) que en facturacion se traducen en descuadres reales.
 */

/** Redondea al centavo mas cercano (mitad hacia arriba). */
export function roundCents(value: number): number {
  return Math.round(value);
}

/** Convierte dolares a centavos enteros. Solo para configuracion legible. */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/** Aplica un porcentaje sobre un importe en centavos y devuelve centavos enteros. */
export function percentOfCents(amountCents: number, percent: number): number {
  return Math.round((amountCents * percent) / 100);
}

/** Restringe un valor a un rango cerrado. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
