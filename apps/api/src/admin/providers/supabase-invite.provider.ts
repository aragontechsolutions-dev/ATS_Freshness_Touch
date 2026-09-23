import { Logger } from '@nestjs/common';
import { describeFailure } from '../../notifications/notifications.types';
import type { InviteResult, StaffInviteProvider } from '../staff-invite.types';

export interface SupabaseInviteOptions {
  /** Direccion del proyecto: https://<ref>.supabase.co */
  url: string | null;
  /**
   * Clave de servicio del proyecto.
   *
   * ES LA CREDENCIAL MAS PODEROSA DEL SISTEMA: salta todas las reglas de
   * seguridad de la base de datos. Por eso vive SOLO en el entorno del
   * servidor —nunca en la base, nunca en el navegador, nunca en un fichero
   * del repositorio— y por eso no se escribe jamas en un registro, ni
   * siquiera recortada.
   */
  serviceRoleKey: string | null;
  /** A donde lleva el enlace de la invitacion. Nulo usa el del proyecto. */
  redirectTo: string | null;
  timeoutMs: number;
}

/**
 * INVITACIONES CON LA API DE ADMINISTRACION DE SUPABASE
 * ----------------------------------------------------
 * `POST /auth/v1/admin/generate_link` con tipo `invite` crea la cuenta y
 * DEVUELVE el enlace SIN enviar ningun correo. El correo lo mandamos
 * nosotros, con nuestra plantilla (ver `templates/staff-emails.ts`).
 *
 * POR QUE NO `POST /auth/v1/invite`, que era lo que habia. Ese si manda el
 * correo, pero con la plantilla del proveedor: una sola para todo el mundo y
 * en un solo idioma, editable desde un panel web y por tanto fuera del
 * repositorio, sin revision ni pruebas. El primer correo que recibe alguien
 * que acaba de entrar en la empresa merece el mismo cuidado que el resto.
 *
 * La respuesta trae ademas el identificador de la cuenta, que es lo que
 * vincula la ficha de personal con el acceso.
 *
 * Se llama con `fetch`, sin libreria, igual que Resend y Telegram: la
 * peticion son veinte lineas y una dependencia mas es superficie de ataque a
 * cambio de muy poco.
 *
 * POR QUE ESTO Y NO VINCULAR POR CORREO AL PRIMER ACCESO. La alternativa era
 * dar de alta con el correo y vincular cuando alguien entrara con una cuenta
 * del mismo correo. Es mas simple y no necesita esta clave, pero su seguridad
 * depende de que el proyecto tenga la confirmacion de correo activada y el
 * registro publico cerrado: dos ajustes que viven FUERA del codigo y que
 * alguien puede cambiar sin que nada avise. Invitando, la cuenta la creamos
 * nosotros y no hay ningun correo en el que confiar.
 */
export class SupabaseInviteProvider implements StaffInviteProvider {
  readonly name = 'supabase';

  private readonly logger = new Logger('SupabaseInviteProvider');

  constructor(private readonly options: SupabaseInviteOptions) {}

  get available(): boolean {
    return Boolean(this.options.url && this.options.serviceRoleKey);
  }

  async invite(email: string): Promise<InviteResult> {
    if (!this.options.url || !this.options.serviceRoleKey) {
      return { ok: false, reason: 'El envio de invitaciones no esta configurado' };
    }

    const destino = new URL('/auth/v1/admin/generate_link', this.options.url);
    if (this.options.redirectTo) destino.searchParams.set('redirect_to', this.options.redirectTo);

    const controller = new AbortController();
    const temporizador = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const respuesta = await fetch(destino, {
        method: 'POST',
        headers: {
          // Ambas cabeceras llevan la misma clave: la puerta de entrada del
          // proyecto exige `apikey` y la API de autenticacion, `Authorization`.
          apikey: this.options.serviceRoleKey,
          Authorization: `Bearer ${this.options.serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'invite', email }),
        signal: controller.signal,
      });

      const cuerpo: unknown = await respuesta.json().catch(() => null);

      if (!respuesta.ok) {
        const detalle = extraerMensaje(cuerpo) ?? `codigo ${respuesta.status}`;
        /*
         * Se registra el motivo pero NO la direccion a la que se llamo: no
         * lleva la clave en la ruta, pero registrar direcciones internas del
         * proyecto es un habito que en el adaptador de Telegram si habria
         * filtrado el token. Mas vale que la regla sea siempre la misma.
         */
        this.logger.error(`Supabase rechazo la invitacion: ${detalle}`);
        return { ok: false, reason: detalle.slice(0, 200) };
      }

      const authUserId = extraerId(cuerpo);
      const actionLink = extraerEnlace(cuerpo);

      if (!authUserId || !actionLink) {
        /*
         * Respondio que si pero sin identificador. Se trata como fallo: sin
         * el no hay nada que vincular, y decir que la invitacion salio bien
         * dejaria una ficha que parece tener acceso y no lo tiene.
         */
        this.logger.error('Supabase genero el enlace pero la respuesta no trae lo esperado');
        return { ok: false, reason: 'La respuesta del proveedor esta incompleta' };
      }

      return { ok: true, authUserId, actionLink };
    } catch (error) {
      const motivo =
        error instanceof Error && error.name === 'AbortError'
          ? `El proveedor de identidad no respondio en ${this.options.timeoutMs} ms`
          : describeFailure(error);

      this.logger.error(`No se pudo enviar la invitacion: ${motivo}`);
      return { ok: false, reason: motivo };
    } finally {
      clearTimeout(temporizador);
    }
  }
}

/**
 * El enlace de un solo uso.
 *
 * NO se registra en ningun sitio, ni siquiera recortado: quien lo lea antes
 * que su destinataria entra en su lugar. Es una credencial, no un dato.
 */
function extraerEnlace(cuerpo: unknown): string | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null;

  const propiedades = (cuerpo as { properties?: Record<string, unknown> }).properties;
  const enlace = (cuerpo as Record<string, unknown>).action_link ?? propiedades?.action_link;

  return typeof enlace === 'string' && enlace.length > 0 ? enlace : null;
}

/** El identificador de la cuenta creada, si la respuesta tiene la forma esperada. */
function extraerId(cuerpo: unknown): string | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null;

  // La respuesta es el usuario. Se admite tambien `{ user: {...} }` por si el
  // proveedor lo envuelve, que es como lo expone su propia libreria.
  const usuario =
    'user' in cuerpo && typeof (cuerpo as { user: unknown }).user === 'object'
      ? (cuerpo as { user: Record<string, unknown> | null }).user
      : (cuerpo as Record<string, unknown>);

  const id = usuario?.id;
  return typeof id === 'string' && id.length > 0 ? id.slice(0, 200) : null;
}

/** El motivo del rechazo, mire donde mire el proveedor. */
function extraerMensaje(cuerpo: unknown): string | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null;

  for (const clave of ['msg', 'message', 'error_description', 'error']) {
    const valor = (cuerpo as Record<string, unknown>)[clave];
    if (typeof valor === 'string' && valor.length > 0) return valor;
  }

  return null;
}
