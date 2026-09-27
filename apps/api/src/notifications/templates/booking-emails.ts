import { DateTime } from 'luxon';
import type { Locale } from '@freshness/types';
import type { EmailMessage } from '../notifications.types';
import { COMPANY_NAME, emailHtml } from './layout';

/**
 * TEXTOS DE LOS CORREOS AL CLIENTE
 * --------------------------------
 * Viven aqui y no en `packages/i18n` a proposito: ese paquete se empaqueta en
 * el sitio publico y en el panel, y el texto de unos correos que ningun
 * navegador va a pintar seria peso muerto descargado por cada visitante.
 *
 * QUE NO SALE NUNCA EN UN CORREO, y conviene que siga asi:
 *
 *   - LAS INSTRUCCIONES DE ACCESO (codigo de la puerta, donde esta la llave).
 *     Las da el cliente y son suyas, pero el correo no es un canal seguro:
 *     viaja por servidores ajenos y se queda para siempre en un buzon que
 *     puede acabar comprometido. Devolverselas por escrito no le aporta nada
 *     —ya las sabe— y multiplica el numero de sitios donde estan.
 *
 *   - EL MOTIVO DE LA CANCELACION. Lo escribe el equipo en el panel y es una
 *     nota interna ("el cliente discutio el precio", "zona conflictiva"). Un
 *     correo automatico que se lo reenvie al cliente es un incidente, no una
 *     funcionalidad.
 */

/** Todo lo que necesita una plantilla, ya resuelto por quien llama. */
export interface BookingEmailData {
  locale: Locale;
  customerFirstName: string;
  reference: string;
  /** Inicio del servicio en UTC. Se convierte a la zona de la empresa al pintar. */
  scheduledStart: Date;
  timezone: string;
  addressLine: string;
  city: string;
  state: string;
  depositCents: number;
  balanceDueCents: number;
  currency: string;
  /** Contacto de la empresa, si esta configurado. */
  companyPhone: string | null;
  companyEmail: string | null;
  /**
   * De donde se descarga el logotipo, o `null` para no ponerlo.
   *
   * Viaja en los datos y no lo lee la plantilla de una variable global para
   * que estas funciones sigan siendo puras: se prueban pasandoles un objeto,
   * sin entorno que preparar.
   */
  logoUrl: string | null;
}

const ETIQUETA_LOCALE: Record<Locale, string> = { en: 'en-US', es: 'es-US' };

/** Correo de confirmacion: la reserva quedo en firme. */
export function bookingConfirmedEmail(to: string, data: BookingEmailData): EmailMessage {
  const es = data.locale === 'es';
  const cuando = formatearFecha(data.scheduledStart, data.timezone, data.locale);
  const deposito = formatearDinero(data.depositCents, data.currency, data.locale);
  const resto = formatearDinero(data.balanceDueCents, data.currency, data.locale);
  const donde = `${data.addressLine}, ${data.city}, ${data.state}`;

  const titulo = es ? 'Tu limpieza está confirmada' : 'Your cleaning is confirmed';

  const parrafos = es
    ? [`Hola ${data.customerFirstName}:`, `Hemos confirmado tu limpieza. Aquí tienes los detalles.`]
    : [`Hi ${data.customerFirstName},`, `Your cleaning is confirmed. Here are the details.`];

  const datos: [string, string][] = es
    ? [
        ['Referencia', data.reference],
        ['Cuándo', cuando],
        ['Dónde', donde],
        ['Retenido en tu tarjeta', deposito],
        ['A pagar el día del servicio', resto],
      ]
    : [
        ['Reference', data.reference],
        ['When', cuando],
        ['Where', donde],
        ['Held on your card', deposito],
        ['Due on the day of service', resto],
      ];

  const nota = es
    ? `El depósito ya está retenido en tu tarjeta, no cobrado. Se descuenta del total el día del servicio.`
    : `The deposit is held on your card, not charged. It comes off your total on the day of service.`;

  return {
    to,
    subject: es
      ? `Limpieza confirmada · ${data.reference}`
      : `Cleaning confirmed · ${data.reference}`,
    text: comoTexto(titulo, parrafos, datos, nota, data),
    html: comoHtml(titulo, parrafos, datos, nota, data),
  };
}

/** Correo de cancelacion. Sin motivo: ver la nota de cabecera. */
export function bookingCancelledEmail(to: string, data: BookingEmailData): EmailMessage {
  const es = data.locale === 'es';
  const cuando = formatearFecha(data.scheduledStart, data.timezone, data.locale);

  const titulo = es ? 'Tu limpieza ha sido cancelada' : 'Your cleaning has been cancelled';

  const parrafos = es
    ? [
        `Hola ${data.customerFirstName}:`,
        `Hemos cancelado la limpieza que tenías reservada. No se te cobrará el servicio.`,
      ]
    : [
        `Hi ${data.customerFirstName},`,
        `We have cancelled your scheduled cleaning. You will not be charged for the service.`,
      ];

  const datos: [string, string][] = es
    ? [
        ['Referencia', data.reference],
        ['Estaba prevista para', cuando],
      ]
    : [
        ['Reference', data.reference],
        ['Was scheduled for', cuando],
      ];

  /*
   * Se habla del deposito solo si lo hubo. Decirle a alguien que "se libera su
   * deposito" cuando nunca se le retuvo nada genera una llamada preguntando
   * por un dinero que no existe.
   */
  const nota =
    data.depositCents > 0
      ? es
        ? `Si tu depósito seguía retenido, se libera. Según tu banco, puede tardar unos días en desaparecer del extracto.`
        : `If your deposit was still held, it is being released. Depending on your bank, it can take a few days to clear.`
      : es
        ? `Si quieres reservar otra fecha, estamos aquí.`
        : `If you would like to book another date, we are here.`;

  return {
    to,
    subject: es
      ? `Limpieza cancelada · ${data.reference}`
      : `Cleaning cancelled · ${data.reference}`,
    text: comoTexto(titulo, parrafos, datos, nota, data),
    html: comoHtml(titulo, parrafos, datos, nota, data),
  };
}

