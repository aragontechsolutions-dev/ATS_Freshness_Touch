import { useTranslation } from 'react-i18next';
import type { AvailabilitySlot, Locale } from '@freshness/types';
import { useAvailability } from '../../hooks/useAvailability';
import type { AvailabilityQuery } from '../../lib/api';
import { addDays, formatDuration, formatTime, todayInTimezone } from '../../lib/format';

/** Zona horaria de la empresa mientras no venga de la configuracion. */
const TIMEZONE = 'America/New_York';

interface ScheduleStepProps {
  query: Omit<AvailabilityQuery, 'date'>;
  date: string;
  slot: string | null;
  locale: Locale;
  onDateChange: (date: string) => void;
  onSlotChange: (slot: string | null) => void;
}

/**
 * PASO 1: DIA Y HORA
 *
 * Las franjas no disponibles se muestran igualmente, apagadas y con el motivo.
 * Ocultarlas dejaria un hueco inexplicable en la rejilla y la sensacion de que
 * la empresa no trabaja a esa hora, cuando lo que pasa es que ya esta ocupada.
 */
export function ScheduleStep({
  query,
  date,
  slot,
  locale,
  onDateChange,
  onSlotChange,
}: ScheduleStepProps) {
  const { t } = useTranslation();
  const { data, loading, errorKey } = useAvailability({ ...query, date });

  const hoy = todayInTimezone(TIMEZONE);

  return (
    <div className="space-y-5">
      <div>
        <label className="ft-label" htmlFor="booking-date">
          {t('booking.schedule.dateLabel')}
        </label>
        <input
          id="booking-date"
          type="date"
          className="ft-input sm:max-w-56"
          value={date}
          min={hoy}
          // El horizonte de reserva son 90 dias: mas alla la agenda es pura
          // especulacion y la API lo rechaza.
          max={addDays(hoy, 90)}
          onChange={(event) => {
            onDateChange(event.target.value);
            // Al cambiar de dia la franja elegida deja de existir.
            onSlotChange(null);
          }}
        />
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {t('booking.schedule.leadTime')}
        </p>
      </div>

      <div aria-live="polite" aria-busy={loading}>
        {loading && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-hidden="true">
            {Array.from({ length: 12 }, (_, index) => (
              <div key={index} className="ft-skeleton h-10" />
            ))}
          </div>
        )}

        {!loading && errorKey && (
          <p className="text-sm text-red-700 dark:text-red-400" role="alert">
            {t(errorKey)}
          </p>
        )}

        {!loading && !errorKey && data && (
          <SlotGrid data={data} slot={slot} locale={locale} onSlotChange={onSlotChange} />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

interface SlotGridProps {
  data: NonNullable<ReturnType<typeof useAvailability>['data']>;
  slot: string | null;
  locale: Locale;
  onSlotChange: (slot: string) => void;
}

function SlotGrid({ data, slot, locale, onSlotChange }: SlotGridProps) {
  const { t } = useTranslation();

  if (!data.businessOpen) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">{t('booking.schedule.closed')}</p>
    );
  }

  if (!data.slots.some((item) => item.available)) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">{t('booking.schedule.none')}</p>
    );
  }

  return (
    <>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        {t('booking.schedule.duration', {
          duration: formatDuration(data.durationMinutes, locale),
        })}{' '}
        {t('booking.schedule.timezone')}
      </p>

      <div
        role="radiogroup"
        aria-label={t('booking.schedule.title')}
        className="grid grid-cols-3 gap-2 sm:grid-cols-4"
      >
        {data.slots.map((item) => (
          <SlotButton
            key={item.startsAt}
            slot={item}
            selected={slot === item.startsAt}
            locale={locale}
            onSelect={() => onSlotChange(item.startsAt)}
          />
        ))}
      </div>
    </>
  );
}

const REASON_KEY: Record<string, string> = {
  FULLY_BOOKED: 'booking.schedule.fullyBooked',
  TOO_SOON: 'booking.schedule.tooSoon',
  DOES_NOT_FIT: 'booking.schedule.doesNotFit',
};

function SlotButton({
  slot,
  selected,
  locale,
  onSelect,
}: {
  slot: AvailabilitySlot;
  selected: boolean;
  locale: Locale;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const hora = formatTime(slot.localTime, locale);
  const motivo = slot.reason ? t(REASON_KEY[slot.reason] ?? 'booking.schedule.fullyBooked') : null;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={!slot.available}
      // El motivo va en el nombre accesible: quien usa lector de pantalla no
      // ve el tachado ni el color, solo oye el boton.
      aria-label={motivo ? `${hora} — ${motivo}` : hora}
      title={motivo ?? undefined}
      onClick={onSelect}
      className={`rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors ${
        selected
          ? 'border-brand-700 bg-brand-700 text-white'
          : slot.available
            ? 'border-slate-300 text-slate-700 hover:bg-brand-50 dark:border-night-600 dark:text-slate-200 dark:hover:bg-night-700'
            : 'cursor-not-allowed border-slate-200 text-slate-400 line-through dark:border-night-700 dark:text-slate-600'
      }`}
    >
      {hora}
    </button>
  );
}
