import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Locale, PrivacyCustomer, PrivacyErasureResult } from '@freshness/types';
import {
  ApiClientError,
  correctPrivacyCustomer,
  erasePrivacyCustomer,
  exportPrivacyCustomer,
  isSessionError,
  searchPrivacyCustomer,
} from '../lib/api';
import { useToast } from '../components/ToastProvider';
import { AlertIcon, SearchIcon } from '../components/Icons';
import { formatTimestamp } from '../lib/format';

interface PrivacidadProps {
  locale: Locale;
  onSessionLost: () => void;
}

/**
 * LOS DERECHOS DE PRIVACIDAD
 * ==========================
 * La pantalla desde la que se atiende a alguien que escribe «quiero una copia
 * de mis datos» o «borradme». La politica promete responder en 30 dias y
 * hasta esta etapa no habia con que.
 *
 * ========================================================================
 * SE BUSCA POR CORREO Y SOLO POR CORREO
 * ========================================================================
 * Una peticion de privacidad llega desde una direccion, y es lo unico que
 * identifica sin ambiguedad. Buscar por nombre convertiria esta pantalla en
 * un listado de clientes con un boton de borrar al lado, que es exactamente
 * lo que no debe ser. El servidor exige coincidencia exacta.
 *
 * ========================================================================
 * LAS TRES ACCIONES NO PESAN LO MISMO, Y SE NOTA
 * ========================================================================
 * Descargar y corregir se deshacen. Borrar no. Por eso el borrado vive en un
 * recuadro rojo, al final, y pide escribir el correo a mano: un «¿seguro?»
 * se pulsa dos veces seguidas sin leer, y copiar el correo obliga a mirar A
 * QUIEN se esta borrando.
 */
