import { DateTime } from 'luxon';
import type { Locale, StaffRole } from '@freshness/types';
import type { EmailMessage } from '../notifications.types';
import { COMPANY_NAME, emailHtml } from './layout';

/**
 * CORREO DE INVITACION AL PANEL
 * -----------------------------
 * Vive aqui, junto a los correos al cliente, y NO en la plantilla del
 * proveedor de identidad. El motivo es el mismo por el que los textos de las
 * reservas estan en el repositorio:
 *
 *   - Se revisa igual que el codigo. Un cambio en lo que le llega a alguien
 *     que acaba de entrar en la empresa pasa por la misma puerta que un
 *     cambio en el cotizador.
 *   - Se puede probar. La plantilla del proveedor solo se comprueba
 *     mandandose correos a uno mismo.
 *   - Y sobre todo: VA EN EL IDIOMA DE LA PERSONA. El proveedor tiene una
 *     sola plantilla para todo el mundo. En una empresa de limpieza en
 *     Georgia, dar la bienvenida en un idioma que la persona no lee es la
 *     peor primera impresion posible.
 *
 * QUE NO LLEVA ESTE CORREO:
 *
 *   - NINGUNA CONTRASENA, ni inicial ni temporal. No existe tal cosa en este
 *     sistema: la persona elige la suya al abrir el enlace. Un correo con una
 *     contrasena dentro se queda para siempre en un buzon.
 *   - NI UNA PALABRA SOBRE OTRAS PERSONAS. Quien invita, que clientes hay,
 *     cuanta gente trabaja aqui: nada de eso ayuda a entrar y todo ello es
 *     informacion interna que viaja por servidores ajenos.
 */

export interface StaffInviteEmailData {
  locale: Locale;
  firstName: string;
  role: StaffRole;
  /**
   * Enlace de un solo uso para elegir contrasena.
   *
   * NUNCA se escribe en un registro. Es una credencial de un solo uso: quien
   * la lea antes que su destinataria entra en su lugar.
   */
  actionLink: string;
  /** Contacto de la empresa, si esta configurado. */
  companyPhone: string | null;
  companyEmail: string | null;
  /** De donde se descarga el logotipo, o `null` para no ponerlo. */
  logoUrl: string | null;
}

/**
 * Lo que necesita el correo de recuperacion.
 *
 * ES EL DE LA INVITACION MENOS EL PUESTO: a quien ya trabaja aqui no hay que
 * recordarle a que se le contrato, y repetirlo en un correo de "has perdido
 * la contrasena" solo anade informacion interna a un mensaje que puede
 * acabar en un buzon ajeno.
 */
export type StaffRecoveryEmailData = Omit<StaffInviteEmailData, 'role'>;

/** Como se llama el puesto en cada idioma, para explicar a que se le invita. */
const PUESTO: Record<Locale, Record<StaffRole, string>> = {
  es: { ADMIN: 'administración', DISPATCHER: 'coordinación', CLEANER: 'limpieza' },
  en: { ADMIN: 'administrator', DISPATCHER: 'dispatcher', CLEANER: 'cleaner' },
};