/**
 * Recordatorio la vispera del servicio.
 *
 * Existe para reducir las ausencias, que son el gasto mas tonto de este
 * negocio: el equipo se desplaza, no puede entrar, y la franja ya no se puede
 * vender a nadie.
 *
 * Por eso el correo es CORTO y dice tres cosas: cuando, donde y cuanto hay
 * que pagar ese dia. Repetir aqui el desglose entero del precio diluiria justo
 * lo que interesa que se lea.
 */
export function bookingReminderEmail(to: string, data: BookingEmailData): EmailMessage {
  const es = data.locale === 'es';
  const cuando = formatearFecha(data.scheduledStart, data.timezone, data.locale);
  const resto = formatearDinero(data.balanceDueCents, data.currency, data.locale);
  const donde = `${data.addressLine}, ${data.city}, ${data.state}`;

  const titulo = es ? 'Tu limpieza es manana' : 'Your cleaning is tomorrow';

  const parrafos = es
    ? [
        `Hola ${data.customerFirstName}:`,
        `Un recordatorio de que tu limpieza esta programada para manana.`,
      ]
    : [`Hi ${data.customerFirstName},`, `A reminder that your cleaning is scheduled for tomorrow.`];

  const datos: [string, string][] = es
    ? [
        ['Referencia', data.reference],
        ['Cuando', cuando],
        ['Donde', donde],
        ['A pagar ese dia', resto],
      ]
    : [
        ['Reference', data.reference],
        ['When', cuando],
        ['Where', donde],
        ['Due that day', resto],
      ];

  /*
   * La nota final invita a avisar si algo cambia. Es deliberado: un cliente
   * que avisa la vispera permite recolocar la franja; uno que no esta cuando
   * llega el equipo cuesta el desplazamiento entero.
   */
  const nota = es
    ? `Si necesitas cambiar la hora o no vas a estar, avisanos hoy y lo resolvemos.`
    : `If you need to change the time or will not be home, let us know today and we will sort it out.`;

  return {
    to,
    subject: es
      ? `Recordatorio: tu limpieza es manana · ${data.reference}`
      : `Reminder: your cleaning is tomorrow · ${data.reference}`,
    text: comoTexto(titulo, parrafos, datos, nota, data),
    html: comoHtml(titulo, parrafos, datos, nota, data),
  };
}

/**
 * Aviso interno por Telegram.
 *
 * Es texto plano, sin formato, por lo que se explica en el proveedor: un
 * apellido con un guion bajo rompe el mensaje entero si se usa Markdown.
 */
export function newBookingTelegramMessage(data: {
  reference: string;
  customerName: string;
  scheduledStart: Date;
  timezone: string;
  addressLine: string;
  city: string;
  totalCents: number;
  currency: string;
}): string {
  const cuando = formatearFecha(data.scheduledStart, data.timezone, 'en');
  const total = formatearDinero(data.totalCents, data.currency, 'en');

  return [
    `Nueva reserva confirmada`,
    ``,
    `Referencia: ${data.reference}`,
    `Cliente: ${data.customerName}`,
    `Cuando: ${cuando}`,
    `Donde: ${data.addressLine}, ${data.city}`,
    `Total: ${total}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Composicion
// ---------------------------------------------------------------------------

function pieDeContacto(data: BookingEmailData): string[] {
  const es = data.locale === 'es';
  const lineas: string[] = [];

  // Solo se ofrece un canal de contacto si de verdad existe. Un correo que
  // dice "llamanos al" seguido de nada es peor que no decir nada.
  if (data.companyPhone !== null) {
    lineas.push(es ? `Teléfono: ${data.companyPhone}` : `Phone: ${data.companyPhone}`);
  }
  if (data.companyEmail !== null) {
    lineas.push(es ? `Correo: ${data.companyEmail}` : `Email: ${data.companyEmail}`);
  }

  return lineas;
}

function comoTexto(
  titulo: string,
  parrafos: string[],
  datos: [string, string][],
  nota: string,
  data: BookingEmailData,
): string {
  const contacto = pieDeContacto(data);

  return [
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
  ].join('\n');
}

/**
 * El HTML sale del diseno comun (`layout.ts`).
 *
 * Esta funcion era antes una copia casi exacta de la de los correos del
 * personal. Casi exacta es el problema: un arreglo se aplicaba a una y no a
 * la otra. Ahora solo traduce los datos de una reserva al vocabulario del
 * diseno.
 */
function comoHtml(
  titulo: string,
  parrafos: string[],
  datos: [string, string][],
  nota: string,
  data: BookingEmailData,
): string {
  return emailHtml({
    locale: data.locale,
    titulo,
    parrafos,
    datos,
    nota,
    contacto: pieDeContacto(data),
    branding: { logoUrl: data.logoUrl },
  });
}

/** Fecha y hora en la zona de la empresa, que es cuando llega el equipo. */
function formatearFecha(fecha: Date, timezone: string, locale: Locale): string {
  return DateTime.fromJSDate(fecha)
    .setZone(timezone)
    .setLocale(ETIQUETA_LOCALE[locale])
    .toLocaleString(DateTime.DATETIME_FULL);
}

function formatearDinero(cents: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(ETIQUETA_LOCALE[locale], {
    style: 'currency',
    currency,
  }).format(cents / 100);
}
