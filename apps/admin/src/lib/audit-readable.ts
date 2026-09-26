import type { AuditLogItem, Locale } from '@freshness/types';
import { TIMEZONE_EMPRESA, formatCents, formatDateTime, formatTimestamp } from './format';

/**
 * DE JSON CRUDO A ALGO QUE SE PUEDA LEER
 * --------------------------------------
 * La pantalla de auditoria enseñaba la metadata tal cual salia de la base:
 *
 *     { "after": [ { "isLead": false,
 *                    "staffId": "0826c725-0414-4abb-ae61-a5e14a4178ae" } ],
 *       "before": [], "reference": "FT-2026-0002" }
 *
 * Eso es correcto y es inservible. Quien lleva la empresa no sabe que es un
 * `staffId`, y un registro que solo entiende quien lo programo no cumple su
 * unica funcion: que alguien pueda mirar y entender que paso.
 *
 * DOS REGLAS QUE ESTE MODULO NO SE SALTA:
 *
 * 1. NO SE PIERDE NADA. Una clave que no se sepa traducir se pinta igual,
 *    con su nombre crudo como etiqueta. Y la pantalla deja el JSON entero
 *    accesible en «detalles tecnicos». Un registro de auditoria que esconde
 *    lo que no entiende deja de ser una prueba de nada.
 *
 * 2. NO SE INVENTA NADA. Cada formato de aqui corresponde a una metadata que
 *    algun servicio escribe de verdad (estan inventariadas en
 *    `docs/16-auditoria.md` §3). No hay traducciones para claves imaginarias.
 *
 * Es codigo puro —recibe `t` en vez de usar el gancho— para poder probarlo
 * sin montar React.
 */

/** Una linea ya lista para pintar: etiqueta y valor, los dos en texto. */
export interface Dato {
  etiqueta: string;
  valor: string;
}

export interface Legible {
  /** Sobre que fue: «Reserva FT-2026-0002», «Ficha de Ana Ruiz»… o nada. */
  objetivo: string | null;
  datos: Dato[];
}

export interface Contexto {
  t: (clave: string, opciones?: Record<string, unknown>) => string;
  locale: Locale;
  /** Identificador de personal → nombre. Del directorio que la pantalla ya pide. */
  nombres: Map<string, string>;
}

/**
 * Claves que NO salen como una linea mas.
 *
 * `reference` sube al titulo como objetivo; `value` es la configuracion
 * entera y se resume a partir de `changed`; `path` y `required` son ruido
 * tecnico que ya viaja en el bloque de detalles.
 */
const FUERA_DE_LA_LISTA = new Set(['reference', 'value', 'path']);

export function describir(item: AuditLogItem, ctx: Contexto): Legible {
  const metadata = objetoDe(item.metadata);

  return {
    objetivo: objetivoDe(item, metadata, ctx),
    datos: datosDe(item, metadata, ctx),
  };
}

/* -------------------------------------------------------------------------- */
/*  Sobre que                                                                 */
/* -------------------------------------------------------------------------- */

