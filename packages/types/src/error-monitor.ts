import { z } from 'zod';

/**
 * EL ERROR QUE NADIE VE
 * =====================
 * Hay dos sitios donde se entera uno de que la API ha reventado: el log de
 * Render y la captura de pantalla que manda un cliente. El primero no lo lee
 * nadie —esa es la historia entera de `system-health.ts`, y las dos caidas
 * que la escribieron— y el segundo llega tarde y de mala manera.
 *
 * `SystemAlertService` resolvio eso para el ESTADO: cinco preguntas con
 * respuesta de si o no, mirandose cada pocos minutos, y un aviso al movil
 * cuando una cambia. Lo que quedaba fuera son las EXCEPCIONES: una peticion
 * que acaba en 500 no cambia ningun estado, no deja la base caida, no deja
 * migraciones pendientes. El sistema sigue sano y una persona se ha quedado
 * sin poder hacer algo.
 *
 * Este contrato es lo que hace falta para que eso tambien avise.
 *
 * ========================================================================
 * POR QUE NO HAY SENTRY, NI NINGUN SERVICIO DE TERCEROS
 * ========================================================================
 * Un monitor de errores de los de verdad manda el stack trace completo a un
 * servidor ajeno, y un stack trace de esta API lleva dentro, muchas veces,
 * los argumentos de la llamada que fallo: un correo, una direccion, el
 * cuerpo de una reserva. Eso convierte al servicio en un SUBENCARGADO DEL
 * TRATAMIENTO con datos personales de clientes de Georgia, y entonces:
 *
 *   - hay que nombrarlo en la politica de privacidad (`privacy-en.ts`),
 *   - hay que subir `PRIVACY_VERSION`, con lo que todas las aceptaciones
 *     guardadas dejan de estar al dia,
 *   - y hay una credencial mas que proteger.
 *
 * Para una empresa de limpieza con un servidor y dos aplicaciones web, el
 * precio no vale lo que se compra. Lo que de verdad hacia falta —QUE ALGUIEN
 * SE ENTERE SIN TENER QUE MIRAR— ya esta construido: la alarma, el chat
 * tecnico de Telegram y la pantalla de estado del panel.
 *
 * Asi que esto cuenta errores en memoria y los cuelga de esa alarma.
 *
 * QUE CAMBIARIA LA DECISION: que la empresa tenga varios servidores, un
 * equipo tecnico de verdad, o que haga falta reproducir fallos antiguos con
 * su stack trace completo. Entonces toca Sentry (o el que sea) con su
 * clausula de subencargado, su version de politica nueva y su `beforeSend`
 * recortando cuerpos. Mientras no sea asi, este archivo es suficiente.
 *
 * ========================================================================
 * LA HUELLA NO PUEDE LLEVAR DATOS, Y POR ESO SE CONSTRUYE, NO SE COPIA
 * ========================================================================
 * Lo comodo seria guardar `${request.method} ${request.url}: ${error.message}`
 * y ensenarlo en el panel. Las dos mitades de eso son una fuga:
 *
 *   - `request.url` trae la ruta REAL, con el identificador de la reserva
 *     dentro y, si alguien puso una, la cadena de consulta entera.
 *   - `error.message` de Postgres trae el nombre del servidor y de la tabla;
 *     el de Stripe puede traer el identificador de un cobro.
 *
 * Es el mismo razonamiento que convirtio `detailKey` en una lista cerrada en
 * `system-health.ts`. Aqui no cabe una lista cerrada —las rutas son muchas y
 * cambian— asi que la huella se MONTA a partir de tres piezas saneadas y
 * `ErrorFingerprintSchema` vuelve a comprobar el resultado. Lo que no encaja
 * no sale: se sustituye por `desconocida`.
 */

/* -------------------------------------------------------------------------- */
/*  Las piezas de una huella                                                  */
/* -------------------------------------------------------------------------- */

/** Los metodos que se nombran tal cual. Cualquier otro pasa a ser `OTRO`. */
const METODOS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

/**
 * Lo que se pone cuando no se sabe por donde entro la peticion.
 *
 * Pasa de verdad, y no es raro: si la excepcion ocurre antes de que Express
 * decida que ruta era —un cuerpo demasiado grande, un JSON roto— no hay
 * patron de ruta que escribir. Decir «no se sabe» es mejor que inventarse
 * uno a partir de la URL, que es justo lo que no se puede hacer.
 */
export const RUTA_DESCONOCIDA = 'desconocida';

/** Lo que se pone cuando el nombre del error no tiene forma de nombre. */
export const ERROR_SIN_NOMBRE = 'Error';

