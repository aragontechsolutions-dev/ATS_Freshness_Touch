import { z } from 'zod';
import { LocaleSchema, type Locale } from './enums';
import { GalleryPhotoPathSchema, YouTubeVideoIdSchema } from './gallery';

/**
 * EL REGISTRO DE CONSENTIMIENTOS
 * ==============================
 * El papel que firma un cliente autorizando que se publique el interior de
 * su casa, anotado aqui y ATADO A LAS PIEZAS QUE AMPARA.
 *
 * ========================================================================
 * POR QUE ESTO NO ES UNA HOJA DE CALCULO
 * ========================================================================
 * El permiso promete dos cosas que solo se pueden cumplir si el sistema sabe
 * de quien es cada pieza:
 *
 *   1. QUE SE PUEDE RETIRAR. Un cliente escribe diciendo que ya no quiere
 *      que salga su casa. Sin este registro, cumplirlo significa revisar el
 *      canal entero a ojo intentando reconocer una cocina.
 *
 *   2. QUE SE RETIRA EN UN PLAZO. Prometer «en cinco dias» obliga a poder
 *      hacerlo, y a poder demostrar cuando se hizo.
 *
 * Aqui revocar es un boton: las piezas que ampara ese permiso DEJAN DE
 * SERVIRSE al momento, sin que nadie tenga que acordarse de borrarlas. El
 * plazo prometido pasa a ser el tiempo que se tarda en pulsar.
 *
 * ========================================================================
 * ESTO NO SALE NUNCA AL SITIO PUBLICO
 * ========================================================================
 * Lleva el nombre del cliente y LA DIRECCION DE SU CASA. Es justo lo que el
 * permiso promete no mostrar, asi que vive en su propia tabla, se lee solo
 * desde administracion, y de la galeria publica solo sale el efecto: la
 * pieza esta o no esta.
 *
 * El modelo del papel, lo que nunca puede entrar en el encuadre y el
 * procedimiento de retirada estan en
 * `docs/38-fotos-y-videos-antes-y-despues.md`.
 */

// ---------------------------------------------------------------------------
// Donde se puede publicar
// ---------------------------------------------------------------------------

/**
 * Los sitios que el permiso enumera.
 *
 * SE GUARDAN AUNQUE SOLO PUBLIQUEMOS EN LA WEB, porque el papel los enumera
 * uno a uno y lo que se firmo es lo que vale. Si manana se publica en
 * Facebook y el papel no lo decia, no hay permiso para eso — y sin tenerlo
 * anotado, nadie podria saberlo.
 */
export const CONSENT_CHANNELS = ['WEBSITE', 'FACEBOOK', 'INSTAGRAM', 'YOUTUBE'] as const;
export const ConsentChannelSchema = z.enum(CONSENT_CHANNELS);
export type ConsentChannel = z.infer<typeof ConsentChannelSchema>;

// ---------------------------------------------------------------------------
// Como se obtuvo
// ---------------------------------------------------------------------------

/**
 * POR QUE EL MEDIO ES UN DATO Y NO UN DETALLE.
 *
 * El modelo nacio suponiendo un papel firmado en la casa, y ese supuesto no
 * aguanta el caso NORMAL: en una limpieza de mudanza la casa esta vacia, en
 * una recurrente el cliente esta trabajando, y hay clientes que contratan
 * desde otro estado. Si el permiso solo se puede obtener en el salon, no se
 * obtiene casi nunca.
 *
 * Una firma electronica es una firma —lo dicen la E-SIGN Act federal y la
 * UETA de Georgia— siempre que se pueda acreditar quien, que y cuando. Lo
 * que no vale es lo que no se puede demostrar: una llamada de telefono, el
 * silencio de quien no contesta, una casilla premarcada.
 *
 * Por eso aqui se anota POR QUE VIA llego, y no para distinguir «bueno» de
 * «malo»: los cuatro valen. Es para saber DONDE ESTA LA PRUEBA el dia que
 * haga falta ensenarla. Un escaneo esta en el archivador; un formulario
 * web, en la fila de la reserva; un correo, en el buzon.
 */
