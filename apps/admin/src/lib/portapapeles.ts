/**
 * COPIAR AL PORTAPAPELES, SABIENDO QUE PUEDE NO PODERSE
 * =====================================================
 * `navigator.clipboard` no esta siempre. Falta en contextos no seguros, el
 * navegador puede negar el permiso, y en algunos moviles falla sin decir por
 * que.
 *
 * ========================================================================
 * POR ESO DEVUELVE SI PUDO, Y NO LANZA
 * ========================================================================
 * Un boton de copiar que falla en silencio es de los peores: la persona cree
 * que tiene algo en el portapapeles, pega, y sale lo de antes. Quien llama
 * tiene que poder ENSENAR el texto para que se copie a mano, y para eso
 * necesita saber que no se pudo.
 */
export async function copiarAlPortapapeles(texto: string): Promise<boolean> {
  try {
    // El encadenamiento opcional no sobra: en un contexto no seguro
    // `navigator.clipboard` es `undefined`, no un objeto que falle.
    if (typeof navigator.clipboard?.writeText !== 'function') return false;

    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}
