import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AdminBookingListItem,
  AdminBookingQueryInput,
  BookingStatus,
  Locale,
} from '@freshness/types';
import { ApiClientError, fetchBookings, isSessionError, sessionLostReason } from '../lib/api';
import { StatusChip } from '../components/StatusChip';
import { SkeletonListaReservas } from '../components/Skeletons';
import { AlertIcon, CalendarIcon, RefreshIcon, SearchIcon, UsersIcon } from '../components/Icons';
import { formatCents, formatDateTime, todayInTimezone } from '../lib/format';

const TIMEZONE = 'America/New_York';

const ESTADOS: BookingStatus[] = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

interface AgendaProps {
  locale: Locale;
  onOpenBooking: (bookingId: string) => void;
  onSessionLost: (reason?: 'expired' | 'noAccess') => void;
}

/**
 * AGENDA
 * ------
 * Arranca en el día de HOY, no en "todas las reservas": lo que el equipo
 * necesita nada más entrar es saber qué toca hoy, no navegar por el histórico.
 *
 * La lista no muestra la calle ni las instrucciones de acceso porque la API no
 * las envía aquí (ver `docs/13-panel-y-permisos.md`). Están en el detalle.
 */
export function Agenda({ locale, onOpenBooking, onSessionLost }: AgendaProps) {
  const { t } = useTranslation();

  const [date, setDate] = useState(() => todayInTimezone(TIMEZONE));
  const [status, setStatus] = useState<BookingStatus | ''>('');
  const [search, setSearch] = useState('');

  const [items, setItems] = useState<AdminBookingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const cargar = useCallback(async (): Promise<void> => {
    setLoading(true);
    setErrorKey(null);

    const query: AdminBookingQueryInput = {
      // Buscar por texto ignora la fecha: quien escribe una referencia la
      // quiere encontrar aunque sea de otro día.
      ...(search.trim().length >= 2 ? { search: search.trim() } : { date }),
      ...(status ? { status } : {}),
    };

    try {
      const respuesta = await fetchBookings(query);
      setItems(respuesta.items);
    } catch (error) {
      if (isSessionError(error)) {
        onSessionLost(sessionLostReason(error));
        return;
      }
      setErrorKey(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
    } finally {
      setLoading(false);
    }
  }, [date, status, search, onSessionLost]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const buscando = search.trim().length >= 2;

  return (
    <div className="space-y-6">
      {/* ------------------------------- Filtros ------------------------------- */}
      <div className="ft-card grid gap-4 p-4 sm:grid-cols-3">
        <div>
          <label className="ft-label" htmlFor="fecha">
            {t('admin.filterDate')}
          </label>
          <input
            id="fecha"
            type="date"
            className="ft-input"
            value={date}
            disabled={buscando}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>

        <div>
          <label className="ft-label" htmlFor="estado">
            {t('admin.filterStatus')}
          </label>
          <select
            id="estado"
            className="ft-input"
            value={status}
            onChange={(event) => setStatus(event.target.value as BookingStatus | '')}
          >
            <option value="">{t('admin.filterAnyStatus')}</option>
            {ESTADOS.map((estado) => (
              <option key={estado} value={estado}>
                {t(`admin.status.${estado}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="ft-label" htmlFor="busqueda">
            {t('admin.filterSearch')}
          </label>
          {/*
            La lupa va DENTRO del campo, a la izquierda, y el texto se aparta
            con `pl-10`. Es la unica forma de que el icono no tape lo que se
            escribe cuando la referencia es larga.
          */}
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
            <input
              id="busqueda"
              type="search"
              className="ft-input pl-10"
              placeholder={t('admin.filterSearchPlaceholder')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ------------------------------ Resultados ----------------------------- */}
      <div aria-live="polite" aria-busy={loading}>
        {loading && <SkeletonListaReservas />}

        {!loading && errorKey && (
          <div className="ft-card flex flex-col items-start gap-3 p-5" role="alert">
            <div className="flex items-start gap-3">
              <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-400" />
              <p className="text-sm font-medium text-red-700 dark:text-red-400">{t(errorKey)}</p>
            </div>
            {/*
              Un error sin salida deja mirando la pantalla. Casi siempre es la
              conexion, y casi siempre se arregla volviendo a pedirlo.
            */}
            <button type="button" className="ft-btn-ghost" onClick={() => void cargar()}>
              <RefreshIcon className="h-4 w-4" />
              {t('admin.retry')}
            </button>
          </div>
        )}

        {!loading && !errorKey && items.length === 0 && (
          <div className="ft-card flex flex-col items-center gap-2 px-6 py-12 text-center">
            <CalendarIcon className="h-9 w-9 text-slate-400 dark:text-slate-500" />
            <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin.noBookings')}</p>
          </div>
        )}

        {!loading && !errorKey && items.length > 0 && (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.bookingId}>
                <button
                  type="button"
                  onClick={() => onOpenBooking(item.bookingId)}
                  className="ft-card w-full p-4 text-left transition-colors hover:border-brand-300
                             hover:bg-brand-50/60 dark:hover:border-brand-700 dark:hover:bg-night-700/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                        {item.reference}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">
                        {item.customerName} · {item.city} {item.postalCode}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {formatDateTime(item.scheduledStart, item.timezone, locale)} ·{' '}
                        {t(`services.${item.service}.name`)}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusChip status={item.status} />
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {formatCents(item.totalCents, locale)}
                      </span>
                    </div>
                  </div>

                  {item.assignedStaff.length > 0 && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <UsersIcon className="h-3.5 w-3.5 shrink-0" />
                      {t('admin.assignedTo', {
                        names: item.assignedStaff.map((s) => s.name).join(', '),
                      })}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
