import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  allowedTransitions,
  refundableCents,
  type AdminBookingDetail,
  type AuthenticatedStaff,
  type BookingStatus,
  type Locale,
} from '@freshness/types';
import {
  ApiClientError,
  captureDeposit,
  changeBookingStatus,
  refundDeposit,
  releaseDeposit,
} from '../lib/api';
import { useToast } from './ToastProvider';
import { centavosADevolver } from '../lib/devolucion';
import { SpinnerIcon } from './Icons';
import { formatCents } from '../lib/format';

/** Estados que exigen explicar por qué: son los que el cliente puede discutir. */
const NEEDS_REASON: BookingStatus[] = ['CANCELLED', 'NO_SHOW'];

type Accion = BookingStatus | 'capture' | 'release' | 'refund';

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
  /*
   * EL IMPORTE A DEVOLVER SE TECLEA EN DOLARES, igual que en la pantalla de
   * tarifas y por lo mismo: nadie piensa en centavos, y un cero de mas en un
   * campo de centavos es una devolucion diez veces mayor que nadie revisa.
   * Vacio significa «todo lo que quede», que es el caso mas habitual.
   */
  const [refundAmount, setRefundAmount] = useState('');

  const transiciones = allowedTransitions(booking.status);
  // Solo administración mueve dinero: quien puede cambiar una cita no tiene
  // por qué poder cobrarle a un cliente.
  const puedeTocarDinero = staff.role === 'ADMIN';
  const retencionViva = booking.payment?.status === 'REQUIRES_CAPTURE';
  /*
   * Lo que queda por devolver lo calcula el CONTRATO, con la misma funcion
   * que usa el servidor para rechazar la peticion: asi el boton no puede
   * ofrecer algo que la API va a negar.
   */
  const devolvible = booking.payment ? refundableCents(booking.payment) : 0;

  const ejecutar = async (
    accion: Accion,
    llamada: () => Promise<AdminBookingDetail>,
    claveDeExito: string,
  ): Promise<void> => {
    setPending(accion);

    try {
      onUpdated(await llamada());
      // Los dos campos se vacian SOLO si la accion salio bien: tras un fallo,
      // quien lo intento sigue teniendo delante lo que habia escrito.
      setReason('');
      setRefundAmount('');
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

  const puedeDevolver = puedeTocarDinero && devolvible > 0;
  const nada = transiciones.length === 0 && !(puedeTocarDinero && retencionViva) && !puedeDevolver;
  if (nada) {
    return (
      <section className="ft-card p-5">
        <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin.noActions')}</p>
      </section>
    );
  }

  const exigeMotivo =
    transiciones.some((estado) => NEEDS_REASON.includes(estado)) ||
    (puedeTocarDinero && retencionViva) ||
    puedeDevolver;

  /*
   * Lo tecleado, en centavos. `null` si no es un importe o si no cabe en lo
   * que queda: el boton se apaga y dice por que, en vez de dejar que el
   * servidor rechace una peticion que ya se sabia mala. La conversion vive
   * en `lib/devolucion` para poder probarla sin montar la pantalla.
   */
  const importeDevolucion = centavosADevolver(refundAmount, devolvible);

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

      {/* ------------------------ Devolver lo cobrado ------------------------ */}
      {puedeDevolver && (
        <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-night-600">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {t('admin.refundAvailable', { amount: formatCents(devolvible, locale) })}
          </p>

          <div className="flex flex-wrap items-end gap-2">
            <div className="w-40">
              <label className="ft-label" htmlFor="importe-devolucion">
                {t('admin.refundAmount')}
              </label>
              <input
                id="importe-devolucion"
                className="ft-input"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder={t('admin.refundAmountPlaceholder')}
                value={refundAmount}
                onChange={(event) => setRefundAmount(event.target.value)}
              />
            </div>

            <button
              type="button"
              className="ft-btn-ghost"
              disabled={
                pending !== null || reason.trim().length === 0 || importeDevolucion === null
              }
              title={
                importeDevolucion === null
                  ? t('admin.refundTooLarge', { amount: formatCents(devolvible, locale) })
                  : reason.trim().length === 0
                    ? t('admin.reasonRequired')
                    : undefined
              }
              onClick={() => {
                if (importeDevolucion === null) return;
                void ejecutar(
                  'refund',
                  () =>
                    refundDeposit(booking.bookingId, {
                      amountCents: importeDevolucion,
                      reason: reason.trim(),
                    }),
                  'admin.toast.depositRefunded',
                );
              }}
            >
              {pending === 'refund' && <SpinnerIcon className="h-4 w-4" />}
              {pending === 'refund' ? t('admin.working') : t('admin.refundDeposit')}
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">{t('admin.refundHelp')}</p>
        </div>
      )}
    </section>
  );
}
