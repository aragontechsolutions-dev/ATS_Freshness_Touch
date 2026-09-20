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

/**
 * Hora local de la empresa ("14:30") en el formato que espera el idioma.
 *
 * Se ancla a una fecha fija en UTC para que el navegador no la desplace a su
 * propia zona horaria: la hora ya viene resuelta en la de la empresa, y
 * volver a convertirla la movería.
 */
export function formatTime(localTime: string, locale: Locale = 'en'): string {
  const [hours, minutes] = localTime.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return localTime;

  const anchor = new Date(Date.UTC(2000, 0, 1, hours, minutes));
  return new Intl.DateTimeFormat(localeTag[locale], {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(anchor);
}

/**
 * Duracion en minutos como "2 hr 30 min" / "2 h 30 min".
 *
 * La unidad la pone Intl, no una cadena escrita a mano: asi cada idioma usa
 * su propia abreviatura sin que haya que mantenerlas en el codigo.
 */
export function formatDuration(minutes: number, locale: Locale = 'en'): string {
  const unidad = (value: number, unit: 'hour' | 'minute'): string =>
    new Intl.NumberFormat(localeTag[locale], {
      style: 'unit',
      unit,
      unitDisplay: 'short',
    }).format(value);

  const horas = Math.floor(minutes / 60);
  const restantes = minutes % 60;

  const partes: string[] = [];
  if (horas > 0) partes.push(unidad(horas, 'hour'));
  if (restantes > 0 || horas === 0) partes.push(unidad(restantes, 'minute'));

  return partes.join(' ');
}

/** Fecha larga con dia de la semana, para confirmar una cita. */
export function formatDateTimeLong(iso: string, timeZone: string, locale: Locale = 'en'): string {
  return new Intl.DateTimeFormat(localeTag[locale], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

/** Solo la hora de un instante, en la zona horaria indicada. */
export function formatTimeInZone(iso: string, timeZone: string, locale: Locale = 'en'): string {
  return new Intl.DateTimeFormat(localeTag[locale], {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso));
}

/**
 * Fecha de hoy (AAAA-MM-DD) en la zona horaria de la empresa.
 *
 * No vale `new Date()` del navegador: alguien que consulte desde California a
 * las 22:00 esta ya en el dia siguiente en Georgia, y veria como disponible
 * un dia que para la empresa ya paso.
 */
export function todayInTimezone(timeZone: string): string {
  // "en-CA" produce exactamente AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Suma dias a una fecha AAAA-MM-DD sin tocar zonas horarias. */
export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const result = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days));
  return result.toISOString().slice(0, 10);
}