export function staffInviteEmail(to: string, data: StaffInviteEmailData): EmailMessage {
  const es = data.locale === 'es';
  const puesto = PUESTO[data.locale][data.role];

  const titulo = es ? `Te damos la bienvenida a ${COMPANY_NAME}` : `Welcome to ${COMPANY_NAME}`;

  const parrafos = es
    ? [
        `Hola ${data.firstName}:`,
        `Se ha creado tu acceso al panel de ${COMPANY_NAME} como ${puesto}.`,
        'Para entrar, elige una contraseña con el botón de abajo.',
      ]
    : [
        `Hi ${data.firstName},`,
        `Your access to the ${COMPANY_NAME} panel has been created as ${puesto}.`,
        'To get in, choose a password with the button below.',
      ];

  const boton = es ? 'Elegir mi contraseña' : 'Choose my password';

  /*
   * Se avisa de que caduca y de que sirve una sola vez. Sin decirlo, quien lo
   * abre una semana despues cree que el sistema esta roto en vez de pedir uno
   * nuevo, y lo que hace es llamar por telefono.
   */
  const nota = es
    ? 'Este enlace sirve una sola vez y caduca. Si al abrirlo te dice que ya no vale, pide uno nuevo desde «¿Has olvidado tu contraseña?» en la pantalla de acceso.'
    : 'This link works once and then expires. If it tells you it is no longer valid, request a new one from "Forgot your password?" on the sign-in screen.';

  const aviso = es
    ? 'Si no esperabas este correo, puedes ignorarlo: sin elegir contraseña no se crea ningún acceso.'
    : 'If you were not expecting this email you can ignore it: without choosing a password no access is created.';

  const contacto = pieDeContacto(data, es);

  return {
    to,
    subject: titulo,
    text: [
      titulo,
      '',
      ...parrafos,
      '',
      // En texto plano el enlace va tal cual: no hay boton que pulsar.
      data.actionLink,
      '',
      nota,
      '',
      aviso,
      ...(contacto.length > 0 ? ['', ...contacto] : []),
      '',
      COMPANY_NAME,
    ].join('\n'),
    html: comoHtml({ titulo, parrafos, boton, nota, aviso, contacto, data }),
  };
}

/**
 * CORREO DE RECUPERACION DE ACCESO
 * --------------------------------
 * Hermano del de invitacion, y por las mismas razones vive aqui y no en la
 * plantilla del proveedor de identidad: se revisa como el codigo, se prueba,
 * y va en el idioma de la persona.
 *
 * ANTES LO MANDABA SUPABASE. Llegaba en ingles, con su remitente y su
 * aspecto, a traves de un servicio de correo que el propio proveedor
 * describe como no apto para produccion y que limita los envios por hora.
 * Para alguien que no puede entrar a trabajar, quedarse sin correo porque se
 * agoto una cuota no es un detalle estetico.
 *
 * LA DIFERENCIA DE FONDO CON EL DE INVITACION es solo el tono: aqui la
 * persona ya tiene cuenta y ya ha entrado antes. No se le da la bienvenida,
 * se le devuelve la llave.
 *
 * QUE NO LLEVA, igual que el de invitacion: ninguna contrasena, y ni una
 * palabra sobre nadie mas.
 */
export function staffRecoveryEmail(to: string, data: StaffRecoveryEmailData): EmailMessage {
  const es = data.locale === 'es';

  const titulo = es ? 'Vuelve a entrar en el panel' : 'Get back into the panel';

  const parrafos = es
    ? [
        `Hola ${data.firstName}:`,
        `Se ha pedido volver a elegir la contraseña de tu acceso al panel de ${COMPANY_NAME}.`,
        'Elige una nueva con el botón de abajo.',
      ]
    : [
        `Hi ${data.firstName},`,
        `Someone asked to choose a new password for your ${COMPANY_NAME} panel access.`,
        'Pick a new one with the button below.',
      ];

  const boton = es ? 'Elegir contraseña nueva' : 'Choose a new password';

  const nota = es
    ? 'Este enlace sirve una sola vez y caduca. Si al abrirlo te dice que ya no vale, vuelve a pedirlo desde «¿Has olvidado tu contraseña?» en la pantalla de acceso.'
    : 'This link works once and then expires. If it tells you it is no longer valid, request it again from "Forgot your password?" on the sign-in screen.';

  /*
   * EL AVISO ES DISTINTO AL DE LA INVITACION, y la diferencia importa.
   *
   * Aqui la cuenta YA existe: si quien recibe esto no lo pidio, puede que
   * alguien este probando con su correo. Se le dice que ignorarlo basta
   * —nada cambia hasta que se abre el enlace— y que lo cuente. Un correo
   * inesperado de este tipo es la primera senal de un intento de entrada.
   */
  const aviso = es
    ? 'Si no lo has pedido tú, ignora este correo: tu contraseña actual sigue funcionando y no cambia nada. Si te llegan varios, avisa a administración.'
    : 'If you did not request this, ignore the email: your current password still works and nothing changes. If several arrive, tell administration.';

  const contacto = pieDeContacto(data, es);

  return {
    to,
    subject: titulo,
    text: [
      titulo,
      '',
      ...parrafos,
      '',
      data.actionLink,
      '',
      nota,
      '',
      aviso,
      ...(contacto.length > 0 ? ['', ...contacto] : []),
      '',
      COMPANY_NAME,
    ].join('\n'),
    html: comoHtml({ titulo, parrafos, boton, nota, aviso, contacto, data }),
  };
}

