/**
 * LIMITADORES DE PETICIONES
 * -------------------------
 * Los nombres viven aqui, en un solo sitio, y de ellos se deriva la exencion.
 *
 * Motivo: `@SkipThrottle()` sin argumentos NO exime de nada cuando los
 * limitadores tienen nombre propio; solo omite uno llamado "default". Con la
 * sonda de salud eso provocaba que Render, que la consulta cada 5 segundos,
 * recibiera un 429 a partir de la peticion numero 11 y diera el servicio por
 * caido.
 *
 * Derivando la exencion de esta misma lista, anadir un limitador nuevo lo
 * incluye automaticamente y el error no puede repetirse.
 */
export const THROTTLER_NAMES = ['global', 'quotes'] as const;

export type ThrottlerName = (typeof THROTTLER_NAMES)[number];

/** Exime de TODOS los limitadores. Para sondas de salud y poco mas. */
export const SKIP_ALL_THROTTLERS: Record<ThrottlerName, boolean> = Object.fromEntries(
  THROTTLER_NAMES.map((name) => [name, true]),
) as Record<ThrottlerName, boolean>;
