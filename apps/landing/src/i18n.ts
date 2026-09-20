import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { defaultLocale, resources, supportedLocales } from '@freshness/i18n';
import type { Locale } from '@freshness/types';

const STORAGE_KEY = 'ft-locale';

function isSupported(value: string | null | undefined): value is Locale {
  return Boolean(value) && (supportedLocales as readonly string[]).includes(value as string);
}

/** Idioma inicial: eleccion guardada > idioma del navegador > ingles. */
function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isSupported(stored)) return stored;
  } catch {
    // localStorage puede estar bloqueado (modo privado): se ignora.
  }

  const navigatorLocale = navigator.language?.split('-')[0];
  return isSupported(navigatorLocale) ? navigatorLocale : defaultLocale;
}

export function persistLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Sin persistencia el idioma dura solo la sesion: comportamiento aceptable.
  }
  document.documentElement.lang = locale;
}

const initialLocale = detectLocale();

void i18next.use(initReactI18next).init({
  resources,
  lng: initialLocale,
  fallbackLng: defaultLocale,
  supportedLngs: [...supportedLocales],
  interpolation: {
    // React ya escapa el contenido: escapar dos veces romperia los textos.
    escapeValue: false,
  },
  returnNull: false,
});

document.documentElement.lang = initialLocale;

export default i18next;
