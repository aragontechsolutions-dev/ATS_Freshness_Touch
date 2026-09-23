import { z } from 'zod';
import { StaffRoleSchema } from './auth';

/**
 * ASIGNAR EQUIPO A UNA RESERVA
 * ----------------------------
 * Quien va a cada trabajo y quien es el responsable.
 *
 * SE GUARDA EL EQUIPO ENTERO DE UNA VEZ, no una persona cada vez. Los motivos
 * son los mismos que en la configuracion del negocio, mas uno propio:
 *
 *   - El equipo es una decision conjunta. "Van Ana y Beto, manda Ana" se
 *     piensa de golpe, no persona a persona.
 *   - La regla del responsable solo tiene sentido sobre el conjunto: con
 *     operaciones sueltas habria instantes con dos responsables o ninguno.
 *   - Una escritura de todo el conjunto no puede quedarse a medias.
 */

/** Una persona en el equipo de un trabajo. */
export const AdminAssignmentSchema = z.strictObject({
  staffId: z.uuid(),
  /**
   * Responsable del trabajo frente al resto.
   *
   * Es quien responde si el cliente pregunta algo en el momento y quien
   * decide si surge un imprevisto. Sin responsable, un equipo de tres se
   * queda mirandose cuando hay que tomar una decision.
   */
  isLead: z.boolean(),
});
export type AdminAssignment = z.infer<typeof AdminAssignmentSchema>;

/**
 * El equipo completo de una reserva.
 *
 * Dos reglas que se comprueban aqui, antes de tocar la base, para que el
 * mismo esquema sirva al panel y al servidor:
 */
export const AdminAssignmentsUpdateSchema = z
  .strictObject({
    /**
     * Tope de diez personas. No es un limite del negocio —ningun piso
     * necesita diez limpiadores— sino una defensa: sin tope, una peticion
     * podria pedir asignar a toda la plantilla y obligar a comprobar
     * solapamientos de cada una contra toda la agenda.
     */
    assignments: z.array(AdminAssignmentSchema).max(10),
  })
  .refine(
    (valor) => new Set(valor.assignments.map((a) => a.staffId)).size === valor.assignments.length,
    { message: 'No se puede asignar dos veces a la misma persona', path: ['assignments'] },
  )
  .refine((valor) => valor.assignments.filter((a) => a.isLead).length <= 1, {
    message: 'Solo puede haber un responsable',
    path: ['assignments'],
  });
export type AdminAssignmentsUpdate = z.infer<typeof AdminAssignmentsUpdateSchema>;
export type AdminAssignmentsUpdateInput = z.input<typeof AdminAssignmentsUpdateSchema>;

/**
 * Una persona tal y como aparece en el selector.
 *
 * LO MINIMO PARA ASIGNAR, y nada mas. No van el correo ni el telefono: para
 * elegir a quien manda a una casa hacen falta el nombre y el puesto. Incluir
 * los datos de contacto convertiria esta pantalla, que se abre a diario, en
 * la agenda telefonica de la plantilla.
 */
export const AdminStaffOptionSchema = z.strictObject({
  staffId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  role: StaffRoleSchema,
});
export type AdminStaffOption = z.infer<typeof AdminStaffOptionSchema>;

export const AdminStaffListSchema = z.strictObject({
  staff: z.array(AdminStaffOptionSchema),
});
export type AdminStaffList = z.infer<typeof AdminStaffListSchema>;

/** Nombre completo para pintar, sin repetir el mismo `join` por todas partes. */
export function staffFullName(persona: { firstName: string; lastName: string }): string {
  return `${persona.firstName} ${persona.lastName}`.trim();
}
