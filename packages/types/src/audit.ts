import { z } from 'zod';
import { BookingStatusSchema } from './booking';

/**
 * RASTRO DE QUIEN HIZO QUE
 * ------------------------
 * El registro de auditoria existe desde la etapa 2.3 y ya guardaba los
 * cambios importantes. Lo que faltaba era todo lo demas: quien entro y
 * cuando, quien reservo desde el sitio, quien MIRO datos de un cliente sin
 * tocar nada, y —sobre todo— alguna forma de leerlo que no fuera abrir la
 * base de datos.
 *
 * TRES REGLAS QUE DEFINEN ESTE MODULO:
 *
 * 1. SOLO SE INSERTA Y SE LEE. No hay forma de editar ni de borrar una
 *    entrada desde la aplicacion. Un registro que se puede modificar no
 *    prueba nada, y el dia que haga falta sera justo cuando alguien tenga
 *    motivos para quererlo cambiar.
 *
 * 2. CONSULTAR LA AUDITORIA TAMBIEN DEJA RASTRO. Es lo que impide que quien
 *    tiene acceso investigue a sus companeros sin que se sepa.
 *
 * 3. AQUI NO SE GUARDAN DATOS SENSIBLES. Ni tarjetas, ni contrasenas, ni
 *    codigos de puerta. Que alguien miro las instrucciones de acceso de una
 *    casa se registra; CUALES eran, no. Si no, el propio registro se
 *    convierte en el sitio mas jugoso del sistema.
 */

/* -------------------------------------------------------------------------- */
/*  Desde donde                                                               */
/* -------------------------------------------------------------------------- */

/**
 * La superficie desde la que se hizo algo.
 *
 * No se deduce del rol ni de la accion: coordinacion puede marcar un trabajo
 * desde el panel en la oficina o desde el movil en la calle, y para investigar
 * un problema esa diferencia importa.
 *
 * `FIELD` esta previsto y hoy NO LO USA NADIE: el equipo de limpieza entra al
 * mismo panel, pantalla «Mis trabajos». Se deja declarado para que el dia que
 * exista la aplicacion de campo no haya que migrar la tabla; mientras tanto,
 * ninguna fila lo lleva.
 */
export const AuditSurfaceSchema = z.enum([
  /** El panel de administracion, sea cual sea la pantalla. */
  'PANEL',
  /** El sitio publico: reservas y cotizaciones. */
  'SITE',
  /** Nadie: un barrido programado, un webhook, el arranque. */
  'SYSTEM',
  /** Reservado para la futura aplicacion de campo. Sin uso hoy. */
  'FIELD',
]);
export type AuditSurface = z.infer<typeof AuditSurfaceSchema>;

/** Quien actua. Coincide con el enumerado de la base de datos. */
export const AuditActorTypeSchema = z.enum(['SYSTEM', 'STAFF', 'CUSTOMER']);
export type AuditActorType = z.infer<typeof AuditActorTypeSchema>;

/* -------------------------------------------------------------------------- */
/*  Que paso                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * CATALOGO DE ACCIONES.
 *
 * Esta escrito a mano y no se genera solo, a proposito: una accion nueva
 * obliga a pasar por aqui y a pensar si de verdad hace falta. Sin catalogo,
 * una errata («bokking.created») crea en silencio una accion que no aparece
 * en ningun filtro y que nadie echa de menos hasta que la busca.
 *
 * El formato es `entidad.pasado`, en minusculas. En pasado porque describe
 * algo que YA ocurrio: la auditoria no registra intenciones.
 */