/**
 * LA PRUEBA EN SI, NO SU REFERENCIA.
 * ----------------------------------
 * Hasta aqui el registro guardaba el NUMERO del papel, no el papel. El dia
 * que haya que demostrar un permiso, una referencia a un PDF que esta en el
 * correo de alguien no sirve de nada.
 *
 * ESTE ARCHIVO NO PUEDE VIVIR DONDE VIVEN LAS FOTOS. El almacen de la
 * galeria es PUBLICO —son imagenes hechas para que las vea todo internet— y
 * esto lleva el nombre del cliente, la direccion de su casa y su firma. Va a
 * un almacen privado y se sirve a traves de la API, detras de la sesion del
 * panel: nunca tiene una direccion que funcione sin ella.
 *
 * Se admite PDF porque un correo impreso y un documento firmado con una
 * herramienta de firma electronica llegan asi. Nada de SVG, por lo mismo que
 * en la galeria: un SVG es un documento que puede llevar JavaScript dentro.
 */
export const CONSENT_EVIDENCE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export const ConsentEvidenceTypeSchema = z.enum(CONSENT_EVIDENCE_TYPES);
export type ConsentEvidenceType = z.infer<typeof ConsentEvidenceTypeSchema>;

/**
 * Diez megas. Un escaneo de varias paginas pesa mas que una foto de movil, y
 * aqui no hay nada que pintar en una pagina: no se gana nada apretandolo.
 */
export const CONSENT_EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * La ruta dentro del almacen privado. LA COMPONE EL SERVIDOR, nunca quien
 * sube: un nombre elegido por quien sube es un nombre que puede apuntar a
 * otra carpeta.
 */
export const CONSENT_EVIDENCE_PATH_PATTERN = /^evidence\/[0-9a-f]{32}\.(pdf|jpg|png|webp)$/;
export const ConsentEvidencePathSchema = z
  .string()
  .regex(CONSENT_EVIDENCE_PATH_PATTERN, 'Esa no es una ruta de prueba');

/** La extension que le toca a cada tipo, para componer la ruta. */
export function consentEvidenceExtension(tipo: ConsentEvidenceType): string {
  if (tipo === 'application/pdf') return 'pdf';
  if (tipo === 'image/jpeg') return 'jpg';
  if (tipo === 'image/png') return 'png';
  return 'webp';
}

/** Y al reves: con que tipo se devuelve lo que se guardo. */
export function consentEvidenceType(path: string): ConsentEvidenceType | null {
  if (path.endsWith('.pdf')) return 'application/pdf';
  if (path.endsWith('.jpg')) return 'image/jpeg';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.webp')) return 'image/webp';
  return null;
}

export const CONSENT_EVIDENCE_KINDS = [
  /** Papel firmado a mano y archivado. */
  'SIGNED_PAPER',
  /** Casilla marcada en el formulario de reserva. */
  'WEB_FORM',
  /** Correo del cliente diciendo que si, por escrito. */
  'EMAIL',
  /** Mensaje escrito: WhatsApp, SMS. */
  'MESSAGE',
] as const;
export const ConsentEvidenceKindSchema = z.enum(CONSENT_EVIDENCE_KINDS);
export type ConsentEvidenceKind = z.infer<typeof ConsentEvidenceKindSchema>;

// ---------------------------------------------------------------------------
// El papel
// ---------------------------------------------------------------------------

/** Ni saltos de linea ni caracteres invisibles, igual que el resto de textos. */
const SIN_CONTROLES = /^[^\p{Cc}\p{Cf}]*$/u;

function texto(max: number) {
  return z.string().trim().min(1).max(max).regex(SIN_CONTROLES);
}

/** Una fecha sin hora, tal y como se escribe en un papel. */
const FechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha va como AAAA-MM-DD');

export const CONSENT_REFERENCE_MAX = 40;
export const CONSENT_NAME_MAX = 120;
export const CONSENT_ADDRESS_MAX = 200;
export const CONSENT_NOTES_MAX = 500;

/**
 * El plazo de retirada que promete el papel, en dias.
 *
 * Con tope porque prometer mas de un mes no es una promesa. El documento
 * recomienda cinco dias laborables; «inmediatamente» no se puede cumplir un
 * domingo y por eso el minimo no es cero.
 */
