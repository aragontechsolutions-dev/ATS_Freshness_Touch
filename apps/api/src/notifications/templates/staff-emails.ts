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
