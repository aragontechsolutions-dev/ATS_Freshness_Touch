import type { Locale } from '@freshness/types';

const localeTag: Record<Locale, string> = { en: 'en-US', es: 'es-US' };

/**
 * La zona horaria de la empresa.
 *
 * Vive aqui y no repetida en cada pantalla porque la regla es de negocio y
 * no de maquetacion: TODO lo que sea una cita —cuando va un equipo a una
 * casa— se ensena en hora de Georgia, aunque quien mire este en otro sitio.
 * Lo contrario haria que el panel y el cliente hablaran de horas distintas
 * para la misma limpieza.
 *
 * Lo que NO es una cita —cuando alguien pulso un boton— va en la zona de
 * quien mira: ver `formatTimestamp`.
 */
export const TIMEZONE_EMPRESA = 'America/New_York';

export function formatCents(cents: number, locale: Locale = 'en'): string {
  return new Intl.NumberFormat(localeTag[locale], {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/** Fecha y hora en la zona horaria de la empresa, no en la del navegador. */
export function formatDateTime(iso: string, timeZone: string, locale: Locale = 'en'): string {
  return new Intl.DateTimeFormat(localeTag[locale], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

/**
 * Hoy, en la zona de la empresa.
 *
 * No vale la fecha del navegador: quien consulte desde otra zona horaria
 * podría estar ya en el día siguiente y vería la agenda equivocada.
 */
export function todayInTimezone(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/**
 * El dia de una fecha concreta, en la zona de la empresa.
 *
 * Comparable con `todayInTimezone`, y la unica forma correcta de agrupar
 * trabajos por dia: agruparlos por la fecha del NAVEGADOR contradice lo que
 * pone en la propia tarjeta, que va en la zona de la empresa. Un trabajo de
 * las nueve de la noche en Georgia se pinta como "hoy" y caeria bajo
 * "proximos", porque para el navegador en horario universal ya es manana.
 */
export function dateInTimezone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

/**
 * Marca de tiempo en la zona horaria de quien mira.
 *
 * A diferencia de una cita —que se ensena SIEMPRE en la zona de la empresa,
 * porque es la hora a la que el equipo se presenta en una casa— esto es el
 * registro de cuando alguien pulso un boton. Ahi lo util es "hace un rato"
 * desde donde esta quien lee, no una hora de Georgia que tiene que traducir.
 */
export function formatTimestamp(iso: string, locale: Locale = 'en'): string {
  return new Intl.DateTimeFormat(localeTag[locale], {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

/**
 * UNA DISTANCIA DE FICHAJE, EN LAS UNIDADES DEL PAIS.
 *
 * ========================================================================
 * PIES POR DEBAJO, MILLAS POR ENCIMA. NI METROS NI KILOMETROS.
 * ========================================================================
 * La empresa opera en Georgia y el resto de la interfaz ya habla en millas
 * —las del area de servicio, las del recargo por traslado—, asi que decir
 * los metros aqui obligaria a quien lee a cambiar de sistema a media
 * pantalla.
 *
 * Y millas a secas no sirve: los 60 metros de estar en la puerta son «0,04
 * millas», que no se puede leer. Por eso hay dos escalas.
 *
 * El corte esta en 1000 pies (unos 300 metros). Por debajo se cuentan pies,
 * que es como se habla de la distancia dentro de un barrio; por encima,
 * millas con un decimal.
 *
 * La API guarda METROS, que es lo correcto para un dato: una unidad sin
 * ambigüedad, sin conversion y sin decimales. La traduccion a pies pasa aqui,
 * en el unico sitio que se ocupa de como se lee algo.
 */
const PIES_POR_METRO = 3.280839895;
const PIES_POR_MILLA = 5280;
const CORTE_EN_PIES = 1000;

export function formatDistanciaDeFichaje(
  metros: number,
  locale: Locale = 'en',
): { value: string; unit: 'feet' | 'miles' } {
  const pies = metros * PIES_POR_METRO;

  if (pies < CORTE_EN_PIES) {
    /*
     * Redondeado a diez pies. Un fichaje viene de un GPS de movil contra un
     * punto interpolado sobre una calle: decir «187 pies» finge una
     * exactitud que no existe por ninguno de los dos lados.
     */
    const redondeado = Math.round(pies / 10) * 10;
    return {
      value: new Intl.NumberFormat(localeTag[locale]).format(redondeado),
      unit: 'feet',
    };
  }

  return {
    value: new Intl.NumberFormat(localeTag[locale], {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(pies / PIES_POR_MILLA),
    unit: 'miles',
  };
}
