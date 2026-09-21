import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Locale } from '@freshness/types';
import { useIdleSignOut } from './hooks/useIdleSignOut';
import { useStaffSession } from './hooks/useStaffSession';
import { Agenda } from './pages/Agenda';
import { BookingDetailPage } from './pages/BookingDetail';
import { Login } from './pages/Login';
import { persistLocale } from './i18n';

/**
 * PANEL DE ADMINISTRACION
 * -----------------------
 * Sin enrutador: hay dos vistas y la navegacion cabe en un estado. Anadir una
 * libreria de rutas para esto seria peso y complejidad a cambio de nada;
 * cuando el panel crezca, entrara.
 */
export default function App() {
  const { t, i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? 'en') as Locale;
  const { state, signOut, refresh } = useStaffSession();
  const [openBookingId, setOpenBookingId] = useState<string | null>(null);

  const dentro = state.status === 'signed-in';

  /*
   * Cierre por inactividad. Solo vigila con sesion iniciada: en la pantalla
   * de acceso no hay nada que proteger y el temporizador sobraria.
   */
  useIdleSignOut(
    dentro,
    useCallback(() => void signOut('idle'), [signOut]),
  );

  const alPerderSesion = useCallback(() => void signOut('expired'), [signOut]);

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

  if (state.status === 'signed-out') {
    return <Login reason={state.reason} onSignedIn={() => void refresh()} />;
  }

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
        {openBookingId ? (
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
