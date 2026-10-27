import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AddOnCodeSchema,
  API_ERROR_CODES,
  FrequencySchema,
  ServiceTypeSchema,
  type AddOnCode,
  type AdminBookingRequestInput,
  type AuthenticatedStaff,
  type Frequency,
  type ServiceType,
} from '@freshness/types';
import { ApiClientError, createAdminBooking, isSessionError, sessionLostReason } from '../lib/api';
import { AlertIcon } from './Icons';

interface NuevaReservaProps {
  staff: AuthenticatedStaff;
  onCreada: (bookingId: string) => void;
  onCerrar: () => void;
  onSessionLost: (reason?: 'expired' | 'noAccess') => void;
}

const SERVICIOS = ServiceTypeSchema.options;
const FRECUENCIAS = FrequencySchema.options;
const EXTRAS = AddOnCodeSchema.options;

/**
 * METER UNA RESERVA A MANO
 * ========================
 * Para la clienta de siempre que llama y dice «el martes a las nueve, como
 * siempre». Hasta ahora esos trabajos vivian en la cabeza de la duena y en su
 * telefono, y el sistema no se enteraba.
 *
 * ========================================================================
 * NO ES UNA NOTA EN LA AGENDA
 * ========================================================================
 * Crea una reserva de verdad: con su precio, su equipo asignable, su lista de
 * tareas, su fichaje y su factura. Y sobre todo OCUPA LA FRANJA, que es lo
 * que hasta ahora no pasaba y hacia que el cotizador publico pudiera vender
 * por segunda vez un martes ya comprometido.
 *
 * ========================================================================
 * EL CHOQUE AVISA, NO PROHIBE
 * ========================================================================
 * Si la franja ya esta llena, el primer intento falla y aparece la casilla
 * para insistir. Nunca se solapa sin que alguien lo haya visto, y nunca se
 * impide a quien sabe que ese dia hay un equipo mas.
 */