export const CONSENT_REMOVAL_DAYS_MIN = 1;
export const CONSENT_REMOVAL_DAYS_MAX = 30;

/**
 * Lo que la duena decidio y lo que el panel propone al crear una ficha.
 *
 * No es un tope ni una regla: un papel concreto puede prometer otra cosa y
 * se teclea. Es el valor que evita que cada ficha lo invente.
 */
export const CONSENT_REMOVAL_DAYS_DEFAULT = 5;

export const MediaConsentSchema = z
  .strictObject({
    /**
     * Lo que va escrito en el papel, para poder emparejar el escaneo.
     *
     * Lo teclea quien archiva, no lo inventa el sistema: el numero util es
     * el que de verdad esta impreso en la hoja que hay en el cajon.
     */
    reference: texto(CONSENT_REFERENCE_MAX),

    /**
     * Por que via llego el permiso, para saber donde esta la prueba.
     *
     * Con valor por defecto porque las fichas anotadas antes de que esto
     * existiera son todas de papel firmado: es lo unico que el panel
     * permitia anotar entonces.
     */
    evidenceKind: ConsentEvidenceKindSchema.default('SIGNED_PAPER'),

    customerName: texto(CONSENT_NAME_MAX),

    /**
     * EL CORREO DEL CLIENTE, PARA PODER DEVOLVERLE EL CONTROL.
     *
     * Sin esto, el registro sabe de quien es cada foto pero no tiene forma
     * de escribirle, y entonces retirar depende SIEMPRE de que el cliente
     * sepa a quien dirigirse y de que alguien del equipo lea su mensaje.
     *
     * Con esto se le puede mandar constancia de lo que autorizo y un enlace
     * que lo retira al momento, sin intermediarios.
     *
     * NULO PARA LAS FICHAS DE PAPEL en las que nadie lo apunto. No es
     * obligatorio: un permiso firmado sin correo sigue siendo un permiso.
     * Lo que no tiene es salida automatica.
     *
     * NUNCA sale al sitio publico ni al registro de auditoria.
     */
    customerEmail: z.string().trim().toLowerCase().email().max(160).nullable().default(null),

    /**
     * EN QUE IDIOMA SE LE ESCRIBE.
     *
     * Porque lo que se le manda —la constancia de lo que autorizo y el
     * enlace que lo retira— tiene que poder leerlo. Mandarle a alguien, en
     * un idioma que no entiende, un correo que habla de publicar fotos de
     * su casa es la peor version posible de este correo: ni sirve de
     * constancia ni se atreve a pulsar el boton.
     *
     * Es el mismo criterio que ya rige para la invitacion al panel. Cuando
     * el permiso viene de una reserva se sabe —lo eligio al reservar—; en
     * una ficha de papel lo elige quien la anota.
     */
    customerLocale: LocaleSchema.default('en'),

    /** La casa. NUNCA sale al sitio publico. */
    propertyAddress: texto(CONSENT_ADDRESS_MAX),

    /**
     * Si en la vivienda vive alguien que no es quien firma.
     *
     * El caso del dueno ausente que alquila: el dueno puede autorizar su
     * propiedad, pero en las imagenes salen los muebles, la ropa y los
     * objetos del INQUILINO, y sobre la vida privada de otro no se puede dar
     * permiso. Lo mismo que ya se exige para los empleados que salen en un
     * video: hacen falta los dos permisos, o no se publica.
     */
    occupiedByOthers: z.boolean().default(false),

    /** Si el permiso de quien habita la vivienda tambien esta obtenido. */
    occupantConsent: z.boolean().default(false),

    serviceDate: FechaSchema,
    /** Cuando se dio el permiso: se firmo, se marco la casilla o se escribio. */
    signedAt: FechaSchema,

    /** Que se autorizo grabar. Al menos una de las dos. */
    coversInterior: z.boolean(),
    coversExterior: z.boolean(),

    /**
     * Si se autorizan las imagenes del «antes».
     *
     * Su propia casilla porque es la parte sensible: el «antes» es, por
     * definicion, la casa sucia de una persona concreta.
     */
    allowsBefore: z.boolean(),

    channels: z.array(ConsentChannelSchema).min(1, 'El permiso tiene que decir donde'),
    removalDays: z.int().min(CONSENT_REMOVAL_DAYS_MIN).max(CONSENT_REMOVAL_DAYS_MAX),

    /** Las piezas que ampara. Es lo que convierte esto en algo util. */
    videoIds: z.array(YouTubeVideoIdSchema).default([]),
    photoPaths: z.array(GalleryPhotoPathSchema).default([]),

    notes: z.string().trim().max(CONSENT_NOTES_MAX).regex(SIN_CONTROLES).nullable().default(null),
  })
  .refine((c) => c.coversInterior || c.coversExterior, {
    message: 'El permiso tiene que cubrir el interior, el exterior o los dos',
    path: ['coversInterior'],
  })
  /*
   * SI AMPARA ALGUNA PIEZA, EL PAPEL TIENE QUE PERMITIR LA WEB.
   *
   * Es donde se publica. Un permiso que solo autoriza Instagram no autoriza
   * la portada, y sin esta comprobacion se podria atar una foto a un papel
   * que no la cubre — que es peor que no tener papel, porque parece que si.
   */
  .refine(
    (c) => (c.videoIds.length === 0 && c.photoPaths.length === 0) || c.channels.includes('WEBSITE'),
    {
      message: 'Para publicar en la web, el permiso tiene que autorizar la web',
      path: ['channels'],
    },
  )
  /*
   * SI VIVE ALLI UN TERCERO Y NO HA DADO SU PERMISO, ESTE NO AMPARA NADA.
   *
   * La ficha se puede anotar igual —es util saber que existe y que falta la
   * otra mitad— pero no puede llevar piezas atadas, y sin piezas atadas el
   * modo estricto no publica ninguna. La regla se cumple sola en vez de
   * depender de que alguien se acuerde.
   */
  .refine(
    (c) =>
      !c.occupiedByOthers ||
      c.occupantConsent ||
      (c.videoIds.length === 0 && c.photoPaths.length === 0),
    {
      message: 'Si vive alli alguien mas, hace falta tambien su permiso',
      path: ['occupantConsent'],
    },
  );

