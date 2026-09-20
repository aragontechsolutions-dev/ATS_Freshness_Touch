import { useTranslation } from 'react-i18next';
import type { BookingResponse, Locale } from '@freshness/types';
import { company } from '../../config/company';
import type { BookingDetailsForm } from '../../lib/booking-validation';
import { formatCents, formatDateTimeLong } from '../../lib/format';
import { CheckIcon, PhoneIcon } from '../Icons';

export type BookingOutcome = 'CONFIRMED' | 'PENDING' | 'DECLINED';

interface DoneStepProps {
  booking: BookingResponse;
  details: BookingDetailsForm;
  outcome: BookingOutcome;
  locale: Locale;
  onClose: () => void;
  onRestart: () => void;
}

/**
 * PANTALLA FINAL
 *
 * Tres desenlaces posibles, y ninguno se disfraza de otro:
 *   CONFIRMED — deposito retenido y cita en firme.
 *   PENDING   — la reserva existe pero no se pudo retener el deposito.
 *   DECLINED  — el banco rechazo la tarjeta y la franja quedo libre.
 *
 * NO se promete ningun correo de confirmacion: los avisos automaticos son de
 * una etapa posterior y anunciar un correo que no llega genera llamadas de
 * clientes preocupados.
 */
export function DoneStep({ booking, details, outcome, locale, onClose, onRestart }: DoneStepProps) {
  const { t } = useTranslation();

  if (outcome === 'DECLINED') {
    return (
      <Aviso
        tono="error"
        title={t('booking.done.declinedTitle')}
        body={t('booking.done.declinedBody')}
      >
        <button type="button" className="ft-btn-secondary w-full" onClick={onRestart}>
          {t('booking.done.tryAgain')}
        </button>
      </Aviso>
    );
  }

  if (outcome === 'PENDING') {
    return (
      <Aviso
        tono="aviso"
        title={t('booking.done.pendingTitle')}
        body={t('booking.done.pendingBody', { phone: company.phoneDisplay })}
      >
        <Referencia reference={booking.reference} />
        <a href={company.phoneHref} className="ft-btn-secondary w-full">
          <PhoneIcon className="h-4 w-4" />
          {company.phoneDisplay}
        </a>
      </Aviso>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full
                     bg-brand-700 text-white"
          aria-hidden="true"
        >
          <CheckIcon className="h-5 w-5" />
        </span>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
          {t('booking.done.title')}
        </h3>
      </div>

      <Referencia reference={booking.reference} />

      <dl className="space-y-3 text-sm">
        <Dato
          label={t('booking.done.when')}
          value={formatDateTimeLong(booking.scheduledStart, booking.timezone, locale)}
        />
        <Dato
          label={t('booking.done.where')}
          value={`${details.line1}${details.line2 ? `, ${details.line2}` : ''}, ${details.city}, ${details.state} ${details.postalCode}`}
        />
        <Dato
          label={t('booking.done.held')}
          value={formatCents(booking.deposit.amountCents, locale)}
        />
        <Dato
          label={t('booking.done.dueLater')}
          value={formatCents(booking.balanceDueAtServiceCents, locale)}
        />
      </dl>

      <p className="text-sm text-slate-600 dark:text-slate-400">
        {t('booking.done.contact', { phone: company.phoneDisplay })}
      </p>

      <button type="button" className="ft-btn-primary w-full" onClick={onClose}>
        {t('booking.done.finish')}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Referencia({ reference }: { reference: string }) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-night-600 dark:bg-night-700">
      <p className="text-xs font-semibold tracking-wide text-brand-800 uppercase dark:text-brand-200">
        {t('booking.done.reference')}
      </p>
      <p className="mt-1 font-mono text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
        {reference}
      </p>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
        {t('booking.done.referenceHelp')}
      </p>
    </div>
  );
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
      <dt className="text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className="font-semibold text-slate-900 dark:text-white">{value}</dd>
    </div>
  );
}

function Aviso({
  tono,
  title,
  body,
  children,
}: {
  tono: 'error' | 'aviso';
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <h3
        className={`text-xl font-bold ${
          tono === 'error' ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-white'
        }`}
      >
        {title}
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400">{body}</p>
      {children}
    </div>
  );
}
