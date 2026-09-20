import { useTranslation } from 'react-i18next';
import { company } from '../config/company';
import { Logo } from './Logo';

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-brand-50 py-12 dark:border-night-600 dark:bg-night-800/60">
      <div className="ft-container flex flex-col gap-4 text-sm text-slate-600 dark:text-slate-400">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Logo size="md" withTagline />
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              {company.city}, {company.state}
            </p>
          </div>
          <p>
            © {year} {company.name}. {t('footer.rights')}
          </p>
        </div>
        <p className="max-w-3xl text-xs leading-relaxed">{t('footer.legalNote')}</p>
      </div>
    </footer>
  );
}
