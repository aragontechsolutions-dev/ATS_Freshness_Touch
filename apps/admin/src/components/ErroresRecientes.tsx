import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiErrorReport } from '@freshness/types';
import { fetchApiErrors, isSessionError, sessionLostReason } from '../lib/api';
import { useRefrescoVisible } from '../lib/use-refresco';
import { SkeletonFormulario } from './Skeletons';

/**
 * QUE HA FALLADO
 * ==============
 * La otra mitad de la alarma de errores. La fila de estado dice CUANTOS
 * errores del servidor hubo en la ultima hora, y con eso solo se puede hacer
 * una cosa: pedirle a alguien que entre a Render a leer el log. Esta
 * pantalla dice CUALES, que es lo primero que se pregunta despues.
 *
 * ========================================================================
 * UNA LINEA POR CLASE DE FALLO, NO POR PETICION
 * ========================================================================
 * Diez clientes que se estrellan contra el mismo error son UN problema que
 * arreglar. Si cada peticion fuera una fila, el fallo mas repetido —que
 * suele ser el mas grave— enterraria a los demas, y la pantalla volveria a
 * ser un log que nadie lee.
 *
 * ========================================================================
 * AQUI NO HAY DATOS DE NADIE, Y SE DICE EN PANTALLA
 * ========================================================================
 * Cada linea es una huella saneada en el servidor: metodo, patron de ruta y
 * nombre de la clase del error. Ni la URL que se pidio —que lleva dentro el
 * identificador de la reserva— ni el mensaje del error —que lleva el nombre
 * del servidor de la base, o el de un cobro de Stripe—.
 *
 * El aviso de la nota al pie no es decorativo: quien lo lee tiene que saber
 * que esto NO es el log, para que no venga a buscar aqui el mensaje del
 * error ni a quien le paso.
 */

interface ErroresRecientesProps {
  onSessionLost: (reason?: 'expired' | 'noAccess') => void;
}

/** Lo mismo que la pantalla de estado, para que las dos cuenten lo mismo. */
const REFRESCO_MS = 60_000;

export function ErroresRecientes({ onSessionLost }: ErroresRecientesProps) {
  const { t } = useTranslation();

  const [informe, setInforme] = useState<ApiErrorReport | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const cargar = useCallback(async (): Promise<void> => {
    try {
      setInforme(await fetchApiErrors());
      setErrorKey(null);
    } catch (error) {
      if (isSessionError(error)) {
        onSessionLost(sessionLostReason(error));
        return;
      }
      setErrorKey('admin.systemHealth.recentErrors.errorLoad');
    } finally {
      setCargando(false);
    }
  }, [onSessionLost]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useRefrescoVisible(() => void cargar(), REFRESCO_MS);

  if (cargando) return <SkeletonFormulario />;

  if (errorKey !== null && informe === null) {
    return (
      <p className="ft-card text-sm text-red-700 dark:text-red-400" role="alert">
        {t(errorKey)}
      </p>
    );
  }

  if (informe === null) return null;

  const horas = Math.round(informe.historyMinutes / 60);

  return (
    <section className="ft-card space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('admin.systemHealth.recentErrors.title')}
        </h2>
        {informe.inWindow > 0 && (
          <span className="text-sm font-semibold text-red-700 dark:text-red-400">
            {t('admin.systemHealth.recentErrors.window', {
              total: informe.inWindow,
              minutes: informe.windowMinutes,
            })}
          </span>
        )}
      </header>

      <p className="text-sm text-slate-600 dark:text-slate-400">
        {t('admin.systemHealth.recentErrors.intro')}
      </p>

      {informe.samples.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t('admin.systemHealth.recentErrors.empty', { hours: horas })}
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
          {informe.samples.map((muestra) => (
            <li key={muestra.fingerprint} className="flex flex-wrap items-baseline gap-x-3 py-3">
              {/*
                EN MONOESPACIADO Y SIN CORTAR. La huella es lo que se busca en
                el codigo despues: `POST /api/v1/bookings TypeError` lleva a
                un sitio concreto del repositorio, y recortarla para que
                quepa le quitaria justo eso.
              */}
              <code className="min-w-0 break-all font-mono text-sm text-slate-900 dark:text-white">
                {muestra.fingerprint}
              </code>
              <span className="text-xs text-slate-500 dark:text-slate-400">{muestra.status}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {t('admin.systemHealth.recentErrors.times', { total: muestra.count })}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {t('admin.systemHealth.recentErrors.lastAt', {
                  time: new Date(muestra.lastAt).toLocaleString(),
                })}
              </span>
            </li>
          ))}
        </ul>
      )}

      <footer className="pt-1 text-xs text-slate-500 dark:text-slate-400">
        {t('admin.systemHealth.recentErrors.note')}
      </footer>
    </section>
  );
}
