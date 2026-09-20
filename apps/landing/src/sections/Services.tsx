import { useTranslation } from 'react-i18next';
import type { Locale, ServiceType } from '@freshness/types';
import { useCatalog } from '../hooks/useCatalog';
import { formatCentsCompact } from '../lib/format';
import { SunflowerIcon } from '../components/Icons';
import { Reveal } from '../components/Reveal';

const SERVICE_ORDER: ServiceType[] = [
  'STANDARD',
  'DEEP',
  'MOVE_IN_OUT',
  'AIRBNB_TURNOVER',
  'POST_CONSTRUCTION',
  'COMMERCIAL',
];

export function Services() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage as Locale;
  const { catalog } = useCatalog();

  return (
    <section id="services" className="py-12 sm:py-16 lg:py-20">
      <div className="ft-container">
        <h2
          className="ft-rule text-3xl font-bold tracking-tight text-brand-800
                       dark:text-white"
        >
          {t('services.title')}
        </h2>
        <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
          {t('services.subtitle')}
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICE_ORDER.map((code, indice) => {
            const entry = catalog?.services.find((service) => service.code === code);

            return (
              <Reveal
                as="article"
                key={code}
                // Cascada corta: si el retardo creciera con cada tarjeta, las
                // ultimas tardarian demasiado en aparecer.
                delayMs={(indice % 3) * 90}
                className="ft-card ft-card-interactive flex flex-col p-6"
              >
                <span
                  className="w-fit rounded-xl bg-brand-50 p-2.5 text-brand-700
                                 dark:bg-night-700 dark:text-sun-400"
                >
                  <SunflowerIcon className="h-5 w-5" />
                </span>

                <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                  {t(`services.${code}.name`)}
                </h3>
                <p className="mt-2 grow text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {t(`services.${code}.description`)}
                </p>

                <p className="mt-5 text-sm font-semibold text-brand-700 dark:text-brand-300">
                  {entry === undefined
                    ? ' '
                    : entry.instantQuote
                      ? `${t('services.startingAt')} ${formatCentsCompact(entry.minimumCents, locale)}`
                      : t('services.requiresVisit')}
                </p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
