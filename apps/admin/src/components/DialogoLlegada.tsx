import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { NavigationIcon, SpinnerIcon } from './Icons';

/**
 * «¿HAS LLEGADO?» AL VOLVER DE LA NAVEGACION
 * ==========================================
 * Quien pulso «Llévame allí» sale de la aplicacion, conduce, aparca y
 * vuelve. Lo que tiene delante es una pantalla con cinco secciones donde el
 * boton de fichar esta donde estaba, y lo primero que hace al llegar a una
 * casa no es leer una lista: es bajarse del coche.
 *
 * Esto pregunta directamente, y la respuesta hace exactamente lo mismo que
 * el boton. No lo sustituye: son dos caminos al mismo sitio.
 *
 * ==========================================================================
 * SE USA EL `<dialog>` DEL NAVEGADOR Y NO UN DIV CON POSICION FIJA
 * ==========================================================================
 * `showModal()` trae de serie tres cosas que a mano se olvidan y que aqui
 * importan: el foco se queda DENTRO —con un teclado o un lector de pantalla,
 * un cuadro falso deja el foco paseando por la pagina de detras—, la tecla
 * de escape lo cierra, y el fondo queda inerte.
 *
 * ==========================================================================
 * SE PUEDE DECIR QUE NO, Y EL «NO» NO CUESTA NADA
 * ==========================================================================
 * Puede aparecer mientras todavia se esta aparcando, o porque se abrio el
 * mapa para mirar la ruta y se volvio. Por eso el boton de descartar esta al
 * mismo nivel y no escondido: una pregunta de la que cuesta salir se
 * contesta que si para quitarsela de encima, y entonces el dato que registra
 * ya no vale nada.
 */

interface DialogoLlegadaProps {
  /** La calle, para que se vea que se pregunta por ESTA casa y no por otra. */
  direccion: string;
  ocupado: boolean;
  onConfirmar: () => void;
  onDescartar: () => void;
}

export function DialogoLlegada({
  direccion,
  ocupado,
  onConfirmar,
  onDescartar,
}: DialogoLlegadaProps) {
  const { t } = useTranslation();
  const dialogo = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const nodo = dialogo.current;

    /*
     * Se comprueba que exista antes de llamarla. `showModal` lleva anos en
     * todos los navegadores que esta PWA soporta, pero el entorno de las
     * pruebas no siempre la trae, y un cuadro que revienta al montarse
     * tumbaria la pantalla entera de quien esta trabajando.
     */
    if (nodo && typeof nodo.showModal === 'function' && !nodo.open) {
      nodo.showModal();
    }
  }, []);

  return (
    <dialog
      ref={dialogo}
      className="ft-dialogo"
      aria-labelledby="llegada-titulo"
      /*
       * La tecla de escape y el gesto de atras cierran el cuadro sin pasar
       * por ningun boton. Sin esto, el cuadro se cerraria y el recuerdo de
       * la navegacion seguiria ahi: volveria a preguntar al siguiente cambio
       * de aplicacion.
       */
      onClose={onDescartar}
    >
      <div className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <NavigationIcon className="mt-0.5 h-6 w-6 shrink-0 text-brand-700 dark:text-sun-300" />
          <div className="min-w-0">
            <h2 id="llegada-titulo" className="text-lg font-bold text-slate-900 dark:text-white">
              {t('admin.myJobs.arrivedTitle')}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{direccion}</p>
          </div>
        </div>

        <p className="text-sm text-slate-700 dark:text-slate-300">
          {t('admin.myJobs.arrivedBody')}
        </p>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="ft-btn-primary min-h-11 w-full"
            disabled={ocupado}
            onClick={onConfirmar}
          >
            {ocupado && <SpinnerIcon className="h-4 w-4 animate-spin" />}
            {t('admin.myJobs.arrivedConfirm')}
          </button>

          <button
            type="button"
            className="ft-btn-ghost min-h-11 w-full"
            disabled={ocupado}
            onClick={onDescartar}
          >
            {t('admin.myJobs.arrivedDismiss')}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default DialogoLlegada;