export function NuevaReserva({ staff, onCreada, onCerrar, onSessionLost }: NuevaReservaProps) {
  const { t } = useTranslation();

  const [service, setService] = useState<ServiceType>('STANDARD');
  const [frequency, setFrequency] = useState<Frequency>('ONE_TIME');
  const [bedrooms, setBedrooms] = useState('3');
  const [bathrooms, setBathrooms] = useState('2');
  const [squareFeet, setSquareFeet] = useState('1500');
  const [extras, setExtras] = useState<Record<string, number>>({});

  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('09:00');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [accessNotes, setAccessNotes] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  const [allowOutsideHours, setAllowOutsideHours] = useState(false);
  const [allowOverlap, setAllowOverlap] = useState(false);
  const [notifyCustomer, setNotifyCustomer] = useState(true);
  const [precio, setPrecio] = useState('');
  const [reason, setReason] = useState('');

  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [choque, setChoque] = useState(false);
  const [guardando, setGuardando] = useState(false);

  /* Solo administracion decide lo que se cobra. La API lo vuelve a comprobar. */
  const puedePactarPrecio = staff.role === 'ADMIN';

  const precioPactadoCents = (() => {
    const limpio = precio.trim();
    if (limpio === '') return null;
    const dolares = Number(limpio.replace(',', '.'));
    return Number.isFinite(dolares) && dolares >= 0 ? Math.round(dolares * 100) : null;
  })();

  const seSalta = allowOutsideHours || allowOverlap || precioPactadoCents !== null;
  const faltaMotivo = seSalta && reason.trim().length < 3;

  const alternarExtra = (code: AddOnCode): void => {
    setExtras((previos) => {
      const copia = { ...previos };
      if (code in copia) delete copia[code];
      else copia[code] = 1;
      return copia;
    });
  };

  const enviar = async (evento: React.FormEvent): Promise<void> => {
    evento.preventDefault();
    if (faltaMotivo || guardando) return;

    setGuardando(true);
    setErrorKey(null);

    /*
     * LA HORA SE CONSTRUYE EN LA ZONA DEL NAVEGADOR y se manda en UTC. Es
     * correcto porque quien usa el panel esta en Georgia, igual que el
     * negocio; si algun dia se gestiona desde otro huso, aqui hay que elegir
     * la zona a mano en vez de suponerla.
     */
    const peticion: AdminBookingRequestInput = {
      booking: {
        service,
        frequency,
        bedrooms: Number(bedrooms),
        bathrooms: Number(bathrooms),
        squareFeet: Number(squareFeet),
        addOns: Object.entries(extras).map(([code, quantity]) => ({
          code: code as AddOnCode,
          quantity,
        })),
        startsAt: new Date(`${fecha}T${hora}`).toISOString(),
        contact: { firstName, lastName, email, phone },
        address: { line1, city, postalCode, ...(accessNotes ? { accessNotes } : {}) },
        ...(customerNotes ? { customerNotes } : {}),
      },
      overrides: {
        source: 'PHONE',
        allowOutsideHours,
        allowOverlap,
        priceOverrideCents: precioPactadoCents,
        notifyCustomer,
        reason: reason.trim(),
      },
    };

    try {
      const creada = await createAdminBooking(peticion);
      onCreada(creada.bookingId);
    } catch (error) {
      if (isSessionError(error)) {
        onSessionLost(sessionLostReason(error));
        return;
      }

      /*
       * EL CHOQUE DE FRANJA NO ES UN ERROR CUALQUIERA: es la respuesta que
       * convierte este formulario en una pregunta. Se ensena la casilla para
       * insistir en vez de dejar a alguien releyendo el mensaje sin salida.
       */
      if (error instanceof ApiClientError && error.code === API_ERROR_CODES.SLOT_UNAVAILABLE) {
        setChoque(true);
      }

      setErrorKey(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form className="ft-card space-y-5 p-5" onSubmit={(evento) => void enviar(evento)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            {t('admin.newBooking.title')}
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {t('admin.newBooking.subtitle')}
          </p>
        </div>
        <button type="button" className="ft-btn-ghost" onClick={onCerrar}>
          {t('admin.newBooking.close')}
        </button>
      </div>

      {/* ----------------------------- El trabajo ---------------------------- */}
      <fieldset className="space-y-3">
        <legend className="ft-label">{t('admin.newBooking.jobTitle')}</legend>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="ft-label" htmlFor="nb-service">
              {t('admin.newBooking.service')}
            </label>
            <select
              id="nb-service"
              className="ft-input"
              value={service}
              onChange={(e) => setService(e.target.value as ServiceType)}
            >
              {SERVICIOS.map((codigo) => (
                <option key={codigo} value={codigo}>
                  {t(`quote.line.service.${codigo}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="ft-label" htmlFor="nb-frequency">
              {t('admin.newBooking.frequency')}
            </label>
            <select
              id="nb-frequency"
              className="ft-input"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as Frequency)}
            >
              {FRECUENCIAS.map((codigo) => (
                <option key={codigo} value={codigo}>
                  {t(`admin.newBooking.frequencyOption.${codigo}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="ft-label" htmlFor="nb-bedrooms">
              {t('admin.newBooking.bedrooms')}
            </label>
            <input
              id="nb-bedrooms"
              type="number"
              min={0}
              max={12}
              required
              className="ft-input"
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
            />
          </div>
          <div>
            <label className="ft-label" htmlFor="nb-bathrooms">
              {t('admin.newBooking.bathrooms')}
            </label>
            <input
              id="nb-bathrooms"
              type="number"
              min={0}
              max={12}
              required
              className="ft-input"
              value={bathrooms}
              onChange={(e) => setBathrooms(e.target.value)}
            />
          </div>
          <div>
            <label className="ft-label" htmlFor="nb-sqft">
              {t('admin.newBooking.squareFeet')}
            </label>
            <input
              id="nb-sqft"
              type="number"
              min={200}
              max={20000}
              required
              className="ft-input"
              value={squareFeet}
              onChange={(e) => setSquareFeet(e.target.value)}
            />
          </div>
        </div>

        <div>
          <span className="ft-label">{t('admin.newBooking.addOns')}</span>
          <div className="mt-1 flex flex-wrap gap-2">
            {EXTRAS.map((codigo) => {
              const puesto = codigo in extras;
              return (
                <button
                  key={codigo}
                  type="button"
                  aria-pressed={puesto}
                  onClick={() => {
                    alternarExtra(codigo);
                  }}
                  className={
                    puesto
                      ? 'rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white'
                      : 'rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 dark:border-night-600 dark:text-slate-300'
                  }
                >
                  {t(`quote.line.addOn.${codigo}`, { quantity: extras[codigo] ?? 1 })}
                </button>
              );
            })}
          </div>
        </div>
      </fieldset>

      {/* ------------------------------ La cita ------------------------------ */}
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="ft-label">{t('admin.newBooking.whenTitle')}</legend>
        <div>
          <label className="ft-label" htmlFor="nb-date">
            {t('admin.newBooking.date')}
          </label>
          <input
            id="nb-date"
            type="date"
            required
            className="ft-input"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </div>
        <div>
          <label className="ft-label" htmlFor="nb-time">
            {t('admin.newBooking.time')}
          </label>
          <input
            id="nb-time"
            type="time"
            required
            className="ft-input"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
          />
        </div>
      </fieldset>

      {/* ----------------------------- La clienta ---------------------------- */}
      <fieldset className="space-y-3">
        <legend className="ft-label">{t('admin.newBooking.customerTitle')}</legend>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="ft-label" htmlFor="nb-first">
              {t('admin.newBooking.firstName')}
            </label>
            <input
              id="nb-first"
              required
              maxLength={80}
              className="ft-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <label className="ft-label" htmlFor="nb-last">
              {t('admin.newBooking.lastName')}
            </label>
            <input
              id="nb-last"
              required
              maxLength={80}
              className="ft-input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="ft-label" htmlFor="nb-email">
              {t('admin.newBooking.email')}
            </label>
            <input
              id="nb-email"
              type="email"
              required
              className="ft-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby="nb-email-help"
            />
            {/*
              El correo IDENTIFICA a la clienta: si ya existe, se reutiliza su
              ficha en vez de duplicarla. Por eso es obligatorio aunque ella no
              lo use nunca — y por eso al lado esta la casilla de no escribirle.
            */}
            <p id="nb-email-help" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('admin.newBooking.emailHelp')}
            </p>
          </div>
          <div>
            <label className="ft-label" htmlFor="nb-phone">
              {t('admin.newBooking.phone')}
            </label>
            <input
              id="nb-phone"
              type="tel"
              required
              className="ft-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      {/* ---------------------------- La direccion --------------------------- */}
      <fieldset className="space-y-3">
        <legend className="ft-label">{t('admin.newBooking.addressTitle')}</legend>

        <div>
          <label className="ft-label" htmlFor="nb-line1">
            {t('admin.newBooking.line1')}
          </label>
          <input
            id="nb-line1"
            required
            maxLength={120}
            className="ft-input"
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="ft-label" htmlFor="nb-city">
              {t('admin.newBooking.city')}
            </label>
            <input
              id="nb-city"
              required
              maxLength={80}
              className="ft-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div>
            <label className="ft-label" htmlFor="nb-zip">
              {t('admin.newBooking.postalCode')}
            </label>
            <input
              id="nb-zip"
              required
              inputMode="numeric"
              pattern="\d{5}"
              className="ft-input"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="ft-label" htmlFor="nb-access">
            {t('admin.newBooking.accessNotes')}
          </label>
          <textarea
            id="nb-access"
            rows={2}
            maxLength={500}
            className="ft-input"
            value={accessNotes}
            onChange={(e) => setAccessNotes(e.target.value)}
          />
        </div>

        <div>
          <label className="ft-label" htmlFor="nb-notes">
            {t('admin.newBooking.customerNotes')}
          </label>
          <textarea
            id="nb-notes"
            rows={2}
            maxLength={1000}
            className="ft-input"
            value={customerNotes}
            onChange={(e) => setCustomerNotes(e.target.value)}
          />
        </div>
      </fieldset>

      {/* ------------------------------ Los saltos --------------------------- */}
      <fieldset className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700/60 dark:bg-amber-950/30">
        <legend className="px-1 text-xs font-bold text-amber-900 dark:text-amber-200">
          {t('admin.newBooking.overridesTitle')}
        </legend>

        <label className="flex items-start gap-2 text-sm text-slate-800 dark:text-slate-200">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={allowOutsideHours}
            onChange={(e) => setAllowOutsideHours(e.target.checked)}
          />
          {t('admin.newBooking.allowOutsideHours')}
        </label>

        {/*
          Solo aparece DESPUES de chocar. Ofrecerla desde el principio seria
          invitar a marcarla «por si acaso», y entonces el aviso deja de avisar.
        */}
        {choque && (
          <label className="flex items-start gap-2 text-sm text-slate-800 dark:text-slate-200">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={allowOverlap}
              onChange={(e) => setAllowOverlap(e.target.checked)}
            />
            {t('admin.newBooking.allowOverlap')}
          </label>
        )}

        <label className="flex items-start gap-2 text-sm text-slate-800 dark:text-slate-200">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={notifyCustomer}
            onChange={(e) => setNotifyCustomer(e.target.checked)}
          />
          {t('admin.newBooking.notifyCustomer')}
        </label>

        {puedePactarPrecio && (
          <div>
            <label className="ft-label" htmlFor="nb-price">
              {t('admin.newBooking.agreedPrice')}
            </label>
            <input
              id="nb-price"
              inputMode="decimal"
              placeholder={t('admin.newBooking.agreedPricePlaceholder')}
              className="ft-input"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
            />
          </div>
        )}

        {seSalta && (
          <div>
            <label className="ft-label" htmlFor="nb-reason">
              {t('admin.newBooking.reason')}
            </label>
            <input
              id="nb-reason"
              className="ft-input"
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {faltaMotivo && (
              <p className="mt-1 text-xs font-medium text-amber-800 dark:text-amber-300">
                {t('admin.newBooking.reasonMissing')}
              </p>
            )}
          </div>
        )}
      </fieldset>

      {errorKey !== null && (
        <p
          className="flex items-start gap-2 text-sm font-medium text-red-700 dark:text-red-400"
          role="alert"
        >
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t(errorKey)}
        </p>
      )}

      <div className="flex justify-end">
        <button type="submit" className="ft-btn-primary" disabled={guardando || faltaMotivo}>
          {guardando ? t('admin.newBooking.saving') : t('admin.newBooking.submit')}
        </button>
      </div>
    </form>
  );
}
