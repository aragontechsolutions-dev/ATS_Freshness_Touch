/**
 * EL FORMATO DE LOS DOCUMENTOS LEGALES
 * ====================================
 * Condiciones y privacidad son el unico texto del sitio que no vive en
 * `@freshness/i18n`, y conviene decir por que: los demas son frases sueltas
 * que se interpolan en una pantalla; estos son DOCUMENTOS, con su estructura,
 * sus tablas y su numeracion, y partirlos en trescientas claves planas los
 * haria imposibles de leer y de revisar.
 *
 * ========================================================================
 * LA PAGINA PUBLICADA ES EL DOCUMENTO
 * ========================================================================
 * No hay una copia en Markdown y otra aqui. Hubo las dos durante un rato y
 * es exactamente la clase de duplicado que se separa solo: se corrige una y
 * la otra se queda mintiendo. Lo que el cliente acepta es lo que esta
 * pagina ensena, asi que esta pagina es el original — y es lo que revisa el
 * abogado.
 *
 * ========================================================================
 * LOS DATOS DE LA EMPRESA NO SE ESCRIBEN AQUI
 * ========================================================================
 * Razon social, direccion postal, telefono y correo salen de los ajustes del
 * negocio. Si se escribieran en el texto habria que tocar codigo para
 * cambiar un telefono, y el sitio ya aprendio esa leccion con los numeros de
 * relleno (`docs/13` §12).
 *
 * Lo que no este configurado NO SE PINTA, igual que el telefono en el resto
 * del sitio: antes un hueco que un «[RAZON SOCIAL]» publicado.
 */

/** Un trozo del documento. Deliberadamente pocos tipos: no es un editor. */
export type Bloque =
  | { t: 'h2'; texto: string }
  | { t: 'h3'; texto: string }
  | { t: 'p'; texto: string }
  | { t: 'ul'; items: string[] }
  | { t: 'ol'; items: string[] }
  | { t: 'tabla'; cabecera: string[]; filas: string[][] }
  /** Un aviso destacado. Se usa poco a proposito: si todo destaca, nada destaca. */
  | { t: 'nota'; texto: string }
  /**
   * LOS DATOS DE CONTACTO DE LA EMPRESA.
   *
   * No lleva contenido: el bloque dice DONDE van y el renderizador los saca
   * de los ajustes del negocio. Lo que no este configurado no se pinta, igual
   * que el telefono en el resto del sitio: antes un hueco que un
   * «[RAZON SOCIAL]» publicado.
   */
  | { t: 'contacto' };

export interface Documento {
  titulo: string;
  bloques: Bloque[];
}

/**
 * Parte un texto en trozos normales y en negrita, por `**`.
 *
 * NO ES UN INTERPRETE DE MARKDOWN y no debe llegar a serlo: en cuanto admita
 * enlaces o HTML, el texto de un documento pasa a poder inyectar cosas en la
 * pagina. Aqui solo hay negrita, y lo que devuelve son cadenas que React
 * pinta como texto.
 */
export function partirNegritas(texto: string): { texto: string; fuerte: boolean }[] {
  return texto
    .split('**')
    .map((trozo, indice) => ({ texto: trozo, fuerte: indice % 2 === 1 }))
    .filter((trozo) => trozo.texto !== '');
}
