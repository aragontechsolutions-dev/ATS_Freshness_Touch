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
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

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
    setErrorKey(null);

    try {
      const actualizado = await markMyJobProgress(job.bookingId, { status });
      setJobs((actual) =>
        (actual ?? []).map((j) => (j.bookingId === actualizado.bookingId ? actualizado : j)),
      );
    } catch (error) {
      if (isSessionError(error)) {
        onSessionLost(sessionLostReason(error));
        return;
      }
      setErrorKey(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
    } finally {
      setOcupado(null);
    }
  };

  if (!jobs) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {errorKey ? t(errorKey) : t('common.loading')}
      </p>
    );
  }

  if (jobs.length === 0) {
    return (
      <section className="ft-card p-5">
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

      {errorKey && (
        <p className="text-sm font-medium text-red-700 dark:text-red-400" role="alert">
          {t(errorKey)}
        </p>
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
        <p className="text-lg font-bold text-slate-900 dark:text-white">
          {formatDateTime(job.scheduledStart, job.timezone, locale)}
        </p>
        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
          {t('admin.durationMinutes', { minutes: job.durationMinutes })} ·{' '}
          {t(`services.${job.service}.name`)}
        </p>
      </div>

      {/*
        La direccion enlaza al mapa. Es lo que evita teclear una calle
        conduciendo, y `?q=` funciona con la aplicacion de mapas que tenga
        instalada cada movil en vez de obligar a una concreta.
      */}
      <div>
        <a
          className="text-base font-semibold text-brand-700 underline dark:text-sun-300"
          href={`https://maps.google.com/?q=${encodeURIComponent(completa)}`}
          target="_blank"
          rel="noreferrer"
        >
          {direccion}
        </a>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {job.city}, {job.state} {job.postalCode}
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t('admin.myJobs.rooms', { bedrooms: job.bedrooms, bathrooms: job.bathrooms })}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium text-slate-900 dark:text-slate-100">
          {job.customerFirstName}
        </span>
        <a className="ft-btn-ghost" href={`tel:${job.customerPhone}`}>
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
          <p className="text-xs font-bold tracking-wide text-slate-800 uppercase dark:text-sun-200">
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
        <div className="text-xs text-slate-600 dark:text-slate-400">
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
          {ocupado ? t('common.loading') : t('admin.myJobs.start')}
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
        {ocupado ? t('common.loading') : t('admin.myJobs.finish')}
      </button>
    );
  }

  return (
    <p className="text-sm font-semibold text-green-700 dark:text-green-400">
      {t('admin.myJobs.finished')}
    </p>
  );
}
