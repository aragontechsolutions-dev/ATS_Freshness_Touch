import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EDITABLE_SERVICE_TYPES,
  OFFERED_ADD_ON_CODES,
  PricingRatesSchema,
  type Frequency,
  type Locale,
  type OfferedAddOnCode,
  type PricingRates,
} from '@freshness/types';
import { ApiClientError, fetchPricingRates, savePricingRates } from '../lib/api';
import { useToast } from './ToastProvider';
import { SkeletonFormulario } from './Skeletons';
import { AlertIcon, SpinnerIcon } from './Icons';
import { formatTimestamp } from '../lib/format';

interface PricingRatesFormProps {
  locale: Locale;
  onSessionLost: (reason?: 'expired' | 'noAccess') => void;
}

type ServicioEditable = (typeof EDITABLE_SERVICE_TYPES)[number];

/** Las cadencias, de menos compromiso a mas. Es el orden en que se leen. */
const CADENCIAS: readonly Frequency[] = ['ONE_TIME', 'MONTHLY', 'BIWEEKLY', 'WEEKLY'];

/**
 * Lo que hay escrito en los campos. Todo cadenas: vienen de inputs, y un
 * campo a medio escribir («12.») no es un numero todavia.
 */
interface CamposTarifa {
  /** Si ese servicio se ofrece en esa cadencia. */
  offered: boolean;
  flat: string;
  /** En centavos, no en dolares: ver la cabecera del componente. */
  sqft: string;
}

interface Borrador {
  services: Record<ServicioEditable, Record<Frequency, CamposTarifa>>;
  addOns: Record<OfferedAddOnCode, { amount: string; max: string }>;
  deposit: string;
  travel: { freeMiles: string; centsPerMile: string; roundTrip: boolean };
}

/** El nombre de cada campo, para poder decir CUAL revisar. */
const ETIQUETA_CAMPO: Record<string, string> = {
  flatCents: 'admin.rates.flat',
  centsPerSquareFoot: 'admin.rates.perSquareFoot',
  unitAmountCents: 'admin.rates.amount',
  maxQuantity: 'admin.rates.maxQuantity',
  depositCents: 'admin.rates.deposit',
  freeRadiusMiles: 'admin.rates.freeRadius',
  centsPerMile: 'admin.rates.perMile',
};

const dolares = (cents: number): string => (cents / 100).toFixed(2);
/*
 * UN CAMPO VACIO DA NaN, NO CERO, y es deliberado. Si diera cero, borrar un
 * precio y guardar dejaria ese servicio a cero sin que nadie lo escribiera.
 * `todoSonNumeros` convierte ese NaN en un aviso.
 */
const aCentavos = (valor: string): number => Math.round(Number.parseFloat(valor) * 100);
const entero = (valor: string): number => Number.parseInt(valor, 10);

/**
 * TARIFAS
 * -------
 * LA PANTALLA MAS PELIGROSA DEL PANEL, y no porque pueda romper nada: es
 * peligrosa justamente porque NO rompe nada. Un cero de mas en un precio
 * cotiza, cobra y factura con total normalidad. No hay pantalla roja.
 *
 * COMO SE LEE EL MODELO. Cada servicio tiene una tarifa POR CADENCIA, y en
 * cada una manda el mayor de dos numeros: un importe plano y, si el servicio
 * mira el tamano de la casa, un precio por pie cuadrado. La limpieza
 * estandar no lo mira —es el precio que se dice por telefono sin preguntar
 * nada— y la profunda y la de mudanza si.
 *
 * Desmarcar una cadencia significa QUE NO SE OFRECE ASI, que no es lo mismo
 * que ponerla cara: una limpieza profunda no se contrata cada semana porque
 * la casa ya esta profunda, y el cotizador responde distinto a cada cosa.
 *
 * Tres decisiones de forma:
 *
 *   1. TODO EN DOLARES, salvo el precio por pie cuadrado y el de la milla.
 *      Nadie piensa en centavos al fijar un precio, y un cero de mas en un
 *      campo de centavos es un precio diez veces mayor que nadie revisa.
 *      Esos dos son la excepcion porque el sector SI piensa en centavos
 *      ahi —«treinta centavos el pie»— y en dolares saldria 0,30.
 *
 *   2. SE VALIDA AQUI CON EL MISMO ESQUEMA QUE EL SERVIDOR, para que el
 *      error salga antes de guardar y diga cual de las reglas se ha roto.
 *
 *   3. SE DICE QUE LO YA RESERVADO NO CAMBIA. Es la primera pregunta que
 *      hace cualquiera antes de tocar un precio.
 */
