import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AdminBookingListItem,
  AdminBookingQueryInput,
  BookingStatus,
  Locale,
} from '@freshness/types';
import { ApiClientError, fetchBookings, isSessionError } from '../lib/api';
import { StatusChip } from '../components/StatusChip';
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
  onSessionLost: () => void;
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
        onSessionLost();
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
            disabled={search.trim().length >= 2}
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
          <input
            id="busqueda"
            type="search"
            className="ft-input"
            placeholder={t('admin.filterSearchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      {/* ------------------------------ Resultados ----------------------------- */}
      <div aria-live="polite" aria-busy={loading}>
        {loading && (
          <p className="text-sm text-slate-600 dark:text-slate-400">{t('common.loading')}</p>
        )}

        {!loading && errorKey && (
          <p className="text-sm font-medium text-red-700 dark:text-red-400" role="alert">
            {t(errorKey)}
          </p>
        )}

        {!loading && !errorKey && items.length === 0 && (
          <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin.noBookings')}</p>
        )}

        {!loading && !errorKey && items.length > 0 && (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.bookingId}>
                <button
                  type="button"
                  onClick={() => onOpenBooking(item.bookingId)}
                  className="ft-card w-full p-4 text-left transition-colors hover:border-brand-300
                             dark:hover:border-brand-700"
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
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
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
