import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshIcon } from './Icons';

/**
 * ============================================================================
 * HAY UNA VERSION NUEVA
 * ============================================================================
 * Cuando el panel esta instalado en un movil, el navegador deja de traer la
 * version nueva sola: se queda con la que tiene guardada hasta que el service
 * worker la reemplaza. Sin este aviso, alguien podria estar usando durante
 * semanas un panel de hace tres despliegues sin enterarse.
 *
 * SE OFRECE, NO SE IMPONE, y esa es la decision de la pantalla. Recargar solo
 * en cuanto hay version nueva le borra a alguien el formulario que esta
 * rellenando —de pie en casa de un cliente, con el movil en una mano—. Aqui
 * se avisa y se espera.
 *
 * NO ES UN AVISO EMERGENTE de los que ya tiene el panel, y tampoco es un
 * descuido: aquellos se van solos a los pocos segundos y no llevan boton.
 * Este tiene que quedarse hasta que se decida, porque pide una accion.
 *
 * SE PUEDE POSPONER SIN MAS: al cerrarlo, la version nueva entra igualmente
 * la proxima vez que se abra la aplicacion. No se pierde nada, solo se
 * retrasa.
 * ============================================================================
 */
export function UpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [hayVersionNueva, setHayVersionNueva],
    updateServiceWorker,
  } = useRegisterSW();

  if (!hayVersionNueva) return null;

  return (
    <div
      /*
       * `status` y no `alert`: es informacion util, no un problema que haya
       * que corregir. Un `alert` interrumpe al lector de pantalla a media
       * frase, y esto no merece interrumpir a nadie.
       */
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-brand-700 bg-brand-700 px-4 py-3
                 text-white shadow-lg dark:border-brand-500 dark:bg-brand-500"
      style={{
        // Sin esto, en un iPhone el boton queda debajo de la barra del sistema.
        paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
      }}
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <RefreshIcon className="h-4 w-4 shrink-0" />
          {t('admin.pwa.updateAvailable')}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-700
                       transition-colors hover:bg-brand-50"
            onClick={() => void updateServiceWorker()}
          >
            {t('admin.pwa.updateNow')}
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/50 px-3 py-2 text-sm font-semibold
                       transition-colors hover:bg-white/10"
            onClick={() => setHayVersionNueva(false)}
          >
            {t('admin.pwa.updateLater')}
          </button>
        </div>
      </div>
    </div>
  );
}
