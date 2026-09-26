import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  aplazar,
  barrerCaducados,
  descartar,
  encolar,
  hayCaducables,
  type Toast,
  type ToastNuevo,
} from '../lib/toast-queue';
import { AlertIcon, CheckCircleIcon, CloseIcon, InfoIcon } from './Icons';

interface ToastAPI {
  /** Algo salio bien y no hay nada mas que hacer. Se va solo. */
  success: (messageKey: string, extra?: Omit<ToastNuevo, 'tone' | 'messageKey'>) => void;
  /** Algo fallo. SE QUEDA hasta que se cierra. */
  error: (messageKey: string, extra?: Omit<ToastNuevo, 'tone' | 'messageKey'>) => void;
  /** Ni bien ni mal: ha pasado algo que conviene saber. Se va solo. */
  info: (messageKey: string, extra?: Omit<ToastNuevo, 'tone' | 'messageKey'>) => void;
}

const ToastContext = createContext<ToastAPI | null>(null);

/**
 * AVISOS EMERGENTES
 * -----------------
 * Antes, cada pantalla resolvia esto a su manera: un parrafo verde debajo del
 * boton en configuracion, otro en personal, y en la agenda directamente nada.
 * El resultado era que «guardado» aparecia en un sitio distinto en cada
 * formulario y, al guardar con la pagina desplazada, no aparecia en ninguno
 * visible.
 *
 * COMO SE ANUNCIAN (esto es lo que importa de verdad):
 *
 *   - Los correctos van en una region `role="status"` (`aria-live="polite"`):
 *     el lector de pantalla los lee cuando termine lo que esta diciendo.
 *   - Los errores van en `role="alert"` (`aria-live="assertive"`): esos si
 *     interrumpen, porque hay algo que corregir.
 *
 * Son DOS REGIONES SEPARADAS Y SIEMPRE PRESENTES en el arbol, aunque esten
 * vacias. Si se montaran al llegar el primer aviso, muchos lectores no
 * anunciarian ese primero: la region tiene que existir antes de que le metan
 * contenido.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  /*
   * LA PAUSA VIVE EN UNA REFERENCIA, NO EN UN ESTADO, Y NO ES UN ATAJO.
   *
   * La primera version guardaba el instante de la pausa en un estado y, al
   * reanudar, llamaba a `setToasts` DENTRO del actualizador de ese estado.
   * Parecia correcto y no lo era: React invoca los actualizadores dos veces
   * en modo estricto justamente para destapar esto, asi que el tiempo parado
   * se sumaba DOS VECES y los avisos se quedaban en pantalla el doble de lo
   * debido. Con siete segundos de lectura, no se iban nunca.
   *
   * Lo cazo la comprobacion en navegador, no las pruebas unitarias: la
   * logica de la cola era correcta; lo que estaba mal era como se la
   * llamaba. Aqui el instante de la pausa es un dato del que nadie depende
   * para pintar, asi que una referencia es su sitio; el estado `pausado`
   * existe solo para que el reloj sepa si debe correr.
   */
  const pausadoDesde = useRef<number | null>(null);
  const [pausado, setPausado] = useState(false);

  // Contador propio en vez de un identificador aleatorio: no hace falta que
  // sea impredecible, solo que no se repita dentro de la pantalla.
  const siguienteId = useRef(0);

  const empujar = useCallback((nuevo: ToastNuevo): void => {
    siguienteId.current += 1;
    const id = `toast-${siguienteId.current}`;
    setToasts((actuales) => encolar(actuales, nuevo, id, Date.now()));
  }, []);

  const api = useMemo<ToastAPI>(
    () => ({
      success: (messageKey, extra) => empujar({ ...extra, tone: 'success', messageKey }),
      error: (messageKey, extra) => empujar({ ...extra, tone: 'error', messageKey }),
      info: (messageKey, extra) => empujar({ ...extra, tone: 'info', messageKey }),
    }),
    [empujar],
  );

  /*
   * UN SOLO RELOJ PARA TODA LA PILA, y solo mientras hay algo que caduque.
   *
   * La alternativa —un temporizador por aviso— obliga a guardarlos, a
   * cancelarlos al cerrar a mano y a recrearlos al reanudar tras una pausa.
   * Son tres sitios donde se escapa un temporizador y deja de limpiarse.
   * Con una marca de tiempo por aviso y un barrido cada cuarto de segundo no
   * hay nada que cancelar.
   */
  useEffect(() => {
    if (pausado || !hayCaducables(toasts)) return;

    const reloj = setInterval(() => {
      setToasts((actuales) => {
        const vivos = barrerCaducados(actuales, Date.now());
        // Misma lista si no se fue nadie: evita repintar cuatro veces por segundo.
        return vivos.length === actuales.length ? actuales : vivos;
      });
    }, 250);

    return () => clearInterval(reloj);
  }, [toasts, pausado]);

  const pausar = useCallback(() => {
    if (pausadoDesde.current !== null) return; // ya estaba en pausa
    pausadoDesde.current = Date.now();
    setPausado(true);
  }, []);

  const reanudar = useCallback(() => {
    const inicio = pausadoDesde.current;
    if (inicio === null) return;
    pausadoDesde.current = null;
    // Lo que estuvo parado se devuelve integro a cada cuenta atras.
    setToasts((actuales) => aplazar(actuales, Date.now() - inicio));
    setPausado(false);
  }, []);

  const cerrar = useCallback((id: string) => {
    setToasts((actuales) => descartar(actuales, id));
  }, []);

  const correctos = toasts.filter((toast) => toast.tone !== 'error');
  const errores = toasts.filter((toast) => toast.tone === 'error');

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div
        className="ft-toast-pila"
        onMouseEnter={pausar}
        onMouseLeave={reanudar}
        onFocusCapture={pausar}
        onBlurCapture={reanudar}
      >
        {/*
          Las dos regiones existen siempre. `aria-relevant="additions"` evita
          que al irse un aviso el lector vuelva a leer los que quedan.
        */}
        <div role="status" aria-relevant="additions" className="contents">
          {correctos.map((toast) => (
            <Aviso key={toast.id} toast={toast} onCerrar={() => cerrar(toast.id)} />
          ))}
        </div>

        <div role="alert" aria-relevant="additions" className="contents">
          {errores.map((toast) => (
            <Aviso key={toast.id} toast={toast} onCerrar={() => cerrar(toast.id)} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

/**
 * El acceso de las pantallas a los avisos.
 *
 * Falla en voz alta si se usa fuera del proveedor. Devolver un objeto vacio
 * seria peor: los avisos dejarian de salir y no habria forma de saber por
 * que, que es como se pierde media tarde.
 */
export function useToast(): ToastAPI {
  const api = useContext(ToastContext);
  if (!api) {
    throw new Error('useToast() necesita estar dentro de <ToastProvider>.');
  }
  return api;
}

/* ------------------------------------------------------------------------ */

/**
 * El color de cada tono esta verificado contra el fondo de su tarjeta, en los
 * dos temas (ver `docs/09-identidad-visual.md`). Y el color NO es la unica
 * senal: cada tono lleva ademas su propio icono, porque quien no distingue
 * verde de rojo necesita poder verlo en la forma.
 */
const TONO = {
  success: {
    marco: 'border-green-600 dark:border-green-700',
    icono: 'text-green-700 dark:text-green-400',
    Icono: CheckCircleIcon,
  },
  error: {
    marco: 'border-red-600 dark:border-red-800',
    icono: 'text-red-700 dark:text-red-400',
    Icono: AlertIcon,
  },
  info: {
    marco: 'border-brand-600 dark:border-brand-700',
    icono: 'text-brand-700 dark:text-brand-300',
    Icono: InfoIcon,
  },
} as const;

function Aviso({ toast, onCerrar }: { toast: Toast; onCerrar: () => void }) {
  const { t } = useTranslation();
  const { marco, icono, Icono } = TONO[toast.tone];

  return (
    <div className={`ft-toast ${marco}`}>
      <Icono className={`mt-0.5 h-5 w-5 shrink-0 ${icono}`} />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t(toast.messageKey, { ...(toast.params ?? {}) })}
        </p>
        {/*
          Texto plano, siempre. Viene del servidor o del proveedor y React lo
          escapa: aqui no hay, ni puede haber, `dangerouslySetInnerHTML`.
        */}
        {toast.detail && (
          <p className="mt-1 font-mono text-xs break-words text-slate-600 dark:text-slate-400">
            {toast.detail}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onCerrar}
        aria-label={t('admin.toastClose')}
        className="-m-1 shrink-0 rounded-md p-1 text-slate-500 transition-colors
                   hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400
                   dark:hover:bg-night-700 dark:hover:text-slate-100"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
