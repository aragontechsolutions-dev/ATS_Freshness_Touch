import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminBookingDetail, AuthenticatedStaff, Locale } from '@freshness/types';
import { ApiClientError, fetchBookingDetail, isSessionError } from '../lib/api';
import { BookingActions } from '../components/BookingActions';
import { StatusChip } from '../components/StatusChip';
import { TeamSection } from '../components/TeamSection';
import { formatCents, formatDateTime } from '../lib/format';

interface BookingDetailProps {
  bookingId: string;
  staff: AuthenticatedStaff;
  locale: Locale;
  onBack: () => void;
  onSessionLost: () => void;
}

export function BookingDetailPage({
  bookingId,
  staff,
  locale,
  onBack,
  onSessionLost,
}: BookingDetailProps) {
  const { t } = useTranslation();
  const [booking, setBooking] = useState<AdminBookingDetail | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;

    fetchBookingDetail(bookingId)
      .then((detalle) => {
        if (vigente) setBooking(detalle);
      })
      .catch((error: unknown) => {
        if (!vigente) return;
        if (isSessionError(error)) {
          onSessionLost();
          return;
        }
        setErrorKey(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
      });

    return () => {
      vigente = false;
    };
  }, [bookingId, onSessionLost]);

  if (errorKey) {
    return (
      <div className="space-y-4">
        <button type="button" className="ft-btn-ghost" onClick={onBack}>
          {t('admin.back')}
        </button>
        <p className="text-sm font-medium text-red-700 dark:text-red-400" role="alert">
          {t(errorKey)}
        </p>
      </div>
    );
  }

  if (!booking) {
    return <p className="text-sm text-slate-600 dark:text-slate-400">{t('common.loading')}</p>;
  }

  return (
    <div className="space-y-5">
      <button type="button" className="ft-btn-ghost" onClick={onBack}>
        {t('admin.back')}
      </button>

      <div className="ft-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-lg font-bold text-slate-900 dark:text-white">
              {booking.reference}
            </p>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
              {formatDateTime(booking.scheduledStart, booking.timezone, locale)} ·{' '}
              {t('admin.durationMinutes', { minutes: booking.durationMinutes })}
            </p>
          </div>
          <StatusChip status={booking.status} />
        </div>
      </div>

      {/* --------------------------- Cliente y acceso -------------------------- */}
      <section className="ft-card p-5">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('admin.customer')}</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Row
            label={t('admin.name')}
            value={`${booking.customer.firstName} ${booking.customer.lastName}`}
          />
          <Row
            label={t('admin.phone')}
            value={
              <a className="underline" href={`tel:${booking.customer.phone}`}>
                {booking.customer.phone}
              </a>
            }
          />
          <Row
            label={t('admin.email')}
            value={
              <a className="underline" href={`mailto:${booking.customer.email}`}>
                {booking.customer.email}
              </a>
            }
          />
          <Row
            label={t('admin.address')}
            value={[
              booking.address.line1,
              booking.address.line2,
              `${booking.address.city}, ${booking.address.state} ${booking.address.postalCode}`,
            ]
              .filter(Boolean)
              .join(', ')}
          />
        </dl>

        {booking.address.accessNotes && (
          /*
           * DATO SENSIBLE: códigos de puerta, dónde está la llave.
           * Se destaca visualmente para que quien tenga la pantalla a la vista
           * sepa que ahí hay algo que no debe quedarse abierto ni leerse en
           * alto delante de terceros.
           */
          <div className="mt-4 rounded-lg border border-sun-400 bg-sun-50 p-3 dark:border-sun-600 dark:bg-night-700">
            <p className="text-xs font-bold tracking-wide text-slate-800 uppercase dark:text-sun-200">
              {t('admin.accessNotes')}
            </p>
            <p className="mt-1 text-sm text-slate-900 dark:text-slate-100">
              {booking.address.accessNotes}
            </p>
            <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
              {t('admin.accessNotesWarning')}
            </p>
          </div>
        )}

        {booking.customerNotes && (
          <div className="mt-4">
            <p className="ft-label">{t('admin.customerNotes')}</p>
            <p className="text-sm text-slate-700 dark:text-slate-300">{booking.customerNotes}</p>
          </div>
        )}
      </section>

      {/*
        El equipo va JUSTO DESPUES del cliente y antes del precio: al abrir una
        reserva, lo operativo —a quien se limpia y quien va— se lee de una
        vez, y lo economico queda agrupado mas abajo con el pago.
      */}
      <TeamSection
        booking={booking}
        staff={staff}
        onUpdated={setBooking}
        onSessionLost={onSessionLost}
      />

      {/* -------------------------------- Precio ------------------------------- */}
      <section className="ft-card p-5">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('admin.pricing')}</h2>
        <dl className="mt-3 space-y-2 text-sm">
          {booking.lines.map((line) => (
            <Row
              key={line.code}
              label={t(line.labelKey, { ...(line.labelParams ?? {}) })}
              value={formatCents(line.amountCents, locale)}
            />
          ))}
          <div className="border-t border-slate-200 pt-2 dark:border-night-600">
            <Row label={t('admin.total')} value={formatCents(booking.totalCents, locale)} strong />
            <Row label={t('admin.deposit')} value={formatCents(booking.depositCents, locale)} />
            <Row
              label={t('admin.balanceDue')}
              value={formatCents(booking.balanceDueCents, locale)}
            />
          </div>
        </dl>
      </section>

      <BookingActions
        booking={booking}
        staff={staff}
        locale={locale}
        // La respuesta de cada accion trae la reserva ya actualizada, asi que
        // la pantalla se refresca sin una segunda peticion.
        onUpdated={setBooking}
        onSessionLost={onSessionLost}
      />

      {/* --------------------------------- Pago -------------------------------- */}
      <section className="ft-card p-5">
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('admin.payment')}</h2>

        {booking.payment ? (
          <dl className="mt-3 space-y-2 text-sm">
            <Row
              label={t('admin.paymentStatus')}
              value={t(`admin.paymentState.${booking.payment.status}`)}
            />
            <Row
              label={t('admin.held')}
              value={formatCents(booking.payment.amountAuthorizedCents, locale)}
            />
            {booking.payment.cardLast4 && (
              <Row
                label={t('admin.card')}
                value={`${booking.payment.cardBrand ?? ''} ···· ${booking.payment.cardLast4}`}
              />
            )}
            {booking.payment.expiresAt && (
              <Row
                label={t('admin.holdExpires')}
                value={formatDateTime(booking.payment.expiresAt, booking.timezone, locale)}
              />
            )}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t('admin.noPayment')}</p>
        )}
      </section>
    </div>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
      <dt className="text-slate-600 dark:text-slate-400">{label}</dt>
      <dd
        className={
          strong
            ? 'font-bold text-slate-900 dark:text-white'
            : 'font-medium text-slate-900 dark:text-slate-100'
        }
      >
        {value}
      </dd>
    </div>
  );
}
