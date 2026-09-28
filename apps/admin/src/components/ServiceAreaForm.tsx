import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_COMPANY_LOCATION,
  MAX_ZONE_MILES,
  ServiceAreaSettingsSchema,
  ZONE_ORDER,
  instantQuoteRadiusMiles,
  serviceRadiusMiles,
  type Locale,
  type ServiceAreaSettings,
  type ServiceAreaZone,
} from '@freshness/types';
import {
  ApiClientError,
  fetchCompanyLocation,
  fetchServiceArea,
  saveServiceArea,
} from '../lib/api';
import { useToast } from './ToastProvider';
import { SkeletonFormulario } from './Skeletons';
import { MapPinIcon, SpinnerIcon } from './Icons';
import { formatTimestamp } from '../lib/format';

/*
 * El mapa se descarga aparte: Leaflet son unos 40 kB comprimidos y esta
 * pantalla se abre unas pocas veces al ano. El panel se usa a diario y no
 * tiene por que cargar con ese peso en cada arranque.
 */
const ServiceAreaMap = lazy(() => import('./ServiceAreaMap'));

interface ServiceAreaFormProps {
  locale: Locale;
  onSessionLost: (reason?: 'expired' | 'noAccess') => void;
}

/** Lo que hay escrito en los campos. Cadenas: vienen de inputs. */
interface BorradorZona {
  code: ServiceAreaZone['code'];
  maxMiles: string;
  instantQuote: boolean;
}

/**
 * AREA DE SERVICIO
 * ----------------
 * Hasta donde va la empresa y donde el precio sale solo.
 *
 * ES LA PANTALLA DE CONFIGURACION QUE MAS DINERO MUEVE. Cambiar un limite
 * unas millas cambia el recargo de todas las casas de esa franja, y ampliar
 * el precio automatico haria que el cotizador prometiera cifras para
 * traslados que nadie ha calculado. Por eso:
 *
 *   - El mapa se actualiza MIENTRAS se escribe. Teclear «325 millas» no dice
 *     nada; ver el circulo cubriendo el estado, si.
 *   - Los recargos se escriben en DOLARES, no en centavos. Nadie piensa en
 *     centavos, y un cero de mas en un campo de centavos es un recargo diez
 *     veces mayor que nadie revisa.
 *   - Las reglas del conjunto se comprueban aqui con EL MISMO esquema que
 *     usa el servidor, para que el error salga antes de guardar.
 */
