import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AddOnCode,
  Frequency,
  Locale,
  QuoteRequestInput,
  QuoteResponse,
  ServiceType,
} from '@freshness/types';
import { useBusinessContact } from '../hooks/useBusinessSettings';
import { useCatalog } from '../hooks/useCatalog';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useFlashOnChange } from '../hooks/useFlashOnChange';
import { ApiClientError, requestQuote } from '../lib/api';
import { formatCents, formatDate, formatMiles } from '../lib/format';
import { PhoneIcon } from '../components/Icons';
import { NumberField, clampNumber } from '../components/NumberField';
import type { BookingJob } from '../components/BookingDialog';

/*
 * El formulario de reserva (con el componente de pago de Stripe dentro) pesa
 * mas que toda la portada. La mayoria de las visitas no llegan a reservar, asi
 * que se descarga solo cuando alguien pulsa el boton: la pagina abre antes
 * para todo el mundo.
 */
const BookingDialog = lazy(() =>
  import('../components/BookingDialog').then((module) => ({ default: module.BookingDialog })),
);

/**
 * EL COTIZADOR SOLO PREGUNTA LO QUE CAMBIA EL PRECIO.
 *
 * Habitaciones y banos no estan, y no es un olvido: la estandar es plana y
 * la profunda y la de mudanza miran los pies cuadrados. Ninguna de las dos
 * los usa, asi que pedirlos alargaba el formulario que genera los ingresos
 * a cambio de nada.
 *
 * Donde SI se piden es en el dialogo de reserva, antes de elegir la hora:
 * alli deciden cuanto dura el trabajo, y con ello cuanto tiempo se bloquea
 * en la agenda.
 */
interface FormState {
  service: ServiceType;
  frequency: Frequency;
  squareFeet: number;
  postalCode: string;
  /** Cantidad por extra; 0 significa "no seleccionado". */
  addOns: Partial<Record<AddOnCode, number>>;
}

const INITIAL_FORM: FormState = {
  service: 'STANDARD',
  frequency: 'ONE_TIME',
  squareFeet: 1800,
  postalCode: '',
  addOns: {},
};

const POSTAL_CODE_PATTERN = /^\d{5}$/;

/** Extras seleccionados, en el formato que esperan la API y la reserva. */
function selectedAddOns(form: FormState): { code: AddOnCode; quantity: number }[] {
  return Object.entries(form.addOns)
    .filter(([, quantity]) => (quantity ?? 0) > 0)
    .map(([code, quantity]) => ({ code: code as AddOnCode, quantity: quantity as number }));
}

function toRequest(form: FormState, locale: Locale): QuoteRequestInput {
  return {
    service: form.service,
    frequency: form.frequency,
    squareFeet: form.squareFeet,
    addOns: selectedAddOns(form),
    destination: { postalCode: form.postalCode },
    locale,
  };
}

