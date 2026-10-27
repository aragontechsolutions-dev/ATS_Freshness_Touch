import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  allowedTransitions,
  chargeableBalanceCents,
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
  chargeBalance,
  refundPayment,
  releaseDeposit,
} from '../lib/api';
import { useToast } from './ToastProvider';
import { centavosADevolver } from '../lib/devolucion';
import { claveDeRetencion, diasDeRetencion } from '../lib/retencion';
import { SpinnerIcon } from './Icons';
import { formatCents } from '../lib/format';

/** Estados que exigen explicar por qué: son los que el cliente puede discutir. */
const NEEDS_REASON: BookingStatus[] = ['CANCELLED', 'NO_SHOW'];

type Accion = BookingStatus | 'capture' | 'release' | 'refund' | 'refundBalance' | 'charge';

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
  /*
   * Lo que queda por devolver lo calcula el CONTRATO, con la misma funcion
   * que usa el servidor para rechazar la peticion: asi el boton no puede
   * ofrecer algo que la API va a negar.
   */
  const devolvible = booking.payment ? refundableCents(booking.payment) : 0;
  /*
   * LO DEVOLVIBLE DEL SALDO (etapa 3.24). Un cobro final es inmediato, no
   * una retencion: lo autorizado y lo cobrado son la misma cifra, asi que
   * `amountCents` vale como lo cobrado. El servidor lo vuelve a comprobar
   * contra la fila de verdad.
   */
  const devolvibleSaldo = booking.finalCharge
    ? refundableCents({
        status: booking.finalCharge.status,
        amountCapturedCents: booking.finalCharge.amountCents,
        amountRefundedCents: booking.finalCharge.amountRefundedCents,
      })
    : 0;

  /*
   * EL SALDO DEL TRABAJO TERMINADO (etapa 3.23). Son los 150 dolares de una
   * limpieza de 185: la mayor parte del importe, que hasta ahora se cobraba
   * fuera del sistema.
   */
  const saldoPendiente = chargeableBalanceCents(booking.balanceDueCents, booking.finalCharge);
  const hayTarjeta = booking.payment?.cardOnFile === true;

  const ejecutar = async (
    accion: Accion,
    llamada: () => Promise<AdminBookingDetail>,
    claveDeExito: string,
  ): Promise<void> => {
    setPending(accion);

    try {
      onUpdated(await llamada());
      // El motivo se vacia SOLO si la accion salio bien: tras un fallo, quien
      // lo intento sigue teniendo delante lo que habia escrito.
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

  const puedeDevolver = puedeTocarDinero && devolvible > 0;
  const puedeDevolverSaldo = puedeTocarDinero && devolvibleSaldo > 0;
  /*
   * Solo con el trabajo TERMINADO: cobrar antes convierte cualquier
   * incidencia en una devolucion, que es mas cara y mas lenta que no haber
   * cobrado todavia. El servidor lo vuelve a comprobar.
   */
  const puedeCobrarSaldo = puedeTocarDinero && booking.status === 'COMPLETED' && saldoPendiente > 0;
  const nada =
    transiciones.length === 0 &&
    !(puedeTocarDinero && retencionViva) &&
    !puedeDevolver &&
    !puedeDevolverSaldo &&
    !puedeCobrarSaldo;
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
    puedeDevolver ||
    puedeDevolverSaldo;

  /** Hay botones que piden motivo y el campo esta vacio. */
  const faltaMotivo =
    transiciones.some((estado) => NEEDS_REASON.includes(estado)) && reason.trim().length === 0;

  /*
   * La reserva ya esta cerrada: nadie va a volver a entrar en ella por su
   * cuenta, asi que una retencion viva aqui es dinero que se queda olvidado.
   */
  const cerrada = booking.status === 'CANCELLED' || booking.status === 'NO_SHOW';

  /* La cuenta y sus dos bordes viven en `lib/retencion.ts`, con sus pruebas. */
  const diasQueQuedan = diasDeRetencion(booking.payment?.expiresAt ?? null);
  const textoDeRetencion = claveDeRetencion(diasQueQuedan);

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

          {/*
           * EL AVISO, A LA VISTA Y NO EN UN `title`.
           *
           * El tooltip solo aparece si el raton se queda quieto encima, y en
           * movil NO APARECE NUNCA. El resultado era un boton gris que no
           * explicaba nada y una persona convencida de que el sistema no
           * dejaba cancelar.
           */}
          {faltaMotivo && (
            <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-200">
              {t('admin.reasonMissing')}
            </p>
          )}
        </div>
      )}

      {/*
       * CANCELAR NO TOCA EL DINERO, y es deliberado: son dos decisiones. Lo
       * que no puede ser es que nadie lo diga — una retencion viva detras de
       * una reserva que ya nadie va a mirar es dinero bloqueado en la
       * tarjeta de alguien.
       *
       * Caduca sola a los 7 dias y el dinero vuelve al cliente, asi que el
       * olvido falla a favor de el. Lo que se pierde es el cobro al que la
       * empresa tenia derecho, y por eso se avisa con los dias que quedan.
       */}
      {retencionViva && cerrada && booking.payment && (
        <p
          className={
            'rounded-md px-3 py-2 text-xs font-medium ' +
            (diasQueQuedan !== null && diasQueQuedan <= 0
              ? 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100'
              : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100')
          }
        >
          {t(textoDeRetencion, {
            count: Math.max(diasQueQuedan ?? 0, 0),
            amount: formatCents(
              booking.payment.amountAuthorizedCents - booking.payment.amountCapturedCents,
              locale,
            ),
          })}
        </p>
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

      {/* ------------------------- Cobrar el saldo -------------------------- */}
      {puedeCobrarSaldo && (
        <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-night-600">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {t('admin.balanceDueNotice', { amount: formatCents(saldoPendiente, locale) })}
          </p>

          <button
            type="button"
            className="ft-btn-primary"
            disabled={pending !== null || !hayTarjeta}
            // Sin tarjeta guardada no es un fallo del sistema: es que a esa
            // persona hay que cobrarle por otra via, y hay que decirlo.
            title={hayTarjeta ? undefined : t('admin.noCardOnFile')}
            onClick={() =>
              void ejecutar(
                'charge',
                () => chargeBalance(booking.bookingId),
                'admin.toast.balanceCharged',
              )
            }
          >
            {pending === 'charge' && <SpinnerIcon className="h-4 w-4" />}
            {pending === 'charge'
              ? t('admin.working')
              : t('admin.chargeBalance', { amount: formatCents(saldoPendiente, locale) })}
          </button>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t('admin.chargeBalanceHelp')}
          </p>
        </div>
      )}

      {/* ------------------------ Devolver lo cobrado ------------------------ */}
      {puedeDevolver && (
        <BloqueDevolucion
          id="deposito"
          etiqueta={t('admin.refundDeposit')}
          disponible={devolvible}
          locale={locale}
          accion="refund"
          pending={pending}
          motivo={reason}
          onDevolver={(centavos) =>
            void ejecutar(
              'refund',
              () =>
                refundPayment(booking.bookingId, {
                  target: 'DEPOSIT',
                  amountCents: centavos,
                  reason: reason.trim(),
                }),
              'admin.toast.depositRefunded',
            )
          }
        />
      )}

      {/*
       * Y EL SALDO, QUE ES OTRO DINERO (etapa 3.24). Son dos conversaciones
       * distintas con el cliente —«te devolvemos el viaje» no es «te
       * devolvemos la limpieza»— y por eso dos bloques y dos acciones en la
       * auditoria, no un desplegable.
       */}
      {puedeDevolverSaldo && (
        <BloqueDevolucion
          id="saldo"
          etiqueta={t('admin.refundBalance')}
          disponible={devolvibleSaldo}
          locale={locale}
          accion="refundBalance"
          pending={pending}
          motivo={reason}
          onDevolver={(centavos) =>
            void ejecutar(
              'refundBalance',
              () =>
                refundPayment(booking.bookingId, {
                  target: 'BALANCE',
                  amountCents: centavos,
                  reason: reason.trim(),
                }),
              'admin.toast.balanceRefunded',
            )
          }
        />
      )}
    </section>
  );
}