/* -------------------------------------------------------------------------- */

function pieDeContacto(
  data: Pick<StaffInviteEmailData, 'companyPhone' | 'companyEmail'>,
  es: boolean,
): string[] {
  const lineas: string[] = [];
  if (data.companyPhone) lineas.push(`${es ? 'Teléfono' : 'Phone'}: ${data.companyPhone}`);
  if (data.companyEmail) lineas.push(`${es ? 'Correo' : 'Email'}: ${data.companyEmail}`);
  return lineas;
}

/**
 * El HTML sale del diseno comun (`layout.ts`).
 *
 * Aqui habia otra copia casi exacta de la maqueta de los correos de
 * reservas, incluida su propia funcion de escapado. Ahora esta funcion solo
 * traduce al vocabulario del diseno; el boton y el enlace en texto los pone
 * el diseno, para todos los correos igual.
 */
function comoHtml(partes: {
  titulo: string;
  parrafos: string[];
  boton: string;
  nota: string;
  aviso: string;
  contacto: string[];
  data: Pick<StaffInviteEmailData, 'locale' | 'actionLink' | 'logoUrl'>;
}): string {
  const { titulo, parrafos, boton, nota, aviso, contacto, data } = partes;

  return emailHtml({
    locale: data.locale,
    titulo,
    parrafos,
    boton: { texto: boton, enlace: data.actionLink },
    nota,
    aviso,
    contacto,
    branding: { logoUrl: data.logoUrl },
  });
}

/* -------------------------------------------------------------------------- */
/*  El aviso a quien asigna los equipos                                       */
/* -------------------------------------------------------------------------- */

/**
 * Lo que necesita quien reparte el trabajo. Y solo eso.
 *
 * ========================================================================
 * NI EL NOMBRE DEL CLIENTE, NI LA CALLE, NI EL PRECIO
 * ========================================================================
 * No es cautela de mas: es que no hacen falta para lo unico que este correo
 * pide —abrir el panel y poner un equipo— y todo lo que se manda por correo
 * se queda para siempre en un buzon que no controlamos.
 *
 * El precio ademas tiene su propio motivo: quien coordina mueve la agenda y
 * no cobra a nadie, y la factura no entra en esa decision. Es la misma linea
 * que ya separa el chat del equipo de limpieza del de operaciones.
 *
 * La ficha entera —con el nombre, la direccion completa y el importe— esta
 * en el panel, detras de una sesion.
 */
export interface DispatchEmailData {
  locale: Locale;
  reference: string;
  /** Inicio y fin en UTC; se pintan en la zona de la empresa. */
  scheduledStart: Date;
  scheduledEnd: Date;
  timezone: string;
  /** Ciudad y estado. La calle NO. */
  city: string;
  state: string;
  /** Que clase de limpieza, tal cual la guarda la reserva. */
  service: string;
  companyPhone: string | null;
  companyEmail: string | null;
  logoUrl: string | null;
}

const ETIQUETA_LOCALE: Record<Locale, string> = { en: 'en-US', es: 'es-US' };

