import { useTranslation } from 'react-i18next';
import { CheckIcon, RefreshIcon, ShieldIcon, TagIcon } from '../components/Icons';

const ITEMS = [
  { key: 'insured', Icon: ShieldIcon },
  { key: 'vetted', Icon: CheckIcon },
  { key: 'transparent', Icon: TagIcon },
  { key: 'guarantee', Icon: RefreshIcon },
] as const;

export function WhyUs() {
  const { t } = useTranslation();

  return (
    <section id="why-us" className="bg-slate-50 py-16 lg:py-20 dark:bg-slate-900">
      <div className="ft-container">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t('whyUs.title')}
        </h2>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map(({ key, Icon }) => (
            <div key={key}>
              <span className="inline-flex rounded-lg bg-white p-2 text-brand-700 shadow-sm
                               dark:bg-slate-950 dark:text-brand-400">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">
                {t(`whyUs.${key}.title`)}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {t(`whyUs.${key}.body`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
