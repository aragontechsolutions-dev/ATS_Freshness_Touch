import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  BookingRequestInput,
  BookingResponse,
  Locale,
  QuoteAddOnInput,
  QuoteResponse,
  ServiceType,
} from '@freshness/types';
import { ApiClientError, createBooking } from '../lib/api';
import {
  EMPTY_DETAILS,
  isValid,
  validateDetails,
  type BookingDetailsForm,
  type DetailsErrors,
} from '../lib/booking-validation';
import { addDays, formatCents, todayInTimezone } from '../lib/format';
import { CloseIcon } from './Icons';
import { DetailsStep } from './booking/DetailsStep';
import { ScheduleStep } from './booking/ScheduleStep';
import { PaymentStep, type PaymentOutcome } from './booking/PaymentStep';
import { DoneStep, type BookingOutcome } from './booking/DoneStep';

const TIMEZONE = 'America/New_York';

/** Trabajo ya definido en el cotizador; el dialogo no lo vuelve a preguntar. */
export interface BookingJob {
  service: ServiceType;
  frequency: BookingRequestInput['frequency'];
  bedrooms: number;
  bathrooms: number;
  squareFeet: number;
  addOns: QuoteAddOnInput[];
  postalCode: string;
}

interface BookingDialogProps {
  open: boolean;
  job: BookingJob;
  quote: QuoteResponse;
  locale: Locale;
  onClose: () => void;
}

type Phase = 'schedule' | 'details' | 'payment' | 'done';

const STEPS: Phase[] = ['schedule', 'details', 'payment'];

/**
 * FORMULARIO DE RESERVA
 * ---------------------
 * Tres pasos y una pantalla final. Se parte en pasos porque el formulario
 * completo tiene mas de quince campos: en un movil eso es una pared que la
 * gente no sube.
 *
 * Se usa <dialog> nativo y no un div a medida: el navegador ya trae atrapado
 * del foco, cierre con Escape e inercia del fondo. Reimplementarlo a mano
 * sale casi siempre mal para quien navega con teclado o lector de pantalla.
 *
 * El dialogo se puede cerrar en cualquier momento. Si se cierra con la reserva
 * ya creada y sin pagar, la franja se libera sola a los 30 minutos: es el
 * comportamiento para el que se diseno la retencion, no una fuga.
 */
