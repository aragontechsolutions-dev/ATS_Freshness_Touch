import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { company } from '../config/company';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { PhoneIcon, SparkleIcon } from './Icons';

const NAV_ITEMS = [
  { href: '#services', key: 'nav.services' },
  { href: '#quote', key: 'nav.quote' },
  { href: '#areas', key: 'nav.areas' },
  { href: '#why-us', key: 'nav.whyUs' },
  { href: '#faq', key: 'nav.faq' },
] as const;

export function Header() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur
                       dark:border-slate-800 dark:bg-slate-950/90"
    >
      <div className="ft-container flex h-16 items-center justify-between gap-4">
        <a href="#top" className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
          <span className="rounded-lg bg-brand-700 p-1.5 text-white">
            <SparkleIcon className="h-4 w-4" />
          </span>
          {company.name}
        </a>

        <nav className="hidden items-center gap-6 lg:flex" aria-label={t('nav.menu')}>
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-brand-700
                         dark:text-slate-300 dark:hover:text-brand-400"
            >
              {t(item.key)}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={company.phoneHref}
            className="hidden items-center gap-2 text-sm font-semibold text-slate-700 sm:inline-flex
                       dark:text-slate-200"
          >
            <PhoneIcon className="h-4 w-4 text-brand-700 dark:text-brand-400" />
            {company.phoneDisplay}
          </a>
          <LanguageSwitcher />
          <ThemeToggle />
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold lg:hidden
                       dark:border-slate-700"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            {t('nav.menu')}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          className="border-t border-slate-200 lg:hidden dark:border-slate-800"
          aria-label={t('nav.menu')}
        >
          <ul className="ft-container flex flex-col py-2">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block py-2 text-sm font-medium text-slate-700 dark:text-slate-200"
                >
                  {t(item.key)}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
