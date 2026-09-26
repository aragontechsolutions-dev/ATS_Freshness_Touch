import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Locale } from '@freshness/types';
import { useIdleSignOut } from './hooks/useIdleSignOut';
import { useStaffSession } from './hooks/useStaffSession';
import { useTheme } from './hooks/useTheme';
import { Agenda } from './pages/Agenda';
import { BookingDetailPage } from './pages/BookingDetail';
import { ForgotPassword } from './pages/ForgotPassword';
import { Login } from './pages/Login';
import { MyJobs } from './pages/MyJobs';
import { SetPassword } from './pages/SetPassword';
import { SettingsPage } from './pages/Settings';
import {
  AlertIcon,
  BriefcaseIcon,
  CalendarIcon,
  GearIcon,
  GlobeIcon,
  MoonIcon,
  RefreshIcon,
  SignOutIcon,
  SunIcon,
} from './components/Icons';
import { SkeletonListaReservas } from './components/Skeletons';
import { LogoMark } from './components/Logo';
import { persistLocale } from './i18n';
import { readPasswordLink, type PasswordLink } from './lib/password-link';

/** Las tres pantallas del panel. El detalle de una reserva se abre sobre la agenda. */
type Vista = 'agenda' | 'myJobs' | 'settings';

/**
 * PANEL DE ADMINISTRACION
 * -----------------------
 * Sin enrutador: son tres vistas y la navegacion cabe en un estado. Anadir
 * una libreria de rutas para esto seria peso y complejidad a cambio de nada;
 * cuando el panel crezca, entrara.
 *
 * LA VISTA ES UN VALOR, NO TRES INTERRUPTORES. Antes habia tres booleanos
 * sueltos y cada boton tenia que acordarse de apagar los otros dos: bastaba
 * olvidarse de uno para acabar en «ajustes» con el detalle de una reserva
 * todavia abierto detras. Con un solo valor ese estado no se puede escribir.
 */
