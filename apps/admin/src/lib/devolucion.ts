/**
 * EL IMPORTE QUE SE VA A DEVOLVER, LEIDO DE UN CAMPO DE TEXTO
 * ----------------------------------------------------------
 * Vive aparte del componente porque es la parte que se puede equivocar en
 * silencio: un `parseFloat` que devuelve `NaN`, una coma en vez de un punto,
 * un cero que no es un importe. Aqui se prueba sola, sin montar una pantalla.
 *
 * SE TECLEA EN DOLARES Y SE MANDA EN CENTAVOS, igual que en la pantalla de
 * tarifas y por lo mismo: nadie piensa en centavos, y un cero de mas en un
 * campo de centavos es una devolucion diez veces mayor que nadie revisa.
 */

/**
 * Devuelve los centavos a devolver, o `null` si lo tecleado no sirve.
 *
 * `null` apaga el boton: es mejor que dejar que el servidor rechace una
 * peticion cuyo resultado ya se sabia.
 *
 *   - VACIO significa «todo lo que quede», que es el caso mas habitual.
 *   - Lo que no es un numero, el cero y los negativos no son importes.
 *   - Mas de lo que queda tampoco: el servidor lo rechazaria con el mismo
 *     limite, calculado con la misma funcion del contrato.
 */
export function centavosADevolver(texto: string, devolvibleCents: number): number | null {
  if (devolvibleCents <= 0) return null;
  if (texto.trim() === '') return devolvibleCents;

  /*
   * `Number.parseFloat` es demasiado permisivo para esto: con «12abc»
   * devuelve 12, y con «1,5» devuelve 1 —se come la coma decimal de media
   * Europa y cobra uno en vez de uno cincuenta—. La forma se comprueba
   * antes, y lo que no la cumple no es un importe.
   */
  if (!/^\d+(\.\d{1,2})?$/.test(texto.trim())) return null;

  const centavos = Math.round(Number.parseFloat(texto.trim()) * 100);

  if (!Number.isFinite(centavos) || centavos <= 0) return null;
  if (centavos > devolvibleCents) return null;

  return centavos;
}