export function ServiceAreaForm({ locale, onSessionLost }: ServiceAreaFormProps) {
  const { t } = useTranslation();
  const toast = useToast();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  const [autoria, setAutoria] = useState<{ updatedAt: string | null; updatedBy: string | null }>({
    updatedAt: null,
    updatedBy: null,
  });

  const [zonas, setZonas] = useState<BorradorZona[]>([]);

  const perdioSesion = onSessionLost;

  const asentar = useCallback((area: ServiceAreaSettings) => {
    setZonas(
      area.zones.map((zona) => ({
        code: zona.code,
        maxMiles: String(zona.maxMiles),
        instantQuote: zona.instantQuote,
      })),
    );
  }, []);

  /*
   * DE DONDE SE CENTRA LA VISTA PREVIA.
   *
   * Estaba ESCRITO A MANO aqui, con un comentario que avisaba de que al
   * mudarse habria que tocar dos sitios. Desde que la sede se edita en su
   * propia pantalla ya no hace falta: se pide, y el circulo se dibuja
   * alrededor del punto desde el que de verdad se mide.
   */
  const [base, setBase] = useState({
    lat: DEFAULT_COMPANY_LOCATION.latitude,
    lon: DEFAULT_COMPANY_LOCATION.longitude,
  });

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorKey(null);

    try {
      const datos = await fetchServiceArea();
      asentar(datos.settings);
      setAutoria({ updatedAt: datos.updatedAt, updatedBy: datos.updatedBy });
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        (error.statusCode === 401 || error.statusCode === 403)
      ) {
        perdioSesion(error.statusCode === 403 ? 'noAccess' : 'expired');
        return;
      }
      setErrorKey(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
    } finally {
      setCargando(false);
    }

    /*
     * LA SEDE, PARA CENTRAR LA VISTA PREVIA. Va aparte y despues: es
     * decoracion del mapa, y si fallara dentro del try de arriba una
     * pantalla utilizable se quedaria en blanco por no haber podido
     * centrar un circulo. Si falla, se dibuja sobre la de partida.
     */
    try {
      const ubicacion = await fetchCompanyLocation();
      setBase({ lat: ubicacion.settings.latitude, lon: ubicacion.settings.longitude });
    } catch {
      setBase({
        lat: DEFAULT_COMPANY_LOCATION.latitude,
        lon: DEFAULT_COMPANY_LOCATION.longitude,
      });
    }
  }, [asentar, perdioSesion]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const cambiar = (indice: number, cambio: Partial<BorradorZona>): void => {
    setZonas((actuales) =>
      actuales.map((zona, i) => {
        if (i !== indice) return zona;
        const siguiente = { ...zona, ...cambio };
        return siguiente;
      }),
    );
  };

  /** Lo tecleado, en la forma del contrato. Devuelve `null` si hay basura. */
  const aContrato = (): ServiceAreaSettings | null => {
    const zonasNumericas = zonas.map((zona) => ({
      code: zona.code,
      maxMiles: Number.parseInt(zona.maxMiles, 10),
      instantQuote: zona.instantQuote,
    }));

    if (zonasNumericas.some((z) => !Number.isFinite(z.maxMiles))) {
      return null;
    }

    return { zones: zonasNumericas };
  };

  const enviar = async (evento: React.FormEvent): Promise<void> => {
    evento.preventDefault();
    setProblema(null);

    const candidato = aContrato();
    /*
     * Se valida aqui con EL MISMO esquema que el servidor. No es para
     * confiar menos en el —el vuelve a validar igual— sino para que el error
     * salga antes de tocar nada y diga cual de las reglas se ha roto.
     */
    const validado = candidato === null ? null : ServiceAreaSettingsSchema.safeParse(candidato);

    if (!validado?.success) {
      setProblema(validado?.error.issues[0]?.message ?? t('admin.serviceArea.invalidNumbers'));
      return;
    }

    setGuardando(true);
    try {
      const datos = await saveServiceArea(validado.data);
      asentar(datos.settings);
      setAutoria({ updatedAt: datos.updatedAt, updatedBy: datos.updatedBy });
      toast.success('admin.serviceArea.saved');
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        (error.statusCode === 401 || error.statusCode === 403)
      ) {
        perdioSesion(error.statusCode === 403 ? 'noAccess' : 'expired');
        return;
      }
      toast.error(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <SkeletonFormulario bloques={2} campos={3} />;

  if (errorKey) {
    return (
      <div className="ft-card flex flex-col items-start gap-3 p-5" role="alert">
        <p className="text-sm font-medium text-red-700 dark:text-red-400">{t(errorKey)}</p>
        <button type="button" className="ft-btn-ghost" onClick={() => void cargar()}>
          {t('admin.retry')}
        </button>
      </div>
    );
  }

  // La vista previa se dibuja con lo TECLEADO, no con lo guardado: es lo que
  // la hace util mientras se edita.
  const enPantalla = aContrato();
  const dibujables =
    enPantalla?.zones
      .filter((zona) => zona.maxMiles > 0 && zona.maxMiles <= MAX_ZONE_MILES)
      .map((zona) => ({
        code: zona.code,
        maxMiles: zona.maxMiles,
        instantQuote: zona.instantQuote,
        etiqueta: t('admin.serviceArea.mapZone', { zone: zona.code, miles: zona.maxMiles }),
      })) ?? [];

  const radio = enPantalla ? serviceRadiusMiles(enPantalla) : 0;
  const radioInstantaneo = enPantalla ? instantQuoteRadiusMiles(enPantalla) : 0;

  return (
    <form onSubmit={(evento) => void enviar(evento)} className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('admin.serviceArea.title')}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t('admin.serviceArea.intro')}
        </p>
      </div>

      {/* --------------------------- Vista previa --------------------------- */}
      <section className="ft-card space-y-3 p-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          {t('admin.serviceArea.preview')}
        </h3>

        {dibujables.length > 0 && (
          <Suspense fallback={<div className="ft-map-hueco" aria-hidden="true" />}>
            <ServiceAreaMap
              className="ft-map"
              centro={{ lat: base.lat, lon: base.lon }}
              descripcion={t('admin.serviceArea.mapDescription', { miles: radio })}
              focoMillas={radio}
              zonas={dibujables}
            />
          </Suspense>
        )}

        <p className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-2">
            <span className="ft-map-clave ft-map-clave-instantanea" aria-hidden="true" />
            {t('admin.serviceArea.legendInstant')}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="ft-map-clave ft-map-clave-peticion" aria-hidden="true" />
            {t('admin.serviceArea.legendOnRequest')}
          </span>
        </p>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          {t('admin.serviceArea.summary', { total: radio, instant: radioInstantaneo })}
        </p>
      </section>

      {/* ------------------------------ Zonas ------------------------------ */}
      <section className="ft-card space-y-4 p-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {t('admin.serviceArea.zones')}
          </h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {t('admin.serviceArea.zonesHelp')}
          </p>
        </div>

        <ul className="space-y-4">
          {zonas.map((zona, indice) => (
            <li
              key={zona.code}
              className="grid gap-3 border-b border-slate-100 pb-4 last:border-0 last:pb-0
                         sm:grid-cols-[auto_1fr_1fr] sm:items-end dark:border-night-700"
            >
              <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-900 sm:pb-2 dark:text-white">
                <MapPinIcon className="h-4 w-4" />
                {t('admin.serviceArea.zoneName', { zone: zona.code })}
              </span>

              <div>
                <label className="ft-label" htmlFor={`zona-${zona.code}-millas`}>
                  {t('admin.serviceArea.maxMiles')}
                </label>
                <input
                  id={`zona-${zona.code}-millas`}
                  className="ft-input"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_ZONE_MILES}
                  value={zona.maxMiles}
                  onChange={(evento) => cambiar(indice, { maxMiles: evento.target.value })}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={zona.instantQuote}
                  onChange={(evento) => cambiar(indice, { instantQuote: evento.target.checked })}
                />
                {t('admin.serviceArea.instantQuote')}
              </label>
            </li>
          ))}
        </ul>
      </section>

      {problema && (
        <p className="text-sm font-medium text-red-700 dark:text-red-400" role="alert">
          {problema}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="ft-btn-primary" disabled={guardando}>
          {guardando && <SpinnerIcon className="h-4 w-4" />}
          {guardando ? t('admin.settings.saving') : t('admin.settings.save')}
        </button>
        <button type="button" className="ft-btn-ghost" onClick={() => void cargar()}>
          {t('admin.staff.discard')}
        </button>
      </div>

      {autoria.updatedAt && (
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {t('admin.settings.lastChange', {
            who: autoria.updatedBy ?? t('admin.settings.unknownAuthor'),
            when: formatTimestamp(autoria.updatedAt, locale),
          })}
        </p>
      )}
    </form>
  );
}

/** El catalogo de zonas configurables, para que la pantalla no lo invente. */
export const ZONAS_CONFIGURABLES = ZONE_ORDER;
