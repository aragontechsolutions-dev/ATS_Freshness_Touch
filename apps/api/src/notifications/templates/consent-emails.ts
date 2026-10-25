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

/* ------------------------------------------------------------------------ */
/*  La constancia que recibe el cliente                                      */
/* ------------------------------------------------------------------------ */

export interface ConsentReceiptEmailData {
  locale: Locale;
  /** La referencia del permiso, para poder citarla si escribe. */
  reference: string;
  /** El dia del servicio, `AAAA-MM-DD`: es por donde lo va a reconocer. */
  serviceDate: string;
  coversInterior: boolean;
  coversExterior: boolean;
  allowsBefore: boolean;
  removalDays: number;
  /** El enlace que lo retira al momento, o `null` si no se pudo componer. */
  removalUrl: string | null;
  /** A donde escribir si prefiere que lo hagamos nosotros. */
  companyEmail: string | null;
  contacto: string[];
  branding: EmailBranding;
}

/**
 * LA CONSTANCIA DE LO QUE AUTORIZO, CON SU SALIDA.
 *
 * ========================================================================
 * POR QUE ESTE CORREO EXISTE
 * ========================================================================
 * Hasta ahora el cliente marcaba una casilla al reservar y NO RECIBIA NADA.
 * Ni que habia autorizado, ni que podia retirarlo, ni como. Un permiso del
 * que la persona no conserva ninguna constancia es un permiso que, el dia
 * que se discuta, solo tiene nuestra palabra detras.
 *
 * ========================================================================
 * Y POR QUE LLEVA UN BOTON QUE LO DESHACE
 * ========================================================================
 * Porque un permiso que se puede retirar con un clic es MAS DEFENDIBLE que
 * uno que exige escribir y esperar: demuestra que la retirada es real y no
 * una promesa impresa. Que el cliente pueda deshacerlo sin hablar con nadie
 * es lo que convierte la promesa en un hecho.
 *
 * SI NO HAY ENLACE —falta la direccion del sitio— el correo sale igual,
 * diciendo a donde escribir. Un boton que no lleva a ninguna parte es peor
 * que no ofrecerlo: el cliente creeria haberlo retirado.
 */
export function consentReceiptEmail(to: string, data: ConsentReceiptEmailData): EmailMessage {
  const es = data.locale === 'es';

  const titulo = es ? 'Constancia de su permiso de imagen' : 'A record of your photo release';

  const que = es
    ? data.coversInterior && data.coversExterior
      ? 'el interior y el exterior de su vivienda'
      : data.coversInterior
        ? 'el interior de su vivienda'
        : 'el exterior de su vivienda'
    : data.coversInterior && data.coversExterior
      ? 'the inside and the outside of your home'
      : data.coversInterior
        ? 'the inside of your home'
        : 'the outside of your home';

  const parrafos = es
    ? [
        `Gracias por dejarnos enseñar nuestro trabajo. Esto es la constancia de lo que usted autorizó, para que la tenga por escrito.`,
        `Puede publicarse ${que} en nuestra página web. ${
          data.allowsBefore
            ? 'Incluye las imágenes del «antes».'
            : 'NO se publican las imágenes del «antes».'
        } Nunca se muestra el número de su calle, ni nada que permita localizar la casa.`,
        `Si cambia de idea, no tiene que darnos ninguna explicación.`,
      ]
    : [
        'Thank you for letting us show our work. This is a record of what you agreed to, so you have it in writing.',
        `We may publish ${que} on our website. ${
          data.allowsBefore
            ? 'This includes the "before" footage.'
            : 'The "before" footage is NOT published.'
        } We never show your street number, or anything that would pinpoint the house.`,
        'If you change your mind, you do not owe us any explanation.',
      ];

  const boton =
    data.removalUrl === null
      ? undefined
      : {
          texto: es ? 'Retirar mis fotos ahora' : 'Take my photos down now',
          enlace: data.removalUrl,
        };

  const nota =
    data.removalUrl === null
      ? es
        ? `Para retirarlo, escríbanos${data.companyEmail === null ? '' : ` a ${data.companyEmail}`} citando la referencia ${data.reference}. Lo quitamos de la web en ${String(data.removalDays)} días.`
        : `To take it down, email us${data.companyEmail === null ? '' : ` at ${data.companyEmail}`} quoting reference ${data.reference}. It comes off the website within ${String(data.removalDays)} days.`
      : es
        ? `Ese botón lo retira al momento, sin hablar con nadie. Si prefiere que lo hagamos nosotros, escríbanos${data.companyEmail === null ? '' : ` a ${data.companyEmail}`} citando la referencia ${data.reference}: lo quitamos en ${String(data.removalDays)} días.`
        : `That button takes it down straight away, without talking to anyone. If you would rather we did it, email us${data.companyEmail === null ? '' : ` at ${data.companyEmail}`} quoting reference ${data.reference}: it comes off within ${String(data.removalDays)} days.`;

  const datos: [string, string][] = [
    [es ? 'Referencia' : 'Reference', data.reference],
    [es ? 'Servicio del' : 'Service on', data.serviceDate],
  ];

  /*
   * EL AVISO DE «SI NO ESPERABAS ESTO», igual que en la invitacion al panel.
   * Un correo que habla de publicar la casa de alguien, llegado por error, da
   * un susto considerable — y aqui la salida es la misma que la accion.
   */
  const aviso = es
    ? 'Si no reconoce este permiso, use el botón de retirar: no se publicará nada.'
    : 'If you do not recognise this release, use the takedown button: nothing will be published.';

  return {
    to,
    subject: titulo,
    text: [
      titulo,
      '',
      ...parrafos,
      '',
      `${es ? 'Referencia' : 'Reference'}: ${data.reference}`,
      `${es ? 'Servicio del' : 'Service on'}: ${data.serviceDate}`,
      ...(data.removalUrl === null ? [] : ['', data.removalUrl]),
      '',
      nota,
      '',
      aviso,
      ...(data.contacto.length > 0 ? ['', ...data.contacto] : []),
      '',
      COMPANY_NAME,
    ].join('\n'),
    html: emailHtml({
      locale: data.locale,
      titulo,
      parrafos,
      datos,
      ...(boton ? { boton } : {}),
      nota,
      aviso,
      contacto: data.contacto,
      branding: data.branding,
    }),
  };
}
