import { useTranslation } from 'react-i18next';

const QUESTIONS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const;

/**
 * Preguntas frecuentes con <details>: accesible y funcional sin JavaScript.
 */
export function Faq() {
  const { t } = useTranslation();

  return (
    <section id="faq" className="bg-slate-50 py-16 lg:py-20 dark:bg-slate-900">
      <div className="ft-container max-w-3xl">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t('faq.title')}
        </h2>

        <div className="mt-8 space-y-3">
          {QUESTIONS.map((key) => (
            <details key={key} className="ft-card group p-5">
              <summary
                className="cursor-pointer list-none font-semibold text-slate-900
                                  marker:content-none dark:text-white"
              >
                <span className="flex items-center justify-between gap-4">
                  {t(`faq.${key}.q`)}
                  <span
                    className="text-brand-700 transition-transform group-open:rotate-45
                                   dark:text-brand-400"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {t(`faq.${key}.a`)}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
