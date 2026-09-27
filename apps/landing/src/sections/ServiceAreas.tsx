import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCatalog } from '../hooks/useCatalog';
import { MapPinIcon } from '../components/Icons';
import { Reveal } from '../components/Reveal';

/*
 * EL MAPA SE DESCARGA APARTE Y SOLO CUANDO SE VE.
 *
 * Leaflet son unos 40 kB comprimidos y esta seccion esta al final de la
 * pagina: meterlo en el paquete principal retrasaria el cotizador, que es lo
 * que de verdad genera ingresos. Se pide cuando la seccion entra en pantalla,
 * que en la mayoria de visitas no llega a pasar.
 */
const ServiceAreaMap = lazy(() => import('../components/ServiceAreaMap'));

/**
 * Zonas de servicio. Los datos vienen del catalogo de la API, de modo que
 * si la empresa cambia sus zonas o recargos, la web se actualiza sola.
 */
export function ServiceAreas() {
  const { t } = useTranslation();
  const { catalog } = useCatalog();

  const zones = catalog?.zones ?? [];
  const base = catalog?.baseOfOperations ?? null;

  /** Hasta donde sale el precio solo. Es el otro encuadre del mapa. */
  const instantMiles = zones.reduce(
    (max, zone) =>
      zone.instantQuote && zone.maxMiles !== null && zone.maxMiles > max ? zone.maxMiles : max,
    0,
  );

  /*
   * No se pide el mapa hasta que la seccion se acerca a la pantalla. El
   * margen de 200 px da tiempo a que Leaflet llegue antes de que se vea el
   * hueco, en vez de ensenar un cuadro vacio que se rellena de golpe.
   */
  const ancla = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  /*
   * Que parte del area se encuadra.
   *
   * Arranca en la cobertura COMPLETA porque es la novedad y lo que la mayoria
   * viene a comprobar: «¿llegais a mi pueblo?». El detalle de las zonas
   * cercanas esta a un clic, y ademas repetido en las tarjetas de abajo.
   */
  const [verCercanas, setVerCercanas] = useState(false);

  useEffect(() => {
    const nodo = ancla.current;
    // Sin observador —navegador antiguo— se carga y ya: mejor el peso de mas
    // que una seccion que no aparece nunca.
    if (!nodo || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((entrada) => entrada.isIntersecting)) {
          setVisible(true);
          observador.disconnect();
        }
      },
      { rootMargin: '200px' },
    );

    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);
  /*
   * Las millas que no cuestan traslado. Viene del catalogo y no de la
   * primera zona: aunque hoy coincidan a proposito, el dia que alguien
   * mueva una sin la otra el sitio tiene que decir lo que se COBRA, no lo
   * que dibuja el mapa.
   */
  const radioLibreMillas = catalog?.travel.freeRadiusMiles ?? 0;

  // Radio maximo atendido: el mayor limite de las zonas con distancia definida.
  const maxServiceableMiles = zones.reduce(
    (max, zone) => (zone.maxMiles !== null && zone.maxMiles > max ? zone.maxMiles : max),
    0,
  );

  return (
    <section id="areas" className="py-12 sm:py-16 lg:py-20">
      <div className="ft-container">
        <h2
          className="ft-rule text-3xl font-bold tracking-tight text-brand-800
                       dark:text-white"
        >
          {t('areas.title')}
        </h2>
        <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">{t('areas.subtitle')}</p>

        {/* ------------------------------ El mapa ------------------------------ */}
        <div ref={ancla} className="mt-8">
          {visible && base && zones.length > 0 && (
            <Suspense fallback={<div className="ft-map-hueco" aria-hidden="true" />}>
              <ServiceAreaMap
                className="ft-map"
                centro={{ lat: base.latitude, lon: base.longitude }}
                descripcion={t('areas.mapDescription', { miles: maxServiceableMiles })}
                focoMillas={verCercanas ? instantMiles : maxServiceableMiles}
                zonas={zones
                  .filter((zone) => zone.serviceable && zone.maxMiles !== null)
                  .map((zone) => ({
                    code: zone.code,
                    maxMiles: zone.maxMiles as number,
                    instantQuote: zone.instantQuote,
                    etiqueta: zone.instantQuote
                      ? t('areas.mapZoneInstant', {
                          zone: zone.code,
                          miles: zone.maxMiles,
                          /*
                           * LA ZONA YA NO LLEVA RECARGO PROPIO. El traslado
                           * se cobra por milla a partir del radio libre, asi
                           * que lo que distingue a una zona de otra es si el
                           * viaje entra en el precio o se cuenta aparte.
                           */
                          amount:
                            zone.maxMiles !== null && zone.maxMiles <= radioLibreMillas
                              ? t('areas.noSurcharge')
                              : t('areas.travelByMile'),
                        })
                      : t('areas.mapZoneOnRequest', { miles: zone.maxMiles }),
                  }))}
              />
            </Suspense>
          )}

          {/*
            DOS ENCUADRES, porque las escalas no se llevan: el area con
            precio al instante llega a 60 millas y la cobertura entera a 325.
            En un solo encuadre, las cuatro zonas cercanas se apelotonan en un
            punto y no se distingue ninguna.
          */}
          {instantMiles > 0 && instantMiles < maxServiceableMiles && (
            <div
              className="mt-3 flex flex-wrap gap-2"
              role="group"
              aria-label={t('areas.mapViewLabel')}
            >
              <button
                type="button"
                onClick={() => setVerCercanas(false)}
                aria-pressed={!verCercanas}
                className={`ft-map-vista ${verCercanas ? '' : 'ft-map-vista-on'}`}
              >
                {t('areas.viewWholeState')}
              </button>
              <button
                type="button"
                onClick={() => setVerCercanas(true)}
                aria-pressed={verCercanas}
                className={`ft-map-vista ${verCercanas ? 'ft-map-vista-on' : ''}`}
              >
                {t('areas.viewInstantArea', { miles: instantMiles })}
              </button>
            </div>
          )}

          <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600 dark:text-slate-400">
            <span className="inline-flex items-center gap-2">
              <span className="ft-map-clave ft-map-clave-instantanea" aria-hidden="true" />
              {t('areas.legendInstant')}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="ft-map-clave ft-map-clave-peticion" aria-hidden="true" />
              {t('areas.legendOnRequest')}
            </span>
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {zones.map((zone, indice) => (
            <Reveal
              key={zone.code}
              delayMs={indice * 90}
              className="ft-card ft-card-interactive p-5"
            >
              <span
                className="inline-flex items-center gap-2 text-sm font-bold text-brand-700
                               dark:text-brand-300"
              >
                <MapPinIcon className="h-4 w-4" />
                {zone.serviceable
                  ? t('areas.zoneLabel', { zone: zone.code })
                  : t('areas.outOfRange')}
              </span>

              {zone.serviceable && (
                <>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    {zone.maxMiles === null
                      ? t('areas.beyondMiles', { miles: maxServiceableMiles })
                      : t('areas.upToMiles', { miles: zone.maxMiles })}
                  </p>
                  <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                    {!zone.instantQuote
                      ? t('areas.onRequest')
                      : zone.maxMiles !== null && zone.maxMiles <= radioLibreMillas
                        ? t('areas.noSurcharge')
                        : t('areas.travelByMile')}
                  </p>
                </>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
