import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { auth, supabaseIsConfigured } from '../lib/supabase';
import type { SignOutReason } from '../hooks/useStaffSession';

interface LoginProps {
  /** Por qué se volvió aquí, si se venía de una sesión cerrada. */
  reason: SignOutReason | null;
  onSignedIn: () => void;
}

/**
 * ACCESO AL PANEL
 * ---------------
 * DOS REGLAS QUE PARECEN DETALLES Y NO LO SON:
 *
 * 1. El mensaje de error es SIEMPRE el mismo, venga de donde venga el fallo.
 *    Decir "ese correo no existe" frente a "la contraseña es incorrecta"
 *    permite averiguar quién trabaja en la empresa probando correos, que es
 *    el primer paso de cualquier ataque dirigido.
 *
 * 2. No se ofrece registro. El personal lo da de alta administración; una
 *    cuenta que se crea sola nunca llega a tener ficha de personal, así que
 *    solo serviría para llenar la base de usuarios inútiles.
 */
export function Login({ reason, onSignedIn }: LoginProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!auth) return;

    setWorking(true);
    setFailed(false);

    const { error } = await auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setWorking(false);

    if (error) {
      // El motivo real queda en la consola del navegador de quien lo intenta,
      // que ya lo sabe; lo que no se hace es distinguirlo en la pantalla.
      setFailed(true);
      // La contraseña se borra: si el fallo fue una errata, reescribirla es
      // más rápido que buscarla en un campo oculto.
      setPassword('');
      return;
    }

    onSignedIn();
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="ft-card w-full max-w-sm p-6">
        <h1 className="text-xl font-bold text-brand-800 dark:text-white">{t('admin.signIn')}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('admin.signInHint')}</p>

        {!supabaseIsConfigured && (
          <p
            className="mt-4 rounded-lg border border-sun-400 bg-sun-50 p-3 text-sm text-slate-800
                       dark:border-sun-600 dark:bg-night-700 dark:text-slate-200"
            role="alert"
          >
            {t('admin.errorNotConfigured')}
          </p>
        )}

        {reason && (
          <p
            className="mt-4 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm
                       text-slate-700 dark:border-night-600 dark:bg-night-700 dark:text-slate-300"
            role="status"
          >
            {t(`admin.signedOut.${reason}`)}
          </p>
        )}

        <form className="mt-6 space-y-4" onSubmit={(event) => void submit(event)}>
          <div>
            <label className="ft-label" htmlFor="email">
              {t('admin.email')}
            </label>
            <input
              id="email"
              type="email"
              className="ft-input"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div>
            <label className="ft-label" htmlFor="password">
              {t('admin.password')}
            </label>
            <input
              id="password"
              type="password"
              className="ft-input"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {failed && (
            <p className="text-sm font-medium text-red-700 dark:text-red-400" role="alert">
              {/* Mensaje único: no distingue correo desconocido de contraseña
                  incorrecta. Ver el comentario de arriba. */}
              {t('admin.errorInvalidCredentials')}
            </p>
          )}

          <button
            type="submit"
            className="ft-btn-primary w-full"
            disabled={working || !supabaseIsConfigured}
          >
            {working ? t('admin.signingIn') : t('admin.signIn')}
          </button>
        </form>
      </div>
    </main>
  );
}
