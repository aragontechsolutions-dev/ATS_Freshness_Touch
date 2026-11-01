import { REMOVAL_LINK_PATH, type Locale } from '@freshness/types';
import { rutaPara, type Pantalla } from '../rutas';
import { supportedLocales } from '@freshness/i18n';

/**
 * QUE PAGINAS EXISTEN DE CARA A UN BUSCADOR
 * =========================================
 * Una lista, y la unica. De aqui salen el `sitemap.xml`, el `canonical` de
 * cada pantalla y las alternativas de idioma.
 *
 * ==========================================================================
 * POR QUE NO SE DEDUCE DE `rutas.ts`
 * ==========================================================================
 * `rutas.ts` contesta «que pinto cuando llega esta direccion», y su respuesta
 * incluye cosas que un buscador NO debe tocar: el 404 y la pantalla de
 * retirar fotos. Son dos preguntas distintas y mezclarlas tiene una forma
 * concreta de salir mal: el dia que alguien anada una pantalla a `rutas.ts`,
 * aparecera en el `sitemap.xml` sin que nadie lo haya decidido.
 *
 * Aqui se dice explicitamente, pantalla por pantalla, si se indexa. Una
 * pantalla nueva no entra sola.
 *
 * ==========================================================================
 * LO QUE NUNCA SE INDEXA, Y NO ES UNA OPINION
 * ==========================================================================
 *   - `/retirar-fotos`. Es la pantalla a la que lleva el enlace de un correo
 *     para que un cliente retire sus fotos. El testigo viaja en el FRAGMENTO
 *     —detras de la almohadilla, que nunca llega al servidor— asi que no hay
 *     nada que se pueda filtrar por aqui. Pero una pantalla de tramite en los
 *     resultados de busqueda no sirve a nadie, y un rastreador pidiendola sin
 *     testigo solo produce ruido.
 *   - El 404. Ver la nota sobre el `noindex` mas abajo: en un sitio estatico
 *     no se puede contestar 404 de verdad, asi que el `noindex` es lo unico
 *     que impide que una direccion mal escrita acabe indexada como pagina.
 */

/** Cada cuanto cambia una pagina, para el `sitemap.xml`. */
export type Frecuencia = 'weekly' | 'yearly';

export interface PaginaIndexable {
  pantalla: Pantalla;
  /**
   * Prioridad relativa DENTRO de este sitio, de 0 a 1.
   *
   * Es una pista debil —los buscadores la usan poco o nada— y aqui esta por
   * una razon honesta: dice en que orden importan las tres paginas si alguna
   * vez hay que elegir. La portada es la que genera los ingresos; las legales
   * existen porque tienen que existir.
   */
  prioridad: number;
  frecuencia: Frecuencia;
  /** La clave de i18n del bloque con su titulo y su descripcion. */
  claveSeo: 'home' | 'terms' | 'privacy';
}

/**
 * LA RUTA NO SE GUARDA: SE PREGUNTA A `rutaPara`.
 *
 * Cada pagina existe en los dos idiomas (`/terms` y `/es/terms`), asi que
 * guardar «la ruta» aqui obligaria a guardar dos y a mantenerlas de acuerdo
 * con `rutas.ts`, que es quien de verdad decide que direccion lleva a que
 * pantalla. Tres listas que tienen que coincidir es una lista de mas.
 */
export function rutaDe(pagina: PaginaIndexable, locale: Locale): string {
  return rutaPara(pagina.pantalla, locale);
}

/** Los idiomas en los que existe cada pagina. Hoy, los dos. */
export const IDIOMAS: readonly Locale[] = supportedLocales;

/**
 * Las paginas que un buscador debe conocer.
 *
 * Son TRES, y conviene no maquillarlo: este sitio es una portada larga con
 * dos documentos legales detras. Las secciones (`#areas`, `#faq`) no son
 * paginas —son anclas de la misma— y listarlas en el `sitemap.xml` como si lo
 * fueran es una de las formas mas rapidas de que un sitio pequeno parezca
 * contenido duplicado.
 */
export const PAGINAS_INDEXABLES: readonly PaginaIndexable[] = [
  { pantalla: 'sitio', prioridad: 1, frecuencia: 'weekly', claveSeo: 'home' },
  { pantalla: 'terms', prioridad: 0.3, frecuencia: 'yearly', claveSeo: 'terms' },
  { pantalla: 'privacy', prioridad: 0.3, frecuencia: 'yearly', claveSeo: 'privacy' },
];

/**
 * Las rutas que se le piden a los rastreadores que no visiten.
 *
 * Va junto a `PAGINAS_INDEXABLES` porque son las dos mitades de la misma
 * decision, y separadas se desincronizan.
 */
export const RUTAS_PRIVADAS: readonly string[] = [REMOVAL_LINK_PATH];

/** La pagina indexable de una pantalla, si lo es. */
export function paginaDe(pantalla: Pantalla): PaginaIndexable | null {
  return PAGINAS_INDEXABLES.find((pagina) => pagina.pantalla === pantalla) ?? null;
}
