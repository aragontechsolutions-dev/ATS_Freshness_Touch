import { z } from 'zod';

/**
 * VALIDACION DE ENTORNO
 * ---------------------
 * La aplicacion NO arranca si falta una variable o tiene un valor invalido.
 * Es preferible fallar al desplegar que servir precios incorrectos o quedarse
 * sin proveedor de distancia en produccion.
 */

const csvToArray = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    API_PREFIX: z.string().default('api/v1'),

    /** Origenes permitidos por CORS, separados por coma. Sin comodines en produccion. */
    CORS_ORIGINS: z.string().default('http://localhost:5173').transform(csvToArray),

    /** Proveedor de distancia: "mock" (simulado, sin coste) o "google". */
    DISTANCE_PROVIDER: z.enum(['mock', 'google']).default('mock'),
    GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
    DISTANCE_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(86400),
    DISTANCE_CACHE_MAX_ENTRIES: z.coerce.number().int().min(1).default(5000),
    DISTANCE_TIMEOUT_MS: z.coerce.number().int().min(500).default(5000),

    /** Limite general de peticiones por IP. */
    RATE_LIMIT_TTL_SECONDS: z.coerce.number().int().min(1).default(60),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(60),
    /** Limite especifico del cotizador (mas estricto: cada cotizacion cuesta dinero). */
    QUOTE_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),

    /** Base de operaciones: origen del calculo de distancia. */
    COMPANY_BASE_CITY: z.string().default('Atlanta'),
    COMPANY_BASE_STATE: z.string().length(2).default('GA'),
    COMPANY_BASE_POSTAL_CODE: z.string().regex(/^\d{5}$/).default('30303'),
  })
  .refine(
    (env) => env.DISTANCE_PROVIDER !== 'google' || Boolean(env.GOOGLE_MAPS_API_KEY),
    {
      message: 'GOOGLE_MAPS_API_KEY es obligatoria cuando DISTANCE_PROVIDER=google',
      path: ['GOOGLE_MAPS_API_KEY'],
    },
  );

export type Env = z.infer<typeof EnvSchema>;

/** Valida process.env al arrancar. Lanza un error legible si algo falta. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(raw);

  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuracion de entorno invalida:\n${detail}`);
  }

  return result.data;
}
