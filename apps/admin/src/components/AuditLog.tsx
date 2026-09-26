import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AUDIT_ACTIONS,
  AuditSurfaceSchema,
  staffFullName,
  type AuditLogItem,
  type AuditQueryInput,
  type AuditSurface,
  type Locale,
} from '@freshness/types';
import {
  ApiClientError,
  fetchAuditLog,
  fetchStaffDirectory,
  isSessionError,
  sessionLostReason,
} from '../lib/api';
import { SkeletonAuditoria } from './Skeletons';
import { AlertIcon, RefreshIcon, ShieldIcon, SpinnerIcon } from './Icons';
import { formatTimestamp } from '../lib/format';

interface AuditLogProps {
  locale: Locale;
  onSessionLost: (reason?: 'expired' | 'noAccess') => void;
}

/** Lo que hay escrito en los filtros. Todo cadena: viene de campos de formulario. */
interface Filtros {
  actorId: string;
  action: string;
  surface: string;
  from: string;
  to: string;
}

const SIN_FILTROS: Filtros = { actorId: '', action: '', surface: '', from: '', to: '' };

const SUPERFICIES = AuditSurfaceSchema.options;

/**
 * REGISTRO DE ACTIVIDAD
 * ---------------------
 * Quien hizo que, desde donde y cuando. Solo la ve administracion, y el
 * servidor responde 403 a cualquier otro rol aunque se llame directamente;
 * que la pestana no aparezca es comodidad, no seguridad.
 *
 * TRES DECISIONES QUE NO SON DE MAQUETACION:
 *
 * 1. NO RECARGA AL TECLEAR, al reves que la agenda. Consultar el registro
 *    deja su propia fila (`audit.queried`), asi que refrescar en cada
 *    pulsacion lo llenaria de consultas sobre si mismo y enterraria lo que
 *    importa. Los filtros se aplican al pulsar el boton, a proposito.
 *
 * 2. EL AVISO DE QUE ESTO SE REGISTRA ESTA SIEMPRE VISIBLE, no escondido en
 *    una ayuda. Quien mira tiene derecho a saber que su mirada se anota: es
 *    lo que convierte el registro en una garantia y no en vigilancia.
 *
 * 3. LA METADATA SE PINTA COMO TEXTO, nunca como marcado. Su contenido
 *    depende de cada accion y parte de el llega de fuera (el motivo que
 *    escribe alguien al cancelar, por ejemplo). Va dentro de un `<pre>` con
 *    el texto ya serializado, que React escapa.
 */
