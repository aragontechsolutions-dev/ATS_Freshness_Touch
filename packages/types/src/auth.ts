import { z } from 'zod';

/**
 * CONTRATOS DE AUTENTICACION
 * --------------------------
 * Dos conceptos que NO son lo mismo, y confundirlos es el error clasico:
 *
 *   IDENTIDAD  — quien dice ser quien llama. La demuestra un token firmado.
 *   AUTORIDAD  — que puede hacer. La concede la ficha de personal (`staff`).
 *
 * Un token valido NO basta. Cualquiera puede registrarse en Supabase y
 * obtener uno perfectamente firmado; si eso diera acceso al panel, el sistema
 * estaria abierto a todo internet. La autoridad solo la da estar dado de alta
 * como personal activo.
 */

export const AuthProviderNameSchema = z.enum(['local', 'supabase']);
export type AuthProviderName = z.infer<typeof AuthProviderNameSchema>;

/**
 * Roles del personal. Debe mantenerse en paralelo con el enum StaffRole del
 * esquema de base de datos.
 */
export const StaffRoleSchema = z.enum([
  /** Acceso total, incluida la configuracion y el dinero. */
  'ADMIN',
  /** Agenda y asignacion de equipos. No toca dinero ni configuracion. */
  'DISPATCHER',
  /** Solo sus propios trabajos. */
  'CLEANER',
]);
export type StaffRole = z.infer<typeof StaffRoleSchema>;

/** Quien esta usando el panel, tal y como lo ve el navegador. */
export const AuthenticatedStaffSchema = z.strictObject({
  staffId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  role: StaffRoleSchema,
  /** Momento en que caduca la sesion, para avisar antes de perder trabajo. */
  sessionExpiresAt: z.iso.datetime(),
});
export type AuthenticatedStaff = z.infer<typeof AuthenticatedStaffSchema>;
