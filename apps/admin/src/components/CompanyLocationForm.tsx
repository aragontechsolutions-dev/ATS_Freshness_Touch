import { Suspense, lazy, useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CompanyLocationSchema,
  isInsideGeorgia,
  type CompanyLocation,
  type Locale,
} from '@freshness/types';
import {
  ApiClientError,
  fetchCompanyLocation,
  fetchServiceArea,
  saveCompanyLocation,
} from '../lib/api';
import { useToast } from './ToastProvider';
import { SkeletonFormulario } from './Skeletons';
import { AlertIcon, MapPinIcon, SpinnerIcon } from './Icons';
import { formatTimestamp } from '../lib/format';

/*
 * El mapa se descarga aparte: Leaflet son unos 40 kB comprimidos y esta
 * pantalla se abre una vez cada mucho. El panel se usa a diario.
 */
const LocationPickerMap = lazy(() => import('./LocationPickerMap'));

interface CompanyLocationFormProps {
  locale: Locale;
  onSessionLost: (reason?: 'expired' | 'noAccess') => void;
}

/** Lo que hay escrito en los campos. Cadenas: vienen de inputs. */
interface Borrador {
  latitude: string;
  longitude: string;
  city: string;
  state: string;
  postalCode: string;
}

/**
 * LA UBICACION DE LA EMPRESA
 * --------------------------
 * ES EL ORIGEN DESDE EL QUE SE MIDE TODO: la distancia de cada presupuesto,
 * las millas de traslado que se cobran, la zona que se guarda en cada
 * reserva y el centro del mapa del sitio.
 *
 * Y como el resto de lo que mueve dinero en este panel, equivocarse aqui NO
 * ROMPE NADA: el sistema sigue cotizando, cobrando y facturando, desde el
 * sitio equivocado. De ahi las tres decisiones de esta pantalla:
 *
 *   1. SE ELIGE PULSANDO EN EL MAPA. Tecleando coordenadas, un signo o un
 *      digito de mas mandan la sede a otro continente y nadie lo nota. Los
 *      campos siguen ahi para pegar unas coordenadas de otro sitio, y el
 *      mapa es entonces la comprobacion.
 *   2. EL CIRCULO DE LAS 35 MILLAS SE MUEVE CON EL MARCADOR. No se elige un
 *      punto: se elige que casas entran en el radio sin traslado.
 *   3. SE AVISA DE QUE NO CAMBIA LO YA RESERVADO. Es la primera pregunta de
 *      cualquiera antes de mover algo que afecta al precio.
 */
