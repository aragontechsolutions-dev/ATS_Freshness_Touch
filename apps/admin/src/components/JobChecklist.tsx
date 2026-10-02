import { useTranslation } from 'react-i18next';
import {
  checklistItemTextKey,
  checklistRoomTextKey,
  checklistRoomsPresent,
  pendingChecklistCount,
  type JobChecklistEntry,
  type Locale,
} from '@freshness/types';
import { formatTimestamp } from '../lib/format';
import { ClipboardCheckIcon, SpinnerIcon } from './Icons';

/**
 * LA LISTA DE VERIFICACION DE UN TRABAJO
 * ======================================
 * Que hay que hacer en cada estancia de la casa, marcado a medida que se
 * hace. Es lo que convierte la pantalla de limpieza de «donde voy» en «que
 * hago».
 *
 * ========================================================================
 * UN SOLO COMPONENTE PARA LAS DOS PANTALLAS, Y LA DIFERENCIA ES `onToggle`
 * ========================================================================
 * Lo usan la pantalla de limpieza —donde se marca— y el detalle del panel
 * —donde solo se lee—. Sin `onToggle` las tareas se pintan como texto y no
 * como casillas.
 *
 * NO ES AHORRO DE CODIGO: es que coordinacion y limpieza vean la MISMA lista
 * del mismo trabajo. Dos componentes acabarian divergiendo —un orden
 * distinto, una tarea retirada que uno esconde y el otro no— y esa es
 * exactamente la clase de discrepancia que convierte «yo lo marque» en una
 * discusion sin arbitro.
 *
 * ========================================================================
 * EL PANEL NO PUEDE MARCAR, Y ES DELIBERADO
 * ========================================================================
 * Lo que ocurre en la casa lo marca quien esta alli. Si coordinacion pudiera
 * marcar desde la oficina, la lista dejaria de ser el registro de lo que se
 * hizo y pasaria a ser el registro de lo que alguien cree que se hizo, que no
 * sirve para nada de lo que esta lista tiene que servir.
 */

interface JobChecklistProps {
  entries: readonly JobChecklistEntry[];
  locale: Locale;
  /**
   * Marcar o desmarcar. SIN ESTO LA LISTA ES DE SOLO LECTURA, que es como la
   * ve el panel.
   */
  onToggle?: (code: string, done: boolean) => void;
  /** El codigo que se esta guardando ahora mismo, si hay alguno. */
  guardando?: string | null;
}

