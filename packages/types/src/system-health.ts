import { z } from 'zod';

/**
 * EL ESTADO DEL SISTEMA, COMO CONTRATO
 * =====================================
 * Esto no describe lo que el sistema HACE, sino si puede hacerlo. Nace de dos
 * caidas reales de esta misma semana, y las dos tienen la misma forma:
 *
 *   1. Se desplego codigo que esperaba una columna que la base no tenia. El
 *      log lo dijo cada media hora durante horas. Nadie lo leyo. Nos
 *      enteramos porque una reserva fallo y el cliente mando una captura.
 *   2. La tabla de tarifas guardada dejo de cumplir su contrato al cambiar de
 *      modelo de precios. Lleva diez dias avisando en el log. Se encontro de
 *      casualidad.
 *
 * LAS DOS ESTABAN REGISTRADAS. El registro no fue lo que falto: falto que
 * alguien mirara. Por eso lo que se construye aqui no es otro registro, es
 * una lista corta de preguntas con respuesta de si o no, pensada para que una
 * maquina la mire cada pocos minutos y avise.
 *
 * ========================================================================
 * POR QUE LA LISTA ES CORTA, Y TIENE QUE SEGUIR SIENDOLO
 * ========================================================================
 * La tentacion es comprobarlo todo. Es un error: cada comprobacion de mas es
 * una posibilidad de mas de que algo este en ambar sin importar, y una lista
 * donde siempre hay algo en ambar es una lista que se deja de mirar. Vuelve a
 * ser el problema del log.
 *
 * La regla para anadir una comprobacion nueva: TIENE QUE PODER ROMPERSE
 * SOLA, SIN QUE NADIE TOQUE NADA, Y QUE NO SE NOTE. Si para que falle hace
 * falta que alguien despliegue algo roto y encima se note en la primera
 * pantalla, no hace falta vigilarla.
 */

/* -------------------------------------------------------------------------- */
/*  Que se comprueba                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Las comprobaciones, cada una con su motivo para existir.
 *
 * Las dos primeras no son hipotesis: son las dos caidas de esta semana,
 * convertidas en preguntas.
 */
export const SYSTEM_CHECK_IDS = [
  /** La base responde. Sin esto no hay reservas, solo cotizaciones. */
  'database',
  /**
   * Las migraciones del repositorio estan todas aplicadas.
   *
   * ESTA ES LA CAIDA DEL PIN DE LA PUERTA. El codigo nuevo pedia una columna
   * que nadie habia creado, y la base respondia perfectamente mientras tanto:
   * una sonda que solo hace ping la habria dado por sana.
   */
  'migrations',
  /**
   * Las tarifas vigentes salen de la tabla y no del respaldo del codigo.
   *
   * ESTA ES LA CAIDA DE LOS PRECIOS. El sitio seguia cotizando —por eso nadie
   * lo noto— pero cada reserva se sellaba con una version que ya no se puede
   * volver a leer, y eso es facturacion que no se puede reproducir.
   */
  'pricingRates',
  /**
   * El proveedor de pago es el que toca.
   *
   * Con `mock` en produccion el sitio acepta reservas y NO RETIENE NADA: se
   * confirma la cita y no hay deposito. No da ningun error, que es lo que lo
   * hace peligroso.
   */
  'paymentProvider',
  /**
   * Los barridos periodicos siguen pasando.
   *
   * Un barrido muerto no se queja: simplemente deja de borrar pines vencidos
   * o de mandar recordatorios, y todo lo demas sigue igual.
   */
  'sweeps',
  /**
   * La API no esta devolviendo errores del servidor.
   *
   * ES LA UNICA DE LA LISTA QUE NO MIRA UN ESTADO, SINO LO QUE HA PASADO, y
   * se anadio por eso: las otras cinco preguntas pueden contestar «todo
   * bien» mientras una ruta revienta en cada peticion. Una excepcion no deja
   * la base caida ni las migraciones pendientes; deja a una persona sin
   * poder reservar, y solo se entera quien lea el log.
   *
   * Cumple la regla de la cabecera —puede romperse sola, sin que nadie toque
   * nada, y no notarse— porque un 500 no se nota desde dentro: el cliente ve
   * un mensaje generico y se va. Ver `error-monitor.ts`.
   */
  'errors',
] as const;

export const SystemCheckIdSchema = z.enum(SYSTEM_CHECK_IDS);
export type SystemCheckId = z.infer<typeof SystemCheckIdSchema>;

