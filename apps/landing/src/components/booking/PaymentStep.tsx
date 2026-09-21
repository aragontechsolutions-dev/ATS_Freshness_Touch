import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BookingResponse, Locale } from '@freshness/types';
import { useBusinessContact } from '../../hooks/useBusinessSettings';
import { ApiClientError, confirmMockPayment } from '../../lib/api';
import { formatCents, formatTimeInZone } from '../../lib/format';
import { PhoneIcon } from '../Icons';
import { StripePaymentForm, stripeIsConfigured } from './StripePaymentForm';

export type PaymentOutcome = 'AUTHORISED' | 'DECLINED';

interface PaymentStepProps {
  booking: BookingResponse;
  locale: Locale;
  onResolved: (outcome: PaymentOutcome) => void;
}

/**
 * PASO 3: RETENER EL DEPOSITO
 *
 * Lo que aqui se pide NO es un cobro y el texto lo dice con todas las letras:
 * un cliente que cree que le estan cobrando 185 dolares por adelantado
 * abandona. Se explica el importe, que se acredita contra la factura y en que
 * caso se cobraria de verdad.
 *
 * El formulario depende del proveedor que tenga activo la API. El sitio no lo
 * decide ni lo adivina: viene en la respuesta de la reserva.
 */
export function PaymentStep({ booking, locale, onResolved }: PaymentStepProps) {
  const { t } = useTranslation();
  const [errorText, setErrorText] = useState<string | null>(null);

  const payment = booking.payment;
  const importe = formatCents(booking.deposit.amountCents, locale);

  // Sin sesion de pago no hay nada que confirmar: la reserva existe y queda
  // pendiente de que alguien la gestione por telefono.
  const noDisponible = payment === null || (payment.provider === 'stripe' && !stripeIsConfigured);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-night-600 dark:bg-night-700">
        <p className="text-sm font-bold text-brand-800 dark:text-brand-200">
          {t('booking.payment.depositTitle')}
        </p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {importe}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {t('booking.payment.depositExplainer', { amount: importe })}
        </p>
      </div>

      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-slate-600 dark:text-slate-400">{t('booking.payment.dueLater')}</dt>
          <dd className="font-semibold text-slate-900 dark:text-white">
            {formatCents(booking.balanceDueAtServiceCents, locale)}
          </dd>
        </div>
        {booking.holdExpiresAt && (
          <p className="pt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('booking.payment.holdExpires', {
              time: formatTimeInZone(booking.holdExpiresAt, booking.timezone, locale),
            })}
          </p>
        )}
      </dl>

      {errorText && (
        <p className="text-sm font-medium text-red-700 dark:text-red-400" role="alert">
          {errorText}
        </p>
      )}

      {noDisponible && <Unavailable />}

      {!noDisponible && payment?.provider === 'mock' && (
        <SimulatedPayment
          clientSecret={payment.clientSecret}
          amountLabel={importe}
          onResolved={onResolved}
          onError={setErrorText}
        />
      )}

      {!noDisponible && payment?.provider === 'stripe' && payment.clientSecret && (
        <StripePaymentForm
          clientSecret={payment.clientSecret}
          amountLabel={importe}
          locale={locale}
          onAuthorised={() => onResolved('AUTHORISED')}
          onDeclined={(message) => setErrorText(message)}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Unavailable() {
  const { t } = useTranslation();
  const contacto = useBusinessContact();

  return (
    <div className="rounded-xl border border-sun-400 bg-sun-50 p-4 dark:border-sun-600 dark:bg-night-700">
      <p className="text-sm font-bold text-slate-900 dark:text-white">
        {t('booking.payment.unavailableTitle')}
      </p>
      <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
        {contacto.phoneDisplay
          ? t('booking.payment.unavailableBody', { phone: contacto.phoneDisplay })
          : t('booking.payment.unavailableBodyNoPhone')}
      </p>
      {contacto.phoneHref && (
        <a href={contacto.phoneHref} className="ft-btn-outline mt-3 w-full">
          <PhoneIcon className="h-4 w-4" />
          {contacto.phoneDisplay}
        </a>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Pago simulado.
 *
 * Con el proveedor real, el navegador confirma la tarjeta contra los
 * servidores de Stripe. El simulador no tiene servidores, asi que se lo pide
 * a la API, que hace exactamente lo que haria Stripe: generar el aviso y
 * procesarlo por el mismo camino.
 *
 * El aviso de que es una simulacion es imposible de pasar por alto a
 * proposito: nadie debe creer que ha pagado algo.
 */
function SimulatedPayment({
  clientSecret,
  amountLabel,
  onResolved,
  onError,
}: {
  clientSecret: string | null;
  amountLabel: string;
  onResolved: (outcome: PaymentOutcome) => void;
  onError: (message: string | null) => void;
}) {
  const { t } = useTranslation();
  const [working, setWorking] = useState(false);

  const confirmar = async (outcome: 'AUTHORIZE' | 'DECLINE'): Promise<void> => {
    if (!clientSecret) return;

    setWorking(true);
    onError(null);

    try {
      const result = await confirmMockPayment({ clientSecret, outcome });
      onResolved(result.status === 'REQUIRES_CAPTURE' ? 'AUTHORISED' : 'DECLINED');
    } catch (error) {
      onError(t(error instanceof ApiClientError ? error.messageKey : 'booking.errorTitle'));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-dashed border-slate-400 p-4 dark:border-night-600">
        <p className="text-sm font-bold text-slate-900 dark:text-white">
          {t('booking.payment.simulatedTitle')}
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t('booking.payment.simulatedBody')}
        </p>
      </div>

      <button
        type="button"
        className="ft-btn-primary w-full"
        disabled={working}
        onClick={() => void confirmar('AUTHORIZE')}
      >
        {working
          ? t('booking.payment.working')
          : t('booking.payment.authorise', { amount: amountLabel })}
      </button>

      <button
        type="button"
        className="w-full text-xs font-medium text-slate-500 underline underline-offset-2
                   hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        disabled={working}
        onClick={() => void confirmar('DECLINE')}
      >
        {t('booking.payment.simulatedDecline')}
      </button>
    </div>
  );
}