export function AuditLog({ locale, onSessionLost }: AuditLogProps) {
  const { t, i18n } = useTranslation();

  const [borrador, setBorrador] = useState<Filtros>(SIN_FILTROS);
  /*
   * Los filtros que produjeron la lista que se esta viendo, separados de los
   * del formulario. Hacen falta los dos: "cargar mas" tiene que seguir
   * pidiendo lo mismo aunque quien mira ya haya empezado a escribir otra
   * busqueda, o la segunda pagina no seria continuacion de la primera.
   */
  const [aplicados, setAplicados] = useState<Filtros>(SIN_FILTROS);

  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [siguiente, setSiguiente] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const [personas, setPersonas] = useState<{ id: string; nombre: string }[]>([]);

  const perdioSesion = onSessionLost;

  /*
   * El directorio se pide UNA vez y su fallo NO rompe la pantalla: sirve
   * para poner nombres en un desplegable, no para leer el registro. Si no
   * llega, el filtro por persona se queda en "cualquiera" y todo lo demas
   * sigue funcionando.
   */
  useEffect(() => {
    let vivo = true;

    void fetchStaffDirectory()
      .then((directorio) => {
        if (!vivo) return;
        setPersonas(
          directorio.staff.map((persona) => ({
            id: persona.staffId,
            nombre: staffFullName(persona),
          })),
        );
      })
      .catch(() => undefined);

    return () => {
      vivo = false;
    };
  }, []);

  const consulta = useCallback((filtros: Filtros): AuditQueryInput => {
    return {
      ...(filtros.actorId ? { actorId: filtros.actorId } : {}),
      ...(filtros.action ? { action: filtros.action } : {}),
      ...(filtros.surface ? { surface: filtros.surface as AuditSurface } : {}),
      /*
       * El dia del calendario se convierte a un instante EN LA ZONA DE QUIEN
       * MIRA, no en horario universal. Es coherente con las marcas de tiempo
       * de la lista, que tambien van en su zona: pedir "hasta el dia 5" y que
       * faltaran las entradas de la tarde del 5 seria desconcertante.
       */
      ...(filtros.from ? { from: new Date(`${filtros.from}T00:00:00`).toISOString() } : {}),
      ...(filtros.to ? { to: new Date(`${filtros.to}T23:59:59.999`).toISOString() } : {}),
    };
  }, []);

  const cargar = useCallback(
    async (filtros: Filtros): Promise<void> => {
      setCargando(true);
      setErrorKey(null);

      try {
        const pagina = await fetchAuditLog(consulta(filtros));
        setItems(pagina.items);
        setSiguiente(pagina.nextBefore);
      } catch (error) {
        if (isSessionError(error)) {
          perdioSesion(sessionLostReason(error));
          return;
        }
        setItems([]);
        setSiguiente(null);
        setErrorKey(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
      } finally {
        setCargando(false);
      }
    },
    [consulta, perdioSesion],
  );

  useEffect(() => {
    void cargar(aplicados);
  }, [cargar, aplicados]);

  const cargarMas = async (): Promise<void> => {
    if (siguiente === null || cargandoMas) return;

    setCargandoMas(true);
    try {
      const pagina = await fetchAuditLog({ ...consulta(aplicados), before: siguiente });
      // Se anade al final: la lista va de lo mas nuevo a lo mas viejo y esta
      // pagina es la continuacion hacia atras.
      setItems((actuales) => [...actuales, ...pagina.items]);
      setSiguiente(pagina.nextBefore);
    } catch (error) {
      if (isSessionError(error)) {
        perdioSesion(sessionLostReason(error));
        return;
      }
      setErrorKey(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
    } finally {
      setCargandoMas(false);
    }
  };

  const cambiar = (campo: keyof Filtros, valor: string): void => {
    setBorrador((actual) => ({ ...actual, [campo]: valor }));
  };

  /*
   * El catalogo se ordena por la etiqueta TRADUCIDA, no por el codigo: en el
   * desplegable se lee "Cobró el depósito", y ordenar por "payment.captured"
   * lo colocaria donde nadie lo busca. Se recalcula al cambiar de idioma.
   */
  const acciones = ordenarPorEtiqueta(
    AUDIT_ACTIONS.map((accion) => ({
      valor: accion,
      etiqueta: t(`admin.audit.action.${accion}`, { defaultValue: accion }),
    })),
    i18n.resolvedLanguage ?? locale,
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('admin.audit.title')}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('admin.audit.intro')}</p>
        <p className="mt-2 flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
          <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {t('admin.audit.selfNote')}
        </p>
      </div>

      {/* ------------------------------ Filtros ----------------------------- */}
      <form
        className="ft-card space-y-4 p-4"
        onSubmit={(evento) => {
          evento.preventDefault();
          setAplicados(borrador);
        }}
      >
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          {t('admin.audit.filters')}
        </h3>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="ft-label" htmlFor="auditoria-persona">
              {t('admin.audit.actor')}
            </label>
            <select
              id="auditoria-persona"
              className="ft-input"
              value={borrador.actorId}
              onChange={(evento) => cambiar('actorId', evento.target.value)}
            >
              <option value="">{t('admin.audit.anyActor')}</option>
              {personas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="ft-label" htmlFor="auditoria-accion">
              {t('admin.audit.what')}
            </label>
            <select
              id="auditoria-accion"
              className="ft-input"
              value={borrador.action}
              onChange={(evento) => cambiar('action', evento.target.value)}
            >
              <option value="">{t('admin.audit.anyAction')}</option>
              {acciones.map((accion) => (
                <option key={accion.valor} value={accion.valor}>
                  {accion.etiqueta}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="ft-label" htmlFor="auditoria-origen">
              {t('admin.audit.where')}
            </label>
            <select
              id="auditoria-origen"
              className="ft-input"
              value={borrador.surface}
              onChange={(evento) => cambiar('surface', evento.target.value)}
            >
              <option value="">{t('admin.audit.anySurface')}</option>
              {SUPERFICIES.map((superficie) => (
                <option key={superficie} value={superficie}>
                  {t(`admin.audit.surface.${superficie}`)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="ft-label" htmlFor="auditoria-desde">
              {t('admin.audit.from')}
            </label>
            <input
              id="auditoria-desde"
              type="date"
              className="ft-input"
              value={borrador.from}
              max={borrador.to === '' ? undefined : borrador.to}
              onChange={(evento) => cambiar('from', evento.target.value)}
            />
          </div>

          <div>
            <label className="ft-label" htmlFor="auditoria-hasta">
              {t('admin.audit.to')}
            </label>
            <input
              id="auditoria-hasta"
              type="date"
              className="ft-input"
              value={borrador.to}
              min={borrador.from === '' ? undefined : borrador.from}
              onChange={(evento) => cambiar('to', evento.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className="ft-btn-primary" disabled={cargando}>
            {cargando && <SpinnerIcon className="h-4 w-4" />}
            {t('admin.audit.apply')}
          </button>
          <button
            type="button"
            className="ft-btn-ghost"
            onClick={() => {
              setBorrador(SIN_FILTROS);
              setAplicados(SIN_FILTROS);
            }}
          >
            {t('admin.audit.clear')}
          </button>
        </div>
      </form>

      {/* ---------------------------- Resultados ---------------------------- */}
      <div aria-live="polite" aria-busy={cargando}>
        {cargando && <SkeletonAuditoria />}

        {!cargando && errorKey && (
          <div className="ft-card flex flex-col items-start gap-3 p-5" role="alert">
            <div className="flex items-start gap-3">
              <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-red-700 dark:text-red-400" />
              <p className="text-sm font-medium text-red-700 dark:text-red-400">{t(errorKey)}</p>
            </div>
            <button type="button" className="ft-btn-ghost" onClick={() => void cargar(aplicados)}>
              <RefreshIcon className="h-4 w-4" />
              {t('admin.retry')}
            </button>
          </div>
        )}

        {!cargando && !errorKey && items.length === 0 && (
          <div className="ft-card flex flex-col items-center gap-2 px-6 py-12 text-center">
            <ShieldIcon className="h-9 w-9 text-slate-400 dark:text-slate-500" />
            <p className="text-sm text-slate-600 dark:text-slate-400">{t('admin.audit.empty')}</p>
          </div>
        )}

        {!cargando && !errorKey && items.length > 0 && (
          <>
            <ul className="space-y-2">
              {items.map((item) => (
                <Entrada key={item.id} item={item} locale={locale} />
              ))}
            </ul>

            <div className="mt-4 flex flex-col items-center gap-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('admin.audit.countShown', { count: items.length })}
              </p>
              {siguiente === null ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('admin.audit.endOfList')}
                </p>
              ) : (
                <button
                  type="button"
                  className="ft-btn-ghost"
                  disabled={cargandoMas}
                  onClick={() => void cargarMas()}
                >
                  {cargandoMas && <SpinnerIcon className="h-4 w-4" />}
                  {cargandoMas ? t('admin.audit.loadingMore') : t('admin.audit.loadMore')}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Una entrada del registro.
 *
 * El nombre de quien actuo NO se da por hecho. Hay tres casos reales y los
 * tres salen en pantalla de forma distinta: una persona del equipo, un
 * cliente que reservo desde el sitio, y el sistema en un barrido automatico.
 * Un cuarto: la ficha ya no existe, y entonces queda el identificador.
 */
function Entrada({ item, locale }: { item: AuditLogItem; locale: Locale }) {
  const { t } = useTranslation();

  const quien =
    item.actorName ??
    (item.actorType === 'SYSTEM'
      ? t('admin.audit.systemActor')
      : item.actorType === 'CUSTOMER'
        ? t('admin.audit.customerActor')
        : t('admin.audit.unknownActor'));

  const detalle = detalleLegible(item.metadata);

  return (
    <li className="ft-card p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-slate-900 dark:text-white">
            <span className="font-semibold">{quien}</span>{' '}
            <span className="text-slate-700 dark:text-slate-300">
              {/*
                Si un dia llega una accion que esta pantalla no conoce —una
                version del servidor mas nueva— se ensena el codigo tal cual.
                Es feo y es correcto: mejor "booking.refunded" que una fila en
                blanco justo cuando alguien esta investigando algo.
              */}
              {t(`admin.audit.action.${item.action}`, { defaultValue: item.action })}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {formatTimestamp(item.occurredAt, locale)}
            {' · '}
            {t(`admin.audit.entity.${item.entityType}`, { defaultValue: item.entityType })}
            {item.ipAddress !== null && ` · ${t('admin.audit.ip', { value: item.ipAddress })}`}
          </p>
        </div>

        <span className="ft-chip shrink-0 bg-slate-100 text-slate-700 dark:bg-night-700 dark:text-slate-300">
          {t(`admin.audit.surface.${item.surface}`)}
        </span>
      </div>

      {detalle !== null && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100">
            {t('admin.audit.details')}
          </summary>
          {/*
            Texto ya serializado dentro de un `<pre>`. React lo escapa, asi
            que lo que alguien escribio en un motivo de cancelacion se ve tal
            cual y no se interpreta como nada.
          */}
          <pre className="mt-1.5 overflow-x-auto rounded-lg bg-slate-50 p-2.5 font-mono text-xs whitespace-pre-wrap text-slate-700 dark:bg-night-900 dark:text-slate-300">
            {detalle}
          </pre>
        </details>
      )}
    </li>
  );
}

/**
 * La metadata, lista para pintar, o `null` si no hay nada que ensenar.
 *
 * Devuelve `null` tambien con un objeto vacio: un desplegable «Detalles» que
 * se abre y ensena `{}` es peor que no ofrecerlo.
 */
function detalleLegible(metadata: unknown): string | null {
  if (metadata === null || metadata === undefined) return null;
  if (typeof metadata === 'object' && Object.keys(metadata).length === 0) return null;

  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    // Una referencia circular no puede venir de la base de datos, pero
    // tampoco vale la pena que rompa la pantalla entera si llegara.
    return null;
  }
}

/** Orden alfabetico segun el idioma, que no es el orden de los codigos. */
function ordenarPorEtiqueta<T extends { etiqueta: string }>(lista: T[], idioma: string): T[] {
  const comparador = new Intl.Collator(idioma);
  return [...lista].sort((a, b) => comparador.compare(a.etiqueta, b.etiqueta));
}
