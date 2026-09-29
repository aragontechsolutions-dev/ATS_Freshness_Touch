import { useTranslation } from 'react-i18next';
import type { Locale, ServiceType } from '@freshness/types';
import { useCatalog } from '../hooks/useCatalog';
import { formatCentsCompact } from '../lib/format';
import { Reveal } from '../components/Reveal';
import { ICONO_POR_SERVICIO } from '../components/ServiceIcons';

const SERVICE_ORDER: ServiceType[] = [
  'STANDARD',
  'DEEP',
  'MOVE_IN_OUT',
  'AIRBNB_TURNOVER',
  'POST_CONSTRUCTION',
  'COMMERCIAL',
];

export function Services() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage as Locale;
  const { catalog } = useCatalog();

  return (
    <section id="services" className="py-12 sm:py-16 lg:py-20">
      <div className="ft-container">
        <h2
          className="ft-rule text-3xl font-bold tracking-tight text-brand-800
                       dark:text-white"
        >
          {t('services.title')}
        </h2>
        <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
          {t('services.subtitle')}
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICE_ORDER.map((code, indice) => {
            const entry = catalog?.services.find((service) => service.code === code);
            const Icono = ICONO_POR_SERVICIO[code];

            return (
              <Reveal
                as="article"
                key={code}
                // Cascada corta: si el retardo creciera con cada tarjeta, las
                // ultimas tardarian demasiado en aparecer.
                delayMs={(indice % 3) * 90}
                className="ft-card ft-card-interactive flex flex-col p-6"
              >
                {/*
                  LA PLACA DE COLOR, NO EL SIMBOLO SUELTO.
                  Un icono de una sola linea flotando sobre la tarjeta blanca
                  se pierde; sobre una placa de color solido es lo primero que
                  se ve de la tarjeta. Mide 44x44, igual que el girasol que
                  habia antes, asi que la cuadricula no cambia de alto.

                  LOS DOS AZULES SON DELIBERADOS, Y ESTAN MEDIDOS:
                    claro   `brand-700` #145788 -> icono blanco a 7.64:1,
                                                   placa sobre tarjeta a 7.64:1
                    oscuro  `brand-500` #2a73a9 -> icono blanco a 5.09:1,
                                                   placa sobre tarjeta a 3.25:1

                  El azul oficial sobre el fondo casi negro solo da 2.17:1: la
                  placa se desdibujaria dentro de la tarjeta oscura. Por eso se
                  aclara al 500 en oscuro, la misma regla que ya gobierna los
                  botones del sitio.

                  EL AMARILLO SE DESCARTO A PROPOSITO. Medía de sobra (10:1 y
                  11:1), pero es el color del boton de accion, y la identidad
                  fija un solo amarillo por pantalla visible: seis placas
                  amarillas aqui le quitarian el sitio al presupuesto gratis.
                */}
                <span
                  className="inline-flex w-fit rounded-xl bg-brand-700 p-2.5 text-white
                             shadow-sm dark:bg-brand-500"
                >
                  <Icono className="h-6 w-6" />
                </span>

                <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">
                  {t(`services.${code}.name`)}
                </h3>
                <p className="mt-2 grow text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {t(`services.${code}.description`)}
                </p>

                <p className="mt-5 text-sm font-semibold text-brand-700 dark:text-brand-300">
                  {/* El «desde X» sale de la tarifa mas barata que se ofrezca: el minimo facturable ya no existe. */}
                  {entry === undefined
                    ? ' '
                    : entry.instantQuote && entry.fromCents !== null
                      ? `${t('services.startingAt')} ${formatCentsCompact(entry.fromCents, locale)}`
                      : t('services.requiresVisit')}
                </p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