export type MediaConsent = z.infer<typeof MediaConsentSchema>;

// ---------------------------------------------------------------------------
// Lo que devuelve el panel
// ---------------------------------------------------------------------------

/**
 * Una ficha completa tal y como la lee el panel.
 *
 * ES TOLERANTE CON CAMPOS NUEVOS, como todo lo que lee un navegador: el
 * panel y la API se despliegan por separado, y un contrato estricto aqui
 * vaciaria la pantalla entera el dia que la API devuelva un campo de mas.
 * Ver `lo-que-lee-la-web-tolera-campos-nuevos.test.ts`.
 */
export const StoredMediaConsentSchema = z.object({
  id: z.uuid(),
  consent: MediaConsentSchema,
  /**
   * La prueba guardada, o `null` si solo esta anotada la referencia.
   *
   * Es una ruta dentro del almacen PRIVADO, no una direccion: no se puede
   * abrir pegandola en el navegador. El panel la pide a la API con su sesion.
   */
  evidencePath: ConsentEvidencePathSchema.nullable().default(null),

  /**
   * Si este cliente tiene enlace para retirar sus fotos el solo.
   *
   * UN SI O UN NO, NUNCA EL ENLACE. El panel lo necesita para no prometer
   * una salida automatica a quien no la tiene —una ficha de papel sin
   * correo—, pero el testigo no puede viajar hasta un navegador: ahi se
   * queda en la memoria de la pestana y en cualquier extension instalada.
   */
  hasRemovalLink: z.boolean().default(false),

  /**
   * EL DIA QUE EL CLIENTE PIDIO LA RETIRADA, o `null` si no la ha pedido.
   *
   * ========================================================================
   * POR QUE NO BASTA CON `revokedAt`
   * ========================================================================
   * Retirar es un boton y despublica al momento, asi que si se mira solo
   * `revokedAt` el plazo se cumple SIEMPRE: parece que se tardo cero.
   *
   * Pero el reloj no empieza cuando alguien pulsa, empieza cuando el cliente
   * escribe. El hueco peligroso es justo ese —entre que llega el correo y
   * que alguien entra al panel— y es el unico tramo donde se puede incumplir
   * una promesa de cinco dias. Sin anotar cuando se pidio, ese hueco no
   * existe para el sistema y no se puede avisar de nada.
   *
   * Va aqui y no en el contrato del papel porque no es algo que el cliente
   * firmara: es algo que paso despues.
   */
  removalRequestedAt: FechaSchema.nullable().default(null),

  /** Cuando se retiro el permiso, o `null` si sigue en pie. */
  revokedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  /** Quien lo anoto por ultima vez. `null` si esa persona ya no esta. */
  updatedBy: z.string().nullable(),
});
export type StoredMediaConsent = z.infer<typeof StoredMediaConsentSchema>;

