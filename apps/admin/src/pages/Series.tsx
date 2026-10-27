import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Locale, SeriesItem, SeriesStatus } from '@freshness/types';
import { ApiClientError, fetchSeries, isSessionError, updateSeries } from '../lib/api';
import { SkeletonFormulario } from '../components/Skeletons';
import { AlertIcon } from '../components/Icons';
import { formatCents, formatDateTime } from '../lib/format';

interface SeriesPageProps {
  locale: Locale;
  onSessionLost: () => void;
}

const DIAS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * LAS CLIENTAS DE SIEMPRE
 * =======================
 * Quien viene cada semana, cada dos o cada mes, y a que hora. Es la pantalla
 * que contesta «¿que tengo comprometido de forma fija?», que hasta ahora solo
 * estaba en la cabeza de la duena.
 *
 * ========================================================================
 * PAUSAR NO CANCELA LO QUE YA ESTA EN LA AGENDA
 * ========================================================================
 * Y la pantalla lo dice en voz alta, porque es lo contrario de lo que
 * cualquiera espera de un boton que se llama «pausar». Pausar deja de CREAR
 * citas; las que ya existen, con su equipo asignado, las cancela una persona
 * mirandolas una a una.
 */
export function SeriesPage({ locale, onSessionLost }: SeriesPageProps) {
  const { t } = useTranslation();

  const [cargando, setCargando] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [lista, setLista] = useState<SeriesItem[]>([]);

  const perdioSesion = onSessionLost;

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorKey(null);

    try {
      setLista((await fetchSeries()).series);
    } catch (error) {
      if (isSessionError(error)) {
        perdioSesion();
        return;
      }
      setErrorKey(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
    } finally {
      setCargando(false);
    }
  }, [perdioSesion]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cambiar = async (id: string, status: SeriesStatus): Promise<void> => {
    try {
      await updateSeries(id, status);
      await cargar();
    } catch (error) {
      if (isSessionError(error)) {
        perdioSesion();
        return;
      }
      setErrorKey(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
    }
  };

  if (cargando) return <SkeletonFormulario />;

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('admin.series.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t('admin.series.subtitle')}
        </p>
      </div>

      {errorKey !== null && (
        <p
          className="ft-card flex items-start gap-2 p-5 text-sm text-red-700 dark:text-red-300"
          role="alert"
        >
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t(errorKey)}
        </p>
      )}

      {lista.length === 0 ? (
        <p className="ft-card p-5 text-sm text-slate-600 dark:text-slate-400">
          {t('admin.series.empty')}
        </p>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {lista.map((serie) => (
            <li key={serie.id} className="ft-card space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {serie.customerName}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {t('admin.series.when', {
                      day: t(`admin.series.day.${DIAS[serie.dayOfWeek] ?? 'sunday'}`),
                      time: serie.startTime,
                      frequency: t(`admin.newBooking.frequencyOption.${serie.frequency}`),
                    })}
                  </p>
                  {serie.priceOverrideCents !== null && (
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {t('admin.series.agreedPrice', {
                        amount: formatCents(serie.priceOverrideCents, locale),
                      })}
                    </p>
                  )}
                  {serie.endDate !== null && (
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {t('admin.series.until', { date: serie.endDate })}
                    </p>
                  )}
                </div>

                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-night-700 dark:text-slate-300">
                  {t(`admin.series.status.${serie.status}`)}
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                {serie.nextAt === null
                  ? t('admin.series.noUpcoming')
                  : t('admin.series.upcoming', {
                      count: serie.upcomingCount,
                      next: formatDateTime(serie.nextAt, locale),
                    })}
              </p>

              {serie.status !== 'ENDED' && (
                <div className="flex flex-wrap gap-2">
                  {serie.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      className="ft-btn-ghost"
                      onClick={() => void cambiar(serie.id, 'PAUSED')}
                    >
                      {t('admin.series.pause')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ft-btn-ghost"
                      onClick={() => void cambiar(serie.id, 'ACTIVE')}
                    >
                      {t('admin.series.resume')}
                    </button>
                  )}

                  <button
                    type="button"
                    className="ft-btn-ghost text-red-700 dark:text-red-400"
                    onClick={() => void cambiar(serie.id, 'ENDED')}
                  >
                    {t('admin.series.end')}
                  </button>
                </div>
              )}

              {/*
                SE DICE EN VOZ ALTA porque es lo contrario de lo que cualquiera
                espera de un boton que se llama «pausar».
              */}
              {serie.upcomingCount > 0 && serie.status !== 'ENDED' && (
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  {t('admin.series.pauseWarning', { count: serie.upcomingCount })}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
