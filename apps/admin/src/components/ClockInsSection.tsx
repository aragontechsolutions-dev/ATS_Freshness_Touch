import { useTranslation } from 'react-i18next';
import {
  CLOCK_IN_STATE_TEXT_KEY,
  isFarFromHouse,
  type AdminBookingDetail,
  type ClockInRecord,
  type Locale,
} from '@freshness/types';
import { formatDistanciaDeFichaje, formatTimestamp } from '../lib/format';
import { AlertIcon, ClockIcon, MapPinIcon } from './Icons';

interface ClockInsSectionProps {
  booking: AdminBookingDetail;
  locale: Locale;
}

/**
 * LOS FICHAJES DE ESTE TRABAJO
 * ============================
 * Es la pantalla para la que existe toda la etapa 3.3: ante un «esto se cerro
 * sin hacerse», a que hora llego cada persona y a que distancia de la casa
 * estaba.
 *
 * ========================================================================
 * SIN AVISOS Y SIN DESTACADO EN LA AGENDA. SOLO QUEDA REGISTRADO.
 * ========================================================================
 * Fue una decision explicita, y el motivo es tecnico: la posicion de la casa
 * viene del geocodificador del Censo, que INTERPOLA sobre el tramo de calle y
 * se equivoca en cientos de metros en zonas rurales
 * (`docs/24-geocodificacion.md` §4). Una alarma automatica sobre ese dato
 * avisaria de cosas que no son, y a la tercera vez nadie la miraria.
 *
 * El aviso de «lejos de la casa» que si aparece aqui TIENE EN CUENTA EL
 * MARGEN DE ERROR del propio GPS: solo sale cuando el movil mismo dice que
 * esa persona no puede estar en la casa. Un GPS malo no acusa a nadie.
 *
 * ========================================================================
 * Y NO SE MUESTRA NINGUNA COORDENADA, PORQUE NO EXISTE NINGUNA
 * ========================================================================
 * La ubicacion de quien ficha nunca se guardo: llego al servidor, se
 * convirtio en metros y se descarto. Lo que hay aqui es todo lo que hay.
 */
export function ClockInsSection({ booking, locale }: ClockInsSectionProps) {
  const { t } = useTranslation();

  /*
   * La seccion no se pinta si no hay nada que contar. Un trabajo confirmado
   * al que nadie ha llegado todavia es el caso normal, y una tarjeta vacia
   * que dice «sin fichajes» solo ocupa sitio en una pantalla donde ya hay
   * mucho que leer.
   */
  if (booking.clockIns.length === 0) return null;

  return (
    <section className="ft-card p-5">
      <h2 className="ft-h2 mb-4 flex items-center gap-2">
        <ClockIcon className="h-5 w-5 text-brand-700 dark:text-brand-400" />
        {t('admin.clockIns.title')}
      </h2>

      <ul className="space-y-3">
        {booking.clockIns.map((fichaje) => (
          <Fichaje
            /*
             * La clave junta persona, tipo e instante: una misma persona puede
             * tener llegada y salida, y en teoria dos llegadas si coordinacion
             * devolvio el trabajo a confirmado.
             */
            key={`${fichaje.staffId}-${fichaje.kind}-${fichaje.occurredAt}`}
            fichaje={fichaje}
            locale={locale}
          />
        ))}
      </ul>

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        {t('admin.clockIns.privacyNote')}
      </p>
    </section>
  );
}

function Fichaje({ fichaje, locale }: { fichaje: ClockInRecord; locale: Locale }) {
  const { t } = useTranslation();
  const lejos = isFarFromHouse(fichaje);

  return (
    <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-slate-200 pb-3 last:border-0 last:pb-0 dark:border-slate-700">
      <span className="min-w-24 font-semibold text-slate-900 dark:text-slate-100">
        {fichaje.staffFirstName}
      </span>

      <span className="text-sm text-slate-600 dark:text-slate-300">
        {t(fichaje.kind === 'ARRIVAL' ? 'admin.clockIns.arrived' : 'admin.clockIns.left')}{' '}
        {formatTimestamp(fichaje.occurredAt, locale)}
      </span>

      <span className="flex items-center gap-1.5 text-sm">
        {lejos && (
          <AlertIcon
            className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
        )}
        <Distancia fichaje={fichaje} locale={locale} lejos={lejos} />
      </span>
    </li>
  );
}

function Distancia({
  fichaje,
  locale,
  lejos,
}: {
  fichaje: ClockInRecord;
  locale: Locale;
  lejos: boolean;
}) {
  const { t } = useTranslation();

  if (fichaje.locationState !== 'RECORDED' || fichaje.distanceMeters === null) {
    /*
     * Los tres motivos tienen texto propio, y no se parecen: `noHouse` dice
     * que el fallo es NUESTRO. Sin esa distincion, un fallo de la
     * geocodificacion se leeria como que alguien apago el GPS.
     */
    return (
      <span className="text-slate-500 dark:text-slate-400">
        {t(`admin.clockIns.${CLOCK_IN_STATE_TEXT_KEY[fichaje.locationState]}`)}
      </span>
    );
  }

  const { value, unit } = formatDistanciaDeFichaje(fichaje.distanceMeters, locale);
  const texto = t(unit === 'feet' ? 'admin.clockIns.feet' : 'admin.clockIns.miles', { value });

  return (
    <span
      className={
        lejos
          ? 'font-semibold text-amber-700 dark:text-amber-400'
          : 'text-slate-600 dark:text-slate-300'
      }
    >
      <MapPinIcon className="mr-1 inline h-3.5 w-3.5 align-[-0.1em]" aria-hidden="true" />
      {texto}
      {/*
       * EL MARGEN DEL GPS, JUNTO A LA DISTANCIA Y NO ESCONDIDO.
       *
       * «A 2,4 millas» invita a una conversacion; «a 2,4 millas ±30 pies»
       * invita a la misma conversacion sabiendo que el dato es solido. Y al
       * contrario: con un margen enorme, quien lee ve que no puede concluir
       * nada, que es justo lo que hay que ver.
       */}
      {fichaje.accuracyMeters !== null && (
        <span className="ml-1.5 font-normal text-slate-500 dark:text-slate-400">
          {t('admin.clockIns.accuracy', {
            value: formatDistanciaDeFichaje(fichaje.accuracyMeters, locale).value,
            unit: t(
              `admin.clockIns.unit.${formatDistanciaDeFichaje(fichaje.accuracyMeters, locale).unit}`,
            ),
          })}
        </span>
      )}
    </span>
  );
}
