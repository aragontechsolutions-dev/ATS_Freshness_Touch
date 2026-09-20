import { useTranslation } from 'react-i18next';
import type { Locale } from '@freshness/types';
import { useCatalog } from '../hooks/useCatalog';
import { formatCentsCompact } from '../lib/format';
import { MapPinIcon } from '../components/Icons';

/**
 * Zonas de servicio. Los datos vienen del catalogo de la API, de modo que
 * si la empresa cambia sus zonas o recargos, la web se actualiza sola.
 */
export function ServiceAreas() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage as Locale;
  const { catalog } = useCatalog();

  const zones = catalog?.zones ?? [];
  // Radio maximo atendido: el mayor limite de las zonas con distancia definida.
  const maxServiceableMiles = zones.reduce(
    (max, zone) => (zone.maxMiles !== null && zone.maxMiles > max ? zone.maxMiles : max),
    0,
  );

  return (
    <section id="areas" className="py-16 lg:py-20">
      <div className="ft-container">
        <h2
          className="ft-rule text-3xl font-bold tracking-tight text-brand-800
                       dark:text-white"
        >
          {t('areas.title')}
        </h2>
        <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">{t('areas.subtitle')}</p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {zones.map((zone) => (
            <div key={zone.code} className="ft-card p-5">
              <span
                className="inline-flex items-center gap-2 text-sm font-bold text-brand-700
                               dark:text-brand-300"
              >
                <MapPinIcon className="h-4 w-4" />
                {zone.serviceable
                  ? t('areas.zoneLabel', { zone: zone.code })
                  : t('areas.outOfRange')}
              </span>

              {zone.serviceable && (
                <>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    {zone.maxMiles === null
                      ? t('areas.beyondMiles', { miles: maxServiceableMiles })
                      : t('areas.upToMiles', { miles: zone.maxMiles })}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                    {zone.surchargeCents === 0
                      ? t('areas.noSurcharge')
                      : t('areas.surcharge', {
                          amount: formatCentsCompact(zone.surchargeCents, locale),
                        })}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
