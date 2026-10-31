import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertIcon, CheckIcon, SpinnerIcon } from './Icons';

/**
 * «¿SEGURO QUE HAS TERMINADO?»
 * ============================
 * Lo unico que se interpone entre un toque y un estado del que no se vuelve.
 *
 * ==========================================================================
 * POR QUE ESTE BOTON Y NO EL DE LLEGADA
 * ==========================================================================
 * «He llegado» y «He terminado» se parecen en la pantalla y NO se parecen en
 * nada mas:
 *
 *   - «He llegado» pulsado sin querer se arregla pulsando «He terminado»
 *     cuando toque. El dato queda raro —un turno que empezo diez minutos
 *     antes— y se corrige hablando.
 *   - «He terminado» NO TIENE SALIDA. `COMPLETED` es un estado final: no hay
 *     transicion que lo deshaga ni para el equipo ni para coordinacion,
 *     porque el historico tiene que contar lo que de verdad paso. Un toque
 *     sin querer —el movil en el bolsillo, las manos mojadas, el dedo que
 *     resbala— cierra un trabajo a mitad, y lo que queda es una llamada a la
 *     oficina y una fila en la base de datos que ya no se puede arreglar.
 *
 * Por eso aqui hay una pregunta y en la llegada no la hay. No es simetria:
 * es que el coste de equivocarse no es el mismo.
 *
 * ==========================================================================
 * Y DICE LAS TAREAS QUE QUEDAN, QUE ES LO QUE DE VERDAD EVITA EL FALLO
 * ==========================================================================
 * «¿Seguro?» a secas se contesta «si» sin leerlo: es la pregunta que todo el
 * mundo ha aprendido a quitarse de encima. Lo que hace que alguien se pare
 * es un dato que no esperaba —«te quedan 4 tareas sin marcar»—, porque eso
 * si distingue el toque correcto del accidental.
 *
 * NO BLOQUEA. Un trabajo se puede terminar con tareas sin marcar, por la
 * misma regla que el fichaje nunca se bloquea: negarlo deja a la persona en
 * la puerta de una casa sin poder cerrar su trabajo. Ver
 * `pendingChecklistCount` en `job-checklist.ts`.
 *
 * ==========================================================================
 * SE USA EL `<dialog>` DEL NAVEGADOR, igual que en `DialogoLlegada`
 * ==========================================================================
 * `showModal()` trae el foco atrapado dentro, la tecla de escape y el fondo
 * inerte. A mano se olvidan las tres, y con un lector de pantalla un cuadro
 * falso deja el foco paseando por la pagina de detras.
 *
 * El escape y el gesto de atras cierran SIN confirmar (`onClose` descarta),
 * que es la direccion segura: si el gesto de salir confirmara, el cuadro
 * seria peor que no tenerlo.
 */
interface DialogoFinalProps {
  /** La calle, para que se vea que se cierra ESTE trabajo y no otro. */
  direccion: string;
  /** Tareas sin marcar. `0` no pinta la linea. */
  pendientes: number;
  ocupado: boolean;
  onConfirmar: () => void;
  onDescartar: () => void;
}

export function DialogoFinal({
  direccion,
  pendientes,
  ocupado,
  onConfirmar,
  onDescartar,
}: DialogoFinalProps) {
  const { t } = useTranslation();
  const dialogo = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const nodo = dialogo.current;

    /*
     * Se comprueba que exista antes de llamarla: `showModal` lleva anos en
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
      aria-labelledby="final-titulo"
      onClose={onDescartar}
    >
      <div className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <CheckIcon className="mt-0.5 h-6 w-6 shrink-0 text-brand-700 dark:text-sun-300" />
          <div className="min-w-0">
            <h2 id="final-titulo" className="text-lg font-bold text-slate-900 dark:text-white">
              {t('admin.myJobs.finishTitle')}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{direccion}</p>
          </div>
        </div>

        {/*
          LA LINEA DE LAS TAREAS VA ANTES DEL AVISO, y en un recuadro.
          Es el dato concreto que distingue el toque bueno del accidental;
          el aviso de abajo es la regla general, que se lee despues.

          Con cero no se pinta: decir «te quedan 0 tareas» es ruido que resta
          fuerza a la unica linea que de verdad tenia que leerse.
        */}
        {pendientes > 0 && (
          <p
            className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm font-medium
                       text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            {t('admin.myJobs.finishPending', { count: pendientes })}
          </p>
        )}

        <p className="text-sm text-slate-700 dark:text-slate-300">
          {t('admin.myJobs.finishWarning')}
        </p>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            className="ft-btn-primary min-h-11 w-full"
            disabled={ocupado}
            onClick={onConfirmar}
          >
            {ocupado && <SpinnerIcon className="h-4 w-4 animate-spin" />}
            {t('admin.myJobs.finishConfirm')}
          </button>

          {/*
            «Todavia no» al mismo nivel y no escondido: una pregunta de la que
            cuesta salir se contesta que si para quitarsela de encima, y
            entonces el cuadro no ha evitado nada.
          */}
          <button
            type="button"
            className="ft-btn-ghost min-h-11 w-full"
            disabled={ocupado}
            onClick={onDescartar}
          >
            {t('admin.myJobs.finishCancel')}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export default DialogoFinal;
