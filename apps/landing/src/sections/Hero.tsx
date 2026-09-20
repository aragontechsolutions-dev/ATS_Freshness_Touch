import { useTranslation } from 'react-i18next';
import { CheckIcon, ShieldIcon } from '../components/Icons';

export function Hero() {
  const { t } = useTranslation();
  const points = [t('hero.point1'), t('hero.point2'), t('hero.point3')];

  return (
    <section
      id="top"
      className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white
                                 dark:from-slate-900 dark:to-slate-950"
    >
      <div className="ft-container grid gap-10 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
        <div>
          <p
            className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1.5 text-xs
                        font-semibold text-brand-800 dark:bg-night-700 dark:text-sun-300"
          >
            <ShieldIcon className="h-4 w-4" />
            {t('hero.badge')}
          </p>

          <h1
            className="mt-5 text-4xl font-extrabold tracking-tight text-brand-800 sm:text-5xl
                         dark:text-white"
          >
            {t('hero.title')}
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            {t('hero.subtitle')}
          </p>

          <ul className="mt-6 space-y-2">
            {points.map((point) => (
              <li
                key={point}
                className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"
              >
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" />
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#quote" className="ft-btn-primary">
              {t('hero.primaryCta')}
            </a>
            <a href="#services" className="ft-btn-outline">
              {t('hero.secondaryCta')}
            </a>
          </div>
        </div>

        {/* Tarjeta ilustrativa: muestra de un vistazo como se compone el precio. */}
        <div className="ft-card p-6 lg:p-8">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {t('calculator.breakdown')}
          </p>
          <div className="mt-4 space-y-3 text-sm">
            {[
              { label: t('services.STANDARD.name'), value: '$185.00' },
              { label: t('addOns.INSIDE_OVEN'), value: '$35.00' },
              { label: t('frequency.BIWEEKLY'), value: '−$22.00' },
              { label: t('calculator.travelDeposit'), value: '$30.00' },
            ].map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between border-b border-dashed
                           border-slate-200 pb-2 dark:border-night-600"
              >
                <span className="text-slate-600 dark:text-slate-400">{row.label}</span>
                <span className="font-semibold text-slate-900 dark:text-white">{row.value}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            {t('quote.disclaimer.estimate')}
          </p>
        </div>
      </div>
    </section>
  );
}
