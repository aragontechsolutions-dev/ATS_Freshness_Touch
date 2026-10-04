import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CLOCK_IN_STATE_TEXT_KEY, canEditChecklist } from '@freshness/types';
import type {
  ClockInKind,
  FieldAdjustmentInput,
  JobChecklistEntry,
  Locale,
  MyJob,
} from '@freshness/types';
import {
  ApiClientError,
  fetchMyJobs,
  isSessionError,
  markChecklistItem,
  markMyJobProgress,
  proposeFieldAdjustment,
  sessionLostReason,
} from '../lib/api';
import { formatPhone } from '@freshness/types';
import { useToast } from '../components/ToastProvider';
import { FieldAdjustmentForm } from '../components/FieldAdjustmentForm';
import { JobChecklist } from '../components/JobChecklist';
import { SkeletonMisTrabajos } from '../components/Skeletons';
import {
  AlertIcon,
  BriefcaseIcon,
  CheckIcon,
  ClockIcon,
  KeyIcon,
  MapPinIcon,
  PhoneIcon,
  PlayIcon,
  SpinnerIcon,
  UsersIcon,
} from '../components/Icons';
import {
  dateInTimezone,
  formatDateTime,
  formatDistanciaDeFichaje,
  todayInTimezone,
} from '../lib/format';
import { ubicacionParaFichar } from '../lib/geolocalizacion';

interface MyJobsProps {
  locale: Locale;
  /**
   * El nombre de pila de quien mira.
   *
   * Hace falta para poder escribir «Cleo, 10:42» DEBAJO DE LA TAREA EN EL
   * MISMO INSTANTE en que se marca, sin esperar a que el servidor lo diga.
   * Sin el, la linea aparece un segundo despues y da un salto en pantalla.
   */
  staffFirstName: string;
  onSessionLost: (reason?: 'expired' | 'noAccess') => void;
}

/**
 * MIS TRABAJOS
 * ------------
 * La pantalla del equipo de limpieza. Hasta ahora esas cuentas entraban
 * correctamente y no veian absolutamente nada.
 *
 * ESTA PANTALLA SE MIRA DE PIE, EN LA CALLE, CON UNA MANO. No es una frase
 * bonita: manda sobre casi todas las decisiones de forma que hay aqui.
 *
 *   - Una tarjeta por trabajo, en una sola columna. Nada de tablas: a 390 px
 *     una tabla obliga a desplazar en horizontal, y eso con guantes puestos
 *     no se hace.
 *   - La direccion es lo mas grande despues de la hora, y es un ENLACE al
 *     mapa. Es lo primero que se necesita y lo que evita teclear una calle
 *     conduciendo.
 *   - Los botones son grandes y estan al final de la tarjeta, donde llega el
 *     pulgar.
 *   - Las instrucciones de acceso van destacadas y con su aviso: es el unico
 *     dato de esta pantalla que no debe leerse en alto.
 */