export function CompanyLocationForm({ locale, onSessionLost }: CompanyLocationFormProps) {
  const { t } = useTranslation();
  const toast = useToast();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [meta, setMeta] = useState<{ updatedAt: string | null; updatedBy: string | null } | null>(
    null,
  );
  /*
   * El radio sin traslado sale del area de servicio, no de aqui: es su
   * primera zona. Se pide para poder DIBUJARLO, y si esa peticion falla la
   * pantalla sigue funcionando sin circulo — no es el dato que se edita.
   */
  const [radioLibreMillas, setRadioLibreMillas] = useState(0);

  const perdioSesion = onSessionLost;

  const asentar = useCallback((ubicacion: CompanyLocation) => {
    setBorrador({
      latitude: String(ubicacion.latitude),
      longitude: String(ubicacion.longitude),
      city: ubicacion.city,
      state: ubicacion.state,
      postalCode: ubicacion.postalCode,
    });
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorKey(null);

    try {
      const datos = await fetchCompanyLocation();
      asentar(datos.settings);
      setMeta({ updatedAt: datos.updatedAt, updatedBy: datos.updatedBy });
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
     * El radio va aparte y DESPUES: es decoracion del mapa. Si fallara
     * dentro del try de arriba, una pantalla perfectamente utilizable se
     * quedaria en blanco por no haber podido dibujar un circulo.
     */
    try {
      const area = await fetchServiceArea();
      setRadioLibreMillas(area.settings.zones[0]?.maxMiles ?? 0);
    } catch {
      setRadioLibreMillas(0);
    }
  }, [asentar, perdioSesion]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /** Lo tecleado, en la forma del contrato. `null` si algo no es un numero. */
  const aContrato = (): CompanyLocation | null => {
    if (!borrador) return null;

    const latitude = Number.parseFloat(borrador.latitude);
    const longitude = Number.parseFloat(borrador.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return {
      latitude,
      longitude,
      city: borrador.city.trim(),
      state: borrador.state.trim().toUpperCase(),
      postalCode: borrador.postalCode.trim(),
    };
  };

  const enviar = async (evento: FormEvent): Promise<void> => {
    evento.preventDefault();
    setProblema(null);

    const candidato = aContrato();
    const validado = candidato === null ? null : CompanyLocationSchema.safeParse(candidato);

    if (!validado?.success) {
      /*
       * EL MENSAJE DE ZOD NO SE ENSENA TAL CUAL: sus textos son tecnicos y
       * van siempre en ingles. Los dos fallos que de verdad pasan aqui
       * —fuera de Georgia, o un campo que no es un numero— tienen su propio
       * texto.
       */
      const fueraDeGeorgia =
        candidato !== null && !isInsideGeorgia(candidato.latitude, candidato.longitude);
      setProblema(
        candidato === null
          ? t('admin.location.errNotNumbers')
          : fueraDeGeorgia
            ? t('admin.location.errOutsideGeorgia')
            : t('admin.location.errInvalid'),
      );
      return;
    }

    setGuardando(true);
    try {
      const datos = await saveCompanyLocation(validado.data);
      asentar(datos.settings);
      setMeta({ updatedAt: datos.updatedAt, updatedBy: datos.updatedBy });
      toast.success('admin.location.saved');
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        (error.statusCode === 401 || error.statusCode === 403)
      ) {
        perdioSesion(error.statusCode === 403 ? 'noAccess' : 'expired');
        return;
      }
      setProblema(null);
      setErrorKey(error instanceof ApiClientError ? error.messageKey : 'admin.errorGeneric');
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <SkeletonFormulario />;

  if (errorKey !== null && borrador === null) {
    return (
      <p
        className="ft-card flex items-start gap-2 p-4 text-sm text-red-700 dark:text-red-300"
        role="alert"
      >
        <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
        {t(errorKey)}
      </p>
    );
  }

  if (!borrador) return null;

  const cambiar = (campo: keyof Borrador, valor: string): void => {
    setBorrador((actual) => (actual === null ? actual : { ...actual, [campo]: valor }));
  };

  /** Lo que se dibuja. Mientras se teclea puede no ser un numero todavia. */
  const puntoDibujable = {
    lat: Number.parseFloat(borrador.latitude),
    lon: Number.parseFloat(borrador.longitude),
  };
  const puntoValido = Number.isFinite(puntoDibujable.lat) && Number.isFinite(puntoDibujable.lon);

  return (
    <form className="space-y-6" onSubmit={(evento) => void enviar(evento)}>
      <header>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('admin.location.title')}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t('admin.location.intro')}
        </p>
        <p
          className="mt-3 flex items-start gap-2 rounded-lg border border-sun-600/40 bg-sun-50 p-3
                     text-sm text-slate-800 dark:border-sun-300/30 dark:bg-night-700
                     dark:text-slate-200"
          role="note"
        >
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {t('admin.location.onlyFuture')}
        </p>
      </header>

      {/* ----------------------------- El mapa ----------------------------- */}
      <section className="ft-card space-y-3 p-4">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {t('admin.location.pickTitle')}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t('admin.location.pickHelp')}
          </p>
        </div>

        {puntoValido && (
          <Suspense fallback={<div className="ft-map-hueco" aria-hidden="true" />}>
            <LocationPickerMap
              className="ft-map"
              punto={puntoDibujable}
              radioLibreMillas={radioLibreMillas}
              descripcion={t('admin.location.mapDescription')}
              onPick={({ lat, lon }) => {
                setBorrador((actual) =>
                  actual === null
                    ? actual
                    : { ...actual, latitude: String(lat), longitude: String(lon) },
                );
                // Un punto nuevo invalida el aviso del intento anterior.
                setProblema(null);
              }}
            />
          </Suspense>
        )}

        {radioLibreMillas > 0 && (
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {t('admin.location.radiusNote', { miles: radioLibreMillas })}
          </p>
        )}
      </section>

      {/* --------------------------- Los campos ---------------------------- */}
      <section className="ft-card space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="ft-label">{t('admin.location.latitude')}</span>
            <input
              type="text"
              inputMode="decimal"
              className="ft-input w-full"
              value={borrador.latitude}
              onChange={(evento) => cambiar('latitude', evento.target.value)}
            />
          </label>
          <label className="block">
            <span className="ft-label">{t('admin.location.longitude')}</span>
            <input
              type="text"
              inputMode="decimal"
              className="ft-input w-full"
              value={borrador.longitude}
              onChange={(evento) => cambiar('longitude', evento.target.value)}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block sm:col-span-2">
            <span className="ft-label">{t('admin.location.city')}</span>
            <input
              type="text"
              className="ft-input w-full"
              value={borrador.city}
              onChange={(evento) => cambiar('city', evento.target.value)}
            />
          </label>
          <label className="block">
            <span className="ft-label">{t('admin.location.postalCode')}</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              className="ft-input w-full"
              value={borrador.postalCode}
              onChange={(evento) => cambiar('postalCode', evento.target.value.replace(/\D/g, ''))}
            />
          </label>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400">
          {t('admin.location.postalCodeNote')}
        </p>
      </section>

      {problema !== null && (
        <p
          className="ft-card flex items-start gap-2 p-4 text-sm text-red-700 dark:text-red-300"
          role="alert"
        >
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {problema}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="ft-btn ft-btn-primary" disabled={guardando}>
          {guardando && <SpinnerIcon className="mr-2 h-4 w-4" />}
          {t('admin.location.save')}
        </button>

        {meta?.updatedAt && (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <MapPinIcon className="h-3.5 w-3.5" />
            {t('admin.location.lastChanged', {
              who: meta.updatedBy ?? t('admin.unknownStaff'),
              when: formatTimestamp(meta.updatedAt, locale),
            })}
          </span>
        )}
      </div>
    </form>
  );
}
