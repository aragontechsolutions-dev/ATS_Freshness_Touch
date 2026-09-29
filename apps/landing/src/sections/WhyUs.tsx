import { useTranslation } from 'react-i18next';
import { CheckIcon, RefreshIcon, ShieldIcon, TagIcon } from '../components/Icons';
import { useSiteText } from '../hooks/useSiteCopy';
import { Reveal } from '../components/Reveal';

const ITEMS = [
  { key: 'insured', Icon: ShieldIcon },
  { key: 'vetted', Icon: CheckIcon },
  { key: 'transparent', Icon: TagIcon },
  { key: 'guarantee', Icon: RefreshIcon },
] as const;

export function WhyUs() {
  const { t } = useTranslation();
  /*
   * Las cuatro promesas se pueden reescribir desde el panel: son
   * afirmaciones sobre como opera la empresa —la poliza, la verificacion de
   * antecedentes, la garantia— y cambian cuando cambia el negocio, no
   * cuando se despliega. El titulo de la seccion no: ese es rotulo.
   */
  const { texto } = useSiteText();

  return (
    <section id="why-us" className="bg-brand-50 py-12 sm:py-16 lg:py-20 dark:bg-night-800">
      <div className="ft-container">
        <h2
          className="ft-rule text-3xl font-bold tracking-tight text-brand-800
                       dark:text-white"
        >
          {t('whyUs.title')}
        </h2>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map(({ key, Icon }, indice) => (
            <Reveal key={key} delayMs={indice * 90}>
              <span
                className="inline-flex rounded-lg bg-white p-2 text-brand-700 shadow-sm
                               dark:bg-night-900 dark:text-brand-300"
              >
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">
                {texto(`whyUs.${key}.title`)}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {texto(`whyUs.${key}.body`)}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
