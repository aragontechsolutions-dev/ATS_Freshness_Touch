import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { auth, supabaseIsConfigured } from '../lib/supabase';
import { PasswordField } from '../components/PasswordField';
import { AlertIcon, InfoIcon, MailIcon, SpinnerIcon } from '../components/Icons';
import type { SignOutReason } from '../hooks/useStaffSession';

interface LoginProps {
  /** Por qué se volvió aquí, si se venía de una sesión cerrada. */
  reason: SignOutReason | null;
  /** Lleva a pedir un enlace para elegir contraseña. */
  onForgot: () => void;
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
 *
 * LOS FALLOS DE AQUÍ NO VAN AL AVISO EMERGENTE, y es deliberado: el aviso se
 * pone en una esquina, y el sitio donde se mira tras fallar al entrar es
 * justo debajo del botón. Un error de credenciales es parte del formulario,
 * no una notificación.
 */
export function Login({ reason, onForgot, onSignedIn }: LoginProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [working, setWorking] = useState(false);
  const [failed, setFailed] = useState(false);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!auth || working) return;

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
      // Y se vuelve a ocultar. Si no, la siguiente queda a la vista sin que
      // nadie lo haya pedido, delante de quien pase por detrás.
      setVerClave(false);
      return;
    }

    onSignedIn();
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        {/* --------------------------- Marca --------------------------- */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sun-400 text-xl font-bold text-ink shadow-sm"
          >
            FT
          </span>
          <div>
            <h1 className="text-xl font-bold text-brand-800 dark:text-white">
              {t('admin.signIn')}
            </h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {t('admin.signInHint')}
            </p>
          </div>
        </div>

        <div className="ft-card p-6">
          {!supabaseIsConfigured && (
            <p
              className="mb-4 flex items-start gap-2 rounded-lg border border-sun-400 bg-sun-50 p-3
                         text-sm text-slate-800 dark:border-sun-600 dark:bg-night-700
                         dark:text-slate-200"
              role="alert"
            >
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {t('admin.errorNotConfigured')}
            </p>
          )}

          {reason && (
            <p
              className="mb-4 flex items-start gap-2 rounded-lg border border-slate-300 bg-slate-50
                         p-3 text-sm text-slate-700 dark:border-night-600 dark:bg-night-700
                         dark:text-slate-300"
              role="status"
            >
              <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {t(`admin.signedOut.${reason}`)}
            </p>
          )}

          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            <div>
              <label className="ft-label" htmlFor="email">
                {t('admin.email')}
              </label>
              <div className="relative">
                <MailIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                <input
                  id="email"
                  type="email"
                  className="ft-input pl-10"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </div>

            <PasswordField
              id="password"
              label={t('admin.password')}
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              visible={verClave}
              onToggleVisible={() => setVerClave((valor) => !valor)}
              required
            />

            {failed && (
              <p
                className="flex items-start gap-2 text-sm font-medium text-red-700 dark:text-red-400"
                role="alert"
              >
                <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
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
              {working && <SpinnerIcon className="h-4 w-4" />}
              {working ? t('admin.signingIn') : t('admin.signIn')}
            </button>

            {/*
              Va DENTRO del formulario y debajo del boton, donde se mira
              cuando algo no funciona. Es `type="button"` para que no envie el
              formulario al pulsarlo.
            */}
            <button
              type="button"
              className="w-full rounded-md py-1 text-sm font-semibold text-brand-700 underline
                         transition-colors hover:text-brand-900 dark:text-sun-300
                         dark:hover:text-sun-200"
              onClick={onForgot}
            >
              {t('admin.passwordReset.forgot')}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
