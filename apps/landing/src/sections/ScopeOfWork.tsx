import { useTranslation } from 'react-i18next';
import type { Locale } from '@freshness/types';
import { useCatalog } from '../hooks/useCatalog';
import { formatCents } from '../lib/format';
import { CheckIcon, CloseIcon } from '../components/Icons';
import { Reveal } from '../components/Reveal';

/**
 * QUE ENTRA Y QUE NO ENTRA EN UNA LIMPIEZA
 * ----------------------------------------
 * Los dos bloques tienen origenes distintos a proposito:
 *
 *   - LOS EXTRAS SALEN DEL CATALOGO, no de una lista escrita aqui. Son los
 *     mismos que el cotizador ofrece y al mismo precio, porque son los
 *     mismos datos: si manana el horno sube a 60 $ o se retira, esta
 *     seccion lo dice sola. Una lista escrita a mano se quedaria vieja el
 *     dia que alguien tocara la pantalla de Tarifas, y el sitio estaria
 *     prometiendo un precio que el cotizador no da.
 *
 *   - LO QUE NO SE LIMPIA ES TEXTO, y tiene que serlo: no es un producto
 *     que se pueda comprar, es una frontera del servicio.
 *
 * POR QUE ESTA LO QUE NO SE HACE EN LA PAGINA PRINCIPAL y no escondido en
 * las condiciones: casi todas las quejas de una limpieza salen de algo que
 * el cliente daba por incluido. Decirlo antes cuesta una seccion y evita la
 * discusion entera, que siempre acaba costando mas.
 */

/** El orden en que se leen. No es alfabetico: va de lo grande a lo pequeno. */
const NO_INCLUIDO = [
  'patios',
  'porches',
  'exteriorWindows',
  'windowTracks',
  'dishes',
  'walls',
  'fullFridgeAndCabinets',
  'smallAppliances',
] as const;

export function ScopeOfWork() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage as Locale;
  const { catalog } = useCatalog();

  const extras = catalog?.addOns ?? [];

  return (
    <section id="scope" className="py-12 sm:py-16 lg:py-20">
      <div className="ft-container">
        <h2 className="ft-rule text-3xl font-bold tracking-tight text-brand-800 dark:text-white">
          {t('scope.title')}
        </h2>
        <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">{t('scope.subtitle')}</p>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {/* ---------------------- Servicios adicionales ---------------------- */}
          <Reveal as="article" className="ft-card p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('scope.extrasTitle')}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {t('scope.extrasNote')}
            </p>

            <ul className="mt-5 space-y-3">
              {extras.map((extra) => (
                <li key={extra.code} className="flex items-start justify-between gap-4">
                  <span className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-400" />
                    {t(`addOns.${extra.code}`)}
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-brand-700 dark:text-brand-300">
                    {/*
                      Los que se cobran por unidad llevan el «/u» pegado: sin
                      el, «$6» junto a «$50» hace parecer barata una ventana
                      y cara la nevera, cuando son cuarenta ventanas.
                    */}
                    {formatCents(extra.unitAmountCents, locale)}
                    {extra.unit === 'PER_UNIT' && (
                      <span className="font-normal text-slate-500 dark:text-slate-400">
                        {' '}
                        {t('scope.perUnit')}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>

          {/* ------------------------ Lo que no se hace ------------------------ */}
          <Reveal as="article" delayMs={90} className="ft-card p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('scope.notIncludedTitle')}
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {t('scope.notIncludedNote')}
            </p>

            <ul className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {NO_INCLUIDO.map((clave) => (
                <li
                  key={clave}
                  className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300"
                >
                  {/*
                    La cruz es DECORATIVA: el encabezado de la tarjeta ya dice
                    que es lo que no se limpia, y repetirlo en cada linea
                    haria que un lector de pantalla leyera «no» ocho veces.
                  */}
                  <CloseIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
                  {t(`scope.notIncluded.${clave}`)}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