function objetivoDe(
  item: AuditLogItem,
  metadata: Record<string, unknown>,
  ctx: Contexto,
): string | null {
  if (item.entityType === 'booking') {
    const referencia = texto(metadata.reference);
    return referencia === null
      ? null
      : ctx.t('admin.audit.target.booking', { reference: referencia });
  }

  if (item.entityType === 'staff') {
    /*
     * El nombre se resuelve con el directorio, no se guarda en la fila. Si la
     * ficha ya no existe queda el correo, que es lo unico que la identifica
     * meses despues; y si tampoco lo hay, no se pone nada antes que poner un
     * identificador que no le dice nada a nadie.
     */
    const nombre = item.entityId === null ? undefined : ctx.nombres.get(item.entityId);
    const quien = nombre ?? texto(metadata.email);
    return quien === null || quien === undefined
      ? null
      : ctx.t('admin.audit.target.staff', { name: quien });
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/*  Las lineas                                                                */
/* -------------------------------------------------------------------------- */

function datosDe(item: AuditLogItem, metadata: Record<string, unknown>, ctx: Contexto): Dato[] {
  // Consultar el registro guarda los filtros usados, y casi todos son nulos:
  // merece su propio resumen en vez de siete lineas con un guion.
  if (item.action === 'audit.queried') return filtrosUsados(metadata, ctx);

  const datos: Dato[] = [];

  for (const [clave, valor] of Object.entries(metadata)) {
    if (FUERA_DE_LA_LISTA.has(clave)) continue;
    // Un nulo no aporta: significa «no habia nada que decir de esto».
    if (valor === null || valor === undefined) continue;

    if (clave === 'before' || clave === 'after') continue; // se tratan juntos
    if (clave === 'changed') {
      datos.push(...camposCambiados(valor, metadata.value, ctx));
      continue;
    }

    datos.push({ etiqueta: etiquetaDe(clave, ctx, valor), valor: valorDe(clave, valor, ctx) });
  }

  // `before` y `after` van emparejados: por separado no se entiende el cambio.
  datos.push(...antesYDespues(item, metadata, ctx));

  return datos;
}

/**
 * El par antes/despues, que aparece en dos acciones y significa cosas
 * distintas en cada una.
 */
function antesYDespues(
  item: AuditLogItem,
  metadata: Record<string, unknown>,
  ctx: Contexto,
): Dato[] {
  const { before, after } = metadata;
  if (before === undefined && after === undefined) return [];

  if (item.action === 'booking.team_changed') {
    return [
      { etiqueta: ctx.t('admin.audit.field.teamBefore'), valor: equipo(before, ctx) },
      { etiqueta: ctx.t('admin.audit.field.teamAfter'), valor: equipo(after, ctx) },
    ];
  }

  /*
   * Ficha de personal: se enseña SOLO lo que de verdad cambio, con flecha.
   * Volcar los tres campos siempre obligaria a comparar a ojo cual es el que
   * se toco, que es exactamente el trabajo que esta pantalla debe ahorrar.
   */
  const antes = objetoDe(before);
  const despues = objetoDe(after);
  const datos: Dato[] = [];

  for (const campo of new Set([...Object.keys(antes), ...Object.keys(despues)])) {
    const a = valorDe(campo, antes[campo], ctx);
    const b = valorDe(campo, despues[campo], ctx);
    if (a === b) continue;
    datos.push({ etiqueta: etiquetaDe(campo, ctx), valor: `${a} → ${b}` });
  }

  return datos;
}

/** El equipo de una reserva, por nombres. Vacio es una respuesta valida. */
function equipo(valor: unknown, ctx: Contexto): string {
  if (!Array.isArray(valor) || valor.length === 0) return ctx.t('admin.audit.value.nobody');

  return valor
    .map((miembro) => {
      const ficha = objetoDe(miembro);
      const id = texto(ficha.staffId);
      const nombre =
        (id === null ? undefined : ctx.nombres.get(id)) ?? ctx.t('admin.audit.value.unknownPerson');
      return ficha.isLead === true ? ctx.t('admin.audit.value.lead', { name: nombre }) : nombre;
    })
    .join(', ');
}

/**
 * Configuracion: que campos se tocaron y como quedaron.
 *
 * `value` trae la configuracion ENTERA, no solo lo cambiado. Volcarla seria
 * peor que el JSON crudo, asi que se usa `changed` como indice y solo se
 * enseña el valor nuevo de lo que figura ahi.
 */
function camposCambiados(changed: unknown, value: unknown, ctx: Contexto): Dato[] {
  if (!Array.isArray(changed) || changed.length === 0) {
    return [
      { etiqueta: ctx.t('admin.audit.field.changed'), valor: ctx.t('admin.audit.value.noChanges') },
    ];
  }

  const valores = objetoDe(value);

  return changed.map((campo) => {
    const nombre = typeof campo === 'string' ? campo : String(campo);
    const nuevo = valores[nombre];

    return {
      etiqueta: ctx.t(`admin.audit.settingsField.${nombre}`, { defaultValue: nombre }),
      // Un horario semanal es un objeto de siete dias: decir «se actualizo»
      // informa mas que pegar el objeto, y el detalle esta en la pantalla
      // de configuracion, que es su sitio.
      valor:
        nuevo === undefined || esObjeto(nuevo)
          ? ctx.t('admin.audit.value.updated')
          : valorDe(nombre, nuevo, ctx),
    };
  });
}

/** Los filtros con los que alguien consulto el registro. */
function filtrosUsados(metadata: Record<string, unknown>, ctx: Contexto): Dato[] {
  const datos: Dato[] = [];

  for (const [clave, valor] of Object.entries(metadata)) {
    if (valor === null || valor === undefined) continue;
    datos.push({ etiqueta: etiquetaDe(clave, ctx, valor), valor: valorDe(clave, valor, ctx) });
  }

  return datos.length > 0
    ? datos
    : [
        {
          etiqueta: ctx.t('admin.audit.field.filters'),
          valor: ctx.t('admin.audit.value.noFilters'),
        },
      ];
}

/* -------------------------------------------------------------------------- */
/*  Etiquetas y valores, por clave                                            */
/* -------------------------------------------------------------------------- */

/**
 * El nombre de la clave, en cristiano.
 *
 * Si no hay traduccion se devuelve la clave tal cual, a proposito: una linea
 * con nombre feo sigue siendo informacion, y una linea que desaparece es un
 * agujero en el registro.
 */
function etiquetaDe(clave: string, ctx: Contexto, valor?: unknown): string {
  /*
   * `from` y `to` necesitan DOS etiquetas distintas, no solo dos formatos.
   * En un cambio de estado son «Antes» y «Después»; en una consulta son el
   * principio y el final de un rango de fechas, y llamar «Antes» a «desde el
   * 1 de septiembre» dice justo lo contrario de lo que paso.
   */
  if ((clave === 'from' || clave === 'to') && esFechaIso(valor)) {
    return ctx.t(`admin.audit.field.${clave}Date`);
  }

  return ctx.t(`admin.audit.field.${clave}`, { defaultValue: clave });
}

function valorDe(clave: string, valor: unknown, ctx: Contexto): string {
  if (valor === null || valor === undefined) return ctx.t('admin.audit.value.none');
  if (typeof valor === 'boolean') {
    return ctx.t(valor ? 'admin.audit.value.yes' : 'admin.audit.value.no');
  }

  switch (clave) {
    case 'role':
      return ctx.t(`admin.role.${String(valor)}`, { defaultValue: String(valor) });

    case 'required':
      return Array.isArray(valor)
        ? valor
            .map((rol) => ctx.t(`admin.role.${String(rol)}`, { defaultValue: String(rol) }))
            .join(', ')
        : String(valor);

    case 'amountCents':
    case 'totalCents':
      return typeof valor === 'number' ? formatCents(valor, ctx.locale) : String(valor);

    /*
     * UNA CITA VA EN HORA DE GEORGIA, no en la de quien mira. Es la hora a
     * la que un equipo se presenta en una casa, y es la misma que ve el
     * cliente en su correo: ensenarla en la zona del navegador haria que el
     * panel y el cliente hablaran de horas distintas para la misma limpieza.
     */
    case 'scheduledStart':
      return esFechaIso(valor)
        ? formatDateTime(valor, TIMEZONE_EMPRESA, ctx.locale)
        : String(valor);

    // Esto en cambio NO es una cita: es cuando corrio un barrido. Va en la
    // zona de quien mira, como el resto de marcas de tiempo del registro.
    case 'olderThan':
      return fecha(valor, ctx);

    /*
     * `from` y `to` significan DOS cosas segun la accion: los estados de una
     * reserva («de confirmada a completada») o el rango de fechas de una
     * consulta. Se distinguen por la forma del valor, no por la accion: es
     * mas robusto y no hay que acordarse de actualizarlo al añadir una.
     */
    case 'from':
    case 'to':
      return esFechaIso(valor) ? fecha(valor, ctx) : estado(valor, ctx);

    case 'service':
      return ctx.t(`services.${String(valor)}.name`, { defaultValue: String(valor) });

    case 'zone':
      return ctx.t('admin.audit.value.zone', { zone: String(valor) });

    case 'source':
      return ctx.t(`admin.audit.value.source.${String(valor)}`, { defaultValue: String(valor) });

    case 'surface':
      return ctx.t(`admin.audit.surface.${String(valor)}`, { defaultValue: String(valor) });

    case 'entityType':
      return ctx.t(`admin.audit.entity.${String(valor)}`, { defaultValue: String(valor) });

    case 'action':
      return ctx.t(`admin.audit.action.${String(valor)}`, { defaultValue: String(valor) });

    case 'actorId': {
      const nombre = ctx.nombres.get(String(valor));
      return nombre ?? ctx.t('admin.audit.value.unknownPerson');
    }

    default:
      return typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
  }
}

function estado(valor: unknown, ctx: Contexto): string {
  return ctx.t(`admin.status.${String(valor)}`, { defaultValue: String(valor) });
}

function fecha(valor: unknown, ctx: Contexto): string {
  return typeof valor === 'string' && esFechaIso(valor)
    ? formatTimestamp(valor, ctx.locale)
    : String(valor);
}

/* -------------------------------------------------------------------------- */
/*  Utilidades                                                                */
/* -------------------------------------------------------------------------- */

function esFechaIso(valor: unknown): valor is string {
  return typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(valor);
}

function esObjeto(valor: unknown): boolean {
  return typeof valor === 'object' && valor !== null;
}

/** La metadata como objeto llano. Cualquier otra cosa se trata como vacia. */
function objetoDe(valor: unknown): Record<string, unknown> {
  return esObjeto(valor) && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {};
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim().length > 0 ? valor : null;
}

/* -------------------------------------------------------------------------- */
/*  Agrupar por dia                                                           */
/* -------------------------------------------------------------------------- */

export interface Jornada {
  /** Clave estable para React: el dia en formato ISO. */
  dia: string;
  titulo: string;
  entradas: AuditLogItem[];
}

/**
 * Parte la lista en dias.
 *
 * «Hoy» y «Ayer» por nombre; el resto, con su fecha. Una lista de cincuenta
 * marcas de tiempo seguidas obliga a leer la fecha entera en cada linea para
 * saber si algo paso el mismo dia que lo anterior.
 *
 * El dia se calcula en la zona de QUIEN MIRA, igual que la hora de cada
 * entrada: aqui no se registra cuando va un equipo a una casa —eso si va en
 * hora de Georgia— sino cuando alguien pulso un boton.
 */
export function porDias(items: AuditLogItem[], ctx: Contexto, ahora = new Date()): Jornada[] {
  const jornadas: Jornada[] = [];
  const hoy = diaLocal(ahora);
  const ayer = diaLocal(new Date(ahora.getTime() - 86_400_000));

  for (const item of items) {
    const dia = diaLocal(new Date(item.occurredAt));
    const ultima = jornadas.at(-1);

    if (ultima?.dia === dia) {
      ultima.entradas.push(item);
      continue;
    }

    jornadas.push({
      dia,
      titulo:
        dia === hoy
          ? ctx.t('admin.audit.day.today')
          : dia === ayer
            ? ctx.t('admin.audit.day.yesterday')
            : diaLargo(item.occurredAt, ctx.locale),
      entradas: [item],
    });
  }

  return jornadas;
}

/** El dia, comparable, en la zona del navegador. */
function diaLocal(fecha: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(fecha);
}

function diaLargo(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

/** Solo la hora: el dia ya lo dice la cabecera del grupo. */
export function soloLaHora(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-US' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

/* -------------------------------------------------------------------------- */
/*  Categorias del filtro                                                     */
/* -------------------------------------------------------------------------- */

/**
 * En que cajon va cada accion.
 *
 * El desplegable de acciones tiene veintitantas entradas y quien lleva la
 * empresa no busca «access_notes.viewed»: busca «quien ha visto datos de
 * clientes». Agrupar por categoria convierte una lista alfabetica en algo
 * que se puede recorrer con una pregunta en la cabeza.
 *
 * El orden es el del desplegable, y esta pensado: primero lo que se mira a
 * diario, y el propio registro al final.
 */
export const GRUPOS = [
  'access',
  'bookings',
  'money',
  'staff',
  'settings',
  'sensitive',
  'log',
] as const;

export type Grupo = (typeof GRUPOS)[number];

/**
 * Se decide por el prefijo de la accion, no con una lista de las veintitantas
 * que hay: asi una accion nueva del catalogo cae sola en su cajon en vez de
 * quedarse fuera del desplegable sin que nadie lo note.
 *
 * Las lecturas son la excepcion y van explicitas. `booking.viewed` empieza
 * por `booking` pero no es un movimiento de la reserva: es alguien mirando
 * los datos de un cliente, que es justo lo que interesa poder filtrar solo.
 */
export function grupoDe(accion: string): Grupo {
  if (accion === 'booking.viewed' || accion === 'access_notes.viewed') return 'sensitive';
  if (accion.startsWith('session.')) return 'access';
  if (accion.startsWith('booking.')) return 'bookings';
  if (accion.startsWith('payment.')) return 'money';
  if (accion.startsWith('staff.')) return 'staff';
  if (accion.startsWith('settings.') || accion.startsWith('notifications.')) return 'settings';
  return 'log';
}
