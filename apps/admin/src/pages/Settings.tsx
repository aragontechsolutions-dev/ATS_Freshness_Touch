import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BusinessSettingsSchema,
  DEFAULT_BUSINESS_SETTINGS,
  WEEKDAYS,
  formatPhone,
  normalizePhoneInput,
  type AdminBusinessSettings,
  type Locale,
  type Weekday,
} from '@freshness/types';
import { ApiClientError, fetchSettings, saveSettings } from '../lib/api';
import { NotificationSettingsForm } from '../components/NotificationSettingsForm';
import { formatTimestamp } from '../lib/format';

interface SettingsPageProps {
  locale: Locale;
  onSessionLost: () => void;
}

/**
 * CONFIGURACION DEL NEGOCIO
 * -------------------------
 * La pantalla desde la que la empresa cambia su telefono, su correo y su
 * horario sin llamar a nadie.
 *
 * Dos decisiones de forma que importan mas de lo que parece:
 *
 *   1. EL TELEFONO SE ESCRIBE COMO SE ESCRIBE. Quien rellena esto teclea
 *      "(404) 555-0123", no "+14045550123". El campo acepta la forma natural
 *      y la convierte al guardar, ensenando debajo lo que quedara guardado.
 *      Obligar a aprenderse un formato tecnico es como se acaba con el
 *      telefono mal puesto.
 *
 *   2. VACIAR UN CAMPO ES UNA OPCION REAL. Si la empresa se queda sin
 *      telefono de atencion, el sitio esconde el enlace. Antes habia un
 *      numero inventado de relleno, que es peor: un cliente lo marca y
 *      termina llamando a un desconocido.
 */
type Seccion = 'business' | 'notifications';

/**
 * Dos bloques que se guardan por separado.
 *
 * No es un capricho de maquetacion: son dos filas distintas en la base de
 * datos y dos formularios independientes. Un solo boton de guardar daria a
 * entender que todo se escribe junto, y al fallar una parte quedaria la duda
 * de que se guardo.
 */
export function SettingsPage({ locale, onSessionLost }: SettingsPageProps) {
  const [seccion, setSeccion] = useState<Seccion>('business');

  return (
    <div className="space-y-6">
      <nav className="flex gap-2" aria-label="Secciones">
        <Pestana activa={seccion === 'business'} onClick={() => setSeccion('business')}>
          <TituloNegocio />
        </Pestana>
        <Pestana activa={seccion === 'notifications'} onClick={() => setSeccion('notifications')}>
          <TituloAvisos />
        </Pestana>
      </nav>

      {seccion === 'business' ? (
        <BusinessSettingsForm locale={locale} onSessionLost={onSessionLost} />
      ) : (
        <NotificationSettingsForm onSessionLost={onSessionLost} />
      )}
    </div>
  );
}

function TituloNegocio() {
  const { t } = useTranslation();
  return <>{t('admin.settings.title')}</>;
}

function TituloAvisos() {
  const { t } = useTranslation();
  return <>{t('admin.notifications.title')}</>;
}

function Pestana({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={activa ? 'page' : undefined}
      className={
        activa
          ? 'rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white'
          : 'ft-btn-ghost px-3 py-2 text-sm'
      }
    >
      {children}
    </button>
  );
}

