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
