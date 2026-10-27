import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Locale, StaffNotification } from '@freshness/types';
import {
  ApiClientError,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationsRead,
} from '../lib/api';
import { clavesDeNotificacion, parametrosDeNotificacion } from '../lib/notificacion';
import { formatTimestamp } from '../lib/format';
import { AlertIcon, ArrowLeftIcon } from './../components/Icons';
import { SkeletonFormulario } from '../components/Skeletons';

/** Cuantas se traen de golpe. Mas que esto ya no se lee, se busca. */
const CUANTAS = 50;

interface NotificationsPageProps {
  locale: Locale;
  onAbrirReserva: (bookingId: string) => void;
  onSessionLost: () => void;
  /** Para que la campana vuelva a contar despues de marcar como leidas. */
  onCambio?: () => void;
}

/**
 * TODAS LAS NOTIFICACIONES
 * ========================
 * La lista completa, y el detalle de cada una.
 *
 * ========================================================================
 * EL DETALLE SE ABRE AQUI DENTRO, NO EN OTRA PANTALLA
 * ========================================================================
 * Una notificacion tiene un titulo, una frase y una fecha: no da para una
 * pantalla propia, y mandar a otra pagina para leer dos lineas obliga a
 * volver para seguir mirando la lista. Se despliega en su sitio, y lo que de
 * verdad lleva a algun lado —la reserva— tiene su boton.
 */
export function NotificationsPage({
  locale,
  onAbrirReserva,
  onSessionLost,
  onCambio,
}: NotificationsPageProps) {
  const { t } = useTranslation();

  const [cargando, setCargando] = useState(true);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [lista, setLista] = useState<StaffNotification[]>([]);
  const [abierta, setAbierta] = useState<string | null>(null);

  const perdioSesion = onSessionLost;
  const avisarCambio = onCambio;

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorKey(null);

    try {
      setLista((await fetchNotifications(CUANTAS)).notifications);
    } catch (error) {
      if (error instanceof ApiClientError && error.statusCode === 401) {
        perdioSesion();
        return;
      }
      setErrorKey(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
    } finally {
      setCargando(false);
    }
  }, [perdioSesion]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const abrir = async (notificacion: StaffNotification): Promise<void> => {
    setAbierta(abierta === notificacion.id ? null : notificacion.id);

    if (!notificacion.read) {
      await markNotificationsRead([notificacion.id]).catch(() => undefined);
      await cargar();
      avisarCambio?.();
    }
  };

  const marcarTodas = async (): Promise<void> => {
    await markAllNotificationsRead().catch(() => undefined);
    await cargar();
    avisarCambio?.();
  };

  if (cargando) return <SkeletonFormulario />;

  if (errorKey !== null) {
    return (
      <section className="ft-card flex items-start gap-2 p-5 text-sm text-red-700 dark:text-red-300">
        <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {t(errorKey)}
      </section>
    );
  }

  const haySinLeer = lista.some((notificacion) => !notificacion.read);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('admin.inbox.title')}
        </h1>

        {haySinLeer && (
          <button type="button" className="ft-btn-ghost" onClick={() => void marcarTodas()}>
            {t('admin.inbox.markAllRead')}
          </button>
        )}
      </div>

      {lista.length === 0 ? (
        <p className="ft-card p-5 text-sm text-slate-600 dark:text-slate-400">
          {t('admin.inbox.empty')}
        </p>
      ) : (
        <ul className="m-0 list-none space-y-2 p-0">
          {lista.map((notificacion) => {
            const claves = clavesDeNotificacion(notificacion.kind);
            const datos = parametrosDeNotificacion(notificacion, locale);
            const desplegada = abierta === notificacion.id;

            return (
              <li key={notificacion.id} className="ft-card p-0">
                <button
                  type="button"
                  className="block w-full p-4 text-left"
                  onClick={() => void abrir(notificacion)}
                  aria-expanded={desplegada}
                >
                  <span className="flex items-start gap-2">
                    {!notificacion.read && (
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600"
                        aria-label={t('admin.inbox.unread')}
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                        {t(claves.titulo, datos)}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {formatTimestamp(notificacion.createdAt, locale)}
                      </span>
                    </span>
                  </span>
                </button>

                {desplegada && (
                  <div className="space-y-3 border-t border-slate-200 p-4 dark:border-night-600">
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {t(claves.cuerpo, datos)}
                    </p>

                    {notificacion.entityType === 'booking' && notificacion.entityId !== null && (
                      <button
                        type="button"
                        className="ft-btn-ghost"
                        onClick={() => {
                          onAbrirReserva(notificacion.entityId as string);
                        }}
                      >
                        <ArrowLeftIcon className="h-4 w-4 rotate-180" aria-hidden="true" />
                        {t('admin.inbox.openEntity')}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
