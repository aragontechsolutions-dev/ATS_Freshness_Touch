import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Locale, MyJob } from '@freshness/types';
import {
  ApiClientError,
  fetchMyJobs,
  isSessionError,
  markMyJobProgress,
  sessionLostReason,
} from '../lib/api';
import { formatPhone } from '@freshness/types';
import { useToast } from '../components/ToastProvider';
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
import { dateInTimezone, formatDateTime, todayInTimezone } from '../lib/format';

interface MyJobsProps {
  locale: Locale;
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
export function MyJobs({ locale, onSessionLost }: MyJobsProps) {
  const { t } = useTranslation();

  const [jobs, setJobs] = useState<MyJob[] | null>(null);
  /** Solo el fallo de la CARGA inicial: sin lista no hay pantalla que mirar. */
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
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
      const actualizado = await markMyJobProgress(job.bookingId, { status });
      setJobs((actual) =>
        (actual ?? []).map((j) => (j.bookingId === actualizado.bookingId ? actualizado : j)),
      );
      /*
       * ESTO ES LO QUE MAS FALTA HACIA DE TODA LA PANTALLA. Marcar la llegada
       * cambiaba el boton y nada mas; con el movil al sol, en la puerta de
       * una casa, no habia forma de estar seguro de que habia quedado
       * registrado, y se pulsaba dos veces.
       */
      toast.success(
        status === 'IN_PROGRESS' ? 'admin.toast.jobStarted' : 'admin.toast.jobFinished',
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
}: {
  job: MyJob;
  locale: Locale;
  ocupado: boolean;
  onMarcar: (job: MyJob, status: 'IN_PROGRESS' | 'COMPLETED') => Promise<void>;
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
