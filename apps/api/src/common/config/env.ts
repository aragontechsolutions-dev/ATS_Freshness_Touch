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

    /**
     * Identidad del personal que usa el panel.
     *
     * "local" emite y verifica sus propios tokens para poder desarrollar sin
     * un proyecto de Supabase. En produccion esta PROHIBIDO (ver mas abajo).
     */
    /**
     * AVISOS
     * ------
     * "log" no envia nada: escribe el correo en el registro del servidor. Es
     * el valor por defecto para que el sistema arranque y se pueda probar de
     * punta a punta sin cuenta de ningun proveedor. En produccion, "resend".
     */
    EMAIL_PROVIDER: z.enum(['log', 'resend']).default('log'),
    RESEND_API_KEY: z.string().min(1).optional(),
    /**
     * Remitente, con nombre: `Freshness Touch <hola@freshnesstouch.com>`.
     * El dominio debe estar verificado en el proveedor o los correos acaban
     * en la carpeta de no deseado, que es indistinguible de no enviarlos.
     */
    EMAIL_FROM: z.string().min(1).optional(),
    /** A donde responde el cliente si contesta. Si falta, se usa EMAIL_FROM. */
    EMAIL_REPLY_TO: z.string().email().optional(),
    EMAIL_TIMEOUT_MS: z.coerce.number().int().min(1000).default(10000),

    /**
     * Token del bot de Telegram, tal y como lo entrega BotFather.
     *
     * ES UNA CREDENCIAL y por eso vive aqui y no en el panel: quien la tiene
     * ES el bot. Lo que si se configura desde el panel es a que chat avisar,
     * que sin este token no sirve para enviar nada.
     *
     * Sin token no se avisa por Telegram y el sistema funciona igual: queda
     * anotado como omitido en el registro de avisos.
     */
    TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
    TELEGRAM_TIMEOUT_MS: z.coerce.number().int().min(1000).default(10000),
    /**
     * Direccion base de la API de Telegram. Solo se cambia para apuntar a un
     * servidor propio de su API, o a uno local en las pruebas de punta a punta.
     */
    TELEGRAM_API_BASE: z.url().default('https://api.telegram.org'),

    /**
     * Cada cuantos minutos se buscan reservas a las que mandar el recordatorio
     * de la vispera. Cero lo apaga.
     *
     * Quince minutos es de sobra: la precision del recordatorio la marca la
     * ventana de horas, no el intervalo. Barrer cada minuto solo anadiria
     * consultas sin que nadie notara la diferencia.
     */
    REMINDER_SWEEP_MINUTES: z.coerce.number().int().min(0).max(1440).default(15),

    AUTH_PROVIDER: z.enum(['local', 'supabase']).default('local'),
    /** Direccion del proyecto de Supabase: https://<ref>.supabase.co */
    SUPABASE_URL: z.string().url().optional(),
    /**
     * Secreto compartido de los proyectos ANTIGUOS de Supabase. Solo hace
     * falta si el proyecto todavia firma con HS256; los nuevos usan claves
     * asimetricas y no lo necesitan.
     */
    SUPABASE_JWT_SECRET: z.string().min(1).optional(),
    /**
     * Clave de servicio del proyecto. Solo se usa para INVITAR personal.
     *
     * ES LA CREDENCIAL MAS PODEROSA DEL SISTEMA: salta todas las reglas de
     * seguridad de la base de datos. Si se filtra, se filtra todo.
     *
     * Por eso es OPCIONAL: sin ella la aplicacion arranca igual y lo unico
     * que no se puede hacer es invitar. Un despliegue que no vaya a dar de
     * alta personal no tiene por que cargar con esta clave, y la regla
     * general es que una credencial que no hace falta no se guarda.
     *
     * Nunca sale al navegador —el panel llama a esta API y esta API llama a
     * Supabase— y nunca se escribe en un registro.
     */
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    /**
     * A donde lleva el enlace de la invitacion: la direccion del panel.
     *
     * Supabase exige que este en su lista de direcciones permitidas. Si se
     * deja vacia usa la del proyecto.
     */
    SUPABASE_INVITE_REDIRECT_URL: z.string().url().optional(),
    AUTH_TIMEOUT_MS: z.coerce.number().int().min(500).default(5000),
    /** Secreto del proveedor local. Solo desarrollo y pruebas. */
    AUTH_LOCAL_SECRET: z.string().min(1).default('secreto-de-desarrollo-no-usar-en-produccion'),

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
  .refine((env) => env.EMAIL_PROVIDER !== 'resend' || Boolean(env.RESEND_API_KEY), {
    message: 'RESEND_API_KEY es obligatoria cuando EMAIL_PROVIDER=resend',
    path: ['RESEND_API_KEY'],
  })
  .refine((env) => env.EMAIL_PROVIDER !== 'resend' || Boolean(env.EMAIL_FROM), {
    message:
      'EMAIL_FROM es obligatoria cuando EMAIL_PROVIDER=resend: el proveedor rechaza los ' +
      'envios sin remitente verificado',
    path: ['EMAIL_FROM'],
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
  })
  .refine((env) => env.AUTH_PROVIDER !== 'supabase' || Boolean(env.SUPABASE_URL), {
    message: 'SUPABASE_URL es obligatoria cuando AUTH_PROVIDER=supabase',
    path: ['SUPABASE_URL'],
  })
  /*
   * Una clave de servicio sin direccion de proyecto no sirve para nada: no
   * hay a quien llamar. Es senal de una configuracion a medias, y prefiero
   * que no arranque a que el boton de invitar falle el dia que se use.
   */
  .refine((env) => !env.SUPABASE_SERVICE_ROLE_KEY || Boolean(env.SUPABASE_URL), {
    message: 'SUPABASE_URL es obligatoria cuando se configura SUPABASE_SERVICE_ROLE_KEY',
    path: ['SUPABASE_URL'],
  })
  /*
   * EL PROVEEDOR LOCAL NO ARRANCA EN PRODUCCION.
   *
   * Emite tokens con un secreto compartido: quien lo conozca puede fabricarse
   * uno de administrador y entrar al panel. No es lo mismo que el simulador
   * de pagos, donde lo peor que pasa es una reserva sin cobrar; aqui seria
   * entregar los datos de todos los clientes.
   *
   * Por eso la aplicacion se NIEGA A ARRANCAR en vez de avisar en el log: un
   * aviso se pasa por alto, un arranque fallido no.
   */
  .refine((env) => env.NODE_ENV !== 'production' || env.AUTH_PROVIDER !== 'local', {
    message:
      'AUTH_PROVIDER=local no se admite en produccion: cualquiera que conozca ' +
      'AUTH_LOCAL_SECRET podria entrar al panel como administrador. Configura AUTH_PROVIDER=supabase',
    path: ['AUTH_PROVIDER'],
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
