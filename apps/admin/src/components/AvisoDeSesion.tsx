import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertIcon, RefreshIcon, SpinnerIcon } from './Icons';

/**
 * «TU SESION SE ACABA EN N MINUTOS»
 * =================================
 * Una franja debajo de la cabecera, con un boton que la renueva.
 *
 * ==========================================================================
 * POR QUE UNA FRANJA Y NO UN CUADRO MODAL
 * ==========================================================================
 * Un modal tapa la pantalla y atrapa el foco. Esto puede aparecer mientras
 * alguien esta de pie en la puerta de una casa a punto de fichar: taparle el
 * boton de fichar para avisarle de que podria perder la sesion seria
 * provocar el dano que el aviso intenta evitar.
 *
 * La franja ocupa una linea, se lee de un vistazo y no impide nada. Si la
 * persona decide seguir fichando y renovar despues, puede.
 *
 * ==========================================================================
 * Y POR QUE NO SE PUEDE CERRAR
 * ==========================================================================
 * No lleva «cerrar» a proposito, y es la unica franja del panel que no lo
 * lleva: cerrarla no arregla nada —la sesion sigue acabandose— y lo unico
 * que conseguiria es que el aviso desapareciera justo cuando empieza a ser
 * verdad. Se quita renovando, que es lo que hay que hacer.
 *
 * Desaparece sola en cuanto la sesion se renueva, por si misma o pulsando:
 * quien lo pinta mira la fecha, no un interruptor.
 */
interface AvisoDeSesionProps {
  /** Minutos redondeados que quedan. `0` significa que ya se acabo. */
  minutos: number;
  /** Pide un token nuevo. Puede fallar sin cerrar la sesion. */
  onRenovar: () => Promise<void>;
}

export function AvisoDeSesion({ minutos, onRenovar }: AvisoDeSesionProps) {
  const { t } = useTranslation();
  const [renovando, setRenovando] = useState(false);

  const renovar = async (): Promise<void> => {
    setRenovando(true);
    try {
      await onRenovar();
    } finally {
      /*
       * Se suelta el boton SIEMPRE, tambien al fallar.
       *
       * Si solo se soltara al salir bien, un fallo de red —el caso para el
       * que existe este aviso— dejaria el boton girando para siempre y sin
       * forma de reintentar. Y no se deja girando "hasta que el aviso
       * desaparezca" porque el aviso puede no desaparecer: eso es
       * precisamente lo que pasa cuando la renovacion no sale.
       */
      setRenovando(false);
    }
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2 border-b border-amber-300 bg-amber-100 px-4
                 py-2 text-sm dark:border-amber-700 dark:bg-amber-950"
      role="status"
    >
      <AlertIcon className="h-4 w-4 shrink-0 text-amber-800 dark:text-amber-300" />
      <p className="min-w-0 flex-1 font-medium text-amber-900 dark:text-amber-200">
        {minutos > 0
          ? t('admin.session.expiringSoon', { count: minutos })
          : t('admin.session.expired')}
      </p>
      <button
        type="button"
        className="ft-btn-ghost min-h-9 shrink-0 px-3 text-xs"
        disabled={renovando}
        onClick={() => void renovar()}
      >
        {renovando ? (
          <SpinnerIcon className="h-4 w-4 animate-spin" />
        ) : (
          <RefreshIcon className="h-4 w-4" />
        )}
        {t('admin.session.stayIn')}
      </button>
    </div>
  );
}

export default AvisoDeSesion;