// ---------------------------------------------------------------------------
// El permiso que se pide al reservar
// ---------------------------------------------------------------------------

/**
 * LA VERSION DEL TEXTO QUE SE ACEPTO.
 *
 * Un permiso vale por lo que decia el texto que la persona leyo, no por lo
 * que diga hoy la pagina. Si manana se reescribe —se anade un canal, se
 * cambia el plazo—, los permisos de ayer siguen amparando lo de ayer, y hace
 * falta poder saber cual de los dos firmaron.
 *
 * SE SUBE AL CAMBIAR EL TEXTO. No cambiarlo al cambiarlo es peor que no
 * tenerlo, porque entonces el numero miente.
 */
export const BOOKING_CONSENT_TEXT_VERSION = 1;

/**
 * Lo que se marca en el formulario de reserva.
 *
 * ========================================================================
 * TRES CASILLAS Y NO UNA
 * ========================================================================
 * Porque son tres decisiones distintas y juntarlas seria arrancar con una
 * sola marca cosas que la persona no ha pensado:
 *
 *   1. `granted` — si se puede publicar la casa. Sin esto no hay nada.
 *   2. `allowsBefore` — si se puede publicar el «antes». Es la parte
 *      sensible: el «antes» es, por definicion, su casa sucia. Va aparte por
 *      la misma razon que va aparte en el panel.
 *   3. `occupiedByOthers` — si la vivienda la habita alguien que no es quien
 *      reserva. Es el caso del dueno que alquila: puede autorizar su
 *      propiedad, pero los muebles y la ropa del plano son del inquilino.
 *
 * ========================================================================
 * TODO EN FALSO POR DEFECTO, Y NO SOLO POR HIGIENE
 * ========================================================================
 * Una casilla premarcada no es un permiso. Y ademas el sitio y la API se
 * despliegan por separado: una reserva enviada por una version anterior del
 * formulario no trae este campo, y lo que tiene que ocurrir entonces es que
 * NO haya permiso — nunca que se suponga uno que nadie dio.
 */
export const BookingMediaConsentSchema = z.strictObject({
  granted: z.boolean().default(false),
  allowsBefore: z.boolean().default(false),
  occupiedByOthers: z.boolean().default(false),
});
export type BookingMediaConsent = z.infer<typeof BookingMediaConsentSchema>;

export const BOOKING_CONSENT_NONE: BookingMediaConsent = {
  granted: false,
  allowsBefore: false,
  occupiedByOthers: false,
};

/**
 * Lo que una reserva con permiso deja anotado en el registro.
 *
 * ESTO NO ES UN ATAJO: es el mismo contrato que una ficha tecleada en el
 * panel, relleno con lo que la reserva ya sabe. Se construye aqui, y no en
 * la API, para que el texto del formulario y lo que queda escrito no puedan
 * separarse sin que se note en una prueba.
 *
 * NACE SIN PIEZAS. El video todavia no existe cuando se reserva; se le atan
 * despues desde el panel. El contrato lo admite: la regla que exige
 * autorizar la web solo se aplica a las fichas que amparan algo.
 */