const ACCIONES_FIJAS = [
  /* --- Acceso ---------------------------------------------------------- */
  /** Alguien abrio sesion en el panel. Una fila por acceso, no por pestana. */
  'session.opened',
  /** Cerro sesion a proposito. Su AUSENCIA no significa nada: ver abajo. */
  'session.closed',
  /** Tenia credenciales validas pero su rol no alcanzaba. */
  'session.denied',

  /* --- Reservas -------------------------------------------------------- */
  /** Un cliente reservo desde el sitio publico. */
  'booking.created',
  'booking.team_changed',

  /* --- Dinero ---------------------------------------------------------- */
  'payment.captured',
  'payment.released',

  /* --- Personal -------------------------------------------------------- */
  'staff.created',
  'staff.updated',
  'staff.invited',
  /**
   * Se le volvio a mandar la invitacion.
   *
   * Se distingue de la primera a proposito: tres reenvios seguidos a la
   * misma persona cuentan una historia —el correo no llega, o va a una
   * direccion equivocada— que «invitada» a secas esconderia.
   */
  'staff.reinvited',
  /**
   * Se le mando un enlace para volver a elegir contrasena, a peticion suya
   * desde la pantalla de acceso.
   *
   * SOLO SE REGISTRA CUANDO EL ENLACE SALE DE VERDAD. Una peticion para un
   * correo que no existe no deja fila: si la dejara, este registro seria
   * una lista de las direcciones que alguien ha ido probando, ordenadas por
   * hora, dentro de la propia herramienta que existe para detectar eso.
   */
  'staff.recovery_sent',

  /* --- Configuracion --------------------------------------------------- */
  'settings.updated',
  'notifications.updated',
  /**
   * Cambio el area de servicio: hasta donde se va y donde el precio sale
   * solo.
   *
   * Se distingue de `settings.updated` porque no es lo mismo cambiar un
   * telefono que cambiar hasta donde llega la empresa: lo segundo mueve
   * dinero en cada reserva que entre despues.
   */
  'service_area.updated',
  /**
   * Se movio la ubicacion de la empresa.
   *
   * Accion propia porque es el origen desde el que se mide TODO: cambiarla
   * recalcula la distancia, el traslado y la zona de cada reserva
   * posterior. La metadata guarda cuantas millas se movio, que es lo que
   * de verdad explica por que los precios de esta semana no cuadran con
   * los de la pasada.
   */
  'company_location.updated',
  /**
   * Cambiaron las tarifas.
   *
   * Tiene accion propia y no `settings.updated` por lo mismo que el area de
   * servicio, y con mas motivo: cambiar un precio mueve dinero en CADA
   * reserva posterior. Ante una reclamacion, la pregunta es «quien subio
   * este precio y cuando», y tiene que responderse con un filtro, no
   * leyendo cincuenta cambios de telefono.
   */
  'pricing.updated',
  /**
   * Cambiaron los textos que el sitio publica: las promesas y las preguntas
   * frecuentes.
   *
   * Accion propia porque lo que se edita aqui son COMPROMISOS —el seguro, la
   * verificacion de antecedentes, la garantia, el plazo para cancelar—, y
   * ante una reclamacion la pregunta es «que prometia la web el dia que este
   * cliente reservo». Mezclado con los cambios de telefono, eso no se
   * responde.
   *
   * La metadata guarda que claves cambiaron y sus valores. No hay nada
   * secreto: es texto escrito para publicarse.
   */
  'site_copy.updated',

  /* --- Lecturas de datos sensibles ------------------------------------- */
  /** Alguien abrio la ficha completa de una reserva, con datos del cliente. */
  'booking.viewed',
  /**
   * Alguien vio las instrucciones de acceso a una casa: codigo de la puerta,
   * donde esta la llave. Se registra QUE se vieron, nunca CUALES son.
   */
  'access_notes.viewed',
  /** Alguien consulto el propio registro de auditoria. */
  'audit.queried',
  /**
   * La purga automatica borro entradas caducadas.
   *
   * El registro cuenta lo que se ha quitado de si mismo. Sin esta fila,
   * un hueco en el historial es indistinguible de un borrado a mano, que
   * es justo la duda que la auditoria existe para despejar.
   */
  'audit.purged',
] as const;

/**
 * El cambio de estado de una reserva genera una accion POR ESTADO
 * (`booking.status.confirmed`, `booking.status.cancelled`...) en vez de una
 * sola `booking.status_changed`.
 *
 * Es deliberado y se hereda de la etapa 2.3: permite filtrar «ensename todas
 * las cancelaciones» sin tener que mirar dentro de la metadata de cada fila.
 * Se derivan del propio catalogo de estados para que anadir un estado nuevo
 * no deje su accion fuera.
 */
const ACCIONES_DE_ESTADO = BookingStatusSchema.options.map(
  (estado) => `booking.status.${estado.toLowerCase()}` as const,
);

export const AUDIT_ACTIONS = [...ACCIONES_FIJAS, ...ACCIONES_DE_ESTADO] as const;

