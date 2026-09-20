import { useTranslation } from 'react-i18next';
import type { Locale } from '@freshness/types';
import { supportedLocales } from '@freshness/i18n';
import { persistLocale } from '../i18n';

/** Selector de idioma EN/ES. El idioma elegido se recuerda en el navegador. */
export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = i18n.resolvedLanguage as Locale;

  const change = (locale: Locale): void => {
    void i18n.changeLanguage(locale);
    persistLocale(locale);
  };

  return (
    <div
      className="inline-flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700"
      role="group"
      aria-label={t('common.language')}
    >
      {supportedLocales.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => change(locale)}
          aria-pressed={current === locale}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold uppercase transition-colors ${
            current === locale
              ? 'bg-brand-700 text-white'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          {locale}
        </button>
      ))}
    </div>
  );
}
