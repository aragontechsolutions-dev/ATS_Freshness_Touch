import { z } from 'zod';
import { StaffRoleSchema } from './auth';
import { LocaleSchema } from './enums';
import { PhoneE164Schema } from './business-settings';

/**
 * DAR DE ALTA PERSONAL
 * --------------------
 * EXISTIR COMO PERSONAL Y PODER ENTRAR AL PANEL SON DOS COSAS DISTINTAS, y
 * separarlas es lo que hace que esto sea sencillo y seguro a la vez:
 *
 *   - Para que a alguien se le asignen trabajos basta con que exista aqui.
 *     Una limpiadora necesita salir en el selector, no iniciar sesion.
 *   - Para entrar al panel hace falta ademas una cuenta vinculada. La sesion
 *     se resuelve por el identificador del proveedor y NUNCA por el correo,
 *     asi que dar de alta a alguien con su correo no le abre ninguna puerta.
 *
 * De ahi que el alta no pida nada relacionado con credenciales: no hay
 * contrasena que escribir, ni aqui ni en ningun sitio. Invitar es una accion
 * aparte y deliberada.
 */

const NombreSchema = z.string().trim().min(1).max(80);

/**
 * Correo de la persona.
 *
 * Es su direccion de CONTACTO y el destino de la invitacion, no su llave.
 * Quien ya tiene acceso sigue entrando aunque se le cambie aqui, porque la
 * sesion va por identificador. Merece la pena tenerlo claro: lo contrario
 * —creer que cambiar el correo cambia el acceso— lleva a pensar que se ha
 * revocado a alguien cuando no se ha revocado nada.
 */
const CorreoSchema = z.string().trim().toLowerCase().email().max(160);

/**
 * Idioma en el que se le escribe.
 *
 * Se elige en el alta porque el primer correo que recibe esa persona es la
 * invitacion al panel, y para entonces ya tiene que estar decidido. Por
 * defecto ingles, como el resto del sistema.
 */
const IdiomaSchema = LocaleSchema.default('en');

/** Alta. El puesto se elige desde el principio para no crear a nadie "sin rol". */
export const StaffCreateSchema = z.strictObject({
  firstName: NombreSchema,
  lastName: NombreSchema,
  email: CorreoSchema,
  phone: PhoneE164Schema.nullable(),
  role: StaffRoleSchema,
  locale: IdiomaSchema,
});
export type StaffCreate = z.infer<typeof StaffCreateSchema>;
export type StaffCreateInput = z.input<typeof StaffCreateSchema>;

/**
 * Edicion. Va el conjunto entero, como la configuracion del negocio.
 *
 * `isActive` viaja aqui y no en un endpoint propio porque dar de baja es, de
 * hecho, editar la ficha: quien lo hace esta en la misma pantalla y espera el
 * mismo boton de guardar. Las guardias que impiden dejar el sistema sin
 * administrador viven en el servidor, donde se puede mirar al resto de fichas.
 */
export const StaffUpdateSchema = z.strictObject({
  firstName: NombreSchema,
  lastName: NombreSchema,
  email: CorreoSchema,
  phone: PhoneE164Schema.nullable(),
  role: StaffRoleSchema,
  locale: IdiomaSchema,
  isActive: z.boolean(),
});
export type StaffUpdate = z.infer<typeof StaffUpdateSchema>;
export type StaffUpdateInput = z.input<typeof StaffUpdateSchema>;

/**
 * Estado de acceso al panel, ya resuelto por el servidor.
 *
 * Se manda resuelto y no en crudo a proposito: el panel no recibe el
 * identificador de la cuenta del proveedor. No le sirve para pintar nada y
 * es un dato interno que, si se filtra, ayuda a quien quiera suplantar a
 * alguien. La pantalla solo necesita saber en cual de los tres estados esta.
 */
export const PanelAccessSchema = z.enum([
  /** No tiene cuenta vinculada: puede recibir trabajos, no puede entrar. */
  'NONE',
  /** Se le invito; entrara cuando abra el enlace y elija contrasena. */
  'INVITED',
  /** Tiene cuenta vinculada sin invitacion registrada (alta antigua, a mano). */
  'LINKED',
]);
export type PanelAccess = z.infer<typeof PanelAccessSchema>;

/**
 * Una ficha en el directorio de personal.
 *
 * ESTE SI LLEVA CORREO Y TELEFONO, y el selector de asignacion no. No es una
 * incoherencia: son dos pantallas con dos propositos. El selector se abre a
 * diario para decidir quien va a una casa, y ahi los datos de contacto solo
 * anaden exposicion. El directorio es la pantalla de administracion de
 * personal, donde el correo ES el dato que se gestiona —es a donde va la
 * invitacion— y solo entra administracion.
 */
export const AdminStaffDirectoryItemSchema = z.strictObject({
  staffId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  role: StaffRoleSchema,
  locale: LocaleSchema,
  isActive: z.boolean(),
  access: PanelAccessSchema,
  invitedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});
export type AdminStaffDirectoryItem = z.infer<typeof AdminStaffDirectoryItemSchema>;

export const AdminStaffDirectorySchema = z.strictObject({
  staff: z.array(AdminStaffDirectoryItemSchema),
  /**
   * Si este despliegue puede invitar.
   *
   * Depende de que la clave de servicio este configurada en el servidor. Se
   * manda para que la pantalla no ofrezca un boton que va a fallar; no es una
   * comprobacion de seguridad, que la hace el servidor igualmente.
   */
  canInvite: z.boolean(),
});
export type AdminStaffDirectory = z.infer<typeof AdminStaffDirectorySchema>;