export const AuditActionSchema = z.enum(AUDIT_ACTIONS as unknown as [string, ...string[]]);
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * SOBRE QUE.
 *
 * Tambien va en catalogo, y no por manía: al escribirlo se encontro que la
 * misma entidad estaba guardada con TRES grafias distintas —`booking`,
 * `Booking` y, en personal, `Staff`—, segun quien hubiera escrito cada
 * llamada. Filtrar «todo lo que le paso a esta reserva» devolvia la mitad de
 * las filas y nadie se habia dado cuenta, porque el resultado parecia
 * plausible.
 *
 * En minusculas y en singular, igual que el prefijo de las acciones.
 */
export const AuditEntityTypeSchema = z.enum([
  'booking',
  'staff',
  'business_settings',
  /** El propio registro, cuando alguien lo consulta. */
  'audit',
  /** Una sesion del panel. */
  'session',
]);
export type AuditEntityType = z.infer<typeof AuditEntityTypeSchema>;

/* -------------------------------------------------------------------------- */
/*  Lo que devuelve la consulta                                               */
/* -------------------------------------------------------------------------- */

export const AuditLogItemSchema = z.object({
  id: z.uuid(),
  occurredAt: z.iso.datetime(),
  surface: AuditSurfaceSchema,
  actorType: AuditActorTypeSchema,
  /** Identificador de la ficha de personal. Nulo si actuo el sistema o un cliente. */
  actorId: z.uuid().nullable(),
  /**
   * Nombre de quien actuo, resuelto al consultar.
   *
   * Se resuelve en la lectura y NO se copia en la fila: si alguien se cambia
   * el apellido, el historial entero pasa a mostrar el nuevo, que es lo que
   * se espera. Queda `null` cuando la ficha ya no existe; el identificador
   * sigue ahi, que es lo que de verdad importa para investigar.
   */
  actorName: z.string().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().nullable(),
  /**
   * Detalle de lo ocurrido. Contenido libre y por eso `unknown`: cada accion
   * guarda lo suyo. Quien lo pinte tiene que tratarlo como texto, nunca como
   * marcado.
   */
  metadata: z.unknown().nullable(),
  ipAddress: z.string().nullable(),
});
export type AuditLogItem = z.infer<typeof AuditLogItemSchema>;

/* -------------------------------------------------------------------------- */
/*  Como se pregunta                                                          */
/* -------------------------------------------------------------------------- */

/** Tope por pagina. Alto para poder repasar un dia entero; no ilimitado. */
export const AUDIT_PAGE_MAX = 100;
export const AUDIT_PAGE_DEFAULT = 50;

export const AuditQuerySchema = z.object({
  /** Todo lo que hizo una persona. */
  actorId: z.uuid().optional(),
  /** Una accion concreta del catalogo. */
  action: AuditActionSchema.optional(),
  surface: AuditSurfaceSchema.optional(),
  /** Todo lo que le paso a una reserva, a una ficha de personal... */
  entityType: AuditEntityTypeSchema.optional(),
  entityId: z.string().trim().min(1).max(80).optional(),
  /** Desde y hasta, en formato de fecha y hora completa. */
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(AUDIT_PAGE_MAX).default(AUDIT_PAGE_DEFAULT),
  /**
   * Paginacion POR CURSOR y no por numero de pagina.
   *
   * La tabla crece por el extremo nuevo constantemente: con `?page=3`, una
   * entrada que llega mientras se lee empuja a las demas y se acaba viendo
   * dos veces la misma fila y saltandose otra. El cursor es el instante de la
   * ultima fila leida, asi que eso no puede pasar.
   */
  before: z.iso.datetime().optional(),
});
export type AuditQuery = z.infer<typeof AuditQuerySchema>;
/**
 * Lo que se manda, antes de aplicar valores por defecto.
 *
 * `limit` es obligatorio DESPUES de validar y opcional al pedir: quien
 * consulta desde el panel no tiene por que elegir tamano de pagina.
 */
export type AuditQueryInput = z.input<typeof AuditQuerySchema>;

export const AuditPageSchema = z.object({
  items: z.array(AuditLogItemSchema),
  /** Cursor para la siguiente pagina. `null` cuando no queda nada mas. */
  nextBefore: z.iso.datetime().nullable(),
});
export type AuditPage = z.infer<typeof AuditPageSchema>;
