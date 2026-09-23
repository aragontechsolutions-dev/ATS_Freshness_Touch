import { z } from 'zod';

/**
 * CONTRASENA DEL PANEL
 * --------------------
 * La regla vive aqui, en el contrato compartido, y no dentro de la pantalla,
 * para que se pueda probar sin navegador y para que diga lo mismo en todos
 * los sitios donde se elige una contrasena: la invitacion y la recuperacion.
 *
 * LARGO MINIMO Y NADA MAS. Nada de "una mayuscula, un numero y un simbolo":
 * esas reglas producen `Password1!` una y otra vez, que es corta y adivinable,
 * y empujan a apuntarla en un papel pegado al monitor. Doce caracteres
 * cualesquiera resisten mucho mas que ocho con adornos.
 *
 * QUIEN MANDA DE VERDAD es el proveedor de identidad, que aplica su propio
 * minimo en el servidor. Esto es una guardia de interfaz: evita que alguien
 * elija algo debil y se entere despues, con un error del proveedor en su
 * idioma. No sustituye a la comprobacion del servidor, la adelanta.
 */
export const PANEL_PASSWORD_MIN_LENGTH = 12;

export const PanelPasswordSchema = z
  .string()
  .min(PANEL_PASSWORD_MIN_LENGTH)
  /*
   * Tope alto pero existente. Sin el, alguien podria enviar megabytes y
   * obligar al proveedor a calcular el hash de todo ello, que es una forma
   * barata de cargar un servidor ajeno.
   */
  .max(200);

/**
 * Las dos veces que se teclea tienen que coincidir.
 *
 * Se pide dos veces porque el campo va oculto: una errata al elegirla no se
 * ve, y se descubre al siguiente intento de entrar, cuando ya no hay forma de
 * saber que se tecleo. Con la segunda vuelta, la errata se detecta ahora.
 */
export const PanelPasswordChoiceSchema = z
  .strictObject({
    password: PanelPasswordSchema,
    confirmation: z.string(),
  })
  .refine((valor) => valor.password === valor.confirmation, {
    message: 'Las dos contrasenas no coinciden',
    path: ['confirmation'],
  });
export type PanelPasswordChoice = z.infer<typeof PanelPasswordChoiceSchema>;

/**
 * Por que se ha rechazado, como clave de traduccion.
 *
 * Se devuelve una CLAVE y no el mensaje del esquema, que esta en un solo
 * idioma. Es la misma leccion que dejaron los ajustes del negocio: un mensaje
 * escrito en el contrato acaba apareciendo en espanol en un panel en ingles.
 */
export function panelPasswordProblem(
  password: string,
  confirmation: string,
): 'tooShort' | 'mismatch' | null {
  if (password.length < PANEL_PASSWORD_MIN_LENGTH) return 'tooShort';
  if (password !== confirmation) return 'mismatch';
  return null;
}