export default function App() {
  const { t, i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? 'en') as Locale;
  const { state, signOut, refresh } = useStaffSession();
  const { theme, toggleTheme } = useTheme();

  const [vista, setVista] = useState<Vista>('agenda');
  const [openBookingId, setOpenBookingId] = useState<string | null>(null);
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

  /*
   * El motivo lo decide quien recibe el error, no este componente. Antes
   * estaba fijo en "caducada" y eso mentia: a una cuenta sin permiso para
   * esta pantalla se le decia que volviera a entrar, cosa que no arregla
   * nada y que la deja reintentando indefinidamente.
   */
  const alPerderSesion = useCallback(
    (reason: 'expired' | 'noAccess' = 'expired') => void signOut(reason),
    [signOut],
  );

  const cambiarIdioma = (): void => {
    const siguiente: Locale = locale === 'en' ? 'es' : 'en';
    void i18n.changeLanguage(siguiente);
    persistLocale(siguiente);
  };

  const irA = (destino: Vista): void => {
    // Cambiar de pantalla cierra el detalle abierto: volver despues a una
    // reserva que ya no se estaba mirando desconcierta mas de lo que ahorra.
    setOpenBookingId(null);
    setVista(destino);
  };

  /*
   * Mientras se comprueba quien eres se pinta EL ESQUELETO DE LA AGENDA, no
   * un «cargando» centrado. Es lo que se va a ver en un segundo, asi que la
   * pagina no da un salto al llegar los datos.
   */
  if (state.status === 'loading') {
    return (
      <div className="min-h-dvh">
        <div className="border-b border-slate-200 bg-white dark:border-night-600 dark:bg-night-800">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
            {/*
              El isotipo NO es un hueco gris: viene con la aplicacion, no de
              la red, asi que ya se puede pintar. Poner un circulo gris en su
              sitio seria fingir una espera que no existe.
            */}
            <div className="flex items-center gap-3">
              <LogoMark className="h-10 w-10 shrink-0" alt={t('common.companyName')} />
              <div className="space-y-1.5">
                <div className="ft-skeleton h-3.5 w-32" />
                <div className="ft-skeleton h-3 w-20" />
              </div>
            </div>
            <div className="ft-skeleton h-11 w-32" />
          </div>
        </div>
        <main className="mx-auto max-w-5xl px-4 py-6">
          <SkeletonListaReservas />
        </main>
      </div>
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
          <div className="flex items-start gap-3">
            <AlertIcon className="mt-0.5 h-6 w-6 shrink-0 text-sun-700 dark:text-sun-300" />
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                {t('admin.unreachable.title')}
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {t('admin.unreachable.body')}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="ft-btn-primary mt-5 w-full"
            onClick={() => void refresh()}
          >
            <RefreshIcon className="h-4 w-4" />
            {t('admin.retry')}
          </button>
          <button
            type="button"
            className="ft-btn-ghost mt-2 w-full"
            onClick={() => void signOut('manual')}
          >
            <SignOutIcon className="h-4 w-4" />
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
   * puesto puede abrir. Coordinacion y administracion la tienen tambien —en
   * una empresa pequena quien coordina tambien limpia— pero para ellas
   * convive con la agenda.
   */
  const soloMisTrabajos = state.staff.role === 'CLEANER';
  const actual: Vista = soloMisTrabajos ? 'myJobs' : vista;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur dark:border-night-600 dark:bg-night-800/95">
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 items-center gap-3">
              {/*
                Solo el isotipo, sin el nombre al lado: a 390 px el logotipo
                completo se come la mitad del ancho, y lo que hace falta ahi
                es saber quien eres tu y a donde puedes ir. El nombre viaja
                en el texto alternativo, que es donde importa.
              */}
              <LogoMark className="h-10 w-10 shrink-0" alt={t('common.companyName')} />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                  {state.staff.firstName} {state.staff.lastName}
                </p>
                <p className="truncate text-xs text-slate-600 dark:text-slate-400">
                  {t(`admin.role.${state.staff.role}`)}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {/*
                Tema e idioma son botones de solo icono: se usan una vez y
                luego no se vuelven a tocar, asi que ocupar ancho con su texto
                iria en contra de lo que de verdad se pulsa a diario. Llevan
                `aria-label` y `title`, que es lo que los hace utilizables.
              */}
              <button
                type="button"
                className="ft-btn-icon"
                onClick={toggleTheme}
                aria-label={t(theme === 'dark' ? 'common.theme.light' : 'common.theme.dark')}
                title={t(theme === 'dark' ? 'common.theme.light' : 'common.theme.dark')}
              >
                {theme === 'dark' ? (
                  <SunIcon className="h-5 w-5" />
                ) : (
                  <MoonIcon className="h-5 w-5" />
                )}
              </button>

              <button
                type="button"
                className="ft-btn-icon relative"
                onClick={cambiarIdioma}
                aria-label={t('common.language')}
                title={t('common.language')}
              >
                <GlobeIcon className="h-5 w-5" />
                {/* La sigla dice a que idioma se va, no en cual se esta. */}
                <span className="absolute right-1 bottom-0.5 text-[10px] font-bold">
                  {locale === 'en' ? 'ES' : 'EN'}
                </span>
              </button>

              <button type="button" className="ft-btn-ghost" onClick={() => void signOut('manual')}>
                <SignOutIcon className="h-4 w-4" />
                <span className="hidden sm:inline">{t('admin.signOut')}</span>
              </button>
            </div>
          </div>

          {/*
            La navegacion solo aparece cuando hay a donde ir. Para limpieza
            hay una sola pantalla, y una pestana solitaria que no lleva a
            ningun sitio es ruido.
          */}
          {!soloMisTrabajos && (
            <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label={t('admin.title')}>
              <Pestana
                activa={actual === 'agenda'}
                onClick={() => irA('agenda')}
                icono={<CalendarIcon className="h-4 w-4" />}
              >
                {t('admin.agenda')}
              </Pestana>
              <Pestana
                activa={actual === 'myJobs'}
                onClick={() => irA('myJobs')}
                icono={<BriefcaseIcon className="h-4 w-4" />}
              >
                {t('admin.myJobs.title')}
              </Pestana>
              {puedeConfigurar && (
                <Pestana
                  activa={actual === 'settings'}
                  onClick={() => irA('settings')}
                  icono={<GearIcon className="h-4 w-4" />}
                >
                  {t('admin.settings.title')}
                </Pestana>
              )}
            </nav>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {actual === 'myJobs' ? (
          <MyJobs locale={locale} onSessionLost={alPerderSesion} />
        ) : actual === 'settings' && puedeConfigurar ? (
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

/**
 * Pestana de la cabecera.
 *
 * La activa se marca de TRES formas a la vez y no solo con color: una linea
 * inferior gruesa, el texto en color de marca y `aria-current="page"`. Con
 * solo el color, quien no distingue azul de gris no sabe donde esta.
 */
function Pestana({
  activa,
  onClick,
  icono,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  icono: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={activa ? 'page' : undefined}
      className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
        activa
          ? 'border-brand-700 text-brand-800 dark:border-sun-400 dark:text-sun-300'
          : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:text-slate-400 dark:hover:border-night-600 dark:hover:text-slate-100'
      }`}
    >
      {icono}
      {children}
    </button>
  );
}
