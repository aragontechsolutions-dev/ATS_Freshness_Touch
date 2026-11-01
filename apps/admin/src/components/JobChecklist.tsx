import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CHECKLIST_NOTE_MAX,
  checklistCounts,
  checklistItemTextKey,
  checklistRoomTextKey,
  checklistRoomsPresent,
  checklistStateTextKey,
  type ChecklistItemState,
  type JobChecklistEntry,
  type Locale,
} from '@freshness/types';
import { formatTimestamp } from '../lib/format';
import { AlertIcon, CheckIcon, ClipboardCheckIcon } from './Icons';

/**
 * LA LISTA DE VERIFICACION DE UN TRABAJO
 * ======================================
 * Que hay que hacer en cada estancia de la casa, y en que queda cada tarea.
 * Es lo que convierte la pantalla de limpieza de «donde voy» en «que hago».
 *
 * ========================================================================
 * TRES ESTADOS Y NO UNA CASILLA, Y LO PIDIO LA DUENA
 * ========================================================================
 * Su lista lo dice asi: «Cada tarea debe tener estas opciones: Completada /
 * Pendiente / No aplica. Si queda pendiente, debe permitir anotar el motivo.»
 *
 * El cuarto estado es SIN TOCAR, y es el de partida: una tarea que nadie ha
 * mirado todavia. No se guarda —es la ausencia de fila— y se distingue de
 * «pendiente» a proposito: sin tocar es trabajo por decidir; pendiente es una
 * respuesta, con su motivo, de alguien que lo miro y no pudo.
 *
 * Antes habia una casilla, y mezclaba las dos cosas que de verdad importan
 * cuando un cliente llama: una casa vacia de mudanza salia con veinte tareas
 * «sin hacer» cuando en veinte de ellas no habia nada que hacer.
 *
 * ========================================================================
 * UN SOLO COMPONENTE PARA LAS DOS PANTALLAS, Y LA DIFERENCIA ES `onChange`
 * ========================================================================
 * Lo usan la pantalla de limpieza —donde se decide— y el detalle del panel
 * —donde solo se lee—. Sin `onChange` los estados se pintan como etiquetas y
 * no como botones.
 *
 * NO ES AHORRO DE CODIGO: es que coordinacion y limpieza vean la MISMA lista
 * del mismo trabajo. Dos componentes acabarian divergiendo —un orden
 * distinto, una tarea retirada que uno esconde y el otro no— y esa es
 * exactamente la clase de discrepancia que convierte «yo lo marque» en una
 * discusion sin arbitro.
 *
 * ========================================================================
 * EL PANEL NO PUEDE DECIDIR, Y ES DELIBERADO
 * ========================================================================
 * Lo que ocurre en la casa lo dice quien esta alli. Si coordinacion pudiera
 * marcar desde la oficina, la lista dejaria de ser el registro de lo que se
 * hizo y pasaria a ser el registro de lo que alguien cree que se hizo, que no
 * sirve para nada de lo que esta lista tiene que servir.
 */

/** Lo que se manda al servidor cuando una tarea cambia. */
export interface CambioDeTarea {
  readonly state: ChecklistItemState | null;
  readonly note: string | null;
}

interface JobChecklistProps {
  entries: readonly JobChecklistEntry[];
  locale: Locale;
  /**
   * Cambiar el estado o el motivo de una tarea. SIN ESTO LA LISTA ES DE SOLO
   * LECTURA, que es como la ve el panel.
   */
  onChange?: (code: string, cambio: CambioDeTarea) => void;
}

/** Los tres botones, en el orden en que se piensan: hecha, no pude, no habia. */
const ESTADOS: readonly ChecklistItemState[] = ['DONE', 'PENDING', 'NOT_APPLICABLE'];

