import { useTranslation } from 'react-i18next';
import { company } from '../config/company';
import { PhoneIcon } from './Icons';

/**
 * Barra fija inferior en movil: llamar o cotizar siempre a un toque.
 * Es la practica estandar en sitios de servicios, donde la mayoria del
 * trafico es movil y la conversion depende de tener el CTA siempre visible.
 */
export function StickyMobileCta() {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3
                    backdrop-blur sm:hidden dark:border-slate-800 dark:bg-slate-950/95">
      <div className="flex gap-2">
        <a href={company.phoneHref} className="ft-btn-secondary flex-1 py-2.5">
          <PhoneIcon className="h-4 w-4" />
          {t('common.callUs')}
        </a>
        <a href="#quote" className="ft-btn-primary flex-1 py-2.5">
          {t('common.getQuote')}
        </a>
      </div>
    </div>
  );
}