/* -------------------------------------------------------------------------- */
/*  Como se responde                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Cuatro estados, y la diferencia entre los dos ultimos importa.
 *
 *   - `ok`       funciona.
 *   - `degraded` funciona a medias, o funciona por el camino equivocado. El
 *                sitio sigue en pie pero algo no es lo que deberia.
 *   - `down`     no funciona. Hay algo que un cliente no puede hacer.
 *   - `unknown`  NO SE PUDO COMPROBAR, que no es lo mismo que «esta bien».
 *
 * `unknown` existe porque la alternativa es peor: una comprobacion que no
 * puede ejecutarse y devuelve `ok` por defecto es una luz verde que no mira
 * nada, y es exactamente como se pierde la confianza en un panel de estado.
 * Si no se sabe, se dice que no se sabe.
 */
export const SYSTEM_CHECK_STATES = ['ok', 'degraded', 'down', 'unknown'] as const;

export const SystemCheckStateSchema = z.enum(SYSTEM_CHECK_STATES);
export type SystemCheckState = z.infer<typeof SystemCheckStateSchema>;

/** Si ese estado merece que suene el telefono de alguien. */
export function requiereAtencion(estado: SystemCheckState): boolean {
  return estado !== 'ok';
}

/**
 * EL DETALLE ES UNA CLAVE DE UNA LISTA CERRADA, NO UNA FRASE NI UN FORMATO.
 *
 * ========================================================================
 * Y ES UNA DECISION DE SEGURIDAD, NO DE TRADUCCION
 * ========================================================================
 * Lo natural seria devolver el mensaje del error. Pero el mensaje de un error
 * de base de datos trae dentro el nombre del servidor, el de la tabla y a
 * veces el de la conexion; el de Stripe puede traer datos de la cuenta. Ese
 * texto acabaria en una respuesta HTTP y en la pantalla de un navegador.
 *
 * ========================================================================
 * POR QUE UNA LISTA Y NO UNA EXPRESION REGULAR
 * ========================================================================
 * La primera version de este campo validaba el FORMATO `palabra.palabra`,
 * que parecia suficiente. No lo es, y lo cazo la prueba de este archivo:
 *
 *     db.abcdefgh        <- medio nombre de servidor de Supabase
 *     migrations.pending <- una clave de verdad
 *
 * Las dos encajan en el mismo patron. Cualquier regla de forma deja pasar
 * algo con forma de clave, y los identificadores de servidor, de proyecto y
 * de cuenta tienen todos esa forma.
 *
 * Con una lista cerrada no hay nada que razonar: lo que no esta escrito aqui
 * no sale de la API. El detalle completo se queda donde debe estar, en el log
 * del servidor, al que solo se llega con credenciales.
 */
export const SYSTEM_DETAIL_KEYS = [
  /** No hay cadena de conexion: la API corre como cotizador y poco mas. */
  'database.notConfigured',
  /** Hay cadena pero nadie responde al otro lado. */
  'database.unreachable',
  /** Faltan migraciones por aplicar. La caida del pin de la puerta. */
  'migrations.pending',
  /** No se pudo leer la lista de migraciones del disco: no se sabe. */
  'migrations.unverifiable',
  /** La tabla vigente no cumple el contrato y se cotiza con el respaldo. */
  'pricingRates.fallback',
  /** No se pudo leer la tabla. Distinto de que este mal. */
  'pricingRates.unreadable',
  /**
   * `mock` fuera de desarrollo: se aceptan reservas y NO se retiene dinero.
   * Sin ningun error por ningun lado, que es lo que lo hace peligroso.
   */
  'paymentProvider.simulated',
  /** Un barrido lleva demasiado tiempo sin pasar. */
  'sweeps.stalled',
  /** Hubo errores del servidor en la ultima ventana. Alguno, no muchos. */
  'errors.recent',
  /** Hubo tantos que algo esta roto ahora mismo. Ver ERROR_DOWN_THRESHOLD. */
  'errors.many',
] as const;

export const SystemDetailKeySchema = z.enum(SYSTEM_DETAIL_KEYS);
export type SystemDetailKey = z.infer<typeof SystemDetailKeySchema>;

/** Una comprobacion, ya resuelta. */
export const SystemCheckSchema = z.strictObject({
  id: SystemCheckIdSchema,
  state: SystemCheckStateSchema,
  /**
   * Por que ese estado. `null` cuando esta en `ok`: lo bueno no necesita
   * explicacion, y dejarlo fuera hace que la pantalla solo tenga texto donde
   * hay algo que leer.
   */
  detailKey: SystemDetailKeySchema.nullable(),
  /**
   * Una cifra que acompana, cuando la hay: cuantas migraciones faltan,
   * cuantos minutos lleva un barrido sin pasar.
   *
   * SOLO UN NUMERO, nunca un texto. Un numero no puede llevar dentro el
   * nombre de un cliente ni la cadena de conexion.
   */
  count: z.number().int().min(0).nullable(),
});
export type SystemCheck = z.infer<typeof SystemCheckSchema>;