export function JobChecklist({ entries, locale, onChange }: JobChecklistProps) {
  const { t } = useTranslation();

  /*
   * LA SECCION NO SE PINTA SI NO HAY LISTA.
   *
   * Ya no es el caso normal —el catalogo tiene las cincuenta y nueve tareas
   * de la lista de la duena— pero sigue siendo posible: un servicio que no
   * pida ninguna tarea. Una tarjeta vacia que dijera «sin tareas» seria peor
   * que nada: en la puerta de una casa parece que la lista se ha perdido.
   */
  if (entries.length === 0) return null;

  const cuentas = checklistCounts(entries);
  const estancias = checklistRoomsPresent(entries);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <ClipboardCheckIcon className="h-5 w-5 shrink-0 text-brand-700 dark:text-sun-300" />
          {t('checklist.title')}
        </h3>
        <Recuento cuentas={cuentas} enLaCasa={onChange !== undefined} />
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
                <Tarea key={entrada.code} entrada={entrada} locale={locale} onChange={onChange} />
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * EL RECUENTO, QUE NO ES EL MISMO PARA LAS DOS PANTALLAS.
 *
 * `untouched` es lo que AVISA: las que quedan por decidir. Las pendientes no
 * entran ahi —ya estan resueltas desde el punto de vista de quien limpia— y
 * las que no aplican tampoco, que es justo el problema que la duena queria
 * arreglar.
 *
 * DOS REDACCIONES PARA EL MISMO NUMERO, segun quien lo lee. «Te quedan 3 por
 * decidir» es trabajo para quien esta en la casa. Para coordinacion, que lee
 * un trabajo ya cerrado, ese 3 significa «3 no se miraron», que no es lo
 * mismo ni se actua igual.
 *
 * Las pendientes y las que no aplican solo se cuentan en el panel: en la casa
 * se ven en la propia lista, y repetirlas arriba ocuparia la linea que hace
 * falta para lo unico que queda por hacer.
 */
function Recuento({
  cuentas,
  enLaCasa,
}: {
  cuentas: ReturnType<typeof checklistCounts>;
  enLaCasa: boolean;
}) {
  const { t } = useTranslation();

  if (cuentas.untouched === 0 && (enLaCasa || cuentas.pending === 0)) {
    return (
      <p className="text-xs font-semibold text-green-700 dark:text-green-400">
        {t('checklist.allDone')}
      </p>
    );
  }

  const partes: string[] = [];
  if (cuentas.untouched > 0) {
    partes.push(
      t(enLaCasa ? 'checklist.left' : 'checklist.untouched', { count: cuentas.untouched }),
    );
  }
  if (!enLaCasa && cuentas.pending > 0) {
    partes.push(t('checklist.countPending', { count: cuentas.pending }));
  }
  if (!enLaCasa && cuentas.notApplicable > 0) {
    partes.push(t('checklist.countNotApplicable', { count: cuentas.notApplicable }));
  }

  return (
    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">{partes.join(' · ')}</p>
  );
}

/* ------------------------------------------------------------------------ */

function Tarea({
  entrada,
  locale,
  onChange,
}: {
  entrada: JobChecklistEntry;
  locale: Locale;
  onChange?: (code: string, cambio: CambioDeTarea) => void;
}) {
  const { t } = useTranslation();

  const texto = t(checklistItemTextKey(entrada.code));
  const quien =
    entrada.state !== null && entrada.markedByFirstName !== null && entrada.markedAt !== null
      ? t('checklist.markedBy', {
          name: entrada.markedByFirstName,
          time: formatTimestamp(entrada.markedAt, locale),
        })
      : null;

  /*
   * SOLO LECTURA: sin `onChange`, o en una tarea retirada.
   *
   * Una retirada no se puede tocar aunque se vea: es trabajo que la empresa
   * ya no hace, y ofrecer los botones invitaria a decidir hoy sobre algo que
   * hoy no se pide.
   */
  const soloLectura = onChange === undefined || entrada.retired;

  return (
    <li className="py-2.5 text-sm">
      <p className="min-w-0">
        <span
          className={
            entrada.state === 'DONE'
              ? 'text-slate-500 line-through dark:text-slate-400'
              : 'text-slate-900 dark:text-slate-100'
          }
        >
          {texto}
        </span>
        {/*
          Una tarea decidida cuando se pedia y que ya no se pide. Se dice en
          pantalla en vez de esconderla: si se ocultara, un trabajo de hace
          tres meses parecerian siete tareas cuando se hicieron nueve.
        */}
        {entrada.retired && (
          <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
            ({t('checklist.retired')})
          </span>
        )}
      </p>

      {soloLectura ? (
        <EstadoPintado entrada={entrada} />
      ) : (
        <BotonesDeEstado entrada={entrada} onChange={onChange} />
      )}

      {quien !== null && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{quien}</p>}

      {/*
        EL MOTIVO, SOLO EN UNA PENDIENTE. En la casa es un campo que se puede
        escribir; en el panel, el texto que escribio quien estaba alli.
      */}
      {entrada.state === 'PENDING' &&
        (soloLectura ? (
          entrada.note !== null && <MotivoLeido note={entrada.note} />
        ) : (
          <CampoDeMotivo entrada={entrada} onChange={onChange} />
        ))}
    </li>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * LOS COLORES DE CADA ESTADO, Y NINGUNO ES ROJO.
 *
 * «No aplica» en rojo se leeria como un fallo, y es lo contrario: es la
 * respuesta correcta a una tarea que no habia que hacer. Va en gris.
 *
 * «Pendiente» en ambar y no en rojo por lo mismo: no es un error de quien
 * limpia, es un aviso para coordinacion de que algo quedo sin hacer.
 */
const COLOR_ACTIVO: Record<ChecklistItemState, string> = {
  DONE: 'border-green-700 bg-green-700 text-white dark:border-green-600 dark:bg-green-600',
  PENDING: 'border-amber-600 bg-amber-500 text-amber-950 dark:border-amber-500 dark:bg-amber-500',
  NOT_APPLICABLE:
    'border-slate-500 bg-slate-500 text-white dark:border-slate-400 dark:bg-slate-400 dark:text-slate-900',
};

const COLOR_TEXTO: Record<ChecklistItemState, string> = {
  DONE: 'text-green-800 dark:text-green-400',
  PENDING: 'text-amber-800 dark:text-amber-300',
  NOT_APPLICABLE: 'text-slate-600 dark:text-slate-400',
};

/**
 * LOS TRES BOTONES.
 *
 * ========================================================================
 * TRES BOTONES Y NO UNA CASILLA QUE DA LA VUELTA
 * ========================================================================
 * Un control que va rotando entre los cuatro estados a cada toque ocuparia la
 * mitad, y seria inservible: para dejar algo en «no aplica» habria que
 * acertar el numero de toques, y pasarse de uno significa afirmar que se
 * hizo. En una pantalla que se usa con guantes eso pasa todos los dias.
 *
 * ========================================================================
 * PULSAR EL ESTADO QUE YA ESTA PUESTO LA DEJA SIN DECIDIR
 * ========================================================================
 * Es la unica forma de deshacer un toque equivocado, y hace falta: la primera
 * vez que alguien marque sin querer «horno limpiado» y no pueda corregirlo,
 * aprendera que la lista miente y dejara de usarla. Lo dice la etiqueta
 * accesible del boton activo —`clearState`— porque a la vista no se ve.
 *
 * SE PINTA PRIMERO Y SE PREGUNTA DESPUES, igual que antes: el movimiento lo
 * hace la pantalla que llama (ver `marcarTarea` en `MyJobs.tsx`), no este
 * componente, que solo avisa de lo que se pulso.
 */
function BotonesDeEstado({
  entrada,
  onChange,
}: {
  entrada: JobChecklistEntry;
  onChange: (code: string, cambio: CambioDeTarea) => void;
}) {
  const { t } = useTranslation();

  return (
    /*
      `role="group"` con el nombre de la tarea: sin el, un lector de pantalla
      lee «Hecha, Pendiente, No aplica» cuarenta veces sin decir de que tarea.
    */
    <div
      role="group"
      aria-label={t(checklistItemTextKey(entrada.code))}
      className="mt-2 flex gap-1.5"
    >
      {ESTADOS.map((estado) => {
        const activo = entrada.state === estado;

        return (
          <button
            key={estado}
            type="button"
            /*
              SIN RELOJ DE ESPERA Y SIN DESHABILITAR, las dos cosas a
              proposito. El boton se pinta activo en el acto, asi que el
              movimiento YA ES la confirmacion; y deshabilitarlo mientras se
              guarda impediria corregir un toque equivocado justo en el
              segundo en que uno se da cuenta de que lo ha dado.

              `min-h-11` son los 44 px que es el minimo que se acierta de pie.
            */
            className={`flex min-h-11 flex-1 items-center justify-center gap-1 rounded-lg border
                        px-1 text-xs font-bold transition-colors ${
                          activo
                            ? COLOR_ACTIVO[estado]
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-night-800 dark:text-slate-200 dark:hover:bg-night-700'
                        }`}
            aria-pressed={activo}
            aria-label={activo ? t('checklist.clearState') : t(`checklist.setState.${estado}`)}
            onClick={() =>
              onChange(entrada.code, {
                // Pulsar el activo lo deja sin decidir.
                state: activo ? null : estado,
                /*
                 * EL MOTIVO SOLO SOBREVIVE SI SIGUE SIENDO PENDIENTE. Al
                 * pasar a «hecha» hay que mandarlo a null, porque el contrato
                 * y la base de datos no admiten motivo en otro estado — y
                 * porque un motivo de «no se pudo» colgado de una tarea hecha
                 * seria una contradiccion guardada.
                 */
                note: !activo && estado === 'PENDING' ? entrada.note : null,
              })
            }
          >
            <IconoDeEstado estado={estado} />
            {t(checklistStateTextKey(estado))}
          </button>
        );
      })}
    </div>
  );
}

function IconoDeEstado({ estado }: { estado: ChecklistItemState }) {
  if (estado === 'DONE') return <CheckIcon className="h-3.5 w-3.5 shrink-0" />;
  if (estado === 'PENDING') return <AlertIcon className="h-3.5 w-3.5 shrink-0" />;

  // Una raya, no una cruz: una cruz se lee como «fallo», y no aplicar no lo es.
  return <span aria-hidden="true" className="h-0.5 w-2.5 shrink-0 rounded bg-current" />;
}

/**
 * El estado de una lista que no se puede tocar.
 *
 * Se pinta como una etiqueta y no como un boton deshabilitado: un boton
 * apagado se lee como «podrias pulsarlo pero ahora no», y en el panel la
 * lectura correcta es «esto no se decide desde aqui».
 */
function EstadoPintado({ entrada }: { entrada: JobChecklistEntry }) {
  const { t } = useTranslation();

  if (entrada.state === null) return null;

  return (
    <p className={`mt-1 flex items-center gap-1.5 text-xs font-bold ${COLOR_TEXTO[entrada.state]}`}>
      <IconoDeEstado estado={entrada.state} />
      {t(checklistStateTextKey(entrada.state))}
    </p>
  );
}

function MotivoLeido({ note }: { note: string }) {
  return (
    <p className="mt-1 border-l-2 border-amber-400 pl-2 text-xs text-slate-700 dark:border-amber-600 dark:text-slate-300">
      {note}
    </p>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * EL MOTIVO DE UNA TAREA PENDIENTE.
 *
 * ========================================================================
 * EL ESTADO SE GUARDA AL TOCAR EL BOTON, ANTES DE ESCRIBIR NADA
 * ========================================================================
 * Y es deliberado: si el motivo y el estado viajaran juntos, una pendiente
 * sin motivo —que es un caso normal y legitimo— solo se guardaria al pulsar
 * «guardar», y un movil que se queda sin bateria a mitad de la frase se
 * llevaria por delante tambien el estado. Se guardan por separado: primero lo
 * que no se puede perder.
 *
 * ========================================================================
 * UN BOTON DE GUARDAR, Y NO GUARDAR AL SALIR DEL CAMPO
 * ========================================================================
 * Guardar al perder el foco parece mas cómodo y no lo es: en un movil el foco
 * se pierde al girar la pantalla, al bajar el teclado o al tocar cualquier
 * sitio, y cada uno de esos gestos seria una peticion con una frase a medias.
 * Un boton explicito es un toque mas y una duda menos.
 *
 * EL CAMPO VACIO QUITA EL MOTIVO. No hace falta un boton aparte: borrar lo
 * escrito y guardar manda `null`, que es lo que una persona espera.
 */
function CampoDeMotivo({
  entrada,
  onChange,
}: {
  entrada: JobChecklistEntry;
  onChange: (code: string, cambio: CambioDeTarea) => void;
}) {
  const { t } = useTranslation();
  const [texto, setTexto] = useState(entrada.note ?? '');

  /*
   * SE RESINCRONIZA CON EL SERVIDOR, pero solo cuando el motivo guardado
   * cambia de verdad. Hace falta porque la respuesta del servidor repinta el
   * trabajo entero y puede traer lo que escribio una companera.
   *
   * No se mete `texto` en las dependencias a proposito: hacerlo borraria lo
   * que se esta escribiendo en cada pulsacion de tecla.
   */
  useEffect(() => {
    setTexto(entrada.note ?? '');
  }, [entrada.note]);

  const limpio = texto.trim();
  const guardado = entrada.note ?? '';
  const haCambiado = limpio !== guardado;

  return (
    <div className="mt-2 space-y-1.5">
      <label className="block text-xs font-semibold text-amber-800 dark:text-amber-300">
        {t('checklist.noteTitle')}
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={CHECKLIST_NOTE_MAX}
          rows={2}
          placeholder={t('checklist.notePlaceholder')}
          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm
                     font-normal text-slate-900 placeholder:text-slate-400
                     focus:border-brand-500 focus:ring-2 focus:ring-brand-500
                     dark:border-slate-600 dark:bg-night-800 dark:text-slate-100"
        />
      </label>
      {/*
        EL BOTON SOLO APARECE SI HAY ALGO QUE GUARDAR. Un boton que no hace
        nada al pulsarlo es peor que no tenerlo: se pulsa, no pasa nada
        visible, y se vuelve a pulsar.
      */}
      {haCambiado && (
        <button
          type="button"
          className="ft-btn-ghost min-h-11 w-full text-xs"
          onClick={() =>
            onChange(entrada.code, {
              state: 'PENDING',
              note: limpio === '' ? null : limpio,
            })
          }
        >
          {limpio === '' ? t('checklist.noteClear') : t('checklist.noteSave')}
        </button>
      )}
    </div>
  );
}
