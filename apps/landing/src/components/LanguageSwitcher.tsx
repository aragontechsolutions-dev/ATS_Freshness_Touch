import { useTranslation } from 'react-i18next';
import type { Locale } from '@freshness/types';
import { supportedLocales } from '@freshness/i18n';
import { persistLocale } from '../i18n';
import { GlobeIcon } from './Icons';

const NOMBRE_IDIOMA: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
};

/**
 * Selector de idioma.
 *
 * Con solo dos idiomas, un boton que alterna ocupa la mitad que dos botones y
 * deja sitio en una cabecera de movil, donde cada pixel cuenta. Muestra el
 * idioma ACTIVO junto al globo; la etiqueta accesible dice a cual cambia, que
 * es la informacion que necesita quien no ve el icono.
 */
export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const actual = (i18n.resolvedLanguage ?? 'en') as Locale;
  const siguiente: Locale = supportedLocales.find((locale) => locale !== actual) ?? 'en';

  const cambiar = (): void => {
    void i18n.changeLanguage(siguiente);
    persistLocale(siguiente);
  };

  return (
    <button
      type="button"
      onClick={cambiar}
      lang={actual}
      title={`${NOMBRE_IDIOMA[actual]} → ${NOMBRE_IDIOMA[siguiente]}`}
      aria-label={`Change language to ${NOMBRE_IDIOMA[siguiente]}`}
      className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-slate-300 px-2.5
                 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100
                 dark:border-night-600 dark:text-slate-200 dark:hover:bg-night-700"
    >
      <GlobeIcon className="h-4 w-4 text-brand-700 dark:text-brand-300" />
      <span className="uppercase">{actual}</span>
    </button>
  );
}
