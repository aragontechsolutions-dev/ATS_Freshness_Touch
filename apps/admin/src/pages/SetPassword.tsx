import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { PANEL_PASSWORD_MIN_LENGTH, panelPasswordProblem } from '@freshness/types';
import { auth } from '../lib/supabase';
import { clearPasswordLinkFromUrl, type PasswordLink } from '../lib/password-link';

interface SetPasswordProps {
  link: PasswordLink;
  /** Se llama al terminar bien: el panel vuelve a preguntar quien es. */
  onDone: () => void;
  onCancel: () => void;
}

type Estado =
  | { fase: 'abriendo' }
  | { fase: 'lista' }
  | { fase: 'guardando' }
  | { fase: 'hecha' }
  | { fase: 'rota'; messageKey: string };

/**
 * ELEGIR CONTRASENA
 * -----------------
 * La misma pantalla sirve para los dos caminos, y es deliberado: lo que la
 * persona hace es identico —teclear una contrasena dos veces— y lo unico que
 * cambia es el titulo. Dos pantallas casi iguales se desincronizan, y la que
 * menos se usa es la que acaba rota.
 *
 * ES EL UNICO SITIO DEL PANEL QUE ACEPTA UNA SESION METIDA EN LA DIRECCION.
 * El cliente tiene `detectSessionInUrl` apagado precisamente para que ninguna
 * otra pantalla lo haga (ver `lib/password-link.ts`). Aqui se abre a mano, y
 * lo PRIMERO que se hace despues es borrar la direccion: mientras el token
 * siga ahi, esta en el historial del navegador y en cualquier captura.
 */
