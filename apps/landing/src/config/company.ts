/**
 * DATOS FIJOS DE LA EMPRESA
 * -------------------------
 * Aqui solo queda lo que NO cambia sin un cambio de codigo.
 *
 * El telefono, el correo y el horario ya no estan en este fichero: se guardan
 * en la base de datos y se editan desde el panel. Hasta la Etapa 2.3 vivian
 * aqui como marcadores inventados ("+1 (000) 000-0000"), esperando a que
 * alguien se acordara de sustituirlos antes de publicar. Ese es exactamente
 * el tipo de espera que acaba en una web publicada con un telefono falso.
 *
 * Ver `hooks/useBusinessSettings.tsx`.
 */
export const company = {
  name: 'Freshness Touch',

  /*
   * Base de operaciones. Debe coincidir con COMPANY_BASE_* de la API, que es
   * desde donde se calculan las distancias y los recargos por zona. No se
   * edita desde el panel a proposito: cambiarla moveria el origen de todos
   * los precios, y eso es una decision con consecuencias economicas, no un
   * dato de contacto.
   */
  city: 'Atlanta',
  state: 'GA',
} as const;
