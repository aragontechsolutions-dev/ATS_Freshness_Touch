import type { Locale, StaffRole } from '@freshness/types';
import type { EmailMessage } from '../notifications.types';

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
}

const COMPANY_NAME = 'Freshness Touch';

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

/* -------------------------------------------------------------------------- */

function pieDeContacto(data: StaffInviteEmailData, es: boolean): string[] {
  const lineas: string[] = [];
  if (data.companyPhone) lineas.push(`${es ? 'Teléfono' : 'Phone'}: ${data.companyPhone}`);
  if (data.companyEmail) lineas.push(`${es ? 'Correo' : 'Email'}: ${data.companyEmail}`);
  return lineas;
}

/**
 * HTML con estilos en linea, como el resto de los correos: los clientes de
 * correo descartan las hojas de estilo y muchos ignoran el `<style>` del
 * encabezado.
 *
 * EL ENLACE SE ESCAPA COMO ATRIBUTO, que no es lo mismo que escapar texto. Va
 * dentro de `href="..."`, asi que unas comillas sin escapar permitirian cerrar
 * el atributo y anadir otros. El enlace lo construye el proveedor y no el
 * usuario, pero escapar solo donde uno cree que hace falta es como se acaban
 * colando estas cosas.
 */
function comoHtml(partes: {
  titulo: string;
  parrafos: string[];
  boton: string;
  nota: string;
  aviso: string;
  contacto: string[];
  data: StaffInviteEmailData;
}): string {
  const { titulo, parrafos, boton, nota, aviso, contacto, data } = partes;
  const enlace = escapar(data.actionLink);

  return `<!doctype html>
<html lang="${data.locale}">
  <body style="margin:0;padding:24px;background:#f7f9fc;font-family:-apple-system,'Segoe UI',sans-serif;">
    <table role="presentation" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;">
      <tr>
        <td style="padding:24px;">
          <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#10456c;">${escapar(titulo)}</p>
          ${parrafos.map((p) => `<p style="margin:0 0 12px;font-size:15px;color:#334155;line-height:1.5;">${escapar(p)}</p>`).join('')}
          <p style="margin:24px 0;">
            <a href="${enlace}" style="display:inline-block;padding:12px 20px;background:#10456c;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">${escapar(boton)}</a>
          </p>
          <!--
            El enlace tambien en texto: hay clientes de correo que no pintan
            botones, y quien lea esto en un movil viejo tiene que poder
            copiarlo a mano.
          -->
          <p style="margin:0 0 16px;font-size:12px;color:#94a3b8;word-break:break-all;">${enlace}</p>
          <p style="margin:0 0 12px;font-size:14px;color:#475569;line-height:1.5;">${escapar(nota)}</p>
          <p style="margin:0 0 16px;font-size:13px;color:#64748b;line-height:1.5;">${escapar(aviso)}</p>
          ${
            contacto.length > 0
              ? `<hr style="border:0;border-top:1px solid #e2e8f0;margin:16px 0;" />
                 ${contacto.map((linea) => `<p style="margin:0 0 4px;font-size:13px;color:#64748b;">${escapar(linea)}</p>`).join('')}`
              : ''
          }
          <p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">${COMPANY_NAME}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapar(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
