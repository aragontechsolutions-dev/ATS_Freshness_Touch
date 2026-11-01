import { useTranslation } from 'react-i18next';
import type { Locale } from '@freshness/types';
import { rutaPara } from '../lib/rutas';

/**
 * LOS ENLACES DE DENTRO DEL SITIO, EN EL IDIOMA QUE SE ESTA LEYENDO
 * ================================================================
 * Cuatro sitios del codigo enlazaban a `/terms` y `/privacy` con la ruta
 * escrita tal cual: el pie, el paso de datos de la reserva y el 404 (dos
 * veces). Con el idioma en la direccion eso se convirtio en un fallo con una
 * forma muy concreta:
 *
 *   Alguien leyendo `/es` pulsa «Condiciones del servicio», aterriza en
 *   `/terms` —la version inglesa— y se encuentra un contrato en un idioma que
 *   no es el suyo. Justo en la pantalla donde acepta algo.
 *
 * Y para un buscador es la otra mitad del problema: si ningun enlace de
 * dentro del sitio apunta a `/es/terms`, esa direccion solo existe en el
 * `sitemap.xml`, y una pagina a la que no enlaza nada se rastrea mal y se
 * posiciona peor.
 *
 * ==========================================================================
 * UN GANCHO Y NO UNA FUNCION SUELTA
 * ==========================================================================
 * Porque hace falta saber el idioma activo, y eso lo tiene i18next. Pasarlo
 * por propiedad a cada componente que enlaza seria cuatro sitios donde
 * olvidarse.
 */
export interface EnlacesInternos {
  terms: string;
  privacy: string;
  /** La portada del idioma actual: `/` o `/es`. */
  portada: string;
  /**
   * Una seccion de la portada: `/#quote` o `/es#quote`.
   *
   * Se construye aqui en vez de escribir `'/#quote'` porque en espanol la
   * portada es `/es`, y `'/#quote'` llevaria a la inglesa perdiendo el idioma
   * y el sitio al que se iba.
   */
  seccion: (ancla: string) => string;
}

export function useEnlacesInternos(): EnlacesInternos {
  const { i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? 'en') as Locale;

  const portada = rutaPara('sitio', locale);

  return {
    terms: rutaPara('terms', locale),
    privacy: rutaPara('privacy', locale),
    portada,
    seccion: (ancla) => `${portada}#${ancla}`,
  };
}