/**
 * La forma de una huella: `METODO patron Nombre`.
 *
 * ES LA GUARDIA DE SEGURIDAD DEL ARCHIVO. El patron admite letras, cifras,
 * barras, dos puntos y guiones, y nada mas: ni `?`, ni `=`, ni `&`, ni `@`,
 * ni espacios, ni `_`. Una URL de verdad con una cadena de consulta no
 * encaja, y un correo tampoco.
 */
const HUELLA = /^[A-Z]{3,7} [A-Za-z0-9/:-]{1,80} [A-Za-z][A-Za-z0-9]{0,48}$/;

export const ErrorFingerprintSchema = z.string().regex(HUELLA);

/**
 * Lo que puede ser un trozo de ruta entre dos barras.
 *
 *   - `:bookingId`  un parametro, que es un nombre que escribimos nosotros;
 *   - `my-jobs`     una palabra, o varias unidas por guiones, cada una
 *                   empezando por letra.
 *
 * ESTA SEGUNDA REGLA ES LA QUE DESCARTA LOS IDENTIFICADORES, y la escribio
 * una prueba que fallo: `[A-Za-z0-9/:-]` —lo que habia aqui antes— admite
 * `8f2c1a94-1d3e-4f55-9b77-2c0a5e6d7f88` sin pestanear, porque un UUID son
 * letras, cifras y guiones. Exigir que cada palabra empiece por letra lo
 * tumba, y tumba tambien `abc-123`. Lo que queda son nombres de ruta.
 */
const TROZO_PARAMETRO = /^:[A-Za-z][A-Za-z0-9]{0,29}$/;
const TROZO_PALABRA = /^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$/;

/** Tope de trozos y de largo. Una ruta nuestra no se acerca a ninguno. */
const TROZOS_MAX = 8;
const TROZO_LARGO_MAX = 24;
const RUTA_LARGO_MAX = 80;

/** Un nombre de clase de error: `TypeError`, `PrismaClientKnownRequestError`. */
const NOMBRE_DE_ERROR = /^[A-Za-z][A-Za-z0-9]{0,48}$/;

function metodoSeguro(metodo: string): string {
  const arriba = metodo.toUpperCase();
  return (METODOS as readonly string[]).includes(arriba) ? arriba : 'OTRO';
}

/**
 * El patron de la ruta, o `desconocida`.
 *
 * Lo que entra aqui tiene que ser el PATRON (`/api/v1/bookings/:id`), que es
 * codigo nuestro, nunca la URL que pidio el navegador. Aun asi se filtra:
 * esto es lo ultimo que hay entre un identificador de cliente y la pantalla
 * de un panel, y una comprobacion de mas en este sitio no cuesta nada.
 */
function rutaSegura(patron: string | undefined): string {
  if (patron === undefined || patron.length > RUTA_LARGO_MAX) return RUTA_DESCONOCIDA;

  // Una barra final sobra y partiria en dos la huella del mismo fallo.
  const limpio = patron.length > 1 ? patron.replace(/\/+$/, '') : patron;

  if (limpio === '/') return '/';
  if (!limpio.startsWith('/')) return RUTA_DESCONOCIDA;

  const trozos = limpio.slice(1).split('/');
  if (trozos.length > TROZOS_MAX) return RUTA_DESCONOCIDA;

  const todosValen = trozos.every(
    (trozo) =>
      trozo.length <= TROZO_LARGO_MAX && (TROZO_PARAMETRO.test(trozo) || TROZO_PALABRA.test(trozo)),
  );

  return todosValen ? limpio : RUTA_DESCONOCIDA;
}

/**
 * El nombre de la clase del error, nunca su mensaje.
 *
 * `error.name` es `TypeError` o `PrismaClientKnownRequestError`: dice QUE
 * clase de fallo fue, que es lo que agrupa, y no lleva datos dentro. El
 * mensaje si los lleva, y se queda en el log del servidor.
 */
function nombreSeguro(nombre: string | undefined): string {
  if (nombre === undefined) return ERROR_SIN_NOMBRE;
  return NOMBRE_DE_ERROR.test(nombre) ? nombre : ERROR_SIN_NOMBRE;
}

/** De donde vino un fallo, antes de sanearlo. */
export interface ErrorOrigen {
  /** El metodo HTTP de la peticion. */
  method: string;
  /** El PATRON de la ruta (`/api/v1/bookings/:id`), no la URL pedida. */
  routePath: string | undefined;
  /** `error.name`. Nunca `error.message`. */
  errorName: string | undefined;
}

