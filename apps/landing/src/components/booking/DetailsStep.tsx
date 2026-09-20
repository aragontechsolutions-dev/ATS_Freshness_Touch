import { useTranslation } from 'react-i18next';
import {
  formatUsPhone,
  type BookingDetailsForm,
  type DetailsErrors,
} from '../../lib/booking-validation';

interface DetailsStepProps {
  form: BookingDetailsForm;
  errors: DetailsErrors;
  onChange: (form: BookingDetailsForm) => void;
}

/**
 * PASO 2: DONDE Y QUIEN
 *
 * Aqui SI se pide la direccion completa, a diferencia del cotizador, que solo
 * necesitaba el codigo postal. El cambio es deliberado: ahora hay una relacion
 * comercial y hace falta saber a donde ir.
 *
 * El codigo postal llega desde la cotizacion y se puede corregir, pero se
 * avisa de que cambiarlo altera el precio: la distancia, y con ella el
 * deposito, se recalculan en el servidor con la direccion completa.
 */
export function DetailsStep({ form, errors, onChange }: DetailsStepProps) {
  const { t } = useTranslation();

  const set = <K extends keyof BookingDetailsForm>(key: K, value: BookingDetailsForm[K]): void => {
    onChange({ ...form, [key]: value });
  };

  return (
    <div className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="text-sm font-bold text-slate-900 dark:text-white">
          {t('booking.details.contactTitle')}
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="firstName"
            label={t('booking.details.firstName')}
            autoComplete="given-name"
            value={form.firstName}
            error={errors.firstName}
            onChange={(value) => set('firstName', value)}
          />
          <Field
            id="lastName"
            label={t('booking.details.lastName')}
            autoComplete="family-name"
            value={form.lastName}
            error={errors.lastName}
            onChange={(value) => set('lastName', value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="email"
            type="email"
            label={t('booking.details.email')}
            autoComplete="email"
            inputMode="email"
            value={form.email}
            error={errors.email}
            onChange={(value) => set('email', value)}
          />
          <Field
            id="phone"
            type="tel"
            label={t('booking.details.phone')}
            autoComplete="tel"
            inputMode="tel"
            value={form.phone}
            error={errors.phone}
            // Se da forma mientras se escribe: asi el propio campo ensena
            // cuantos digitos faltan, en vez de avisar al enviar.
            onChange={(value) => set('phone', formatUsPhone(value))}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-bold text-slate-900 dark:text-white">
          {t('booking.details.addressTitle')}
        </legend>

        <Field
          id="line1"
          label={t('booking.details.line1')}
          autoComplete="address-line1"
          value={form.line1}
          error={errors.line1}
          onChange={(value) => set('line1', value)}
        />
        <Field
          id="line2"
          label={t('booking.details.line2')}
          autoComplete="address-line2"
          value={form.line2}
          onChange={(value) => set('line2', value)}
        />

        <div className="grid gap-4 sm:grid-cols-[1fr_5rem_7rem]">
          <Field
            id="city"
            label={t('booking.details.city')}
            autoComplete="address-level2"
            value={form.city}
            error={errors.city}
            onChange={(value) => set('city', value)}
          />
          <Field
            id="state"
            label={t('booking.details.state')}
            autoComplete="address-level1"
            maxLength={2}
            value={form.state}
            error={errors.state}
            onChange={(value) => set('state', value.toUpperCase().replace(/[^A-Z]/g, ''))}
          />
          <Field
            id="postalCode"
            label={t('booking.details.postalCode')}
            autoComplete="postal-code"
            inputMode="numeric"
            maxLength={5}
            value={form.postalCode}
            error={errors.postalCode}
            help={t('booking.details.postalCodeLocked')}
            onChange={(value) => set('postalCode', value.replace(/\D/g, '').slice(0, 5))}
          />
        </div>
      </fieldset>

      <div>
        <label className="ft-label" htmlFor="accessNotes">
          {t('booking.details.accessNotes')}
        </label>
        <textarea
          id="accessNotes"
          className="ft-input min-h-20"
          maxLength={500}
          value={form.accessNotes}
          aria-describedby="accessNotes-help"
          onChange={(event) => set('accessNotes', event.target.value)}
        />
        <p id="accessNotes-help" className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {t('booking.details.accessNotesHelp')}
        </p>
      </div>

      <div>
        <label className="ft-label" htmlFor="customerNotes">
          {t('booking.details.customerNotes')}
        </label>
        <textarea
          id="customerNotes"
          className="ft-input min-h-20"
          maxLength={1000}
          value={form.customerNotes}
          onChange={(event) => set('customerNotes', event.target.value)}
        />
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-slate-400 text-brand-700 focus:ring-brand-600
                     dark:border-night-600"
          checked={form.marketingOptIn}
          onChange={(event) => set('marketingOptIn', event.target.checked)}
        />
        {t('booking.details.marketingOptIn')}
      </label>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {t('booking.details.priceNotice')}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'tel' | 'numeric';
  maxLength?: number;
  error?: string;
  help?: string;
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  inputMode,
  maxLength,
  error,
  help,
}: FieldProps) {
  const { t } = useTranslation();
  const describedBy = [error ? `${id}-error` : null, help ? `${id}-help` : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <label className="ft-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        className={`ft-input ${error ? 'border-red-500 dark:border-red-500' : ''}`}
        value={value}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        // El error se anuncia por el campo, no solo por el color: sin esto,
        // quien no distingue el rojo no sabe cual esta mal.
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">
          {t(error)}
        </p>
      )}
      {help && !error && (
        <p id={`${id}-help`} className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {help}
        </p>
      )}
    </div>
  );
}
