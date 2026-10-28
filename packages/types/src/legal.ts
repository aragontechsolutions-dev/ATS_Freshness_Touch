import { z } from 'zod';

/**
 * LO QUE EL CLIENTE ACEPTA AL RESERVAR
 * ====================================
 * Los dos documentos —condiciones y privacidad— viven como paginas del sitio
 * y se aceptan con una casilla en el formulario. Aqui esta lo que hace que esa
 * aceptacion SE PUEDA DEMOSTRAR mas adelante.
 *
 * ========================================================================
 * SE GUARDA LA VERSION, NO EL TEXTO
 * ========================================================================
 * Guardar el documento entero en cada reserva serian trescientas lineas
 * multiplicadas por cada cita. Se guarda el numero de version, y las
 * versiones son archivos del repositorio con su historia en git.
 *
 * LA CONSECUENCIA, QUE ES LA REGLA MAS IMPORTANTE DE ESTE ARCHIVO:
 * **corregir un texto ya publicado no es editar el archivo, es publicar una
 * version nueva.** Si se edita sin subir el numero, lo guardado apunta a un
 * texto que ya no es el que esa persona acepto, y entonces el registro
 * entero deja de servir para lo unico que existe.
 *
 * Se sube al cambiar EL FONDO, no una errata ni una coma.
 */

/**
 * Fecha de entrada en vigor de los dos documentos.
 *
 * Es una constante del codigo y no un ajuste del panel: la fecha va atada al
 * texto, y un texto que se publico el 28 no puede decir que rige desde el 30
 * porque alguien cambio un campo.
 */
export const LEGAL_EFFECTIVE_DATE = '2026-10-29';

/** Version vigente de los Terminos y Condiciones. Ver la regla de arriba. */
export const TERMS_VERSION = 1;

/** Version vigente de la Politica de Privacidad. Ver la regla de arriba. */
export const PRIVACY_VERSION = 2;

/** Las dos paginas publicas. El pie y la casilla enlazan aqui. */
export const LEGAL_PATHS = {
  terms: '/terms',
  privacy: '/privacy',
} as const;
export type LegalPath = (typeof LEGAL_PATHS)[keyof typeof LEGAL_PATHS];

/**
 * La aceptacion que viaja con la reserva.
 *
 * ========================================================================
 * SIN `.default()`, Y ESO ES LO QUE LA HACE OBLIGATORIA
 * ========================================================================
 * Un valor por defecto aqui significaria que el dia que el formulario tenga
 * un fallo se reservaria sin aceptacion y nadie se enteraria: la fila diria
 * «version 1» sin que nadie hubiera marcado nada. Preferimos que falle.
 *
 * Que el campo sea OPCIONAL en la peticion de reserva es otra cosa y esta
 * explicado en `booking.ts`: el panel crea reservas por telefono, donde no
 * hay ninguna casilla que marcar.
 */
export const LegalAcceptanceSchema = z.strictObject({
  termsVersion: z.int().positive(),
  privacyVersion: z.int().positive(),
});
export type LegalAcceptance = z.infer<typeof LegalAcceptanceSchema>;

/** Lo que manda el formulario cuando alguien marca la casilla. */
export function currentAcceptance(): LegalAcceptance {
  return { termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION };
}

/**
 * Si lo aceptado sigue siendo lo vigente.
 *
 * Existe para el panel: ante una reclamacion, lo primero que hay que saber no
 * es que acepto, sino SI LO QUE ACEPTO ES LO QUE HAY PUBLICADO HOY. Si no lo
 * es, la conversacion va sobre el texto viejo.
 */
export function acceptanceIsCurrent(aceptacion: LegalAcceptance | null): boolean {
  if (aceptacion === null) return false;
  return aceptacion.termsVersion === TERMS_VERSION && aceptacion.privacyVersion === PRIVACY_VERSION;
}
