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

/**
 * Exime del limitador de cotizaciones, no del global.
 *
 * ES LO QUE NECESITA TODO ENDPOINT QUE NO CALCULA COTIZACIONES. El limitador
 * "quotes" es de 10 peticiones por minuto porque cada cotizacion gasta cuota
 * de pago del proveedor de distancia, pero se aplica a TODA la API: con
 * nombres propios, un limitador no se limita a sus rutas, cubre todas las que
 * no lo desactiven explicitamente.
 *
 * Por eso vive aqui y se pone A NIVEL DE CLASE en los controladores del
 * panel: puesto metodo a metodo, el dia que alguien anade un endpoint nuevo
 * se olvida, y esa pantalla se cae con un 429 en la undecima peticion del
 * minuto. Paso exactamente eso con las asignaciones.
 */
export const SKIP_QUOTE_THROTTLER: Partial<Record<ThrottlerName, boolean>> = {
  [THROTTLER_NAMES[1]]: true,
};

/**
 * EL LIMITE DE LA RECUPERACION DE CONTRASENA.
 *
 * Va como override por ruta con `@Throttle({ global: RECOVERY_RATE_LIMIT })`
 * y NO como limitador con nombre propio, que fue lo primero que probe.
 *
 * El motivo es la trampa que explica todo este archivo: un limitador con
 * nombre se aplica a TODA la API, asi que anadir uno de cinco peticiones por
 * cuarto de hora habria obligado a eximirlo en cada controlador que existe
 * —y en cada uno que se escriba manana—. El dia que a alguien se le olvide,
 * la pantalla afectada se cae a la sexta peticion. Un override por ruta solo
 * puede afectar a esa ruta.
 *
 * Los numeros: cinco peticiones por cuarto de hora y por IP. Cada una manda
 * un correo a una persona real, asi que sin tope esto es una forma gratuita
 * de inundar un buzon ajeno y de gastar la cuota de envio de la empresa de
 * paso. Cinco deja margen de sobra para quien se equivoca al teclear su
 * correo y lo reintenta.
 */
export const RECOVERY_RATE_LIMIT = { limit: 5, ttl: 15 * 60 * 1000 } as const;
