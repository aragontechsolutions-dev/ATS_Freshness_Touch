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
