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
   * Base de operaciones, SOLO COMO RESPALDO.
   *
   * La sede de verdad es la que esta guardada en el panel: es el origen del
   * calculo de distancia y de los recargos por zona, y llega a la web dentro
   * del catalogo (`baseOfOperations`). Lo que se pinta sale de ahi.
   *
   * ESTOS DOS VALORES SOLO SE USAN MIENTRAS EL CATALOGO NO HA LLEGADO o si la
   * API no responde, para que la seccion de contacto no salga con un hueco.
   * Antes eran la unica fuente, escrita a mano, y eso permitia que la web
   * anunciara una ciudad mientras los precios se median desde otra: el
   * cliente leia "con base en X" y pagaba el traslado desde Y. Si la empresa
   * se muda, lo que hay que cambiar es el panel; esto es solo el texto que se
   * ensena durante los primeros milisegundos, asi que conviene mantenerlo al
   * dia, pero ya no manda.
   */
  city: 'Marietta',
  state: 'GA',
} as const;
