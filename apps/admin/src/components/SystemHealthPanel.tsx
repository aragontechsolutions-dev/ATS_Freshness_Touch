import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SYSTEM_CHECK_IDS,
  type SystemCheck,
  type SystemCheckState,
  type SystemHealth,
} from '@freshness/types';
import { fetchSystemHealth, isSessionError, sessionLostReason } from '../lib/api';
import { useRefrescoVisible } from '../lib/use-refresco';
import { SkeletonFormulario } from './Skeletons';
import { SpinnerIcon } from './Icons';

/**
 * ESTADO DEL SISTEMA
 * ==================
 * La pantalla que le permite al titular del negocio saber si su sistema esta
 * sano sin depender de que alguien se lo diga.
 *
 * ========================================================================
 * POR QUE EXISTE SI YA HAY UNA ALARMA
 * ========================================================================
 * La alarma avisa cuando algo CAMBIA. Esto responde a la otra pregunta, la
 * que se hace en el momento contrario: «acabo de arreglar algo / acabo de
 * desplegar / me dijeron que fallaba, ¿como esta ahora?».
 *
 * Sin esta pantalla la unica forma de saberlo seria esperar a que sonara —o
 * a que no sonara— el telefono, y eso no es saber.
 *
 * ========================================================================
 * NO HAY NINGUN BOTON QUE ARREGLE NADA, Y ES A PROPOSITO
 * ========================================================================
 * Aplicar migraciones desde un navegador es exactamente la clase de boton
 * que parece util hasta el dia que alguien lo pulsa sin entenderlo. Lo que
 * hay que hacer esta escrito en `docs/30`, se hace con credenciales y desde
 * fuera. Esta pantalla INFORMA.
 */

interface SystemHealthPanelProps {
  onSessionLost: (reason?: 'expired' | 'noAccess') => void;
}

/** Cada cuanto se vuelve a preguntar mientras la pantalla esta abierta. */
const REFRESCO_MS = 60_000;

/*
 * El color de cada estado.
 *
 * ROJO Y AMBAR NO SE DISTINGUEN SOLO POR EL COLOR. Cada fila lleva ademas su
 * texto de estado, porque en torno a uno de cada doce hombres no distingue
 * bien el rojo del verde, y un panel que dice «esto va mal» unicamente con
 * un punto de color no se lo dice a esa persona. El punto acompana; el que
 * informa es el texto.
 */
const COLOR: Record<SystemCheckState, string> = {
  ok: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  unknown: 'bg-slate-400',
  down: 'bg-red-600',
};

export function SystemHealthPanel({ onSessionLost }: SystemHealthPanelProps) {
  const { t } = useTranslation();

  const [estado, setEstado] = useState<SystemHealth | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const cargar = useCallback(async (): Promise<void> => {
    try {
      setEstado(await fetchSystemHealth());
      // La pantalla se cura sola: un fallo de red pasajero no la deja en
      // rojo hasta que alguien recargue.
      setErrorKey(null);
    } catch (error) {
      /*
       * Los dos motivos de perder la sesion se distinguen porque dicen cosas
       * distintas: a quien se le caduco hay que mandarle a entrar otra vez,
       * y a quien no tiene permiso hay que decirle que no puede. Ya hay dos
       * ayudantes para esto; escribir aqui otra comprobacion de codigos HTTP
       * seria una tercera version de la misma regla.
       */
      if (isSessionError(error)) {
        onSessionLost(sessionLostReason(error));
        return;
      }
      setErrorKey('admin.systemHealth.errorLoad');
    } finally {
      setCargando(false);
    }
  }, [onSessionLost]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useRefrescoVisible(() => void cargar(), REFRESCO_MS);

  if (cargando) return <SkeletonFormulario />;

  if (errorKey !== null && estado === null) {
    return (
      <p className="ft-card text-sm text-red-700 dark:text-red-400" role="alert">
        {t(errorKey)}
      </p>
    );
  }

  if (estado === null) return null;

  return (
    <section className="ft-card space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('admin.systemHealth.title')}
        </h2>
        <Resumen estado={estado.state} />
      </header>

      <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin.systemHealth.intro')}</p>

      <ul className="divide-y divide-slate-200 dark:divide-slate-700">
        {/*
          SE RECORRE LA LISTA DEL CONTRATO, no la de la respuesta. Asi, el dia
          que se anada una comprobacion nueva en el servidor y el panel
          todavia no se haya desplegado, la fila aparece igual en vez de
          desaparecer en silencio; y si el servidor deja de mandar una, se ve
          que falta en lugar de parecer que todo esta bien.
        */}
        {SYSTEM_CHECK_IDS.map((id) => (
          <Fila key={id} id={id} check={estado.checks.find((c) => c.id === id)} />
        ))}
      </ul>

      <footer className="flex items-center gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
        {errorKey !== null && <SpinnerIcon className="h-3 w-3 animate-spin" />}
        <span>
          {/*
            LA HORA DE LA COMPROBACION VA SIEMPRE A LA VISTA. Sin ella, una
            pantalla congelada por un fallo de red se ve exactamente igual
            que un sistema sano, que es la peor confusion posible en un panel
            de estado.
          */}
          {t('admin.systemHealth.checkedAt', {
            time: new Date(estado.checkedAt).toLocaleTimeString(),
          })}
        </span>
      </footer>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function Resumen({ estado }: { estado: SystemCheckState }) {
  const { t } = useTranslation();

  return (
    <span className="inline-flex items-center gap-2 text-sm font-semibold">
      <span className={`h-2.5 w-2.5 rounded-full ${COLOR[estado]}`} aria-hidden="true" />
      {t(`admin.systemHealth.state.${estado}`)}
    </span>
  );
}

function Fila({ id, check }: { id: string; check: SystemCheck | undefined }) {
  const { t } = useTranslation();

  // Sin dato del servidor no se pinta verde: se dice que no se sabe.
  const state: SystemCheckState = check?.state ?? 'unknown';

  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-slate-900 dark:text-white">
          {t(`admin.systemHealth.check.${id}`)}
        </p>
        {check !== undefined && check.detailKey !== null && (
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            {t(`admin.systemHealth.detail.${check.detailKey}`)}
            {check.count !== null && ` (${check.count})`}
          </p>
        )}
      </div>

      <span className="inline-flex shrink-0 items-center gap-2 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${COLOR[state]}`} aria-hidden="true" />
        {t(`admin.systemHealth.state.${state}`)}
      </span>
    </li>
  );
}