export function SetPassword({ link, onDone, onCancel }: SetPasswordProps) {
  const { t } = useTranslation();

  const [estado, setEstado] = useState<Estado>({ fase: 'abriendo' });
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [problema, setProblema] = useState<'tooShort' | 'mismatch' | null>(null);

  // En desarrollo React monta dos veces; sin esto se intentaria canjear el
  // mismo codigo de un solo uso dos veces y el segundo intento fallaria.
  const abierto = useRef(false);

  useEffect(() => {
    if (abierto.current) return;
    abierto.current = true;

    void (async () => {
      if (!auth) {
        setEstado({ fase: 'rota', messageKey: 'admin.passwordReset.notConfigured' });
        return;
      }

      if (link.via === 'error') {
        clearPasswordLinkFromUrl();
        setEstado({ fase: 'rota', messageKey: 'admin.passwordReset.linkExpired' });
        return;
      }

      try {
        if (link.via === 'code') {
          await auth.exchangeCodeForSession(link.code);
        } else {
          await auth.setSession({
            access_token: link.accessToken,
            refresh_token: link.refreshToken,
          });
        }
      } catch {
        clearPasswordLinkFromUrl();
        /*
         * El canje por codigo falla tambien cuando el enlace se abre en OTRO
         * navegador: el verificador se guardo en el que lo pidio. Es el caso
         * comun de pedirlo en el ordenador y abrir el correo en el movil, y
         * merece su propio mensaje: "caducado" mandaria a pedir otro enlace
         * para repetir exactamente el mismo error.
         */
        setEstado({
          fase: 'rota',
          messageKey:
            link.via === 'code'
              ? 'admin.passwordReset.linkOtherDevice'
              : 'admin.passwordReset.linkExpired',
        });
        return;
      }

      // Antes que nada: fuera de la barra de direcciones.
      clearPasswordLinkFromUrl();
      setEstado({ fase: 'lista' });
    })();
  }, [link]);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!auth || estado.fase !== 'lista') return;

    const fallo = panelPasswordProblem(password, confirmation);
    setProblema(fallo);
    if (fallo) return;

    setEstado({ fase: 'guardando' });

    const { error } = await auth.updateUser({ password });

    if (error) {
      /*
       * Aqui el proveedor si tiene la ultima palabra: puede rechazar por su
       * propio minimo o porque la sesion del enlace ya no vale. No se
       * distingue el motivo en pantalla porque las dos salidas son la misma:
       * pedir un enlace nuevo.
       */
      setEstado({ fase: 'rota', messageKey: 'admin.passwordReset.linkExpired' });
      return;
    }

    /*
     * Se confirma ANTES de seguir, en vez de saltar directamente al panel.
     *
     * El motivo: si esta cuenta no es personal del panel —le puede pasar a
     * quien fue dado de baja despues de pedir el enlace— lo siguiente que
     * veria seria la pantalla de acceso diciendo que no tiene permiso, y
     * pareceria que la contrasena tampoco se guardo. Se guardo. Decirlo aqui
     * evita que lo intente cinco veces mas.
     */
    setEstado({ fase: 'hecha' });
  };

  if (estado.fase === 'abriendo') {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">{t('common.loading')}</p>
      </main>
    );
  }

  if (estado.fase === 'hecha') {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4 py-12">
        <div className="ft-card w-full max-w-sm p-6">
          <p className="text-sm font-medium text-green-700 dark:text-green-400" role="status">
            {t('admin.passwordReset.saved')}
          </p>
          <button type="button" className="ft-btn-primary mt-4 w-full" onClick={onDone}>
            {t('admin.signIn')}
          </button>
        </div>
      </main>
    );
  }

  if (estado.fase === 'rota') {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4 py-12">
        <div className="ft-card w-full max-w-sm p-6">
          <p className="text-sm font-medium text-red-700 dark:text-red-400" role="alert">
            {t(estado.messageKey)}
          </p>
          <button type="button" className="ft-btn-primary mt-4 w-full" onClick={onCancel}>
            {t('admin.passwordReset.backToSignIn')}
          </button>
        </div>
      </main>
    );
  }

  const esInvitacion = link.via !== 'error' && link.kind === 'invite';

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="ft-card w-full max-w-sm p-6">
        <h1 className="text-xl font-bold text-brand-800 dark:text-white">
          {t(
            esInvitacion
              ? 'admin.passwordReset.chooseTitleInvite'
              : 'admin.passwordReset.chooseTitleRecovery',
          )}
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t(
            esInvitacion
              ? 'admin.passwordReset.chooseIntroInvite'
              : 'admin.passwordReset.chooseIntroRecovery',
          )}
        </p>

        <form className="mt-5 space-y-4" onSubmit={(event) => void submit(event)}>
          <div>
            <label className="ft-label" htmlFor="clave-nueva">
              {t('admin.passwordReset.newPassword')}
            </label>
            <input
              id="clave-nueva"
              type={verClave ? 'text' : 'password'}
              // Le dice al gestor de contrasenas que esto es una clave nueva,
              // para que ofrezca generarla y guardarla en vez de autocompletar
              // la vieja, que es justo la que ya no vale.
              autoComplete="new-password"
              className="ft-input w-full"
              maxLength={200}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <div className="mt-1 flex items-start justify-between gap-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('admin.passwordReset.minLength', { count: PANEL_PASSWORD_MIN_LENGTH })}
              </p>
              {/*
                Ver la contrasena evita la errata invisible, que es el motivo
                numero uno de "no me deja entrar" al dia siguiente.
              */}
              <button
                type="button"
                className="shrink-0 text-xs font-semibold text-brand-700 underline dark:text-sun-300"
                onClick={() => setVerClave((valor) => !valor)}
              >
                {t(verClave ? 'admin.passwordReset.hide' : 'admin.passwordReset.show')}
              </button>
            </div>
          </div>

          <div>
            <label className="ft-label" htmlFor="clave-repetida">
              {t('admin.passwordReset.repeatPassword')}
            </label>
            <input
              id="clave-repetida"
              type={verClave ? 'text' : 'password'}
              autoComplete="new-password"
              className="ft-input w-full"
              maxLength={200}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </div>

          {problema && (
            <p className="text-sm font-medium text-red-700 dark:text-red-400" role="alert">
              {t(`admin.passwordReset.${problema}`, { count: PANEL_PASSWORD_MIN_LENGTH })}
            </p>
          )}

          <button
            type="submit"
            className="ft-btn-primary w-full"
            disabled={estado.fase === 'guardando'}
          >
            {estado.fase === 'guardando' ? t('common.loading') : t('admin.passwordReset.choose')}
          </button>
        </form>
      </div>
    </main>
  );
}
