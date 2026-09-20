import type { Locale } from '@freshness/types';

const localeTag: Record<Locale, string> = {
  en: 'en-US',
  es: 'es-US',
};

/**
 * Formatea centavos como moneda. El dinero se transporta siempre en centavos
 * enteros y solo se convierte a texto en el ultimo momento, aqui.
 */
export function formatCents(cents: number, locale: Locale = 'en'): string {
  return new Intl.NumberFormat(localeTag[locale], {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/** Version compacta sin decimales, para titulares de precio. */
export function formatCentsCompact(cents: number, locale: Locale = 'en'): string {
  return new Intl.NumberFormat(localeTag[locale], {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatDate(isoDate: string, locale: Locale = 'en'): string {
  return new Intl.DateTimeFormat(localeTag[locale], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(isoDate));
}

export function formatMiles(miles: number, locale: Locale = 'en'): string {
  return new Intl.NumberFormat(localeTag[locale], { maximumFractionDigits: 0 }).format(miles);
}