function BusinessSettingsForm({ locale, onSessionLost }: SettingsPageProps) {
  const { t } = useTranslation();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [autoria, setAutoria] = useState<Omit<AdminBusinessSettings, 'settings'> | null>(null);

  // Lo que hay en los campos. El telefono se guarda como se teclea y solo se
  // normaliza al enviar: normalizar en cada pulsacion mueve el cursor y hace
  // imposible corregir un digito del medio.
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [hours, setHours] = useState(DEFAULT_BUSINESS_SETTINGS.hours);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const alPerderSesion = onSessionLost;

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorKey(null);

    try {
      const datos = await fetchSettings();
      setPhone(datos.settings.phone ?? '');
      setEmail(datos.settings.email ?? '');
      setHours(datos.settings.hours);
      setAutoria({ updatedAt: datos.updatedAt, updatedBy: datos.updatedBy });
    } catch (error) {
      if (error instanceof ApiClientError && error.statusCode === 401) {
        alPerderSesion();
        return;
      }
      setErrorKey(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
    } finally {
      setCargando(false);
    }
  }, [alPerderSesion]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cambiarDia = (dia: Weekday, valor: { open: string; close: string } | null): void => {
    setHours((actual) => ({ ...actual, [dia]: valor }));
    setGuardado(false);
  };

  const enviar = async (evento: React.FormEvent): Promise<void> => {
    evento.preventDefault();
    setErrorKey(null);
    setFieldErrors({});
    setGuardado(false);

    /*
     * Se valida aqui con EL MISMO esquema que usa el servidor. No es para
     * confiar menos en el servidor —el vuelve a validar igualmente— sino para
     * que el error salga junto al campo que lo causa en vez de como un
     * "algo ha ido mal" generico al final.
     */
    const candidato: unknown = {
      phone: phone.trim() === '' ? null : normalizePhoneInput(phone),
      email: email.trim() === '' ? null : email.trim(),
      hours,
    };

    const validado = BusinessSettingsSchema.safeParse(candidato);

    if (!validado.success) {
      setFieldErrors(clavesDeError(validado.error.issues));
      return;
    }

    setGuardando(true);
    try {
      const datos = await saveSettings(validado.data);
      setPhone(datos.settings.phone ?? '');
      setEmail(datos.settings.email ?? '');
      setHours(datos.settings.hours);
      setAutoria({ updatedAt: datos.updatedAt, updatedBy: datos.updatedBy });
      setGuardado(true);
    } catch (error) {
      if (error instanceof ApiClientError && error.statusCode === 401) {
        alPerderSesion();
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

  // Lo que quedara guardado, para que no haya sorpresas al pulsar el boton.
  const telefonoNormalizado = phone.trim() === '' ? null : normalizePhoneInput(phone);

  return (
    <form onSubmit={(evento) => void enviar(evento)} className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('admin.settings.title')}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t('admin.settings.intro')}
        </p>
      </div>

      {/* ---------------------------- Contacto ---------------------------- */}
      <section className="ft-card space-y-4 p-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          {t('admin.settings.contact')}
        </h3>

        <div>
          <label className="ft-label" htmlFor="ajuste-telefono">
            {t('admin.settings.phone')}
          </label>
          <input
            id="ajuste-telefono"
            className="ft-input"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={phone}
            placeholder="(404) 555-0123"
            onChange={(evento) => {
              setPhone(evento.target.value);
              setGuardado(false);
            }}
          />
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {telefonoNormalizado === null
              ? t('admin.settings.phoneEmpty')
              : t('admin.settings.phoneSaved', {
                  value: formatPhone(telefonoNormalizado) ?? telefonoNormalizado,
                })}
          </p>
          {fieldErrors.phone && <p className="mt-1 text-xs text-red-700">{t(fieldErrors.phone)}</p>}
        </div>

        <div>
          <label className="ft-label" htmlFor="ajuste-correo">
            {t('admin.settings.email')}
          </label>
          <input
            id="ajuste-correo"
            className="ft-input"
            type="email"
            autoComplete="off"
            value={email}
            placeholder="contact@freshnesstouch.com"
            onChange={(evento) => {
              setEmail(evento.target.value);
              setGuardado(false);
            }}
          />
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {email.trim() === '' ? t('admin.settings.emailEmpty') : t('admin.settings.emailHelp')}
          </p>
          {fieldErrors.email && <p className="mt-1 text-xs text-red-700">{t(fieldErrors.email)}</p>}
        </div>
      </section>

      {/* ----------------------------- Horario ---------------------------- */}
      <section className="ft-card space-y-4 p-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {t('admin.settings.hours')}
          </h3>
          {/*
           * Aviso deliberado: cerrar un dia NO cancela lo que ya hay
           * agendado. Sin esta frase, alguien cierra el domingo dando por
           * hecho que las citas de ese domingo desaparecen, y el equipo se
           * presenta igualmente (o peor: no se presenta).
           */}
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {t('admin.settings.hoursHelp')}
          </p>
        </div>

        <ul className="space-y-2">
          {WEEKDAYS.map((dia) => {
            const valor = hours[dia];
            const abierto = valor !== null;
            const errorDelDia = fieldErrors[`hours.${dia}`];

            return (
              <li
                key={dia}
                className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-2
                           last:border-0 last:pb-0 dark:border-night-700"
              >
                <span className="w-24 shrink-0 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {t(`admin.settings.day.${dia}`)}
                </span>

                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={abierto}
                    onChange={(evento) =>
                      cambiarDia(
                        dia,
                        evento.target.checked ? { open: '08:00', close: '18:00' } : null,
                      )
                    }
                  />
                  {t('admin.settings.open')}
                </label>

                {abierto ? (
                  <div className="flex items-center gap-2">
                    <input
                      className="ft-input w-36"
                      type="time"
                      step={900}
                      aria-label={t('admin.settings.opensAt', {
                        day: t(`admin.settings.day.${dia}`),
                      })}
                      value={valor.open}
                      onChange={(evento) =>
                        cambiarDia(dia, { ...valor, open: evento.target.value })
                      }
                    />
                    <span aria-hidden="true" className="text-slate-500">
                      –
                    </span>
                    <input
                      className="ft-input w-36"
                      type="time"
                      step={900}
                      aria-label={t('admin.settings.closesAt', {
                        day: t(`admin.settings.day.${dia}`),
                      })}
                      value={valor.close}
                      onChange={(evento) =>
                        cambiarDia(dia, { ...valor, close: evento.target.value })
                      }
                    />
                  </div>
                ) : (
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t('admin.settings.closed')}
                  </span>
                )}

                {errorDelDia && <p className="w-full text-xs text-red-700">{t(errorDelDia)}</p>}
              </li>
            );
          })}
        </ul>
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

      {autoria?.updatedAt && (
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {t('admin.settings.lastChange', {
            who: autoria.updatedBy ?? t('admin.settings.unknownAuthor'),
            when: formatTimestamp(autoria.updatedAt, locale),
          })}
        </p>
      )}
    </form>
  );
}

/**
 * Convierte los fallos del contrato en una CLAVE DE TRADUCCION por campo.
 *
 * No se ensena el mensaje del esquema. Esos textos estan escritos en espanol
 * para quien programa ("El telefono debe ir en formato internacional...") y
 * salian tal cual a alguien con el panel en ingles. Un error en otro idioma
 * no solo no ayuda: hace dudar de si la aplicacion se ha roto.
 *
 * El horario se agrupa por dia (`hours.3`) y no por campo suelto: a quien
 * edita le sirve "el miercoles esta mal", no "close esta mal".
 */
function clavesDeError(issues: { path: PropertyKey[] }[]): Record<string, string> {
  const errores: Record<string, string> = {};

  for (const issue of issues) {
    const [primero, segundo] = issue.path;

    if (primero === 'hours') {
      errores[`hours.${String(segundo)}`] ??= 'admin.settings.hoursInvalid';
    } else if (primero === 'phone' || primero === 'email') {
      errores[primero] ??= `admin.settings.${primero}Invalid`;
    }
  }

  return errores;
}