/**
 * La huella con la que se agrupan los fallos iguales.
 *
 * Dos peticiones distintas a la misma ruta que revientan por lo mismo tienen
 * que contar como un problema, no como dos: lo que hay que arreglar es uno.
 * Y al no llevar el identificador dentro, mil fallos de mil reservas siguen
 * siendo una sola linea en el panel.
 */
export function huellaDelError(origen: ErrorOrigen): string {
  return [
    metodoSeguro(origen.method),
    rutaSegura(origen.routePath),
    nombreSeguro(origen.errorName),
  ].join(' ');
}

/* -------------------------------------------------------------------------- */
/*  Cuanto se mira y cuando duele                                             */
/* -------------------------------------------------------------------------- */

/**
 * La ventana de la alarma.
 *
 * La comprobacion `errors` contesta «¿ha reventado algo en la ultima hora?».
 * Cuando pasa una hora sin un fallo nuevo vuelve a `ok` y la alarma manda su
 * «resuelto», que aqui significa «ya no pasa», no «esta arreglado». Es una
 * diferencia que hay que tener presente al leerlo, y se eligio asi a
 * proposito: la alternativa era un boton de «visto» en el panel, o sea un
 * estado mas que guardar y una pantalla mas que atender.
 */
export const ERROR_WINDOW_MINUTES = 60;

/**
 * A partir de cuantos fallos en la ventana esto pasa de `degraded` a `down`.
 *
 * Un 500 suelto es un fallo que hay que mirar hoy. Diez en una hora es algo
 * roto AHORA MISMO, y la diferencia tiene que verse en el color de la fila y
 * en el texto del aviso, porque no se responde igual a las dos cosas.
 */
export const ERROR_DOWN_THRESHOLD = 10;

/**
 * Cuanto se conserva para la pantalla del panel.
 *
 * Mas que la ventana de la alarma a proposito: quien abre el panel por la
 * manana tiene que poder ver el fallo de las tres de la madrugada, aunque la
 * alarma ya haya dicho «resuelto».
 */
export const ERROR_HISTORY_MINUTES = 1440;

/**
 * Cuantas huellas DISTINTAS se recuerdan como maximo.
 *
 * Es un tope de memoria, y hace falta: esto vive en el proceso de la API y
 * un bucle de peticiones raras podria inventar huellas sin parar. Cuando se
 * llena se tira la mas antigua. El contador total no se pierde por eso.
 */
export const ERROR_FINGERPRINTS_MAX = 50;

/* -------------------------------------------------------------------------- */
/*  El informe que lee el panel                                               */
/* -------------------------------------------------------------------------- */

/**
 * Una huella con lo que se sabe de ella.
 *
 * ES `z.object` Y NO `z.strictObject`, como todo lo que lee un navegador: el
 * panel y la API se despliegan por separado, y un campo nuevo en la
 * respuesta no puede hacer desaparecer la tarjeta entera. Lo que guarda la
 * seguridad aqui no es la rigidez del objeto, es el patron de la huella.
 */
export const ApiErrorSampleSchema = z.object({
  fingerprint: ErrorFingerprintSchema,
  /** El codigo con el que se respondio. Siempre 5xx: el resto no se cuenta. */
  status: z.number().int().min(500).max(599),
  /** Cuantas veces paso, en lo que se conserva. */
  count: z.number().int().positive(),
  /** La ultima vez, en ISO. */
  lastAt: z.string(),
});
export type ApiErrorSample = z.infer<typeof ApiErrorSampleSchema>;

export const ApiErrorReportSchema = z.object({
  /** Los minutos que mira la alarma. Va en la respuesta para no repetirlo. */
  windowMinutes: z.number().int().positive(),
  /** Cuantos fallos en esa ventana. Es la cifra que sale en el aviso. */
  inWindow: z.number().int().min(0),
  /** Los minutos que conserva la pantalla. */
  historyMinutes: z.number().int().positive(),
  /**
   * Las huellas, de la mas reciente a la mas antigua.
   *
   * Se filtra lo que no se entiende en vez de descartar el informe entero:
   * una huella con una forma que este panel no conoce no puede dejar la
   * pantalla en blanco.
   */
  samples: z.array(z.unknown()).transform((filas) =>
    filas.flatMap((fila) => {
      const parsed = ApiErrorSampleSchema.safeParse(fila);
      return parsed.success ? [parsed.data] : [];
    }),
  ),
  /** Cuando se miro. */
  checkedAt: z.string(),
});
export type ApiErrorReport = z.infer<typeof ApiErrorReportSchema>;
