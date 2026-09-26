import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NotificationSettingsSchema,
  type NotificationSettings,
} from '@freshness/types';
import { ApiClientError, fetchNotificationSettings, saveNotificationSettings } from '../lib/api';
import { useToast } from './ToastProvider';
import { SkeletonFormulario } from './Skeletons';
import { BellIcon, MailIcon, SpinnerIcon } from './Icons';

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

  const toast = useToast();
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  /** Solo el fallo de la CARGA: sin datos no hay formulario que rellenar. */
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [valores, setValores] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  // Los campos de texto se guardan tal y como se teclean y solo se convierten
  // a `null` al enviar: si se normalizaran en cada pulsación, borrar el
  // contenido para reescribirlo lo daría por vacío a mitad de camino.
  const [internalEmail, setInternalEmail] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [horasAntes, setHorasAntes] = useState(
    String(DEFAULT_NOTIFICATION_SETTINGS.reminderHoursBefore),
  );

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorKey(null);

    try {
      const datos = await fetchNotificationSettings();
      setValores(datos);
      setInternalEmail(datos.internalEmail ?? '');
      setTelegramChatId(datos.telegramChatId ?? '');
      setHorasAntes(String(datos.reminderHoursBefore));
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
  };

  const enviar = async (evento: React.FormEvent): Promise<void> => {
    evento.preventDefault();
    setFieldErrors({});

    const candidato: unknown = {
      ...valores,
      internalEmail: internalEmail.trim() === '' ? null : internalEmail.trim(),
      telegramChatId: telegramChatId.trim() === '' ? null : telegramChatId.trim(),
      // Number('') es 0, que el contrato rechaza por debajo del minimo: el
      // campo vacio da un error claro en vez de guardarse como cero.
      reminderHoursBefore: Number(horasAntes),
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
      setHorasAntes(String(datos.reminderHoursBefore));
      toast.success('admin.settings.saved');
    } catch (error) {
      if (error instanceof ApiClientError && error.statusCode === 401) {
        onSessionLost();
        return;
      }
      toast.error(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return <SkeletonFormulario bloques={2} campos={3} />;
  }

  if (errorKey) {
    return (
      <div className="ft-card flex flex-col items-start gap-3 p-5" role="alert">
        <p className="text-sm font-medium text-red-700 dark:text-red-400">{t(errorKey)}</p>
        <button type="button" className="ft-btn-ghost" onClick={() => void cargar()}>
          {t('admin.retry')}
        </button>
      </div>
    );
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
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <MailIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
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

        <Interruptor
          id="aviso-recordatorio"
          etiqueta={t('admin.notifications.emailBookingReminder')}
          ayuda={t('admin.notifications.emailBookingReminderHelp')}
          valor={valores.emailBookingReminder}
          onChange={(v) => marcar('emailBookingReminder', v)}
        />

        {/* El campo de horas solo tiene sentido con el recordatorio encendido. */}
        {valores.emailBookingReminder && (
          <div className="ml-6">
            <label className="ft-label" htmlFor="aviso-horas">
              {t('admin.notifications.reminderHoursBefore')}
            </label>
            <input
              id="aviso-horas"
              className="ft-input w-32"
              type="number"
              inputMode="numeric"
              /*
               * SIN `min` NI `max` A PROPOSITO. Con ellos, el navegador
               * bloquea el envio y ensena SU propio mensaje, en SU idioma:
               * alguien con el panel en espanol y el navegador en ingles
               * recibiria "Value must be less than or equal to 72". Los
               * limites los comprueba el mismo esquema que usa el servidor,
               * asi que el aviso sale igual, en el idioma del panel y junto
               * al campo, como en el resto del formulario.
               */
              value={horasAntes}
              onChange={(evento) => {
                setHorasAntes(evento.target.value);
              }}
            />
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              {t('admin.notifications.reminderHoursBeforeHelp')}
            </p>
            {fieldErrors.reminderHoursBefore && (
              <p className="mt-1 text-xs text-red-700">{t(fieldErrors.reminderHoursBefore)}</p>
            )}
          </div>
        )}
      </section>

      {/* -------------------------- Avisos internos ----------------------- */}
      <section className="ft-card space-y-4 p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <BellIcon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
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

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="ft-btn-primary" disabled={guardando}>
          {guardando && <SpinnerIcon className="h-4 w-4" />}
          {guardando ? t('admin.settings.saving') : t('admin.settings.save')}
        </button>
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
