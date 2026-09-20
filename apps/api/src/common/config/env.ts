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

    /**
     * Base de datos (Supabase). AMBAS SON OPCIONALES a proposito: sin ellas la
     * API arranca igual y el cotizador sigue funcionando; solo quedan
     * deshabilitadas las funciones que necesitan guardar datos. Asi un
     * despliegue no se cae por una variable que todavia no se ha configurado.
     *
     * DATABASE_URL: conexion agrupada (puerto 6543), la que usa la aplicacion.
     * DIRECT_URL:   conexion directa (puerto 5432), solo para migraciones.
     */
    DATABASE_URL: z.string().url().optional(),
    DIRECT_URL: z.string().url().optional(),

    /**
     * Pagos. "mock" simula el proveedor sin mover dinero y es el valor por
     * defecto: asi el sistema arranca y se puede probar de punta a punta sin
     * una cuenta de Stripe. En produccion hay que poner "stripe".
     */
    PAYMENT_PROVIDER: z.enum(['mock', 'stripe']).default('mock'),
    STRIPE_SECRET_KEY: z.string().min(1).optional(),
    /** Secreto del endpoint de webhook (whsec_...), distinto de la clave secreta. */
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
    STRIPE_TIMEOUT_MS: z.coerce.number().int().min(1000).default(10000),
    /** Clave con la que se firman los webhooks simulados en desarrollo y pruebas. */
    PAYMENT_MOCK_WEBHOOK_SECRET: z.string().min(1).default('mock-webhook-secret'),
    /**
     * Dias que dura la retencion antes de caducar. Las redes de tarjetas dan
     * 7 dias; poner mas haria creer que un deposito antiguo todavia se puede
     * capturar cuando en realidad ya no.
     */
    PAYMENT_AUTHORIZATION_DAYS: z.coerce.number().int().min(1).max(7).default(7),
    /**
     * Texto que acompana al nombre de la empresa en el extracto del cliente.
     * Stripe solo admite letras, numeros y espacios, y como maximo 10.
     */
    PAYMENT_STATEMENT_DESCRIPTOR: z
      .string()
      .trim()
      .min(5)
      .max(10)
      .regex(/^[A-Za-z0-9 ]+$/, 'Solo se admiten letras, numeros y espacios')
      .default('FRESHNESS'),

    /** Base de operaciones: origen del calculo de distancia. */
    COMPANY_BASE_CITY: z.string().default('Atlanta'),
    COMPANY_BASE_STATE: z.string().length(2).default('GA'),
    COMPANY_BASE_POSTAL_CODE: z
      .string()
      .regex(/^\d{5}$/)
      .default('30303'),
  })
  .refine((env) => env.DISTANCE_PROVIDER !== 'google' || Boolean(env.GOOGLE_MAPS_API_KEY), {
    message: 'GOOGLE_MAPS_API_KEY es obligatoria cuando DISTANCE_PROVIDER=google',
    path: ['GOOGLE_MAPS_API_KEY'],
  })
  .refine((env) => env.PAYMENT_PROVIDER !== 'stripe' || Boolean(env.STRIPE_SECRET_KEY), {
    message: 'STRIPE_SECRET_KEY es obligatoria cuando PAYMENT_PROVIDER=stripe',
    path: ['STRIPE_SECRET_KEY'],
  })
  /*
   * Sin el secreto del webhook, Stripe podria avisar de que un deposito quedo
   * autorizado y no habria forma de comprobar que el aviso viene de Stripe:
   * cualquiera podria confirmar reservas que nadie ha pagado. Por eso es
   * obligatorio, no opcional.
   */
  .refine((env) => env.PAYMENT_PROVIDER !== 'stripe' || Boolean(env.STRIPE_WEBHOOK_SECRET), {
    message: 'STRIPE_WEBHOOK_SECRET es obligatoria cuando PAYMENT_PROVIDER=stripe',
    path: ['STRIPE_WEBHOOK_SECRET'],
  });

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
