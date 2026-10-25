import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { REMOVAL_TOKEN_PATTERN } from '@freshness/types';
import { retirarFotos } from '../lib/api';

/**
 * LA PAGINA DESDE LA QUE UN CLIENTE RETIRA SUS FOTOS
 * ==================================================
 * Llega aqui desde el enlace de su correo de constancia. Lo que hace es una
 * sola cosa, y no pide identificarse: el testigo que trae ES la
 * identificacion.
 *
 * ========================================================================
 * EL TESTIGO VIAJA EN EL FRAGMENTO, Y POR ESO SE LEE DE `location.hash`
 * ========================================================================
 * Lo que va detras de la almohadilla NO SE MANDA AL SERVIDOR: no aparece en
 * los registros del servidor web, ni en los de ningun intermediario, ni en
 * la cabecera `Referer` cuando el navegador salta a otra pagina. Es el mismo
 * criterio que el enlace de contrasena del panel.
 *
 * ========================================================================
 * HAY QUE PULSAR UN BOTON, Y NO ES UN TRAMITE DE MAS
 * ========================================================================
 * Outlook Safe Links, los antivirus de correo y los previsualizadores de
 * WhatsApp o Slack ABREN SOLOS los enlaces de un correo para comprobar si
 * son peligrosos. Si esta pagina retirara al cargarse, el filtro de spam del
 * cliente le despublicaria las fotos sin que el hiciera nada — y nadie
 * entenderia por que.
 *
 * Los escaneres abren paginas. No pulsan botones.
 *
 * ========================================================================
 * NO ENSENA NADA DEL CLIENTE
 * ========================================================================
 * Ni su nombre, ni su direccion, ni de que fotos se trata. Quien reciba este
 * enlace reenviado por error no puede averiguar de quien es: solo puede
 * retirarlo, que es reversible desde el panel.
 */
export function RetirarFotos() {
  const { t } = useTranslation();

  const [testigo, setTestigo] = useState<string | null>(null);
  const [estado, setEstado] = useState<'listo' | 'enviando' | 'hecho' | 'invalido' | 'error'>(
    'listo',
  );

  useEffect(() => {
    const fragmento = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const valor = fragmento.get('t');

    if (valor !== null && REMOVAL_TOKEN_PATTERN.test(valor)) {
      setTestigo(valor);
    } else {
      setEstado('invalido');
    }

    /*
     * SE BORRA DE LA BARRA EN CUANTO SE LEE. Mientras este ahi, cualquiera
     * que mire la pantalla o que reciba una captura tiene la credencial. Se
     * sustituye la entrada del historial en vez de anadir una, para que el
     * boton de atras tampoco la recupere.
     */
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  async function retirar(): Promise<void> {
    if (testigo === null) return;

    setEstado('enviando');
    try {
      const { done } = await retirarFotos(testigo);
      setEstado(done ? 'hecho' : 'invalido');
    } catch {
      setEstado('error');
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-12">
      <div className="ft-card space-y-4 p-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">{t('removal.title')}</h1>

        {estado === 'hecho' ? (
          <p className="text-sm text-slate-700 dark:text-slate-300">{t('removal.done')}</p>
        ) : estado === 'invalido' ? (
          /*
           * UN TESTIGO FALSO, UNO YA GASTADO Y UNO AUSENTE DICEN LO MISMO.
           * Distinguirlos convertiria esta pagina en una forma de averiguar
           * que enlaces existieron alguna vez.
           */
          <p className="text-sm text-slate-700 dark:text-slate-300">{t('removal.invalid')}</p>
        ) : (
          <>
            <p className="text-sm text-slate-700 dark:text-slate-300">{t('removal.intro')}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">{t('removal.help')}</p>

            {estado === 'error' && (
              <p className="text-sm font-medium text-red-700 dark:text-red-300">
                {t('removal.error')}
              </p>
            )}

            <button
              type="button"
              className="ft-btn-primary w-full"
              onClick={() => void retirar()}
              disabled={estado === 'enviando'}
            >
              {estado === 'enviando' ? t('removal.sending') : t('removal.confirm')}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