export function QuoteCalculator() {
  const { t, i18n } = useTranslation();
  const contacto = useBusinessContact();
  const locale = (i18n.resolvedLanguage ?? 'en') as Locale;
  const { catalog, failed: catalogFailed } = useCatalog();

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);

  /*
   * El trabajo que se envia a la reserva se congela al abrir el dialogo: si
   * el cliente toca el formulario con el dialogo abierto, la franja que ya
   * eligio podria dejar de encajar en la duracion y acabaria reservando algo
   * distinto de lo que vio.
   */
  const [bookingJob, setBookingJob] = useState<BookingJob | null>(null);
  const [bookingQuote, setBookingQuote] = useState<QuoteResponse | null>(null);

  const requestRef = useRef<AbortController | null>(null);
  // Solo se recalcula automaticamente si el usuario ya pidio un precio una vez.
  const hasQuoteRef = useRef(false);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  /**
   * Cambiar de servicio puede dejar elegida una cadencia que ese servicio no
   * ofrece —de estándar semanal a profunda semanal, por ejemplo—.
   *
   * SE VUELVE A LA PUNTUAL, que todos los servicios con precio automático
   * ofrecen por contrato. Sin esto, el cotizador contestaría «elige otra
   * frecuencia» a alguien que no ha tocado la frecuencia, y la salida
   * estaría en un botón que acaba de quedarse apagado.
   */
  const cambiarServicio = (code: ServiceType): void => {
    const servicio = catalog?.services.find((item) => item.code === code);
    const sigueValiendo = servicio ? servicio.rates[form.frequency] !== null : true;

    setForm((current) => ({
      ...current,
      service: code,
      frequency: sigueValiendo ? current.frequency : 'ONE_TIME',
    }));
  };

  const submit = useCallback(
    async (state: FormState): Promise<void> => {
      if (!POSTAL_CODE_PATTERN.test(state.postalCode)) {
        setErrorKey('calculator.errorPostalCode');
        return;
      }

      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;

      setLoading(true);
      setErrorKey(null);

      try {
        const result = await requestQuote(toRequest(state, locale), controller.signal);
        setQuote(result);
        hasQuoteRef.current = true;
      } catch (error) {
        if (controller.signal.aborted) return;
        setErrorKey(error instanceof ApiClientError ? error.messageKey : 'calculator.errorGeneric');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [locale],
  );

  // Recalculo automatico con retardo: evita una peticion por cada pulsacion.
  const debouncedForm = useDebouncedValue(form, 700);
  useEffect(() => {
    if (!hasQuoteRef.current) return;
    void submit(debouncedForm);
  }, [debouncedForm, submit]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const limits = catalog?.limits;

  /**
   * El importe plano del servicio elegido en esa cadencia, o `null` si no se
   * ofrece asi.
   *
   * Es EL IMPORTE PLANO y no el precio final: el final depende de los pies
   * cuadrados y aqui todavia no se han escrito. Ensenarlo como referencia
   * junto al boton es lo que permite comparar cadencias de un vistazo; la
   * cifra exacta la da el presupuesto de abajo.
   */
  const tarifaPlanaDe = (frecuencia: Frequency): number | null => {
    const servicio = catalog?.services.find((item) => item.code === form.service);
    return servicio?.rates[frecuencia]?.flatCents ?? null;
  };
  const showResult = quote !== null;

  /*
   * Los servicios sin cotizacion instantanea (el comercial) se agendan tras
   * una visita previa: ofrecer el boton de reservar llevaria a un error del
   * servidor en vez de a una cita.
   */
  const servicioAgendable = useMemo(
    () => catalog?.services.find((item) => item.code === form.service)?.instantQuote ?? false,
    [catalog, form.service],
  );

  const abrirReserva = (): void => {
    if (!quote) return;
    setBookingJob({
      service: form.service,
      frequency: form.frequency,
      squareFeet: form.squareFeet,
      addOns: selectedAddOns(form),
      postalCode: form.postalCode,
    });
    setBookingQuote(quote);
    setBookingOpen(true);
  };

  return (
    <section id="quote" className="bg-brand-50 py-12 sm:py-16 lg:py-20 dark:bg-night-800">
      <div className="ft-container">
        <h2
          className="ft-rule text-3xl font-bold tracking-tight text-brand-800
                       dark:text-white"
        >
          {t('calculator.title')}
        </h2>
        <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
          {t('calculator.subtitle')}
        </p>

        <div className="mt-10 grid gap-6 lg:grid-cols-5">
          {/* ---------------------------- Formulario ---------------------------- */}
          <form
            className="ft-card space-y-5 p-6 lg:col-span-3"
            onSubmit={(event) => {
              event.preventDefault();
              void submit(form);
            }}
          >
            <div>
              <label className="ft-label" htmlFor="service">
                {t('calculator.serviceLabel')}
              </label>
              <select
                id="service"
                className="ft-input"
                value={form.service}
                onChange={(event) => cambiarServicio(event.target.value as ServiceType)}
              >
                {(catalog?.services ?? []).map((service) => (
                  <option key={service.code} value={service.code}>
                    {t(`services.${service.code}.name`)}
                  </option>
                ))}
              </select>
            </div>

            <fieldset>
              <legend className="ft-label">{t('frequency.title')}</legend>
              <div className="flex flex-wrap gap-2">
                {(catalog?.frequencies ?? []).map((frequency) => {
                  const selected = form.frequency === frequency.code;
                  const tarifa = tarifaPlanaDe(frequency.code);
                  /*
                   * Una limpieza profunda no se contrata cada semana: la casa
                   * ya está profunda. El botón se apaga en vez de dejar
                   * pulsar y contestar con un aviso: enseñar la puerta
                   * cerrada es más honesto que dejar que se estrelle contra
                   * ella. Se sigue VIENDO, porque para la estándar sí existe
                   * y esconderlo haría que la lista cambiara de tamaño al
                   * cambiar de servicio.
                   */
                  const disponible = tarifa !== null;

                  return (
                    <button
                      key={frequency.code}
                      type="button"
                      onClick={() => update('frequency', frequency.code)}
                      aria-pressed={selected}
                      disabled={!disponible}
                      title={disponible ? undefined : t('frequency.notOffered')}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        !disponible
                          ? 'cursor-not-allowed border-slate-200 text-slate-400 dark:border-night-700 dark:text-slate-600'
                          : selected
                            ? 'border-brand-700 bg-brand-700 text-white'
                            : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-night-600 dark:text-slate-300 dark:hover:bg-night-700'
                      }`}
                    >
                      {t(`frequency.${frequency.code}`)}
                      {/*
                        SE ENSENA EL PRECIO, NO UN PORCENTAJE.
                        La recurrencia dejo de ser un descuento sobre el
                        precio puntual y paso a ser su propia tarifa, asi que
                        lo honesto es decir lo que cuesta —«$120»— en vez de
                        un «-35%» que obliga a hacer la cuenta para saber lo
                        que se paga. Donde el servicio no se ofrece en esa
                        cadencia no hay cifra que ensenar.
                      */}
                      {tarifa !== null && (
                        <span
                          className={
                            selected
                              ? 'ml-1.5 text-brand-100'
                              : 'ml-1.5 text-brand-700 dark:text-brand-300'
                          }
                        >
                          {formatCents(tarifa, locale)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                id="squareFeet"
                label={t('calculator.squareFeetLabel')}
                value={form.squareFeet}
                min={limits?.squareFeet.min ?? 200}
                max={limits?.squareFeet.max ?? 20000}
                step={50}
                onChange={(value) => update('squareFeet', value)}
              />
            </div>

            <div>
              <label className="ft-label" htmlFor="postalCode">
                {t('calculator.postalCodeLabel')}
              </label>
              <input
                id="postalCode"
                className="ft-input sm:max-w-40"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={5}
                placeholder={t('calculator.postalCodePlaceholder')}
                value={form.postalCode}
                aria-describedby="postalCode-help"
                onChange={(event) =>
                  update('postalCode', event.target.value.replace(/\D/g, '').slice(0, 5))
                }
              />
              <p id="postalCode-help" className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                {t('calculator.postalCodeHelp')}
              </p>
            </div>

            <fieldset>
              <legend className="ft-label">{t('calculator.addOnsLabel')}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(catalog?.addOns ?? []).map((addOn) => {
                  const quantity = form.addOns[addOn.code] ?? 0;
                  const checked = quantity > 0;

                  return (
                    <div
                      key={addOn.code}
                      className="flex items-center justify-between gap-3 rounded-lg border
                                 border-slate-200 px-3 py-2 dark:border-night-600"
                    >
                      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-brand-700
                                     focus:ring-brand-600 dark:border-night-600"
                          checked={checked}
                          onChange={(event) =>
                            update('addOns', {
                              ...form.addOns,
                              [addOn.code]: event.target.checked ? 1 : 0,
                            })
                          }
                        />
                        {t(`addOns.${addOn.code}`)}
                      </label>

                      {checked && addOn.unit === 'PER_UNIT' && (
                        <input
                          type="number"
                          aria-label={`${t(`addOns.${addOn.code}`)} - ${t('calculator.quantityLabel')}`}
                          className="ft-input w-20 py-1 text-sm"
                          min={1}
                          max={addOn.maxQuantity}
                          value={quantity}
                          onChange={(event) =>
                            update('addOns', {
                              ...form.addOns,
                              [addOn.code]: clampNumber(
                                Number(event.target.value),
                                1,
                                addOn.maxQuantity,
                              ),
                            })
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </fieldset>

            <button type="submit" className="ft-btn-primary w-full" disabled={loading}>
              {loading
                ? t('common.loading')
                : showResult
                  ? t('calculator.recalculate')
                  : t('calculator.submit')}
            </button>

            {catalogFailed && (
              <p className="text-sm text-sun-700 dark:text-sun-300">
                {t('calculator.errorNetwork')}
              </p>
            )}
          </form>

          {/* ---------------------------- Resultado ---------------------------- */}
          <div className="lg:col-span-2" aria-live="polite" aria-busy={loading}>
            {errorKey && (
              <div className="ft-card border-red-300 p-6 dark:border-red-900" role="alert">
                <h3 className="font-semibold text-red-700 dark:text-red-400">
                  {t('calculator.errorTitle')}
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t(errorKey)}</p>
                {contacto.phoneHref && (
                  <a href={contacto.phoneHref} className="ft-btn-outline mt-4 w-full">
                    <PhoneIcon className="h-4 w-4" />
                    {contacto.phoneDisplay}
                  </a>
                )}
              </div>
            )}

            {!errorKey && !showResult && !loading && (
              <div className="ft-card p-6 text-sm text-slate-600 dark:text-slate-400">
                {t('calculator.subtitle')}
              </div>
            )}

            {/*
              Mientras se calcula el primer precio se muestra la FORMA del
              resultado. Un texto de "cargando" deja la columna vacia y el
              salto posterior resulta brusco; asi el usuario ya sabe que va
              a aparecer y donde.
            */}
            {!errorKey && !showResult && loading && (
              <div className="ft-card space-y-4 p-6" aria-hidden="true">
                <div className="ft-skeleton h-3 w-24" />
                <div className="ft-skeleton h-9 w-40" />
                <div className="ft-skeleton h-3 w-52" />
                <div className="space-y-2 pt-4">
                  <div className="ft-skeleton h-3 w-full" />
                  <div className="ft-skeleton h-3 w-5/6" />
                  <div className="ft-skeleton h-3 w-4/6" />
                </div>
              </div>
            )}

            {!errorKey && quote && (
              <QuoteResult
                quote={quote}
                locale={locale}
                canBook={servicioAgendable}
                onBook={abrirReserva}
              />
            )}
          </div>
        </div>
      </div>

      {bookingJob && bookingQuote && (
        <Suspense fallback={null}>
          <BookingDialog
            open={bookingOpen}
            job={bookingJob}
            quote={bookingQuote}
            locale={locale}
            onClose={() => setBookingOpen(false)}
          />
        </Suspense>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */

interface QuoteResultProps {
  quote: QuoteResponse;
  locale: Locale;
  /** false para los servicios que requieren visita previa. */
  canBook: boolean;
  onBook: () => void;
}

function QuoteResult({ quote, locale, canBook, onBook }: QuoteResultProps) {
  const { t } = useTranslation();
  const contacto = useBusinessContact();
  // Sin esta senal, al cambiar el formulario el total se actualiza en
  // silencio y no queda claro si ya refleja lo que se acaba de tocar.
  const destello = useFlashOnChange(quote.totals.totalCents);

  if (quote.manualReview.required && quote.totals.totalCents === 0) {
    return (
      <div className="ft-card p-6">
        <h3 className="font-semibold text-slate-900 dark:text-white">
          {t('calculator.manualReviewTitle')}
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
          {quote.manualReview.reasonKeys.map((key) => (
            <li key={key}>{t(key)}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          {t('calculator.manualReviewBody')}
        </p>
        <a href={contacto.phoneHref ?? '#contact'} className="ft-btn-secondary mt-4 w-full">
          {t('calculator.requestCallback')}
        </a>
      </div>
    );
  }

  return (
    <div className="ft-enter ft-card divide-y divide-slate-200 dark:divide-night-600">
      <div className="p-6">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          {t('calculator.estimatedTotal')}
        </p>
        <p
          className={`mt-1 inline-block rounded-lg text-4xl font-extrabold tracking-tight
                      text-slate-900 dark:text-white ${destello}`}
        >
          {formatCents(quote.totals.totalCents, locale)}
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {t('calculator.distanceSummary', {
            miles: formatMiles(quote.distance.miles, locale),
            zone: quote.distance.zone,
          })}
        </p>
      </div>

      <div className="space-y-2 p-6 text-sm">
        <p className="font-semibold text-slate-900 dark:text-white">{t('calculator.breakdown')}</p>
        {quote.lines.map((line) => (
          <div key={line.code} className="flex items-start justify-between gap-3">
            <span className="text-slate-600 dark:text-slate-400">
              {t(line.labelKey, { ...line.labelParams })}
            </span>
            <span
              className={`shrink-0 font-medium ${
                line.amountCents < 0
                  ? 'text-brand-700 dark:text-brand-300'
                  : 'text-slate-900 dark:text-white'
              }`}
            >
              {formatCents(line.amountCents, locale)}
            </span>
          </div>
        ))}
        <p className="pt-2 text-xs text-slate-500 dark:text-slate-400">{t('calculator.noTax')}</p>
      </div>

      <div className="space-y-2 p-6 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-600 dark:text-slate-400">
            {t('calculator.travelDeposit')}
          </span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {formatCents(quote.deposit.amountCents, locale)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-600 dark:text-slate-400">{t('calculator.dueAtService')}</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {formatCents(quote.balanceDueAtServiceCents, locale)}
          </span>
        </div>
      </div>

      <div className="space-y-2 p-6">
        {quote.manualReview.reasonKeys.map((key) => (
          <p key={key} className="text-xs text-sun-700 dark:text-sun-300">
            {t(key)}
          </p>
        ))}
        {quote.disclaimerKeys.map((key) => (
          <p key={key} className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {t(key)}
          </p>
        ))}
        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
          {t('calculator.validUntil', { date: formatDate(quote.expiresAt, locale) })}
        </p>
      </div>

      {canBook && (
        <div className="p-6">
          <button type="button" className="ft-btn-primary w-full" onClick={onBook}>
            {t('booking.cta')}
          </button>
        </div>
      )}
    </div>
  );
}
