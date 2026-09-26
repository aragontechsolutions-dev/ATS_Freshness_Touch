import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Locale } from '@freshness/types';
import { useIdleSignOut } from './hooks/useIdleSignOut';
import { useStaffSession } from './hooks/useStaffSession';
import { Agenda } from './pages/Agenda';
import { BookingDetailPage } from './pages/BookingDetail';
import { ForgotPassword } from './pages/ForgotPassword';
import { Login } from './pages/Login';
import { MyJobs } from './pages/MyJobs';
import { SetPassword } from './pages/SetPassword';
import { SettingsPage } from './pages/Settings';
import { persistLocale } from './i18n';
import { readPasswordLink, type PasswordLink } from './lib/password-link';

/**
 * PANEL DE ADMINISTRACION
 * -----------------------
 * Sin enrutador: son tres vistas y la navegacion cabe en un estado. Anadir una
 * libreria de rutas para esto seria peso y complejidad a cambio de nada;
 * cuando el panel crezca, entrara.
 */
export default function App() {
  const { t, i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? 'en') as Locale;
  const { state, signOut, refresh } = useStaffSession();
  const [openBookingId, setOpenBookingId] = useState<string | null>(null);
  const [enAjustes, setEnAjustes] = useState(false);
  const [enMisTrabajos, setEnMisTrabajos] = useState(false);
  const [pidiendoEnlace, setPidiendoEnlace] = useState(false);

  /*
   * El enlace de correo se lee UNA SOLA VEZ, al arrancar, y se guarda.
   *
   * Tiene que leerse antes de que nada mas toque la direccion, y guardarse
   * porque la pantalla que lo atiende la borra en cuanto la usa: si se
   * volviera a leer en cada pintado, el segundo ya no encontraria nada y la
   * pantalla se cerraria a media escritura.
   */
  const [enlace, setEnlace] = useState<PasswordLink | null>(() =>
    typeof window === 'undefined' ? null : readPasswordLink(window.location.href),
  );
  const [enlaceAtendido, setEnlaceAtendido] = useState(false);

  const dentro = state.status === 'signed-in';

  /*
   * Cierre por inactividad. Solo vigila con sesion iniciada: en la pantalla
   * de acceso no hay nada que proteger y el temporizador sobraria.
   */
  useIdleSignOut(
    dentro,
    useCallback(() => void signOut('idle'), [signOut]),
  );

  /*
   * El motivo lo decide quien recibe el error, no este componente. Antes
   * estaba fijo en "caducada" y eso mentia: a una cuenta sin permiso para
   * esta pantalla se le decia que volviera a entrar, cosa que no arregla
   * nada y que la deja reintentando indefinidamente.
   */
  /*
   * TAMBIEN SE ESCUCHA EL CAMBIO DE FRAGMENTO, y no es rebuscado.
   *
   * Si el panel ya esta abierto en la pestana donde se pulsa el enlace del
   * correo, el navegador NO recarga: la direccion pasa de "/" a
   * "/#access_token=...", que para el es la misma pagina con otro ancla. Sin
   * esto, el enlace no haria absolutamente nada y quien lo pulsa se quedaria
   * mirando la pantalla de acceso sin entender por que.
   */
  useEffect(() => {
    const alCambiarFragmento = (): void => {
      const leido = readPasswordLink(window.location.href);
      if (!leido) return;
      setEnlace(leido);
      setEnlaceAtendido(false);
    };

    window.addEventListener('hashchange', alCambiarFragmento);
    return () => window.removeEventListener('hashchange', alCambiarFragmento);
  }, []);

  const alPerderSesion = useCallback(
    (reason: 'expired' | 'noAccess' = 'expired') => void signOut(reason),
    [signOut],
  );

  const cambiarIdioma = (): void => {
    const siguiente: Locale = locale === 'en' ? 'es' : 'en';
    void i18n.changeLanguage(siguiente);
    persistLocale(siguiente);
  };

  if (state.status === 'loading') {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-slate-600 dark:text-slate-400">{t('common.loading')}</p>
      </main>
    );
  }

  /*
   * Elegir contrasena manda sobre todo lo demas, incluso sobre tener sesion
   * abierta. Quien llega por un enlace de invitacion o de recuperacion viene
   * a hacer eso; mostrarle la agenda de la sesion anterior seria ignorar
   * justo lo que acaba de pedir.
   */
  if (enlace && !enlaceAtendido) {
    return (
      <SetPassword
        link={enlace}
        onDone={() => {
          setEnlaceAtendido(true);
          void refresh();
        }}
        onCancel={() => setEnlaceAtendido(true)}
      />
    );
  }

  /*
   * No se ha podido comprobar la sesion. NO es lo mismo que estar fuera: la
   * sesion sigue viva y lo unico que falta es poder preguntar al servidor.
   *
   * Antes este caso mandaba a la pantalla de acceso diciendo que la sesion
   * habia caducado, lo cual cerraba una sesion buena y ademas mentia. Aqui se
   * ofrece reintentar, que es lo unico que hace falta.
   */
  if (state.status === 'unreachable') {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4 py-12">
        <div className="ft-card w-full max-w-sm p-6">
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">
            {t('admin.unreachable.title')}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {t('admin.unreachable.body')}
          </p>
          <button
            type="button"
            className="ft-btn-primary mt-4 w-full"
            onClick={() => void refresh()}
          >
            {t('admin.unreachable.retry')}
          </button>
          <button
            type="button"
            className="ft-btn-ghost mt-2 w-full"
            onClick={() => void signOut('manual')}
          >
            {t('admin.signOut')}
          </button>
        </div>
      </main>
    );
  }

  if (state.status === 'signed-out') {
    if (pidiendoEnlace) {
      return <ForgotPassword onBack={() => setPidiendoEnlace(false)} />;
    }

    return (
      <Login
        reason={state.reason}
        onForgot={() => setPidiendoEnlace(true)}
        onSignedIn={() => void refresh()}
      />
    );
  }

  /*
   * La configuracion solo se ofrece a administracion. Es comodidad, no
   * seguridad: la API responde 403 a cualquier otro rol aunque se llame
   * directamente. Esconder un boton nunca ha protegido nada.
   */
  const puedeConfigurar = state.staff.role === 'ADMIN';

  /*
   * PARA LIMPIEZA, "MIS TRABAJOS" ES TODO EL PANEL.
   *
   * No es una pestana mas escondida entre otras: es la unica pantalla que su
   * puesto puede abrir, asi que se pinta directamente. Coordinacion y
   * administracion la tienen tambien —en una empresa pequena quien coordina
   * tambien limpia, y desde la etapa anterior se le puede asignar— pero para
   * ellas convive con la agenda.
   */
  const soloMisTrabajos = state.staff.role === 'CLEANER';

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white dark:border-night-600 dark:bg-night-800">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-brand-800 dark:text-white">{t('admin.title')}</p>
            <p className="truncate text-xs text-slate-600 dark:text-slate-400">
              {state.staff.firstName} {state.staff.lastName} · {t(`admin.role.${state.staff.role}`)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!soloMisTrabajos && (
              <button
                type="button"
                className="ft-btn-ghost"
                aria-pressed={enMisTrabajos}
                onClick={() => {
                  setOpenBookingId(null);
                  setEnAjustes(false);
                  setEnMisTrabajos((valor) => !valor);
                }}
              >
                {enMisTrabajos ? t('admin.back') : t('admin.myJobs.title')}
              </button>
            )}

            {puedeConfigurar && (
              <button
                type="button"
                className="ft-btn-ghost"
                aria-pressed={enAjustes}
                onClick={() => {
                  // Al ir a configuracion se cierra el detalle abierto: volver
                  // despues a una reserva que ya no se estaba mirando
                  // desconcierta mas de lo que ahorra.
                  setOpenBookingId(null);
                  setEnMisTrabajos(false);
                  setEnAjustes((valor) => !valor);
                }}
              >
                {enAjustes ? t('admin.settings.backToAgenda') : t('admin.settings.title')}
              </button>
            )}

            <button type="button" className="ft-btn-ghost" onClick={cambiarIdioma}>
              {locale === 'en' ? 'ES' : 'EN'}
            </button>
            <button type="button" className="ft-btn-ghost" onClick={() => void signOut('manual')}>
              {t('admin.signOut')}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {soloMisTrabajos || enMisTrabajos ? (
          <MyJobs locale={locale} onSessionLost={alPerderSesion} />
        ) : enAjustes && puedeConfigurar ? (
          <SettingsPage staff={state.staff} locale={locale} onSessionLost={alPerderSesion} />
        ) : openBookingId ? (
          <BookingDetailPage
            bookingId={openBookingId}
            staff={state.staff}
            locale={locale}
            onBack={() => setOpenBookingId(null)}
            onSessionLost={alPerderSesion}
          />
        ) : (
          <Agenda locale={locale} onOpenBooking={setOpenBookingId} onSessionLost={alPerderSesion} />
        )}
      </main>
    </div>
  );
}
