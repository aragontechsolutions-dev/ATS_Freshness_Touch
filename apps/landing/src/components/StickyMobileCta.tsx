import { useTranslation } from 'react-i18next';
import { useBusinessContact } from '../hooks/useBusinessSettings';
import { ArrowRightIcon, WhatsAppIcon } from './Icons';

/**
 * Barra fija inferior en movil: escribir o cotizar, siempre a un toque.
 *
 * En sitios de servicios la mayoria del trafico es movil y la conversion
 * depende de tener la accion principal siempre visible.
 *
 * Detalles que importan en un movil real:
 *   - Respeta la franja inferior de los telefonos con gesto de inicio
 *     (`safe-area-inset-bottom`); sin eso, en un iPhone los botones quedan
 *     medio tapados por la barra del sistema.
 *   - Los botones miden 44 pixeles de alto, el minimo para tocar con el dedo.
 *   - El texto no se parte: en pantallas estrechas se abrevia con iconos.
 */
export function StickyMobileCta() {
  const { t } = useTranslation();
  const contacto = useBusinessContact();
  const whatsapp = contacto.whatsappHref();

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-canvas/95
                 px-3 pt-2.5 backdrop-blur sm:hidden dark:border-night-600 dark:bg-night-900/95"
      style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-stretch gap-2">
        {/* Sin numero, cotizar ocupa toda la barra en vez de dejar un hueco
            o un boton que no escribe a nadie. */}
        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="ft-btn-outline min-h-11 flex-1 px-3 py-2 text-sm whitespace-nowrap"
          >
            <WhatsAppIcon className="h-4 w-4 shrink-0" />
            {t('common.whatsapp')}
          </a>
        )}

        <a
          href="#quote"
          className="ft-btn-primary min-h-11 flex-[1.4] px-3 py-2 text-sm whitespace-nowrap"
        >
          {t('common.getQuote')}
          <ArrowRightIcon className="h-4 w-4 shrink-0" />
        </a>
      </div>
    </div>
  );
}