export function PricingRatesForm({ locale, onSessionLost }: PricingRatesFormProps) {
  const { t } = useTranslation();
  const toast = useToast();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [meta, setMeta] = useState<{
    version: string;
    updatedAt: string | null;
    updatedBy: string | null;
    versionCount: number;
  } | null>(null);

  const perdioSesion = onSessionLost;

  const asentar = useCallback((rates: PricingRates) => {
    const services = {} as Borrador['services'];
    for (const tipo of EDITABLE_SERVICE_TYPES) {
      const porCadencia = {} as Record<Frequency, CamposTarifa>;
      for (const cadencia of CADENCIAS) {
        const tarifa = rates.services[tipo]?.[cadencia] ?? null;
        porCadencia[cadencia] = {
          offered: tarifa !== null,
          flat: tarifa === null ? '' : dolares(tarifa.flatCents),
          sqft: tarifa?.centsPerSquareFoot === null ? '' : String(tarifa?.centsPerSquareFoot ?? ''),
        };
      }
      services[tipo] = porCadencia;
    }

    const addOns = {} as Borrador['addOns'];
    for (const codigo of OFFERED_ADD_ON_CODES) {
      addOns[codigo] = {
        amount: dolares(rates.addOns[codigo]?.unitAmountCents ?? 0),
        max: String(rates.addOns[codigo]?.maxQuantity ?? 1),
      };
    }

    setBorrador({
      services,
      addOns,
      deposit: dolares(rates.depositCents),
      travel: {
        freeMiles: String(rates.travel.freeRadiusMiles),
        centsPerMile: rates.travel.centsPerMile === null ? '' : String(rates.travel.centsPerMile),
        roundTrip: rates.travel.roundTrip,
      },
    });
  }, []);

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorKey(null);

    try {
      const datos = await fetchPricingRates();
      asentar(datos.rates);
      setMeta({
        version: datos.version,
        updatedAt: datos.updatedAt,
        updatedBy: datos.updatedBy,
        versionCount: datos.versionCount,
      });
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
  }, [asentar, perdioSesion]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  /** Recorre el objeto entero buscando un numero que no lo es. */
  const todoSonNumeros = (valor: unknown): boolean => {
    if (typeof valor === 'number') return Number.isFinite(valor);
    if (typeof valor !== 'object' || valor === null) return true;
    return Object.values(valor).every((v) => todoSonNumeros(v));
  };

  /**
   * El fallo del esquema, en el idioma de quien mira.
   *
   * NO SE ENSENA EL MENSAJE DE ZOD TAL CUAL: sus textos son tecnicos y van
   * siempre en ingles («Too big: expected number to be <=1000000»). Las
   * reglas del conjunto llevan clave de traduccion en el contrato; el resto
   * son numeros fuera de rango, y de esos lo util es QUE CAMPO revisar.
   */
  const mensajeDe = (fallo: { message: string; path: PropertyKey[] }): string => {
    if (fallo.message.startsWith('admin.rates.')) return t(fallo.message);

    const ultimo = String(fallo.path.at(-1) ?? '');
    const campo = ETIQUETA_CAMPO[ultimo];
    return t('admin.rates.outOfRange', { field: campo === undefined ? ultimo : t(campo) });
  };

  /** Lo tecleado, en la forma del contrato. `null` si hay algo que no es un numero. */
  const aContrato = (): PricingRates | null => {
    if (!borrador) return null;

    const services = {} as PricingRates['services'];
    for (const tipo of EDITABLE_SERVICE_TYPES) {
      const porCadencia = {} as PricingRates['services'][ServicioEditable];
      for (const cadencia of CADENCIAS) {
        const campos = borrador.services[tipo][cadencia];
        porCadencia[cadencia] = !campos.offered
          ? null
          : {
              flatCents: aCentavos(campos.flat),
              /*
               * Vacio significa «este servicio no mira el tamano», que es
               * `null` y no cero: con cero el maximo lo ganaria siempre el
               * importe plano y daria igual, pero el dia que alguien mire la
               * tabla vería un precio por pie que no existe.
               */
              centsPerSquareFoot: campos.sqft.trim() === '' ? null : Number.parseFloat(campos.sqft),
            };
      }
      services[tipo] = porCadencia;
    }

    const addOns = {} as PricingRates['addOns'];
    for (const codigo of OFFERED_ADD_ON_CODES) {
      addOns[codigo] = {
        unitAmountCents: aCentavos(borrador.addOns[codigo].amount),
        maxQuantity: entero(borrador.addOns[codigo].max),
      };
    }

    const candidato: PricingRates = {
      services,
      addOns,
      depositCents: aCentavos(borrador.deposit),
      travel: {
        freeRadiusMiles: entero(borrador.travel.freeMiles),
        roundTrip: borrador.travel.roundTrip,
        // Vacio = la tarifa vigente del IRS.
        centsPerMile:
          borrador.travel.centsPerMile.trim() === ''
            ? null
            : Number.parseFloat(borrador.travel.centsPerMile),
      },
    };

    return todoSonNumeros(candidato) ? candidato : null;
  };

  const enviar = async (evento: FormEvent): Promise<void> => {
    evento.preventDefault();
    setProblema(null);

    const candidato = aContrato();
    const validado = candidato === null ? null : PricingRatesSchema.safeParse(candidato);

    if (!validado?.success) {
      const fallo = validado?.error.issues[0];
      setProblema(fallo === undefined ? t('admin.rates.invalidNumbers') : mensajeDe(fallo));
      return;
    }

    setGuardando(true);
    try {
      const datos = await savePricingRates(validado.data);
      asentar(datos.rates);
      setMeta({
        version: datos.version,
        updatedAt: datos.updatedAt,
        updatedBy: datos.updatedBy,
        versionCount: datos.versionCount,
      });
      toast.success('admin.rates.saved');
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

  const cambiarTarifa = (
    tipo: ServicioEditable,
    cadencia: Frequency,
    cambio: Partial<CamposTarifa>,
  ): void => {
    setBorrador((actual) =>
      actual === null
        ? actual
        : {
            ...actual,
            services: {
              ...actual.services,
              [tipo]: {
                ...actual.services[tipo],
                [cadencia]: { ...actual.services[tipo][cadencia], ...cambio },
              },
            },
          },
    );
  };

  return (
    <form className="space-y-6" onSubmit={(evento) => void enviar(evento)}>
      <header>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('admin.rates.title')}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('admin.rates.intro')}</p>
        <p
          className="mt-3 flex items-start gap-2 rounded-lg border border-sun-600/40 bg-sun-50 p-3
                     text-sm text-slate-800 dark:border-sun-300/30 dark:bg-night-700
                     dark:text-slate-200"
          role="note"
        >
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {t('admin.rates.onlyFuture')}
        </p>
      </header>

      {/* --- Tarifas por servicio y cadencia ---------------------------- */}
      <section className="ft-card space-y-4 p-4">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {t('admin.rates.services')}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t('admin.rates.servicesHelp')}
          </p>
        </div>

        <div className="space-y-4">
          {EDITABLE_SERVICE_TYPES.map((tipo) => (
            <fieldset
              key={tipo}
              className="rounded-lg border border-slate-200 p-3 dark:border-night-600"
            >
              <legend className="px-1 text-sm font-semibold text-brand-800 dark:text-brand-300">
                {t(`services.${tipo}.name`)}
              </legend>

              <div className="space-y-2">
                {CADENCIAS.map((cadencia) => {
                  const campos = borrador.services[tipo][cadencia];
                  return (
                    <div
                      key={cadencia}
                      className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-2
                                 first:border-0 first:pt-0 dark:border-night-700"
                    >
                      <label className="flex w-40 items-center gap-2 pb-2 text-sm text-slate-800 dark:text-slate-200">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={campos.offered}
                          onChange={(evento) =>
                            cambiarTarifa(tipo, cadencia, { offered: evento.target.checked })
                          }
                        />
                        {t(`frequency.${cadencia}`)}
                      </label>

                      {campos.offered ? (
                        <>
                          <label className="w-32">
                            <span className="ft-label">{t('admin.rates.flat')}</span>
                            <div className="relative">
                              <span
                                aria-hidden="true"
                                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-500 dark:text-slate-400"
                              >
                                $
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                className="ft-input w-full pl-7"
                                value={campos.flat}
                                onChange={(evento) =>
                                  cambiarTarifa(tipo, cadencia, { flat: evento.target.value })
                                }
                              />
                            </div>
                          </label>

                          <label className="w-32">
                            <span className="ft-label">{t('admin.rates.perSquareFoot')}</span>
                            <div className="relative">
                              <span
                                aria-hidden="true"
                                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-500 dark:text-slate-400"
                              >
                                ¢
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                className="ft-input w-full pl-7"
                                placeholder={t('admin.rates.noSize')}
                                value={campos.sqft}
                                onChange={(evento) =>
                                  cambiarTarifa(tipo, cadencia, { sqft: evento.target.value })
                                }
                              />
                            </div>
                          </label>
                        </>
                      ) : (
                        <p className="pb-2 text-sm text-slate-500 dark:text-slate-400">
                          {t('admin.rates.notOffered')}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      {/* --- Extras ------------------------------------------------------ */}
      <section className="ft-card space-y-4 p-4">
        <h3 className="font-semibold text-slate-900 dark:text-white">{t('admin.rates.addOns')}</h3>

        <div className="grid gap-3 sm:grid-cols-2">
          {OFFERED_ADD_ON_CODES.map((codigo) => (
            <div
              key={codigo}
              className="flex items-end gap-3 rounded-lg border border-slate-200 p-3 dark:border-night-600"
            >
              <span className="flex-1 text-sm text-slate-800 dark:text-slate-200">
                {t(`addOns.${codigo}`)}
              </span>
              <label className="w-24">
                <span className="ft-label">{t('admin.rates.amount')}</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="ft-input w-full"
                  value={borrador.addOns[codigo].amount}
                  onChange={(evento) =>
                    setBorrador((actual) =>
                      actual === null
                        ? actual
                        : {
                            ...actual,
                            addOns: {
                              ...actual.addOns,
                              [codigo]: { ...actual.addOns[codigo], amount: evento.target.value },
                            },
                          },
                    )
                  }
                />
              </label>
              <label className="w-20">
                <span className="ft-label">{t('admin.rates.maxQuantity')}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="ft-input w-full"
                  value={borrador.addOns[codigo].max}
                  onChange={(evento) =>
                    setBorrador((actual) =>
                      actual === null
                        ? actual
                        : {
                            ...actual,
                            addOns: {
                              ...actual.addOns,
                              [codigo]: { ...actual.addOns[codigo], max: evento.target.value },
                            },
                          },
                    )
                  }
                />
              </label>
            </div>
          ))}
        </div>
      </section>

      {/* --- Deposito y traslado ------------------------------------------ */}
      <section className="ft-card space-y-4 p-4">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {t('admin.rates.depositAndTravel')}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t('admin.rates.depositHelp')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="ft-label">{t('admin.rates.deposit')}</span>
            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-500 dark:text-slate-400"
              >
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                className="ft-input w-full pl-7"
                value={borrador.deposit}
                onChange={(evento) =>
                  setBorrador((actual) =>
                    actual === null ? actual : { ...actual, deposit: evento.target.value },
                  )
                }
              />
            </div>
          </label>

          <label className="block">
            <span className="ft-label">{t('admin.rates.freeRadius')}</span>
            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-500 dark:text-slate-400"
              >
                mi
              </span>
              <input
                type="text"
                inputMode="numeric"
                className="ft-input w-full pl-9"
                value={borrador.travel.freeMiles}
                onChange={(evento) =>
                  setBorrador((actual) =>
                    actual === null
                      ? actual
                      : { ...actual, travel: { ...actual.travel, freeMiles: evento.target.value } },
                  )
                }
              />
            </div>
          </label>

          <label className="block">
            <span className="ft-label">{t('admin.rates.perMile')}</span>
            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-500 dark:text-slate-400"
              >
                ¢
              </span>
              <input
                type="text"
                inputMode="decimal"
                className="ft-input w-full pl-7"
                placeholder={t('admin.rates.irsRate')}
                value={borrador.travel.centsPerMile}
                onChange={(evento) =>
                  setBorrador((actual) =>
                    actual === null
                      ? actual
                      : {
                          ...actual,
                          travel: { ...actual.travel, centsPerMile: evento.target.value },
                        },
                  )
                }
              />
            </div>
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={borrador.travel.roundTrip}
            onChange={(evento) =>
              setBorrador((actual) =>
                actual === null
                  ? actual
                  : { ...actual, travel: { ...actual.travel, roundTrip: evento.target.checked } },
              )
            }
          />
          {t('admin.rates.roundTrip')}
        </label>
      </section>

      {problema !== null && (
        <p className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300" role="alert">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {problema}
        </p>
      )}

      {errorKey !== null && (
        <p className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300" role="alert">
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {t(errorKey)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="ft-btn-primary" disabled={guardando}>
          {guardando && <SpinnerIcon className="h-4 w-4" />}
          {guardando ? t('admin.settings.saving') : t('admin.rates.save')}
        </button>

        {meta !== null && (
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {t('admin.rates.currentVersion', { version: meta.version, count: meta.versionCount })}
            {meta.updatedAt !== null && meta.updatedBy !== null && (
              <>
                {' · '}
                {t('admin.settings.lastChange', {
                  who: meta.updatedBy,
                  when: formatTimestamp(meta.updatedAt, locale),
                })}
              </>
            )}
          </p>
        )}
      </div>
    </form>
  );
}