export function MyJobs({ locale, staffFirstName, onSessionLost }: MyJobsProps) {
  const { t } = useTranslation();

  const [jobs, setJobs] = useState<MyJob[] | null>(null);
  /** Solo el fallo de la CARGA inicial: sin lista no hay pantalla que mirar. */
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  /**
   * EL NUMERO DE ORDEN DE LA ULTIMA PETICION ENVIADA POR CADA TRABAJO.
   *
   * ======================================================================
   * EXISTE POR UN FALLO DE DATOS, NO POR ESTETICA
   * ======================================================================
   * Cada respuesta de marcar trae el trabajo ENTERO tal como estaba el
   * servidor al atenderla. Marcando dos tareas seguidas —que es como se
   * usa esto— hay dos peticiones en vuelo, y LA RED NO GARANTIZA EL ORDEN
   * DE LLEGADA: si la respuesta de la primera llega la ultima, trae una
   * foto SIN la segunda marca, y repintar con ella DESMARCA EN PANTALLA
   * algo que en la base de datos esta marcado.
   *
   * Con esto, solo se adopta la foto del servidor cuando la respuesta viene
   * de la ULTIMA peticion enviada. Las demas se descartan: son viejas por
   * construccion.
   *
   * Va en una referencia y no en el estado a proposito: cambiarlo no tiene
   * que repintar nada, y leerlo dentro de la promesa tiene que dar el valor
   * de AHORA, no el del render en el que se lanzo.
   */
  const ultimaPeticion = useRef(new Map<string, number>());
  /** El trabajo cuyo ajuste se esta enviando, si hay alguno. */
  const [ajustando, setAjustando] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    let vigente = true;

    fetchMyJobs()
      .then((respuesta) => {
        if (vigente) setJobs(respuesta.jobs);
      })
      .catch((error: unknown) => {
        if (!vigente) return;
        if (isSessionError(error)) {
          onSessionLost(sessionLostReason(error));
          return;
        }
        setErrorKey(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
      });

    return () => {
      vigente = false;
    };
  }, [onSessionLost]);

  const marcar = async (job: MyJob, status: 'IN_PROGRESS' | 'COMPLETED'): Promise<void> => {
    setOcupado(job.bookingId);

    try {
      /*
       * LA UBICACION SE PIDE AQUI, AL PULSAR, y no al abrir la pantalla.
       *
       * El navegador muestra su dialogo de permiso la primera vez, y que
       * aparezca al abrir la aplicacion —sin que la persona haya hecho nada
       * que lo justifique— es la forma mas rapida de que le de a «Bloquear»
       * para siempre. Pulsado «He llegado», el dialogo tiene un porque
       * evidente.
       *
       * Y NO PUEDE FALLAR: `ubicacionParaFichar` nunca lanza. Si no hay
       * ubicacion devuelve el motivo, y el fichaje sale igual.
       */
      const ubicacion = await ubicacionParaFichar();

      const actualizado = await markMyJobProgress(job.bookingId, { status, ...ubicacion });
      setJobs((actual) =>
        (actual ?? []).map((j) => (j.bookingId === actualizado.bookingId ? actualizado : j)),
      );
      /*
       * ESTO ES LO QUE MAS FALTA HACIA DE TODA LA PANTALLA. Marcar la llegada
       * cambiaba el boton y nada mas; con el movil al sol, en la puerta de
       * una casa, no habia forma de estar seguro de que habia quedado
       * registrado, y se pulsaba dos veces.
       */
      /*
       * EL AVISO DICE LA DISTANCIA QUE QUEDO REGISTRADA.
       *
       * Fue una decision explicita: no hay un expediente secreto sobre
       * nadie. Quien ficha ve exactamente el mismo dato que vera
       * coordinacion, y si esta mal puede decirlo en el momento en vez de
       * enterarse en una revision tres meses despues.
       */
      toast.success(
        status === 'IN_PROGRESS' ? 'admin.toast.jobStarted' : 'admin.toast.jobFinished',
        { detail: textoDeFichaje(actualizado, status, t, locale) },
      );
    } catch (error) {
      if (isSessionError(error)) {
        onSessionLost(sessionLostReason(error));
        return;
      }
      toast.error(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
    } finally {
      setOcupado(null);
    }
  };

  /**
   * Marca o desmarca una tarea.
   *
   * ======================================================================
   * SE PINTA PRIMERO Y SE PREGUNTA DESPUES
   * ======================================================================
   * La casilla se mueve EN EL ACTO, antes de que el servidor conteste. No
   * es un adorno: en una casa con mala cobertura pasan dos segundos entre
   * el toque y el movimiento, y esa espera no se lee como «esta
   * guardando», se lee como «no me ha cogido el toque». Se vuelve a pulsar,
   * y asi es como una lista de veinticinco tareas acaba marcada a medias.
   *
   * Si el servidor dice que no, la casilla vuelve a su sitio EXACTAMENTE
   * como estaba —con su hora y su autor anteriores— y se avisa. Una casilla
   * que vuelve sola sin explicacion se lee como una pantalla rota.
   *
   * ======================================================================
   * SIN AVISO AL ACERTAR, Y SI AL FALLAR
   * ======================================================================
   * Es lo contrario que al fichar, y la diferencia esta razonada: fichar
   * ocurre una vez y hay que quedarse tranquilo de que quedo registrado.
   * Marcar tareas ocurre veinticinco veces en una casa, y veinticinco
   * avisos seguidos tapan la pantalla justo cuando se esta trabajando. La
   * casilla marcandose YA ES la confirmacion.
   */
  const marcarTarea = async (job: MyJob, code: string, done: boolean): Promise<void> => {
    const anterior = job.checklist.find((entrada) => entrada.code === code);
    if (!anterior) return;

    // Lo que se pinta ya mismo, sin preguntar a nadie.
    parcharTarea(setJobs, job.bookingId, {
      ...anterior,
      done,
      doneAt: done ? new Date().toISOString() : null,
      doneByFirstName: done ? staffFirstName : null,
    });

    const turno = (ultimaPeticion.current.get(job.bookingId) ?? 0) + 1;
    ultimaPeticion.current.set(job.bookingId, turno);

    try {
      const actualizado = await markChecklistItem(job.bookingId, { itemCode: code, done });

      /*
       * SOLO MANDA LA RESPUESTA DE LA ULTIMA PETICION ENVIADA.
       *
       * Si mientras tanto se marco otra tarea, esta foto del servidor es
       * vieja por construccion y adoptarla desmarcaria la otra. Lo que esta
       * pintado en local ya es correcto para las marcas propias; lo unico
       * que aporta la foto es lo que haya marcado una companera, y eso
       * llega igual con la respuesta de la ultima.
       */
      if (ultimaPeticion.current.get(job.bookingId) !== turno) return;

      setJobs((actual) =>
        (actual ?? []).map((j) => (j.bookingId === actualizado.bookingId ? actualizado : j)),
      );
    } catch (error) {
      if (isSessionError(error)) {
        onSessionLost(sessionLostReason(error));
        return;
      }

      // Se deshace SOLO esta tarea, dejandola como estaba. No se repinta el
      // trabajo entero: eso borraria lo que se haya marcado mientras tanto.
      parcharTarea(setJobs, job.bookingId, anterior);
      toast.error(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
    }
  };

  /**
   * El responsable avisa de que el trabajo no es el contratado.
   *
   * AQUI SI HAY AVISO AL ACERTAR, al reves que al marcar una tarea: esto
   * ocurre una vez por casa y pone en marcha una conversacion con el cliente.
   * Quien lo manda tiene que quedarse tranquilo de que llego.
   */
  const ajustar = async (job: MyJob, cambios: FieldAdjustmentInput): Promise<void> => {
    setAjustando(job.bookingId);

    try {
      const actualizado = await proposeFieldAdjustment(job.bookingId, cambios);
      setJobs((actual) =>
        (actual ?? []).map((j) => (j.bookingId === actualizado.bookingId ? actualizado : j)),
      );
      toast.success('admin.toast.adjustmentSent');
    } catch (error) {
      if (isSessionError(error)) {
        onSessionLost(sessionLostReason(error));
        return;
      }
      toast.error(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
    } finally {
      setAjustando(null);
    }
  };

  if (errorKey) {
    return (
      <div className="ft-card flex items-start gap-3 p-5" role="alert">
        <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-400" />
        <p className="text-sm font-medium text-red-700 dark:text-red-400">{t(errorKey)}</p>
      </div>
    );
  }

  if (!jobs) {
    return <SkeletonMisTrabajos />;
  }

  if (jobs.length === 0) {
    return (
      <section className="ft-card flex flex-col items-center gap-2 px-6 py-12 text-center">
        <BriefcaseIcon className="h-9 w-9 text-slate-400 dark:text-slate-500" />
        <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin.myJobs.empty')}</p>
      </section>
    );
  }

  /*
   * Se agrupa por la fecha EN LA ZONA DE LA EMPRESA, la misma en la que se
   * pinta la hora en cada tarjeta. Con la fecha del navegador, un trabajo de
   * las nueve de la noche en Georgia sale como "mié 23" y caeria bajo
   * "proximos", porque en horario universal ya es dia 24. El encabezado
   * contradiciendo a la tarjeta es de los fallos que nadie sabe explicar.
   */
  const zona = jobs[0]?.timezone ?? 'America/New_York';
  const hoy = todayInTimezone(zona);
  const deHoy = jobs.filter((j) => dateInTimezone(j.scheduledStart, j.timezone) === hoy);
  const siguientes = jobs.filter((j) => dateInTimezone(j.scheduledStart, j.timezone) !== hoy);

  return (
    <div className="space-y-4">
      {deHoy.length > 0 && (
        <>
          <h2 className="px-1 text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {t('admin.myJobs.today')}
          </h2>
          {deHoy.map((job) => (
            <Tarjeta
              key={job.bookingId}
              job={job}
              locale={locale}
              ocupado={ocupado === job.bookingId}
              onMarcar={marcar}
              onMarcarTarea={marcarTarea}
              ajustando={ajustando === job.bookingId}
              onAjustar={ajustar}
            />
          ))}
        </>
      )}

      {siguientes.length > 0 && (
        <>
          <h2 className="px-1 pt-2 text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {t('admin.myJobs.upcoming')}
          </h2>
          {siguientes.map((job) => (
            <Tarjeta
              key={job.bookingId}
              job={job}
              locale={locale}
              ocupado={ocupado === job.bookingId}
              onMarcar={marcar}
              onMarcarTarea={marcarTarea}
              ajustando={ajustando === job.bookingId}
              onAjustar={ajustar}
            />
          ))}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function Tarjeta({
  job,
  locale,
  ocupado,
  onMarcar,
  onMarcarTarea,
  ajustando,
  onAjustar,
}: {
  job: MyJob;
  locale: Locale;
  ocupado: boolean;
  onMarcar: (job: MyJob, status: 'IN_PROGRESS' | 'COMPLETED') => Promise<void>;
  onMarcarTarea: (job: MyJob, code: string, done: boolean) => Promise<void>;
  ajustando: boolean;
  onAjustar: (job: MyJob, cambios: FieldAdjustmentInput) => Promise<void>;
}) {
  const { t } = useTranslation();

  const direccion = [job.addressLine1, job.addressLine2].filter(Boolean).join(', ');
  const completa = `${direccion}, ${job.city}, ${job.state} ${job.postalCode}`;

  return (
    <section className="ft-card space-y-4 p-5">
      <div>
        <p className="flex items-start gap-2 text-lg font-bold text-slate-900 dark:text-white">
          <ClockIcon className="mt-1 h-5 w-5 shrink-0 text-brand-700 dark:text-sun-300" />
          {formatDateTime(job.scheduledStart, job.timezone, locale)}
        </p>
        <p className="mt-0.5 ml-7 text-sm text-slate-600 dark:text-slate-400">
          {t('admin.durationMinutes', { minutes: job.durationMinutes })} ·{' '}
          {t(`services.${job.service}.name`)}
        </p>
      </div>

      {/*
        La direccion enlaza al mapa. Es lo que evita teclear una calle
        conduciendo, y `?q=` funciona con la aplicacion de mapas que tenga
        instalada cada movil en vez de obligar a una concreta.
      */}
      <div className="flex items-start gap-2">
        <MapPinIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-700 dark:text-sun-300" />
        <div className="min-w-0">
          <a
            className="text-base font-semibold text-brand-700 underline dark:text-sun-300"
            href={`https://maps.google.com/?q=${encodeURIComponent(completa)}`}
            target="_blank"
            rel="noreferrer"
          >
            {direccion}
            {/*
              Sin esto, el enlace se anuncia solo como una calle y no hay
              forma de saber que abre el mapa —ni de saber que se va a otra
              aplicacion, que conduciendo importa.
            */}
            <span className="sr-only"> — {t('admin.myJobs.directions')}</span>
          </a>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {job.city}, {job.state} {job.postalCode}
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t('admin.myJobs.rooms', { bedrooms: job.bedrooms, bathrooms: job.bathrooms })}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {job.customerFirstName}
        </span>
        <a className="ft-btn-ghost" href={`tel:${job.customerPhone}`}>
          <PhoneIcon className="h-4 w-4" />
          {t('admin.myJobs.call')} · {formatPhone(job.customerPhone)}
        </a>
      </div>

      {job.accessNotes && (
        /*
         * DATO SENSIBLE: el codigo de la puerta. Se destaca para que quien
         * tenga la pantalla a la vista sepa que ahi hay algo que no se lee en
         * alto ni se deja abierto encima de una mesa.
         */
        <div className="rounded-lg border border-sun-400 bg-sun-50 p-3 dark:border-sun-600 dark:bg-night-700">
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-slate-800 uppercase dark:text-sun-200">
            <KeyIcon className="h-4 w-4 shrink-0" />
            {t('admin.myJobs.howToGetIn')}
          </p>
          <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">{job.accessNotes}</p>
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
            {t('admin.myJobs.howToGetInWarning')}
          </p>
        </div>
      )}

      {job.customerNotes && (
        <div>
          <p className="ft-label">{t('admin.myJobs.customerNotes')}</p>
          <p className="text-sm text-slate-700 dark:text-slate-300">{job.customerNotes}</p>
        </div>
      )}

      {(job.iAmLead || job.teammates.length > 0) && (
        <div className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-400">
          <UsersIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            {job.iAmLead && <p className="font-semibold">{t('admin.myJobs.lead')}</p>}
            {job.teammates.length > 0 && (
              <p>
                {t('admin.myJobs.withYou')}:{' '}
                {job.teammates
                  .map((c) => (c.isLead ? `${c.name} (${t('admin.myJobs.withYouLead')})` : c.name))
                  .join(', ')}
              </p>
            )}
          </div>
        </div>
      )}

      {/*
        LA LISTA VA JUSTO ENCIMA DE LOS BOTONES, y no al principio de la
        tarjeta: la direccion y el telefono son lo que se necesita ANTES de
        llegar, y las tareas despues de entrar. Puesta arriba, empujaria hacia
        abajo lo primero que hay que mirar conduciendo.

        No se pinta cuando el trabajo esta cancelado o ya cerrado por
        coordinacion, porque ahi no se puede marcar: el componente leeria
        bien, pero cada toque devolveria un error y nadie entenderia por que.
      */}
      {canEditChecklist(job.status) && (
        <JobChecklist
          entries={job.checklist}
          locale={locale}
          onToggle={(code, done) => void onMarcarTarea(job, code, done)}
        />
      )}

      {/*
        CORREGIR LO CONTRATADO VA DESPUES DE LA LISTA Y ANTES DE LOS BOTONES.
        Es lo que se hace al mirar la casa, no al llegar ni al irse, y empieza
        cerrado: el caso normal es que la reserva sea correcta.
      */}
      <FieldAdjustmentForm
        job={job}
        enviando={ajustando}
        onEnviar={(cambios) => onAjustar(job, cambios)}
      />

      <Acciones job={job} ocupado={ocupado} onMarcar={onMarcar} />
    </section>
  );
}

/**
 * Los dos botones.
 *
 * Se pinta UNO SOLO cada vez, el que toca segun el estado. Ofrecer los dos a
 * la vez invita a pulsar «he terminado» nada mas llegar, que es como se
 * pierde la hora de entrada.
 */
function Acciones({
  job,
  ocupado,
  onMarcar,
}: {
  job: MyJob;
  ocupado: boolean;
  onMarcar: (job: MyJob, status: 'IN_PROGRESS' | 'COMPLETED') => Promise<void>;
}) {
  const { t } = useTranslation();

  if (job.status === 'CONFIRMED') {
    return (
      <div>
        <button
          type="button"
          className="ft-btn-primary w-full py-3 text-base"
          disabled={ocupado}
          onClick={() => void onMarcar(job, 'IN_PROGRESS')}
        >
          {ocupado ? <SpinnerIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
          {ocupado ? t('admin.working') : t('admin.myJobs.start')}
        </button>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {t('admin.myJobs.finishHint')}
        </p>
      </div>
    );
  }

  if (job.status === 'IN_PROGRESS') {
    return (
      <button
        type="button"
        className="ft-btn-primary w-full py-3 text-base"
        disabled={ocupado}
        onClick={() => void onMarcar(job, 'COMPLETED')}
      >
        {ocupado ? <SpinnerIcon className="h-5 w-5" /> : <CheckIcon className="h-5 w-5" />}
        {ocupado ? t('admin.working') : t('admin.myJobs.finish')}
      </button>
    );
  }

  return (
    <p className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-400">
      <CheckIcon className="h-4 w-4 shrink-0" />
      {t('admin.myJobs.finished')}
    </p>
  );
}

/**
 * EL TEXTO QUE VE QUIEN ACABA DE FICHAR.
 *
 * «a 60 m de la casa», o el motivo de que no haya distancia. Se muestra
 * porque no hay un expediente secreto sobre nadie: es el mismo dato que vera
 * coordinacion.
 *
 * Devuelve `undefined` cuando no hay nada que anadir, que el aviso trata como
 * «sin detalle» y no pinta una linea vacia.
 */
function textoDeFichaje(
  job: MyJob,
  status: 'IN_PROGRESS' | 'COMPLETED',
  t: (clave: string, params?: Record<string, string | number>) => string,
  locale: Locale,
): string | undefined {
  const esperado: ClockInKind = status === 'IN_PROGRESS' ? 'ARRIVAL' : 'DEPARTURE';

  /*
   * EL ULTIMO DEL TIPO QUE SE ACABA DE HACER, no simplemente el ultimo de la
   * lista: los fichajes vienen ordenados por hora e incluyen los de los
   * companeros, asi que coger el ultimo sin mas mostraria la distancia de
   * otra persona al fichar uno mismo.
   */
  const mio = [...job.clockIns].reverse().find((f) => f.kind === esperado);
  if (!mio) return undefined;

  if (mio.locationState === 'RECORDED' && mio.distanceMeters !== null) {
    /*
     * Dos claves distintas, una por unidad, en vez de una sola con la unidad
     * interpolada: «3 pies» y «3 millas» no se dicen igual en los dos
     * idiomas, y una sola clave obligaria a construir la frase juntando
     * trozos, que es como salen las traducciones raras.
     */
    const { value, unit } = formatDistanciaDeFichaje(mio.distanceMeters, locale);
    return t(
      unit === 'feet' ? 'admin.myJobs.clockIn.distanceFeet' : 'admin.myJobs.clockIn.distanceMiles',
      { value },
    );
  }

  /*
   * Los tres motivos tienen su propio texto. `NO_HOUSE` en particular dice
   * que el fallo es NUESTRO, para que nadie crea que su movil va mal.
   */
  return t(`admin.myJobs.clockIn.${CLOCK_IN_STATE_TEXT_KEY[mio.locationState]}`);
}

/**
 * Cambia UNA tarea de UN trabajo, dejando todo lo demas como estaba.
 *
 * Esta aparte porque se usa en los dos sentidos —al pintar el toque y al
 * deshacerlo si falla— y porque la precision importa: repintar el trabajo
 * entero borraria lo que una companera haya marcado mientras tanto.
 */
function parcharTarea(
  setJobs: React.Dispatch<React.SetStateAction<MyJob[] | null>>,
  bookingId: string,
  entrada: JobChecklistEntry,
): void {
  setJobs((actual) =>
    (actual ?? []).map((job) =>
      job.bookingId === bookingId
        ? {
            ...job,
            checklist: job.checklist.map((t) => (t.code === entrada.code ? entrada : t)),
          }
        : job,
    ),
  );
}