/** El dia, y la franja de principio a fin. Es lo que decide si cabe un equipo. */
function franja(data: DispatchEmailData): string {
  const inicio = DateTime.fromJSDate(data.scheduledStart).setZone(data.timezone);
  const fin = DateTime.fromJSDate(data.scheduledEnd).setZone(data.timezone);
  const idioma = ETIQUETA_LOCALE[data.locale];

  const dia = inicio.setLocale(idioma).toLocaleString({
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const hora = (momento: DateTime): string =>
    momento.setLocale(idioma).toLocaleString({ hour: 'numeric', minute: '2-digit' });

  return `${dia}, ${hora(inicio)} – ${hora(fin)}`;
}

/**
 * HA ENTRADO UNA RESERVA Y HAY QUE PONERLE EQUIPO.
 *
 * ========================================================================
 * POR QUE NO VALIA LA COPIA INTERNA QUE YA HABIA
 * ========================================================================
 * `internalEmail` recibe EL MISMO correo que el cliente. Eso es util cuando
 * el cliente llama —se ve exactamente lo que tiene delante— y no sirve para
 * esto: esta escrito para el, lleva el precio, y no dice lo unico que
 * importa aqui, que es que esa reserva todavia no tiene a nadie asignado.
 *
 * ========================================================================
 * NO LLEVA ENLACE AL PANEL, Y ES A PROPOSITO
 * ========================================================================
 * Seria mas comodo, y haria falta una variable de entorno mas con la
 * direccion del panel. Una variable que se puede quedar mal puesta o
 * anticuada pone un enlace roto en TODOS los correos, y un enlace roto en un
 * aviso urgente es peor que no tener enlace. El dia que se quiera, es una
 * linea; mientras tanto, el panel se abre como se abre todos los dias.
 */
export function newBookingDispatchEmail(to: string, data: DispatchEmailData): EmailMessage {
  const es = data.locale === 'es';

  const titulo = es ? 'Reserva nueva sin equipo' : 'New booking with no team yet';

  const parrafos = es
    ? [
        'Ha entrado una reserva confirmada y todavía no tiene equipo asignado.',
        'Ábrela en el panel y asígnale uno.',
      ]
    : [
        'A confirmed booking has come in and it does not have a team yet.',
        'Open it in the panel and assign one.',
      ];

  const datos: [string, string][] = es
    ? [
        ['Referencia', data.reference],
        ['Cuándo', franja(data)],
        ['Dónde', `${data.city}, ${data.state}`],
        ['Servicio', data.service],
      ]
    : [
        ['Reference', data.reference],
        ['When', franja(data)],
        ['Where', `${data.city}, ${data.state}`],
        ['Service', data.service],
      ];

  /*
   * Se dice en el propio correo que falta informacion y donde esta. Sin esa
   * frase, quien lo recibe busca el nombre del cliente, no lo encuentra y
   * cree que el aviso esta incompleto.
   */
  const nota = es
    ? 'El nombre del cliente, la dirección completa y el importe están en la ficha del panel: por correo no viajan.'
    : 'The customer name, the full address and the amount are in the booking in the panel: they do not travel by email.';

  const contacto = pieDeContacto(data, es);

  return {
    to,
    subject: es ? `Asignar equipo · ${data.reference}` : `Assign a team · ${data.reference}`,
    text: [
      titulo,
      '',
      ...parrafos,
      '',
      ...datos.map(([etiqueta, valor]) => `${etiqueta}: ${valor}`),
      '',
      nota,
      ...(contacto.length > 0 ? ['', ...contacto] : []),
      '',
      COMPANY_NAME,
    ].join('\n'),
    html: emailHtml({
      locale: data.locale,
      titulo,
      parrafos,
      datos,
      nota,
      contacto,
      branding: { logoUrl: data.logoUrl },
    }),
  };
}