/* -------------------------------------------------------------------------- */
/*  El informe entero                                                         */
/* -------------------------------------------------------------------------- */

export const SystemHealthSchema = z.strictObject({
  /** El peor de los estados de abajo. Ver `peorEstado`. */
  state: SystemCheckStateSchema,
  checks: z.array(SystemCheckSchema),
  /**
   * Cuando se miro.
   *
   * Va en la respuesta porque el informe se cachea unos segundos, y sin esta
   * fecha no habria forma de distinguir «todo bien» de «esto es de hace una
   * hora y el servidor ya no responde».
   */
  checkedAt: z.string(),
});
export type SystemHealth = z.infer<typeof SystemHealthSchema>;

/**
 * El estado del conjunto es EL PEOR de sus partes, nunca un promedio.
 *
 * Con un promedio, cuatro comprobaciones en verde taparian una en rojo y el
 * panel diria «75 % bien» mientras nadie puede reservar. Un sistema con una
 * pieza rota esta roto.
 *
 * `unknown` cuenta como peor que `degraded` y mejor que `down`: no saber si
 * algo funciona es mas grave que saber que funciona a medias, y menos grave
 * que saber que no funciona.
 */
const GRAVEDAD: Record<SystemCheckState, number> = {
  ok: 0,
  degraded: 1,
  unknown: 2,
  down: 3,
};

export function peorEstado(checks: readonly SystemCheck[]): SystemCheckState {
  return checks.reduce<SystemCheckState>(
    (peor, check) => (GRAVEDAD[check.state] > GRAVEDAD[peor] ? check.state : peor),
    'ok',
  );
}

/* -------------------------------------------------------------------------- */
/*  El mismo informe, tal como lo LEE el panel                                */
/* -------------------------------------------------------------------------- */

/**
 * EL INFORME QUE LEE EL NAVEGADOR, QUE NO PUEDE SER EL ESTRICTO
 * =============================================================
 * `SystemHealthSchema` es `strictObject` con enumeraciones cerradas, y para
 * construir la respuesta en el servidor es lo correcto. Para LEERLA desde el
 * panel es una trampa, y la misma que ya costo un incidente con la galeria
 * (ver `lo-que-lee-la-web-tolera-campos-nuevos.test.ts`): el panel y la API
 * se despliegan por separado.
 *
 * Esta vez el campo nuevo no es una clave de sobra, es un VALOR de sobra. El
 * dia que se anadio la comprobacion `errors`, un panel todavia sin
 * desplegar habria recibido un identificador que su enumeracion no conocia,
 * `safeParse` habria fallado y la pantalla de estado entera habria mostrado
 * «no se pudo cargar». La pantalla que existe para decir si el sistema esta
 * sano, apagada por haber anadido una comprobacion mas.
 *
 * Asi que al leer:
 *
 *   - una comprobacion con un identificador desconocido SE DESCARTA, y la
 *     pantalla la pinta como «no se sabe», porque recorre la lista del
 *     contrato y no la de la respuesta;
 *   - un `detailKey` desconocido se queda en `null`: se pierde la frase, no
 *     la fila;
 *   - un estado desconocido pasa a `unknown`, que es exactamente lo que es;
 *   - las claves de sobra se ignoran.
 *
 * LA LISTA CERRADA DE `detailKey` SIGUE MANDANDO EN EL SERVIDOR. Esto no la
 * relaja: lo que no esta en el contrato sigue sin poder salir de la API,
 * porque la respuesta se construye con `SystemCheck`. Aqui solo se decide
 * que hacer con lo que llega.
 */
const SystemCheckReadSchema = z.object({
  id: SystemCheckIdSchema,
  state: SystemCheckStateSchema.catch('unknown'),
  detailKey: SystemDetailKeySchema.nullable().catch(null),
  count: z.number().int().min(0).nullable().catch(null),
});

export const SystemHealthReadSchema = z.object({
  state: SystemCheckStateSchema.catch('unknown'),
  checks: z.array(z.unknown()).transform((filas) =>
    filas.flatMap((fila) => {
      const parsed = SystemCheckReadSchema.safeParse(fila);
      return parsed.success ? [parsed.data] : [];
    }),
  ),
  checkedAt: z.string(),
});