export function JobChecklist({ entries, locale, onToggle, guardando }: JobChecklistProps) {
  const { t } = useTranslation();

  /*
   * LA SECCION NO SE PINTA SI NO HAY LISTA, y hoy es el caso normal: las
   * tareas de las plantillas del cliente estan pendientes de transcribir, asi
   * que el catalogo esta vacio.
   *
   * Una tarjeta vacia que dijera «sin tareas» seria peor que nada: en la
   * puerta de una casa parece que la lista se ha perdido.
   */
  if (entries.length === 0) return null;

  const pendientes = pendingChecklistCount(entries);
  const estancias = checklistRoomsPresent(entries);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <ClipboardCheckIcon className="h-5 w-5 shrink-0 text-brand-700 dark:text-sun-300" />
          {t('checklist.title')}
        </h3>
        {/*
          EL CONTADOR AVISA, NO BLOQUEA. Un trabajo se puede terminar con
          tareas sin marcar, por el mismo motivo por el que el fichaje nunca
          se bloquea: el boton de «he terminado» es lo que registra la salida.
        */}
        <p
          className={
            pendientes === 0
              ? 'text-xs font-semibold text-green-700 dark:text-green-400'
              : 'text-xs font-semibold text-slate-600 dark:text-slate-400'
          }
        >
          {pendientes === 0
            ? t('checklist.allDone')
            : /*
               * DOS REDACCIONES PARA EL MISMO NUMERO, segun quien lo lee.
               * «Te quedan 3» es trabajo pendiente para quien esta en la
               * casa. Para coordinacion, que lee un trabajo ya cerrado, ese 3
               * significa «3 se quedaron sin marcar», que no es lo mismo ni
               * se actua igual.
               */
              t(onToggle ? 'checklist.pending' : 'checklist.notTicked', { count: pendientes })}
        </p>
      </div>

      {estancias.map((estancia) => (
        <div key={estancia}>
          <p className="mb-1 text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {t(checklistRoomTextKey(estancia))}
          </p>
          <ul className="divide-y divide-slate-200 dark:divide-slate-700">
            {entries
              .filter((entrada) => entrada.room === estancia)
              .map((entrada) => (
                <Tarea
                  key={entrada.code}
                  entrada={entrada}
                  locale={locale}
                  onToggle={onToggle}
                  guardandoEsta={guardando === entrada.code}
                />
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/* ------------------------------------------------------------------------ */

function Tarea({
  entrada,
  locale,
  onToggle,
  guardandoEsta,
}: {
  entrada: JobChecklistEntry;
  locale: Locale;
  onToggle?: (code: string, done: boolean) => void;
  guardandoEsta: boolean;
}) {
  const { t } = useTranslation();

  const texto = t(checklistItemTextKey(entrada.code));
  const quien =
    entrada.done && entrada.doneByFirstName !== null && entrada.doneAt !== null
      ? t('checklist.doneBy', {
          name: entrada.doneByFirstName,
          time: formatTimestamp(entrada.doneAt, locale),
        })
      : null;

  const detalle = (
    <>
      <span
        className={
          entrada.done
            ? 'text-slate-500 line-through dark:text-slate-400'
            : 'text-slate-900 dark:text-slate-100'
        }
      >
        {texto}
      </span>
      {/*
        Una tarea marcada cuando se pedia y que ya no se pide. Se dice en
        pantalla en vez de esconderla: si se ocultara, un trabajo de hace tres
        meses parecerian siete tareas cuando se hicieron nueve.
      */}
      {entrada.retired && (
        <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
          ({t('checklist.retired')})
        </span>
      )}
      {quien !== null && (
        <span className="block text-xs text-slate-500 dark:text-slate-400">{quien}</span>
      )}
    </>
  );

  /*
   * SOLO LECTURA: sin `onToggle`, o en una tarea retirada.
   *
   * Una retirada no se puede marcar aunque se vea: es trabajo que la empresa
   * ya no hace, y ofrecer la casilla invitaria a marcar hoy algo que hoy no
   * se pide.
   */
  if (!onToggle || entrada.retired) {
    return (
      <li className="flex items-start gap-3 py-2.5 text-sm">
        {/*
          UNA RETIRADA SE PINTA APAGADA, NO EN VERDE.
          En la pantalla de limpieza convive con casillas azules marcables, y
          en verde se leeria como «esta mas hecha que las demas». Es lo
          contrario: es historia de un trabajo, no trabajo de hoy.
        */}
        <CasillaDibujada done={entrada.done} apagada={entrada.retired} />
        <span className="min-w-0">{detalle}</span>
      </li>
    );
  }

  return (
    <li>
      {/*
        UNA ETIQUETA CON SU CASILLA DE VERDAD, no un `div` con `onClick`.
        Con una casilla real se puede marcar con el teclado, el lector de
        pantalla dice «marcada / sin marcar», y el area pulsable es toda la
        linea —que a 390 px y con guantes es la diferencia entre acertar y no—.

        `py-3` y no `py-2`: 44 px de alto es el minimo que se acierta de pie.
      */}
      <label className="flex cursor-pointer items-start gap-3 py-3 text-sm">
        <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
          <input
            type="checkbox"
            className="h-6 w-6 rounded border-slate-400 text-brand-700 focus:ring-2 focus:ring-brand-500 dark:border-slate-500"
            checked={entrada.done}
            /*
             * Se deshabilita SOLO la que se esta guardando, no la lista
             * entera: bloquear todo en cada toque haria que marcar cinco
             * tareas seguidas —que es como se usa— fuera imposible.
             */
            disabled={guardandoEsta}
            onChange={(e) => onToggle(entrada.code, e.target.checked)}
          />
          {guardandoEsta && (
            <SpinnerIcon className="pointer-events-none absolute h-4 w-4 text-brand-700 dark:text-sun-300" />
          )}
        </span>
        <span className="min-w-0">{detalle}</span>
      </label>
    </li>
  );
}

/**
 * La casilla de una lista que no se puede tocar.
 *
 * Se dibuja en vez de usar un `<input disabled>`: una casilla deshabilitada
 * se lee como «podrias marcarla pero ahora no», y en el panel la lectura
 * correcta es «esto no se marca desde aqui».
 */
function CasillaDibujada({ done, apagada = false }: { done: boolean; apagada?: boolean }) {
  const marcada = apagada
    ? 'border-slate-400 bg-slate-400 text-white dark:border-slate-500 dark:bg-slate-500'
    : 'border-green-700 bg-green-700 text-white dark:border-green-500 dark:bg-green-600';

  return (
    <span
      aria-hidden="true"
      className={
        done
          ? `mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${marcada}`
          : 'mt-0.5 h-5 w-5 shrink-0 rounded border border-slate-300 dark:border-slate-600'
      }
    >
      {done && (
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 8.5l3.5 3.5L13 4.5" />
        </svg>
      )}
    </span>
  );
}
