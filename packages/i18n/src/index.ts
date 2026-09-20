import { en, type TranslationResources } from './en';
import { es } from './es';

export type { TranslationResources };
export { en, es };

export const defaultLocale = 'en' as const;
export const supportedLocales = ['en', 'es'] as const;

/** Recursos listos para i18next: { en: { translation }, es: { translation } }. */
export const resources = {
  en: { translation: en },
  es: { translation: es },
} as const;
