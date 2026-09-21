import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationSettingsSchema,
  type NotificationSettings,
} from '@freshness/types';
import { ApiClientError, fetchNotificationSettings, saveNotificationSettings } from '../lib/api';

interface Props {
  onSessionLost: () => void;
}

/**
 * AJUSTES DE AVISOS
 * -----------------
 * Qué se avisa y a dónde.
 *
 * AQUÍ NO SE PIDE NINGUNA CREDENCIAL, y el formulario lo dice en voz alta. La
 * clave del proveedor de correo y el token del bot viven en el servidor: un
 * campo para pegarlos aquí los guardaría en la base de datos, que se copia en
 * cada respaldo. Sin ese aviso, lo lógico es buscar dónde se pega el token y
 * acabar abriendo una incidencia.
 */
export function NotificationSettingsForm({ onSessionLost }: Props) {
  const { t } = useTranslation();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [valores, setValores] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  // Los campos de texto se guardan tal y como se teclean y solo se convierten
  // a `null` al enviar: si se normalizaran en cada pulsación, borrar el
  // contenido para reescribirlo lo daría por vacío a mitad de camino.
  const [internalEmail, setInternalEmail] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorKey(null);

    try {
      const datos = await fetchNotificationSettings();
      setValores(datos);
      setInternalEmail(datos.internalEmail ?? '');
      setTelegramChatId(datos.telegramChatId ?? '');
    } catch (error) {
      if (error instanceof ApiClientError && error.statusCode === 401) {
        onSessionLost();
        return;
      }
      setErrorKey(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
    } finally {
      setCargando(false);
    }
  }, [onSessionLost]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const marcar = (campo: keyof NotificationSettings, valor: boolean): void => {
    setValores((actual) => ({ ...actual, [campo]: valor }));
    setGuardado(false);
  };

  const enviar = async (evento: React.FormEvent): Promise<void> => {
    evento.preventDefault();
    setErrorKey(null);
    setFieldErrors({});
    setGuardado(false);

    const candidato: unknown = {
      ...valores,
      internalEmail: internalEmail.trim() === '' ? null : internalEmail.trim(),
      telegramChatId: telegramChatId.trim() === '' ? null : telegramChatId.trim(),
    };

    // Mismo esquema que usa el servidor: el error sale junto al campo que lo
    // causa, no como un "algo ha ido mal" al final.
    const validado = NotificationSettingsSchema.safeParse(candidato);

    if (!validado.success) {
      const errores: Record<string, string> = {};
      for (const issue of validado.error.issues) {
        const campo = String(issue.path[0]);
        errores[campo] ??= `admin.notifications.${campo}Invalid`;
      }
      setFieldErrors(errores);
      return;
    }

    setGuardando(true);
    try {
      const datos = await saveNotificationSettings(validado.data);
      setValores(datos);
      setInternalEmail(datos.internalEmail ?? '');
      setTelegramChatId(datos.telegramChatId ?? '');
      setGuardado(true);
    } catch (error) {
      if (error instanceof ApiClientError && error.statusCode === 401) {
        onSessionLost();
        return;
      }
      setErrorKey(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return <p className="text-sm text-slate-600 dark:text-slate-400">{t('common.loading')}</p>;
  }

  return (
    <form onSubmit={(evento) => void enviar(evento)} className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('admin.notifications.title')}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t('admin.notifications.intro')}
        </p>
      </div>

      {/* ------------------------ Correo al cliente ----------------------- */}
      <section className="ft-card space-y-4 p-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          {t('admin.notifications.customerEmails')}
        </h3>

        <Interruptor
          id="aviso-confirmacion"
          etiqueta={t('admin.notifications.emailBookingConfirmed')}
          ayuda={t('admin.notifications.emailBookingConfirmedHelp')}
          valor={valores.emailBookingConfirmed}
          onChange={(v) => marcar('emailBookingConfirmed', v)}
        />

        <Interruptor
          id="aviso-cancelacion"
          etiqueta={t('admin.notifications.emailBookingCancelled')}
          ayuda={t('admin.notifications.emailBookingCancelledHelp')}
          valor={valores.emailBookingCancelled}
          onChange={(v) => marcar('emailBookingCancelled', v)}
        />
      </section>

      {/* -------------------------- Avisos internos ----------------------- */}
      <section className="ft-card space-y-4 p-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          {t('admin.notifications.internal')}
        </h3>

        <div>
          <label className="ft-label" htmlFor="aviso-correo-interno">
            {t('admin.notifications.internalEmail')}
          </label>
          <input
            id="aviso-correo-interno"
            className="ft-input"
            type="email"
            autoComplete="off"
            value={internalEmail}
            placeholder="avisos@freshnesstouch.com"
            onChange={(evento) => {
              setInternalEmail(evento.target.value);
              setGuardado(false);
            }}
          />
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {internalEmail.trim() === ''
              ? t('admin.notifications.internalEmailEmpty')
              : t('admin.notifications.internalEmailHelp')}
          </p>
          {fieldErrors.internalEmail && (
            <p className="mt-1 text-xs text-red-700">{t(fieldErrors.internalEmail)}</p>
          )}
        </div>

        <Interruptor
          id="aviso-telegram"
          etiqueta={t('admin.notifications.telegramOnNewBooking')}
          ayuda={t('admin.notifications.telegramOnNewBookingHelp')}
          valor={valores.telegramOnNewBooking}
          onChange={(v) => marcar('telegramOnNewBooking', v)}
        />

        <div>
          <label className="ft-label" htmlFor="aviso-chat">
            {t('admin.notifications.telegramChatId')}
          </label>
          <input
            id="aviso-chat"
            className="ft-input"
            inputMode="numeric"
            autoComplete="off"
            value={telegramChatId}
            placeholder="123456789"
            onChange={(evento) => {
              setTelegramChatId(evento.target.value);
              setGuardado(false);
            }}
          />
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {t('admin.notifications.telegramChatIdHelp')}
          </p>
          {fieldErrors.telegramChatId && (
            <p className="mt-1 text-xs text-red-700">{t(fieldErrors.telegramChatId)}</p>
          )}
        </div>

        {/*
         * Aviso deliberado y visible. Sin él, lo lógico es buscar dónde se
         * pega el token del bot, no encontrarlo, y abrir una incidencia.
         */}
        <p className="rounded-lg bg-slate-100 p-3 text-xs text-slate-700 dark:bg-night-700 dark:text-slate-300">
          {t('admin.notifications.credentialsNote')}
        </p>
      </section>

      {errorKey && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {t(errorKey)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="ft-btn-primary" disabled={guardando}>
          {guardando ? t('admin.settings.saving') : t('admin.settings.save')}
        </button>

        {guardado && (
          <p role="status" className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            {t('admin.settings.saved')}
          </p>
        )}
      </div>
    </form>
  );
}

/** Casilla con su explicación debajo: un interruptor sin contexto se marca a ciegas. */
function Interruptor({
  id,
  etiqueta,
  ayuda,
  valor,
  onChange,
}: {
  id: string;
  etiqueta: string;
  ayuda: string;
  valor: boolean;
  onChange: (valor: boolean) => void;
}) {
  return (
    <div>
      <label className="flex items-start gap-2.5 text-sm font-semibold text-slate-800 dark:text-slate-200">
        <input
          id={id}
          type="checkbox"
          className="mt-0.5"
          checked={valor}
          onChange={(evento) => onChange(evento.target.checked)}
        />
        {etiqueta}
      </label>
      <p className="mt-1 ml-6 text-xs text-slate-600 dark:text-slate-400">{ayuda}</p>
    </div>
  );
}