export function consentFromBooking(datos: {
  marcado: BookingMediaConsent;
  reference: string;
  customerName: string;
  /** El de la reserva: es lo que hace posible devolverle el control. */
  customerEmail: string;
  /** El que eligio al reservar: en ese idioma se le escribe. */
  customerLocale: Locale;
  propertyAddress: string;
  serviceDate: string;
  signedAt: string;
}): MediaConsent {
  return {
    reference: datos.reference,
    evidenceKind: 'WEB_FORM',
    customerName: datos.customerName,
    customerEmail: datos.customerEmail,
    customerLocale: datos.customerLocale,
    propertyAddress: datos.propertyAddress,
    occupiedByOthers: datos.marcado.occupiedByOthers,
    /*
     * Quien reserva no puede dar el permiso de quien vive alli. Si dice que
     * la vivienda la habita otra persona, la ficha queda anotada con la
     * mitad que falta a la vista, y sin ese segundo permiso no podra llevar
     * piezas atadas.
     */
    occupantConsent: false,
    serviceDate: datos.serviceDate,
    signedAt: datos.signedAt,
    /*
     * El texto del formulario habla de «la vivienda que limpiamos», por
     * dentro y por fuera. Si algun dia se parte en dos casillas, esto tiene
     * que seguirlo y el numero de version tiene que subir.
     */
    coversInterior: true,
    coversExterior: true,
    allowsBefore: datos.marcado.allowsBefore,
    /*
     * SOLO LA WEB. El texto del formulario autoriza la pagina, no las redes
     * sociales: publicar en Facebook con un permiso que no las nombra es
     * publicar sin permiso. Anadirlas exige cambiar el texto y subir la
     * version.
     */
    channels: ['WEBSITE'],
    removalDays: CONSENT_REMOVAL_DAYS_DEFAULT,
    videoIds: [],
    photoPaths: [],
    notes: `Formulario de reserva, texto v${String(BOOKING_CONSENT_TEXT_VERSION)}`,
  };
}

// ---------------------------------------------------------------------------
// El plazo de retirada
// ---------------------------------------------------------------------------

/**
 * Lo que se manda al anotar que un cliente pidio la retirada.
 *
 * UN OBJETO PARA UN SOLO CAMPO, y no la fecha suelta, porque el dia que haya
 * que anotar tambien por donde llego la peticion —correo, mensaje— se anade
 * una clave y las peticiones anteriores siguen valiendo. Con una fecha suelta
 * en el cuerpo, ese dia hay que cambiar el contrato entero.
 */
export const RemovalRequestSchema = z.strictObject({
  requestedAt: FechaSchema,
});
export type RemovalRequest = z.infer<typeof RemovalRequestSchema>;