/**
 * UN BLOQUE DE DEVOLUCION, que se usa para el deposito y para el saldo.
 *
 * Tiene su propio importe tecleado a proposito: son dos devoluciones
 * distintas y compartir el campo haria que lo escrito para una apareciera en
 * la otra, que con dinero es justo lo que no puede pasar.
 *
 * SE TECLEA EN DOLARES, igual que en la pantalla de tarifas: nadie piensa en
 * centavos, y un cero de mas en un campo de centavos es una devolucion diez
 * veces mayor que nadie revisa. Vacio significa «todo lo que quede».
 */
function BloqueDevolucion({
  id,
  etiqueta,
  disponible,
  locale,
  accion,
  pending,
  motivo,
  onDevolver,
}: {
  id: string;
  etiqueta: string;
  disponible: number;
  locale: Locale;
  accion: Accion;
  pending: Accion | null;
  motivo: string;
  onDevolver: (centavos: number) => void;
}) {
  const { t } = useTranslation();
  const [importe, setImporte] = useState('');

  /*
   * Al cambiar lo disponible —es decir, en cuanto la devolucion sale bien—
   * el campo se vacia. Dejarlo escrito invitaria a pulsar otra vez y volver
   * a devolver el mismo importe.
   */
  useEffect(() => setImporte(''), [disponible]);

  const centavos = centavosADevolver(importe, disponible);
  const sinMotivo = motivo.trim().length === 0;

  return (
    <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-night-600">
      <p className="text-xs text-slate-600 dark:text-slate-400">
        {t('admin.refundAvailable', { amount: formatCents(disponible, locale) })}
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-40">
          <label className="ft-label" htmlFor={`importe-devolucion-${id}`}>
            {t('admin.refundAmount')}
          </label>
          <input
            id={`importe-devolucion-${id}`}
            className="ft-input"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            placeholder={t('admin.refundAmountPlaceholder')}
            value={importe}
            onChange={(event) => setImporte(event.target.value)}
          />
        </div>

        <button
          type="button"
          className="ft-btn-ghost"
          disabled={pending !== null || sinMotivo || centavos === null}
          title={
            centavos === null
              ? t('admin.refundTooLarge', { amount: formatCents(disponible, locale) })
              : sinMotivo
                ? t('admin.reasonRequired')
                : undefined
          }
          onClick={() => {
            if (centavos === null) return;
            onDevolver(centavos);
          }}
        >
          {pending === accion && <SpinnerIcon className="h-4 w-4" />}
          {pending === accion ? t('admin.working') : etiqueta}
        </button>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">{t('admin.refundHelp')}</p>
    </div>
  );
}
