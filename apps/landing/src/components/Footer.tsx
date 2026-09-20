import { useTranslation } from 'react-i18next';
import { company } from '../config/company';

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-slate-50 py-10 dark:border-slate-800 dark:bg-slate-900">
      <div className="ft-container flex flex-col gap-4 text-sm text-slate-600 dark:text-slate-400">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            {company.name} · {company.city}, {company.state}
          </p>
          <p>
            © {year} {company.name}. {t('footer.rights')}
          </p>
        </div>
        <p className="max-w-3xl text-xs leading-relaxed">{t('footer.legalNote')}</p>
      </div>
    </footer>
  );
}
