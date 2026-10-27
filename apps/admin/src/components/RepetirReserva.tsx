import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SERIES_FREQUENCIES,
  type AdminBookingDetail,
  type AuthenticatedStaff,
  type SeriesFrequency,
} from '@freshness/types';
import { ApiClientError, createSeriesFromBooking, isSessionError } from '../lib/api';
import { AlertIcon } from './Icons';

interface RepetirReservaProps {
  booking: AdminBookingDetail;
  staff: AuthenticatedStaff;
  /** Para refrescar la ficha: la reserva pasa a pertenecer a la serie. */
  onCreada: () => void;
  onSessionLost: () => void;
}

/**
 * «ESTO SE REPITE»
 * ================
 * Convierte una cita en una serie: la clienta de siempre que viene cada dos
 * semanas a la misma hora.
 *
 * ========================================================================
 * SE CREA DESDE AQUI Y NO CON UN FORMULARIO PROPIO
 * ========================================================================
 * Un formulario de serie pediria otra vez la clienta, la direccion, el
 * servicio, el tamano y la hora: lo que se acaba de escribir al meter esta
 * cita. Dos formularios que piden lo mismo se separan solos, y obligan a
 * teclear dos veces.
 *
 * Aqui solo se pregunta lo que de verdad es nuevo: cada cuanto, hasta
 * cuando y a que precio.
 */
export function RepetirReserva({ booking, staff, onCreada, onSessionLost }: RepetirReservaProps) {
  const { t } = useTranslation();

  const [frequency, setFrequency] = useState<SeriesFrequency>('BIWEEKLY');
  const [endDate, setEndDate] = useState('');
  const [precio, setPrecio] = useState('');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  /* El precio pactado es dinero, y el dinero es de administracion. */
  const puedePactarPrecio = staff.role === 'ADMIN';

  /*
   * SI YA PERTENECE A UNA SERIE NO SE OFRECE. Sin esto, el unico aviso
   * llegaria como un error despues de rellenar el formulario entero.
   */
  if (booking.seriesId !== null) {
    return (
      <section className="ft-card p-5">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          {t('admin.repeat.title')}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t('admin.repeat.alreadyInSeries')}
        </p>
      </section>
    );
  }

  /* Una cita cancelada no se repite: lo que se repite es lo que se hace. */
  if (booking.status === 'CANCELLED' || booking.status === 'NO_SHOW') return null;

  const enviar = async (evento: React.FormEvent): Promise<void> => {
    evento.preventDefault();
    if (guardando) return;

    setGuardando(true);
    setErrorKey(null);

    const dolares = Number(precio.trim().replace(',', '.'));
    const precioPactado =
      precio.trim() !== '' && Number.isFinite(dolares) && dolares >= 0
        ? Math.round(dolares * 100)
        : null;

    try {
      await createSeriesFromBooking(booking.bookingId, {
        frequency,
        endDate: endDate === '' ? null : endDate,
        priceOverrideCents: precioPactado,
      });
      onCreada();
    } catch (error) {
      if (isSessionError(error)) {
        onSessionLost();
        return;
      }
      setErrorKey(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className="ft-card space-y-4 p-5" onSubmit={(evento) => void enviar(evento)}>
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white">
          {t('admin.repeat.title')}
        </h2>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          {t('admin.repeat.subtitle')}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="ft-label" htmlFor="rep-frequency">
            {t('admin.repeat.frequency')}
          </label>
          <select
            id="rep-frequency"
            className="ft-input"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as SeriesFrequency)}
          >
            {SERIES_FREQUENCIES.map((codigo) => (
              <option key={codigo} value={codigo}>
                {t(`admin.newBooking.frequencyOption.${codigo}`)}
              </option>
            ))}
          </select>
          {/* Mensual son cuatro semanas: si no, cambiaria de dia cada mes. */}
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('admin.repeat.monthlyNote')}
          </p>
        </div>

        <div>
          <label className="ft-label" htmlFor="rep-end">
            {t('admin.repeat.endDate')}
          </label>
          <input
            id="rep-end"
            type="date"
            className="ft-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {puedePactarPrecio && (
        <div>
          <label className="ft-label" htmlFor="rep-price">
            {t('admin.repeat.agreedPrice')}
          </label>
          <input
            id="rep-price"
            inputMode="decimal"
            className="ft-input"
            placeholder={t('admin.newBooking.agreedPricePlaceholder')}
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            aria-describedby="rep-price-help"
          />
          {/*
            El precio vive en la serie y no en cada cita: si se recalculara
            cada vez, el dia que se suban las tarifas se le subirian a ella
            sin que nadie lo decidiera.
          */}
          <p id="rep-price-help" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('admin.repeat.agreedPriceHelp')}
          </p>
        </div>
      )}

      {errorKey !== null && (
        <p
          className="flex items-start gap-2 text-sm font-medium text-red-700 dark:text-red-400"
          role="alert"
        >
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t(errorKey)}
        </p>
      )}

      <button type="submit" className="ft-btn-primary" disabled={guardando}>
        {guardando ? t('admin.newBooking.saving') : t('admin.repeat.submit')}
      </button>
    </form>
  );
}
