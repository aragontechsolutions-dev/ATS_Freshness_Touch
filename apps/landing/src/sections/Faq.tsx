import { useTranslation } from 'react-i18next';

import { Reveal } from '../components/Reveal';
import { useSiteText } from '../hooks/useSiteCopy';

const QUESTIONS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const;

/**
 * Preguntas frecuentes con <details>: accesible y funcional sin JavaScript.
 */
export function Faq() {
  const { t } = useTranslation();
  /*
   * Las seis preguntas se pueden reescribir desde el panel. No son adorno:
   * aqui viven el plazo para cancelar, como se explica el deposito y la
   * politica de propinas, que son promesas que la empresa cumple y que
   * cambian sin que cambie el codigo. El titulo de la seccion no se edita.
   */
  const { texto } = useSiteText();

  return (
    <section id="faq" className="bg-brand-50 py-12 sm:py-16 lg:py-20 dark:bg-night-800">
      <div className="ft-container max-w-3xl">
        <h2
          className="ft-rule text-3xl font-bold tracking-tight text-brand-800
                       dark:text-white"
        >
          {t('faq.title')}
        </h2>

        <div className="mt-8 space-y-3">
          {QUESTIONS.map((key, indice) => (
            <Reveal key={key} delayMs={indice * 70}>
              <details className="ft-card group p-5">
                <summary
                  className="cursor-pointer list-none font-semibold text-slate-900
                                  marker:content-none dark:text-white"
                >
                  <span className="flex items-center justify-between gap-4">
                    {texto(`faq.${key}.q`)}
                    <span
                      className="text-brand-700 transition-transform group-open:rotate-45
                                   dark:text-brand-300"
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {texto(`faq.${key}.a`)}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