export function Privacidad({ locale, onSessionLost }: PrivacidadProps) {
  const { t } = useTranslation();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [buscado, setBuscado] = useState(false);
  const [cliente, setCliente] = useState<PrivacyCustomer | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [resultado, setResultado] = useState<PrivacyErasureResult | null>(null);

  const fallo = (error: unknown): void => {
    if (isSessionError(error)) {
      onSessionLost();
      return;
    }
    setErrorKey(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
  };

  const buscar = async (evento: React.FormEvent): Promise<void> => {
    evento.preventDefault();
    setBuscando(true);
    setErrorKey(null);
    setResultado(null);

    try {
      const encontrado = await searchPrivacyCustomer(email);
      setCliente(encontrado.customers[0] ?? null);
      setBuscado(true);
    } catch (error) {
      fallo(error);
    } finally {
      setBuscando(false);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('admin.privacy.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t('admin.privacy.subtitle')}
        </p>
      </div>

      <form className="ft-card flex flex-wrap items-end gap-3 p-4" onSubmit={(e) => void buscar(e)}>
        <div className="min-w-60 flex-1">
          <label className="ft-label" htmlFor="priv-email">
            {t('admin.privacy.email')}
          </label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="priv-email"
              type="email"
              required
              className="ft-input pl-10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby="priv-email-ayuda"
            />
          </div>
          {/* Exacto: con una busqueda parcial esta pantalla saca media cartera. */}
          <p id="priv-email-ayuda" className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('admin.privacy.emailHelp')}
          </p>
        </div>

        <button type="submit" className="ft-btn-primary" disabled={buscando}>
          {buscando ? t('admin.privacy.searching') : t('admin.privacy.search')}
        </button>
      </form>

      {errorKey !== null && (
        <p
          className="ft-card flex items-start gap-2 p-4 text-sm text-red-700 dark:text-red-300"
          role="alert"
        >
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t(errorKey)}
        </p>
      )}

      {buscado && cliente === null && errorKey === null && (
        <p className="ft-card p-4 text-sm text-slate-600 dark:text-slate-400">
          {t('admin.privacy.notFound')}
        </p>
      )}

      {resultado !== null && (
        <div className="ft-card border-l-4 border-green-600 p-4">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {t('admin.privacy.erased')}
          </p>
          {/*
            SE DICE QUE SE TOCO Y QUE SE QUEDA. La politica promete contarle a
            la persona que se conservo y por que, asi que quien la atiende
            tiene que poder leerlo aqui y copiarlo en su respuesta.
          */}
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
            {t('admin.privacy.erasedDetail', {
              bookings: resultado.bookings,
              addresses: resultado.addresses,
              consents: resultado.mediaConsents,
              revoked: resultado.mediaRevoked,
            })}
          </p>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
            {t('admin.privacy.erasedKept')}
          </p>
        </div>
      )}

      {cliente !== null && (
        <FichaDePrivacidad
          cliente={cliente}
          locale={locale}
          onError={fallo}
          onCorregido={(actualizado) => {
            setCliente(actualizado);
            toast.success('admin.privacy.corrected');
          }}
          onBorrado={(salida) => {
            setCliente(null);
            setBuscado(false);
            setResultado(salida);
          }}
        />
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */

interface FichaProps {
  cliente: PrivacyCustomer;
  locale: Locale;
  onError: (error: unknown) => void;
  onCorregido: (cliente: PrivacyCustomer) => void;
  onBorrado: (resultado: PrivacyErasureResult) => void;
}

function FichaDePrivacidad({ cliente, locale, onError, onCorregido, onBorrado }: FichaProps) {
  const { t } = useTranslation();

  const [firstName, setFirstName] = useState(cliente.firstName);
  const [lastName, setLastName] = useState(cliente.lastName);
  const [email, setEmail] = useState(cliente.email);
  const [phone, setPhone] = useState(cliente.phone);
  const [marketingOptIn, setMarketing] = useState(cliente.marketingOptIn);
  const [motivo, setMotivo] = useState('');

  const [confirmacion, setConfirmacion] = useState('');
  const [motivoBorrado, setMotivoBorrado] = useState('');
  const [trabajando, setTrabajando] = useState(false);

  const descargar = async (): Promise<void> => {
    setTrabajando(true);
    try {
      const copia = await exportPrivacyCustomer(cliente.customerId);

      /*
       * SE DESCARGA, NO SE PINTA. Un expediente completo en pantalla se queda
       * abierto encima de una mesa; un archivo se adjunta a la respuesta y se
       * cierra. Y asi es ademas lo que se le manda a la persona.
       */
      const enlace = document.createElement('a');
      enlace.href = URL.createObjectURL(
        new Blob([JSON.stringify(copia, null, 2)], { type: 'application/json' }),
      );
      enlace.download = `datos-${cliente.email}.json`;
      enlace.click();
      URL.revokeObjectURL(enlace.href);
    } catch (error) {
      onError(error);
    } finally {
      setTrabajando(false);
    }
  };

  const corregir = async (evento: React.FormEvent): Promise<void> => {
    evento.preventDefault();
    setTrabajando(true);
    try {
      await correctPrivacyCustomer(cliente.customerId, {
        firstName,
        lastName,
        email,
        phone,
        marketingOptIn,
        reason: motivo.trim(),
      });
      onCorregido({ ...cliente, firstName, lastName, email, phone, marketingOptIn });
      setMotivo('');
    } catch (error) {
      onError(error);
    } finally {
      setTrabajando(false);
    }
  };

  const borrar = async (evento: React.FormEvent): Promise<void> => {
    evento.preventDefault();
    setTrabajando(true);
    try {
      onBorrado(
        await erasePrivacyCustomer(cliente.customerId, {
          confirmEmail: confirmacion.trim().toLowerCase(),
          reason: motivoBorrado.trim(),
        }),
      );
    } catch (error) {
      onError(error);
    } finally {
      setTrabajando(false);
    }
  };

  const puedeBorrar =
    confirmacion.trim().toLowerCase() === cliente.email.toLowerCase() &&
    motivoBorrado.trim().length >= 3;

  return (
    <div className="space-y-4">
      <div className="ft-card p-4">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {cliente.firstName} {cliente.lastName}
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">{cliente.email}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {t('admin.privacy.since', {
            date: formatTimestamp(cliente.createdAt, locale),
            count: cliente.bookingCount,
          })}
        </p>

        {cliente.anonymized && (
          <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300">
            {t('admin.privacy.alreadyErased')}
          </p>
        )}

        <button
          type="button"
          className="ft-btn-ghost mt-3"
          disabled={trabajando}
          onClick={() => void descargar()}
        >
          {t('admin.privacy.download')}
        </button>
      </div>

      {/* ----------------------------- Corregir ----------------------------- */}
      <form className="ft-card space-y-3 p-4" onSubmit={(e) => void corregir(e)}>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">
          {t('admin.privacy.correctTitle')}
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="ft-label" htmlFor="priv-first">
              {t('admin.newBooking.firstName')}
            </label>
            <input
              id="priv-first"
              required
              className="ft-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div>
            <label className="ft-label" htmlFor="priv-last">
              {t('admin.newBooking.lastName')}
            </label>
            <input
              id="priv-last"
              required
              className="ft-input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <div>
            <label className="ft-label" htmlFor="priv-mail">
              {t('admin.newBooking.email')}
            </label>
            <input
              id="priv-mail"
              type="email"
              required
              className="ft-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="ft-label" htmlFor="priv-phone">
              {t('admin.newBooking.phone')}
            </label>
            <input
              id="priv-phone"
              required
              className="ft-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={marketingOptIn}
            onChange={(e) => setMarketing(e.target.checked)}
          />
          {t('admin.privacy.marketing')}
        </label>

        <div>
          <label className="ft-label" htmlFor="priv-reason">
            {t('admin.privacy.reason')}
          </label>
          <input
            id="priv-reason"
            className="ft-input"
            maxLength={300}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="ft-btn-primary"
          disabled={trabajando || motivo.trim().length < 3}
        >
          {t('admin.privacy.correct')}
        </button>
      </form>

      {/* ------------------------------ Borrar ------------------------------ */}
      {/*
        EN ROJO, AL FINAL Y CON EL CORREO A MANO. Es lo unico de esta pantalla
        que no se deshace: no se puede reconstruir un nombre que ya no esta.
      */}
      <form
        className="ft-card space-y-3 border-l-4 border-red-600 p-4"
        onSubmit={(e) => void borrar(e)}
      >
        <h2 className="text-sm font-bold text-red-800 dark:text-red-300">
          {t('admin.privacy.eraseTitle')}
        </h2>
        <p className="text-sm text-slate-700 dark:text-slate-300">{t('admin.privacy.eraseWhat')}</p>
        <p className="text-xs text-slate-600 dark:text-slate-400">{t('admin.privacy.eraseKept')}</p>

        <div>
          <label className="ft-label" htmlFor="priv-confirm">
            {t('admin.privacy.confirmEmail')}
          </label>
          <input
            id="priv-confirm"
            className="ft-input"
            autoComplete="off"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
          />
        </div>

        <div>
          <label className="ft-label" htmlFor="priv-erase-reason">
            {t('admin.privacy.reason')}
          </label>
          <input
            id="priv-erase-reason"
            className="ft-input"
            maxLength={300}
            value={motivoBorrado}
            onChange={(e) => setMotivoBorrado(e.target.value)}
          />
        </div>

        <button
          type="submit"
          className="ft-btn-primary bg-red-700 hover:bg-red-800"
          disabled={trabajando || !puedeBorrar}
        >
          {t('admin.privacy.erase')}
        </button>
      </form>
    </div>
  );
}
