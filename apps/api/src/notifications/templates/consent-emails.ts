import type { Locale } from '@freshness/types';
import type { EmailMessage } from '../notifications.types';
import { COMPANY_NAME, emailHtml, type EmailBranding } from './layout';

/**
 * EL AVISO DE LOS PLAZOS DE RETIRADA
 * ----------------------------------
 * El papel firmado promete que, si el cliente lo pide, sus fotos dejan de
 * publicarse en unos dias. Retirar es un boton y despublica al momento, pero
 * ese boton hay que pulsarlo: el hueco peligroso va desde que llega el correo
 * del cliente hasta que alguien entra al panel.
 *
 * Esto es lo que cierra ese hueco. Un correo al dia, solo si hay algo
 * pendiente, hasta que se cumple.
 *
 * ========================================================================
 * NI UN NOMBRE NI UNA DIRECCION EN ESTE CORREO
 * ========================================================================
 * Y no es por costumbre: es que un correo es el canal MENOS controlado que
 * tiene el sistema. Se reenvia, se queda en el movil de quien lo lee, pasa
 * por filtros de spam y se queda en un buzon para siempre. Justo lo que el
 * permiso promete no exponer es el nombre del cliente y la direccion de su
 * casa.
 *
 * La referencia basta: con ella se abre la ficha en el panel, que es donde
 * ese dato puede verse y donde hace falta estar identificado para verlo.
 *
 * Por el mismo motivo tampoco lleva enlace directo a la ficha: una direccion
 * en un correo invita a pulsarla desde cualquier sitio, y lo que hay al otro
 * lado solo deberia abrirse desde una sesion del panel.
 */

export interface RemovalDeadlineItem {
  /** La referencia del permiso. Es todo lo que identifica la ficha aqui. */
  reference: string;
  /** Dias que quedan. Negativo si el plazo ya se paso. */
  daysLeft: number;
  /** El dia en que vence, `AAAA-MM-DD`. */
  deadline: string;
}

export interface RemovalDeadlineEmailData {
  locale: Locale;
  /** Ordenadas de mas urgente a menos. Nunca vacia: sin nada, no se manda. */
  items: RemovalDeadlineItem[];
  contacto: string[];
  branding: EmailBranding;
}

/** Como se describe el estado de una peticion, en una linea. */
function estado(item: RemovalDeadlineItem, es: boolean): string {
  if (item.daysLeft < 0) {
    const dias = Math.abs(item.daysLeft);
    return es
      ? `VENCIDO hace ${String(dias)} ${dias === 1 ? 'día' : 'días'} (${item.deadline})`
      : `OVERDUE by ${String(dias)} ${dias === 1 ? 'day' : 'days'} (${item.deadline})`;
  }

  if (item.daysLeft === 0) {
    return es ? `vence HOY (${item.deadline})` : `due TODAY (${item.deadline})`;
  }

  return es
    ? `quedan ${String(item.daysLeft)} ${item.daysLeft === 1 ? 'día' : 'días'} (${item.deadline})`
    : `${String(item.daysLeft)} ${item.daysLeft === 1 ? 'day' : 'days'} left (${item.deadline})`;
}

export function removalDeadlineEmail(to: string, data: RemovalDeadlineEmailData): EmailMessage {
  const es = data.locale === 'es';
  const vencidos = data.items.filter((item) => item.daysLeft < 0).length;
  const total = data.items.length;

  /*
   * EL ASUNTO DICE SI ALGO YA SE PASO. Es lo unico que se lee sin abrir el
   * correo, y la diferencia entre «hay trabajo» y «se esta incumpliendo una
   * promesa» tiene que verse desde la bandeja de entrada.
   */
  const titulo =
    vencidos > 0
      ? es
        ? `Retiradas de fotos: ${String(vencidos)} fuera de plazo`
        : `Photo takedowns: ${String(vencidos)} past the deadline`
      : es
        ? `Retiradas de fotos pendientes: ${String(total)}`
        : `Photo takedowns pending: ${String(total)}`;

  const parrafos = es
    ? [
        total === 1
          ? 'Un cliente ha pedido que se retiren sus fotos y todavía están publicadas.'
          : `${String(total)} clientes han pedido que se retiren sus fotos y todavía están publicadas.`,
        'Se retiran desde Ajustes → Permisos de imagen, con el botón de retirar. Desaparecen de la web al momento.',
      ]
    : [
        total === 1
          ? 'A customer asked for their photos to be taken down and they are still published.'
          : `${String(total)} customers asked for their photos to be taken down and they are still published.`,
        'Withdraw them from Settings → Image releases, with the withdraw button. They come off the website straight away.',
      ];

  const datos: [string, string][] = data.items.map((item) => [item.reference, estado(item, es)]);

  const nota = es
    ? 'Aquí solo va la referencia del permiso: el nombre del cliente y la dirección de su casa están en el panel, que es donde hace falta identificarse para verlos.'
    : 'Only the release reference is listed here: the customer’s name and address live in the panel, where you have to be signed in to see them.';

  return {
    to,
    subject: titulo,
    text: [
      titulo,
      '',
      ...parrafos,
      '',
      ...data.items.map((item) => `- ${item.reference}: ${estado(item, es)}`),
      '',
      nota,
      ...(data.contacto.length > 0 ? ['', ...data.contacto] : []),
      '',
      COMPANY_NAME,
    ].join('\n'),
    html: emailHtml({
      locale: data.locale,
      titulo,
      parrafos,
      datos,
      nota,
      contacto: data.contacto,
      branding: data.branding,
    }),
  };
}

/**
 * El mismo aviso, para el chat de operaciones.
 *
 * MISMA REGLA: referencias y plazos, ningun nombre y ninguna direccion. Un
 * grupo de Telegram tiene aun menos control que un correo —se reenvia con dos
 * toques y cualquiera que entre al grupo ve todo el historial—.
 */
export function removalDeadlineTelegramMessage(items: RemovalDeadlineItem[]): string {
  const vencidos = items.filter((item) => item.daysLeft < 0).length;

  const titular =
    vencidos > 0
      ? `⚠️ Retiradas de fotos: ${String(vencidos)} fuera de plazo`
      : `🕒 Retiradas de fotos pendientes: ${String(items.length)}`;

  return [
    titular,
    '',
    ...items.map((item) => `• ${item.reference}: ${estado(item, true)}`),
    '',
    'Ajustes → Permisos de imagen → Retirar.',
  ].join('\n');
}
