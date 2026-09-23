import type { Locale } from '@freshness/types';

const localeTag: Record<Locale, string> = { en: 'en-US', es: 'es-US' };

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
