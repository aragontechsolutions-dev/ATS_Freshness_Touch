import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NOTIFICATION_PREVIEW_COUNT,
  notificationBadge,
  type Locale,
  type StaffNotification,
} from '@freshness/types';
import { ApiClientError, fetchNotifications, markNotificationsRead } from '../lib/api';
import { clavesDeNotificacion, parametrosDeNotificacion } from '../lib/notificacion';
import { formatTimestamp } from '../lib/format';
import { BellIcon } from './Icons';

interface NotificationsBellProps {
  locale: Locale;
  /** Para abrir la lista completa. */
  onVerTodas: () => void;
  /** Para abrir lo que la notificacion senala. */
  onAbrirReserva: (bookingId: string) => void;
  onSessionLost: () => void;
}

/**
 * LA CAMPANA
 * ==========
 * El globo con lo que hay sin leer, y un desplegable con las ultimas cinco.
 *
 * ========================================================================
 * EL GLOBO SE PARA EN «+9»
 * ========================================================================
 * El numero exacto no cambia ninguna decision: con diez sin leer y con
 * cuarenta se hace lo mismo —abrirlas—, y un «47» en un globo de dieciseis
 * pixeles no se lee, solo ensucia. La cuenta exacta sigue estando en la
 * lista completa, que es donde sirve de algo.
 *
 * Con cero NO SE PINTA el globo: uno con un cero dentro es ruido que pide
 * atencion para decir que no pasa nada.
 *
 * ========================================================================
 * SE REFRESCA AL ABRIR, NO EN BUCLE
 * ========================================================================
 * Nada de un temporizador preguntando cada pocos segundos: esto corre en el
 * movil de quien trabaja, y la bateria y los datos son suyos. Se pide al
 * montar y cada vez que se abre el desplegable, que es cuando alguien quiere
 * saber.
 */
export function NotificationsBell({
  locale,
  onVerTodas,
  onAbrirReserva,
  onSessionLost,
}: NotificationsBellProps) {
  const { t } = useTranslation();

  const [abierto, setAbierto] = useState(false);
  const [sinLeer, setSinLeer] = useState(0);
  const [ultimas, setUltimas] = useState<StaffNotification[]>([]);
  const contenedor = useRef<HTMLDivElement>(null);

  const perdioSesion = onSessionLost;

  const cargar = useCallback(async () => {
    try {
      const bandeja = await fetchNotifications(NOTIFICATION_PREVIEW_COUNT);
      setUltimas(bandeja.notifications);
      setSinLeer(bandeja.unreadCount);
    } catch (error) {
      /*
       * UN FALLO AQUI NO MOLESTA A NADIE. La campana es un extra: si la API
       * no responde, se queda sin globo y el panel sigue funcionando. Sacar
       * un aviso rojo por no poder contar notificaciones seria convertir un
       * detalle en una interrupcion.
       */
      if (error instanceof ApiClientError && error.statusCode === 401) perdioSesion();
    }
  }, [perdioSesion]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /* Cerrar al pulsar fuera: es un desplegable, no una pantalla. */
  useEffect(() => {
    if (!abierto) return;

    const alPulsar = (evento: MouseEvent): void => {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', alPulsar);
    return () => {
      document.removeEventListener('mousedown', alPulsar);
    };
  }, [abierto]);

  const alternar = (): void => {
    const siguiente = !abierto;
    setAbierto(siguiente);
    if (siguiente) void cargar();
  };

  const abrir = async (notificacion: StaffNotification): Promise<void> => {
    setAbierto(false);

    /*
     * SE MARCA LEIDA AL ABRIRLA, no al verla en la lista. Verla de refilon
     * en un desplegable no es enterarse, y marcarla entonces haria
     * desaparecer del globo cosas que nadie llego a leer.
     */
    if (!notificacion.read) {
      await markNotificationsRead([notificacion.id]).catch(() => undefined);
      void cargar();
    }

    if (notificacion.entityType === 'booking' && notificacion.entityId !== null) {
      onAbrirReserva(notificacion.entityId);
    } else {
      onVerTodas();
    }
  };

  const globo = notificationBadge(sinLeer);

  return (
    <div className="relative" ref={contenedor}>
      <button
        type="button"
        className="ft-btn-icon relative"
        onClick={alternar}
        aria-label={
          sinLeer > 0 ? t('admin.inbox.badgeLabel', { count: sinLeer }) : t('admin.inbox.open')
        }
        title={t('admin.inbox.open')}
        aria-expanded={abierto}
      >
        <BellIcon className="h-5 w-5" />
        {globo !== '' && (
          <span
            className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-red-600 px-1
                       text-center text-[10px] font-bold leading-4 text-white"
            /* El numero ya va en el `aria-label` del boton: aqui sobra. */
            aria-hidden="true"
          >
            {globo}
          </span>
        )}
      </button>

      {abierto && (
        <div
          className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden
                     rounded-lg border border-slate-200 bg-white shadow-lg
                     dark:border-night-600 dark:bg-night-800"
        >
          <p className="border-b border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 dark:border-night-600 dark:text-white">
            {t('admin.inbox.title')}
          </p>

          {ultimas.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-600 dark:text-slate-400">
              {t('admin.inbox.empty')}
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {ultimas.map((notificacion) => {
                const claves = clavesDeNotificacion(notificacion.kind);
                const datos = parametrosDeNotificacion(notificacion, locale);

                return (
                  <li
                    key={notificacion.id}
                    className="border-b border-slate-100 dark:border-night-700"
                  >
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-night-700"
                      onClick={() => void abrir(notificacion)}
                    >
                      <span className="flex items-start gap-2">
                        {/* Un punto, no la palabra: ocupa lo que debe ocupar. */}
                        {!notificacion.read && (
                          <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600"
                            aria-label={t('admin.inbox.unread')}
                          />
                        )}
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-900 dark:text-white">
                            {t(claves.titulo, datos)}
                          </span>
                          <span className="block text-xs text-slate-600 dark:text-slate-400">
                            {t(claves.cuerpo, datos)}
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-slate-500">
                            {formatTimestamp(notificacion.createdAt, locale)}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/*
            «Ver todas» SIEMPRE, no solo cuando hay mas de cinco: este boton
            es la unica puerta a la lista completa —la bandeja no tiene
            entrada en el menu— y esconderlo cuando hay cuatro dejaria sin
            forma de volver a mirar las ya leidas.
          */}
          <button
            type="button"
            className="block w-full px-3 py-2 text-center text-sm font-medium text-brand-700
                       hover:bg-slate-50 dark:text-brand-300 dark:hover:bg-night-700"
            onClick={() => {
              setAbierto(false);
              onVerTodas();
            }}
          >
            {t('admin.inbox.showAll')}
          </button>
        </div>
      )}
    </div>
  );
}