export function BookingDialog({ open, job, quote, locale, onClose }: BookingDialogProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [phase, setPhase] = useState<Phase>('schedule');
  // Se empieza dos dias adelante: con 24 horas de antelacion minima, hoy y
  // casi todo manana estan descartados y abrir en un dia vacio desanima.
  const [date, setDate] = useState(() => addDays(todayInTimezone(TIMEZONE), 2));
  const [slot, setSlot] = useState<string | null>(null);
  const [details, setDetails] = useState<BookingDetailsForm>(() => ({
    ...EMPTY_DETAILS,
    postalCode: job.postalCode,
  }));
  const [errors, setErrors] = useState<DetailsErrors>({});
  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [outcome, setOutcome] = useState<BookingOutcome>('CONFIRMED');
  const [sending, setSending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const controllerRef = useRef<AbortController | null>(null);

  // --- Apertura y cierre del dialogo nativo --------------------------------
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Con el dialogo abierto no se desplaza el fondo: en movil resulta
  // desconcertante ver moverse la pagina detras.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const reiniciar = useCallback(() => {
    setPhase('schedule');
    setSlot(null);
    setBooking(null);
    setOutcome('CONFIRMED');
    setErrorKey(null);
  }, []);

  // --- Envio de la reserva --------------------------------------------------
  const enviar = useCallback(async (): Promise<void> => {
    if (!slot) return;

    const validacion = validateDetails(details);
    setErrors(validacion);
    if (!isValid(validacion)) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setSending(true);
    setErrorKey(null);

    try {
      /*
       * El cuerpo NO lleva ningun importe. Solo viajan las caracteristicas
       * del trabajo: el precio y el deposito los recalcula el servidor con la
       * direccion completa, y pueden diferir de la estimacion.
       */
      const created = await createBooking(
        {
          service: job.service,
          frequency: job.frequency,
          bedrooms: job.bedrooms,
          bathrooms: job.bathrooms,
          squareFeet: job.squareFeet,
          addOns: job.addOns,
          startsAt: slot,
          contact: {
            firstName: details.firstName.trim(),
            lastName: details.lastName.trim(),
            email: details.email.trim(),
            phone: details.phone.trim(),
            locale,
            marketingOptIn: details.marketingOptIn,
          },
          address: {
            line1: details.line1.trim(),
            ...(details.line2.trim() ? { line2: details.line2.trim() } : {}),
            city: details.city.trim(),
            state: details.state.trim(),
            postalCode: details.postalCode.trim(),
            ...(details.accessNotes.trim() ? { accessNotes: details.accessNotes.trim() } : {}),
          },
          ...(details.customerNotes.trim() ? { customerNotes: details.customerNotes.trim() } : {}),
        },
        controller.signal,
      );

      setBooking(created);

      if (created.payment === null) {
        // La reserva existe pero no se pudo iniciar la retencion: se dice tal
        // cual en vez de mostrar un pago que no va a funcionar.
        setOutcome('PENDING');
        setPhase('done');
        return;
      }

      setPhase('payment');
    } catch (error) {
      if (controller.signal.aborted) return;
      setErrorKey(error instanceof ApiClientError ? error.messageKey : 'booking.errorTitle');
      // Si la franja se acaba de ocupar, se vuelve al calendario: seguir en
      // este paso no deja al cliente ninguna salida.
      if (error instanceof ApiClientError && error.code === 'SLOT_UNAVAILABLE') {
        setSlot(null);
        setPhase('schedule');
      }
    } finally {
      if (!controller.signal.aborted) setSending(false);
    }
  }, [slot, details, job, locale]);

  const onPaymentResolved = useCallback((resultado: PaymentOutcome) => {
    setOutcome(resultado === 'AUTHORISED' ? 'CONFIRMED' : 'DECLINED');
    setPhase('done');
  }, []);

  const indice = STEPS.indexOf(phase);
  const puedeAvanzar = phase === 'schedule' ? slot !== null : true;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="booking-title"
      onClose={onClose}
      className="m-auto w-[calc(100vw-1.5rem)] max-w-2xl rounded-2xl bg-white p-0
                 backdrop:bg-ink/60 backdrop:backdrop-blur-sm dark:bg-night-800"
    >
      <div className="flex max-h-[85vh] flex-col">
        {/* ------------------------------ Cabecera ------------------------------ */}
        <div
          className="flex items-start justify-between gap-3 border-b border-slate-200 p-5
                     dark:border-night-600"
        >
          <div className="min-w-0">
            {/* La cabecera dice siempre lo mismo. El desenlace lo anuncia la
                pantalla final con su propio titulo: repetirlo aqui daba dos
                veces el mismo mensaje en la misma vista. */}
            <h2
              id="booking-title"
              className="text-lg font-bold text-brand-800 sm:text-xl dark:text-white"
            >
              {t('booking.title')}
            </h2>
            {phase !== 'done' && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {t('booking.stepOf', { current: indice + 1, total: STEPS.length })} ·{' '}
                {t(`booking.steps.${phase}`)}
              </p>
            )}
          </div>

          <button
            type="button"
            aria-label={t('booking.close')}
            onClick={() => dialogRef.current?.close()}
            className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors
                       hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400
                       dark:hover:bg-night-700 dark:hover:text-white"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Barra de progreso: en un formulario largo, saber cuanto queda
            reduce el abandono mas que cualquier otro detalle. */}
        {phase !== 'done' && (
          <div className="h-1 w-full bg-slate-200 dark:bg-night-700">
            <div
              className="h-full bg-sun-400 transition-[width] duration-300"
              style={{ width: `${((indice + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        )}

        {/* ------------------------------ Contenido ----------------------------- */}
        <div className="flex-1 overflow-y-auto p-5">
          {errorKey && phase !== 'done' && (
            <div
              className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-900
                         dark:bg-night-700"
              role="alert"
            >
              <p className="text-sm font-medium text-red-700 dark:text-red-400">{t(errorKey)}</p>
            </div>
          )}

          {phase === 'schedule' && (
            <ScheduleStep
              query={{
                service: job.service,
                bedrooms: job.bedrooms,
                bathrooms: job.bathrooms,
                squareFeet: job.squareFeet,
                addOns: job.addOns,
              }}
              date={date}
              slot={slot}
              locale={locale}
              onDateChange={setDate}
              onSlotChange={setSlot}
            />
          )}

          {phase === 'details' && (
            <DetailsStep form={details} errors={errors} onChange={setDetails} />
          )}

          {phase === 'payment' && booking && (
            <PaymentStep booking={booking} locale={locale} onResolved={onPaymentResolved} />
          )}

          {phase === 'done' && booking && (
            <DoneStep
              booking={booking}
              details={details}
              outcome={outcome}
              locale={locale}
              onClose={() => dialogRef.current?.close()}
              onRestart={reiniciar}
            />
          )}
        </div>

        {/* -------------------------------- Pie -------------------------------- */}
        {(phase === 'schedule' || phase === 'details') && (
          <div
            className="flex items-center justify-between gap-3 border-t border-slate-200 p-5
                       dark:border-night-600"
          >
            <div className="min-w-0">
              <button
                type="button"
                className="text-sm font-semibold text-slate-600 hover:text-slate-900
                           disabled:opacity-40 dark:text-slate-400 dark:hover:text-white"
                disabled={phase === 'schedule'}
                onClick={() => setPhase('schedule')}
              >
                {t('booking.back')}
              </button>
              {/* Recordar el precio estimado evita la sorpresa al llegar al
                  paso del deposito, que es donde mas gente abandona. */}
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {t('calculator.estimatedTotal')}:{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {formatCents(quote.totals.totalCents, locale)}
                </span>
              </p>
            </div>

            <button
              type="button"
              className="ft-btn-primary min-w-40"
              disabled={!puedeAvanzar || sending}
              onClick={() => {
                if (phase === 'schedule') setPhase('details');
                else void enviar();
              }}
            >
              {sending ? t('common.loading') : t('booking.next')}
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}