/** Suma dias a una fecha `AAAA-MM-DD`, en UTC, sin arrastrar husos. */
function sumarDias(fecha: string, dias: number): string {
  const base = new Date(`${fecha}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + dias);
  return base.toISOString().slice(0, 10);
}

/** Dias enteros de `desde` a `hasta`. Negativo si `hasta` ya paso. */
function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T00:00:00Z`);
  const b = Date.parse(`${hasta}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

/** El dia en que vence lo que el papel prometio. */
export function removalDeadline(requestedAt: string, removalDays: number): string {
  return sumarDias(requestedAt, removalDays);
}

export interface RemovalState {
  /** El cliente ha pedido la retirada. */
  requested: boolean;
  /** Ya se retiro: la promesa esta cumplida. */
  fulfilled: boolean;
  /** El dia en que vence, o `null` si no se ha pedido nada. */
  deadline: string | null;
  /** Dias que quedan. Negativo si ya se paso. `null` si no aplica. */
  daysLeft: number | null;
  /** Se paso el plazo y la pieza sigue publicada. */
  overdue: boolean;
}

/** Lo minimo que hace falta para situar una promesa de retirada. */
export interface RemovalFacts {
  /** El dia que el cliente lo pidio, o `null` si no lo ha pedido. */
  requestedAt: string | null;
  /** Los dias que promete ese papel. */
  removalDays: number;
  /** Si ya se retiro. */
  revoked: boolean;
}

/**
 * En que punto esta la promesa de retirada.
 *
 * UNA SOLA FUNCION PARA LOS TRES SITIOS que lo preguntan —el panel, el
 * barrido que avisa y las pruebas—, porque es una cuenta con un borde
 * resbaladizo: el dia del vencimiento todavia NO esta vencido. Escrita tres
 * veces, uno de los tres se habria quedado con el borde al reves.
 *
 * TOMA CUATRO DATOS Y NO LA FICHA ENTERA. El barrido lee de la base solo lo
 * que necesita para decidir —son cuatro columnas de una tabla que lleva
 * nombres y direcciones— y con una firma que pidiera la ficha completa
 * tendria que cargarla igualmente para hacer una resta.
 */
export function removalState(datos: RemovalFacts, hoy: string): RemovalState {
  const { requestedAt } = datos;

  if (requestedAt === null) {
    return { requested: false, fulfilled: false, deadline: null, daysLeft: null, overdue: false };
  }

  const deadline = removalDeadline(requestedAt, datos.removalDays);
  const fulfilled = datos.revoked;
  const daysLeft = diasEntre(hoy, deadline);

  return {
    requested: true,
    fulfilled,
    deadline,
    daysLeft,
    /*
     * El dia del vencimiento NO cuenta como vencido: prometer «en cinco
     * dias» incluye el quinto. Se pasa al sexto.
     */
    overdue: !fulfilled && daysLeft < 0,
  };
}

// ---------------------------------------------------------------------------
// El enlace con el que el cliente retira sus fotos
// ---------------------------------------------------------------------------

/**
 * UN TESTIGO DE RETIRADA ES UNA CREDENCIAL.
 *
 * Quien lo tenga puede despublicar las fotos de esa ficha sin identificarse
 * de ninguna otra forma. Por eso:
 *
 *   - NO SE GUARDA. De el solo queda su resumen criptografico en la fila,
 *     igual que con una contrasena. Ni la base de datos ni una copia de
 *     seguridad robada sirven para retirar nada.
 *   - NO SE ESCRIBE EN NINGUN REGISTRO, ni del servidor ni de auditoria. Es
 *     la misma regla que ya rige para los enlaces de invitacion al panel.
 *   - VIAJA EN EL FRAGMENTO de la direccion (`#t=...`) y no en la ruta. Lo
 *     que va detras de la almohadilla NO LLEGA AL SERVIDOR: no aparece en
 *     los registros del servidor web, ni en la cabecera `Referer` cuando el
 *     navegador salta a otra pagina.
 *
 * ========================================================================
 * LO QUE PUEDE HACER QUIEN LO ROBE
 * ========================================================================
 * Despublicar unas fotos. Nada mas: no lee la ficha, no ve el nombre ni la
 * direccion, no publica nada y no toca ninguna otra. Y es REVERSIBLE desde
 * el panel con el boton de restituir.
 *
 * Es la direccion de fallo que se eligio a proposito. Un enlace que
 * PUBLICARA habria sido lo contrario: irreversible y en el sentido malo.
 */
export const REMOVAL_TOKEN_BYTES = 32;

/** 32 bytes en base64url: 43 caracteres sin relleno. */
export const REMOVAL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const RemovalTokenSchema = z
  .string()
  .regex(REMOVAL_TOKEN_PATTERN, 'Ese no es un enlace de retirada');

/** Lo que el sitio publico manda al pulsar el boton de retirar. */
export const RemovalLinkRequestSchema = z.strictObject({
  token: RemovalTokenSchema,
});
export type RemovalLinkRequest = z.infer<typeof RemovalLinkRequestSchema>;

/**
 * Lo que responde.
 *
 * UN SOLO BOOLEANO, y a proposito: no dice de quien era la ficha, ni cuantas
 * piezas amparaba, ni si el testigo existio alguna vez. Quien llegue con un
 * enlace filtrado no puede sacar de aqui ningun dato.
 *
 * Tolerante con campos nuevos, como todo lo que lee un navegador.
 */
export const RemovalLinkResultSchema = z.object({
  done: z.boolean(),
});
export type RemovalLinkResult = z.infer<typeof RemovalLinkResultSchema>;

/** La ruta de la pagina publica de retirada, dentro del sitio. */
export const REMOVAL_LINK_PATH = '/retirar-fotos';

/**
 * La direccion completa que va en el correo.
 *
 * EL TESTIGO VA DETRAS DE LA ALMOHADILLA, que es lo que hace que no llegue
 * al servidor. La pagina lo lee del fragmento y lo manda en el cuerpo de una
 * peticion, nunca en la direccion.
 */
export function removalLinkUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, '')}${REMOVAL_LINK_PATH}#t=${token}`;
}
