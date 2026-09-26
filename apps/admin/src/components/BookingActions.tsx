import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  allowedTransitions,
  type AdminBookingDetail,
  type AuthenticatedStaff,
  type BookingStatus,
  type Locale,
} from '@freshness/types';
import { ApiClientError, captureDeposit, changeBookingStatus, releaseDeposit } from '../lib/api';
import { useToast } from './ToastProvider';
import { SpinnerIcon } from './Icons';
import { formatCents } from '../lib/format';

/** Estados que exigen explicar por qué: son los que el cliente puede discutir. */
const NEEDS_REASON: BookingStatus[] = ['CANCELLED', 'NO_SHOW'];

type Accion = BookingStatus | 'capture' | 'release';

interface BookingActionsProps {
  booking: AdminBookingDetail;
  staff: AuthenticatedStaff;
  locale: Locale;
  onUpdated: (booking: AdminBookingDetail) => void;
  onSessionLost: () => void;
}

/**
 * ACCIONES SOBRE LA RESERVA
 * -------------------------
 * Los botones que se pintan salen de la tabla de transiciones del contrato
 * compartido, no de una lista escrita aquí: la regla de negocio vive en un
 * sitio y el panel la consulta.
 *
 * El servidor vuelve a comprobarla igualmente. Esto solo evita ofrecer un
 * botón que va a fallar.
 *
 * EL RESULTADO SE AVISA, YA SEA BUENO O MALO. Antes, cancelar una reserva no
 * decía nada al terminar: el botón desaparecía porque el nuevo estado ya no
 * lo permitía, y había que deducir del cambio que había funcionado. Cobrar
 * un depósito —que sí mueve dinero— tampoco confirmaba nada.
 */
export function BookingActions({
  booking,
  staff,
  locale,
  onUpdated,
  onSessionLost,
}: BookingActionsProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [pending, setPending] = useState<Accion | null>(null);
  const [reason, setReason] = useState('');

  const transiciones = allowedTransitions(booking.status);
  // Solo administración mueve dinero: quien puede cambiar una cita no tiene
  // por qué poder cobrarle a un cliente.
  const puedeTocarDinero = staff.role === 'ADMIN';
  const retencionViva = booking.payment?.status === 'REQUIRES_CAPTURE';

  const ejecutar = async (
    accion: Accion,
    llamada: () => Promise<AdminBookingDetail>,
    claveDeExito: string,
  ): Promise<void> => {
    setPending(accion);

    try {
      onUpdated(await llamada());
      setReason('');
      toast.success(claveDeExito);
    } catch (error) {
      // Un 403 aquí puede ser "tu rol no llega", no solo sesión perdida: solo
      // el 401 cierra la sesión.
      if (error instanceof ApiClientError && error.statusCode === 401) {
        onSessionLost();
        return;
      }
      toast.error(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
    } finally {
      setPending(null);
    }
  };

  const nada = transiciones.length === 0 && !(puedeTocarDinero && retencionViva);
  if (nada) {
    return (
      <section className="ft-card p-5">
        <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin.noActions')}</p>
      </section>
    );
  }

  const exigeMotivo =
    transiciones.some((estado) => NEEDS_REASON.includes(estado)) ||
    (puedeTocarDinero && retencionViva);

  return (
    <section className="ft-card space-y-4 p-5">
      <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('admin.actions')}</h2>

      {exigeMotivo && (
        <div>
          <label className="ft-label" htmlFor="motivo">
            {t('admin.reason')}
          </label>
          <input
            id="motivo"
            className="ft-input"
            maxLength={500}
            placeholder={t('admin.reasonPlaceholder')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('admin.reasonHelp')}</p>
        </div>
      )}

      {transiciones.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {transiciones.map((estado) => {
            const falta = NEEDS_REASON.includes(estado) && reason.trim().length === 0;
            return (
              <button
                key={estado}
                type="button"
                className="ft-btn-ghost"
                disabled={pending !== null || falta}
                // Sin esto, un botón desactivado no explica por qué lo está.
                title={falta ? t('admin.reasonRequired') : undefined}
                onClick={() =>
                  void ejecutar(
                    estado,
                    () =>
                      changeBookingStatus(booking.bookingId, {
                        status: estado,
                        ...(reason.trim() ? { reason: reason.trim() } : {}),
                      }),
                    'admin.toast.statusChanged',
                  )
                }
              >
                {pending === estado && <SpinnerIcon className="h-4 w-4" />}
                {pending === estado ? t('admin.working') : t(`admin.action.${estado}`)}
              </button>
            );
          })}
        </div>
      )}

      {puedeTocarDinero && retencionViva && booking.payment && (
        <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-night-600">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {t('admin.depositHeld', {
              amount: formatCents(booking.payment.amountAuthorizedCents, locale),
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="ft-btn-ghost"
              disabled={pending !== null || reason.trim().length === 0}
              title={reason.trim().length === 0 ? t('admin.reasonRequired') : undefined}
              onClick={() =>
                void ejecutar(
                  'capture',
                  () => captureDeposit(booking.bookingId, { reason: reason.trim() }),
                  'admin.toast.depositCaptured',
                )
              }
            >
              {pending === 'capture' && <SpinnerIcon className="h-4 w-4" />}
              {pending === 'capture' ? t('admin.working') : t('admin.captureDeposit')}
            </button>

            <button
              type="button"
              className="ft-btn-primary"
              disabled={pending !== null || reason.trim().length === 0}
              title={reason.trim().length === 0 ? t('admin.reasonRequired') : undefined}
              onClick={() =>
                void ejecutar(
                  'release',
                  () => releaseDeposit(booking.bookingId, { reason: reason.trim() }),
                  'admin.toast.depositReleased',
                )
              }
            >
              {pending === 'release' && <SpinnerIcon className="h-4 w-4" />}
              {pending === 'release' ? t('admin.working') : t('admin.releaseDeposit')}
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('admin.depositHelp')}</p>
        </div>
      )}
    </section>
  );
}
