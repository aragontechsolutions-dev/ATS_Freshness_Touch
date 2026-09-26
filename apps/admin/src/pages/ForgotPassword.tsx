import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { auth, supabaseIsConfigured } from '../lib/supabase';
import {
  AlertIcon,
  ArrowLeftIcon,
  CheckCircleIcon,
  MailIcon,
  SpinnerIcon,
} from '../components/Icons';

interface ForgotPasswordProps {
  onBack: () => void;
}

/**
 * PEDIR UN ENLACE PARA ELEGIR CONTRASENA
 * --------------------------------------
 * LA DECISION QUE SOSTIENE ESTA PANTALLA: el mensaje es EL MISMO exista o no
 * la cuenta, y el boton se deshabilita igual en los dos casos.
 *
 * Decir "ese correo no esta registrado" convertiria esta pantalla en una
 * forma de averiguar quien trabaja aqui, probando direcciones una a una. En
 * una empresa pequena de un pueblo eso no es teorico: con cuatro apellidos se
 * saca la plantilla entera, y con la plantilla se sabe a quien suplantar.
 *
 * Tampoco se distingue un fallo del proveedor. Es tentador ("ha fallado el
 * envio, reintenta"), pero el proveedor limita por direccion: un error
 * distinto para un correo que existe y otro para uno que no volveria a
 * filtrar lo mismo por la puerta de atras.
 */
export function ForgotPassword({ onBack }: ForgotPasswordProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [working, setWorking] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!auth || working) return;

    setWorking(true);

    /*
     * El enlace vuelve a la raiz del panel. Desde ahi, `readPasswordLink`
     * decide si hay algo que atender; el resto del panel no acepta sesiones
     * metidas en la direccion.
     */
    await auth
      .resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
      .catch(() => undefined);

    /*
     * Se anuncia enviado PASE LO QUE PASE, y sin mirar la respuesta. Es lo
     * mismo que se le ensena a quien escribe una direccion que no existe.
     */
    setWorking(false);
    setEnviado(true);
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="ft-card w-full max-w-sm p-6">
        <h1 className="text-xl font-bold text-brand-800 dark:text-white">
          {t('admin.passwordReset.requestTitle')}
        </h1>

        {!supabaseIsConfigured ? (
          <p
            className="mt-4 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"
            role="alert"
          >
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            {t('admin.passwordReset.notConfigured')}
          </p>
        ) : enviado ? (
          <p
            className="mt-4 flex items-start gap-2 rounded-lg border border-slate-300 bg-slate-50
                       p-3 text-sm text-slate-700 dark:border-night-600 dark:bg-night-700
                       dark:text-slate-300"
            role="status"
          >
            <CheckCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-green-700 dark:text-green-400" />
            {t('admin.passwordReset.requestSent')}
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {t('admin.passwordReset.requestIntro')}
            </p>

            <form className="mt-5 space-y-4" onSubmit={(event) => void submit(event)}>
              <div>
                <label className="ft-label" htmlFor="correo-recuperacion">
                  {t('admin.email')}
                </label>
                <div className="relative">
                  <MailIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
                  <input
                    id="correo-recuperacion"
                    /*
                     * `type="email"` a proposito NO: el navegador bloquearia
                     * el envio con SU mensaje y en SU idioma. Aqui ademas
                     * daria igual, porque la respuesta es la misma escriba lo
                     * que escriba, y un aviso del navegador solo confundiria.
                     */
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    className="ft-input w-full pl-10"
                    maxLength={160}
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="ft-btn-primary w-full"
                disabled={working || email.trim().length === 0}
              >
                {working && <SpinnerIcon className="h-4 w-4" />}
                {working ? t('admin.working') : t('admin.passwordReset.requestSend')}
              </button>
            </form>
          </>
        )}

        <button type="button" className="ft-btn-ghost mt-4 w-full" onClick={onBack}>
          <ArrowLeftIcon className="h-4 w-4" />
          {t('admin.passwordReset.backToSignIn')}
        </button>
      </div>
    </main>
  );
}
