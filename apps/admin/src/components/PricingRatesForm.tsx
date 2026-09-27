import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EDITABLE_SERVICE_TYPES,
  PricingRatesSchema,
  type AddOnCode,
  type EditableServiceType,
  type Locale,
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

/**
 * Lo que hay escrito en los campos. Todo cadenas: vienen de inputs, y un
 * campo a medio escribir («12.») no es un numero todavia.
 */
interface CamposServicio {
  base: string;
  bedroom: string;
  bathroom: string;
  /** En centavos, no en dolares: ver la cabecera del componente. */
  sqft: string;
  minimum: string;
}

type ClaveServicio = keyof CamposServicio;

type Borrador = {
  services: Record<EditableServiceType, CamposServicio>;
  addOns: Record<AddOnCode, { amount: string; max: string }>;
  discounts: { weekly: string; biweekly: string; monthly: string };
  deposit: { base: string; freeMiles: string; roundTrip: boolean; min: string; max: string };
};

const CODIGOS_EXTRA: AddOnCode[] = [
  'INSIDE_FRIDGE',
  'INSIDE_OVEN',
  'INSIDE_CABINETS',
  'INTERIOR_WINDOWS',
  'LAUNDRY',
  'BASEMENT',
  'GARAGE',
  'PET_HAIR',
  'PATIO',
  'BED_LINENS',
];

/** El nombre de cada campo, para poder decir CUAL revisar. */
const ETIQUETA_CAMPO: Record<string, string> = {
  baseCents: 'admin.rates.base',
  perBedroomCents: 'admin.rates.perBedroom',
  perBathroomCents: 'admin.rates.perBathroom',
  centsPerSquareFoot: 'admin.rates.perSquareFoot',
  minimumCents: 'admin.rates.minimum',
  unitAmountCents: 'admin.rates.amount',
  maxQuantity: 'admin.rates.maxQuantity',
  weeklyPercent: 'frequency.WEEKLY',
  biweeklyPercent: 'frequency.BIWEEKLY',
  monthlyPercent: 'frequency.MONTHLY',
  freeRadiusMiles: 'admin.rates.freeRadius',
  minCents: 'admin.rates.depositMin',
  maxCents: 'admin.rates.depositMax',
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
 * De ahi las tres decisiones que la gobiernan:
 *
 *   1. TODO EN DOLARES, no en centavos, salvo el precio por pie cuadrado.
 *      Nadie piensa en centavos al fijar un precio, y un cero de mas en un
 *      campo de centavos es un precio diez veces mayor que nadie revisa. El
 *      pie cuadrado es la excepcion porque el sector SI piensa en centavos
 *      ahi —«cobramos tres centavos el pie»— y en dolares saldria 0,03.
 *
 *   2. SE VALIDA AQUI CON EL MISMO ESQUEMA QUE EL SERVIDOR. No por
 *      desconfiar de el —vuelve a validar igual— sino para que el error
 *      salga antes de guardar y diga cual de las reglas se ha roto.
 *
 *   3. SE DICE QUE LO YA RESERVADO NO CAMBIA. Es la primera pregunta que
 *      hace cualquiera antes de tocar un precio, y no responderla en la
 *      pantalla lleva a no tocarlo o a llamar por telefono.
 *
 * Lo que NO se puede editar desde aqui —el servicio comercial, si un extra
 * es plano o por unidad, las duraciones, los limites y el impuesto— esta
 * razonado en `packages/types/src/pricing-rates.ts`.
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
    /*
     * Se rellenan con bucles y no con `Object.fromEntries`: esa devuelve un
     * indice abierto que hay que forzar con un `as`, y forzarlo es
     * exactamente lo que deja pasar un servicio olvidado el dia que se
     * anada uno nuevo.
     */
    const services = {} as Borrador['services'];
    for (const tipo of EDITABLE_SERVICE_TYPES) {
      const tarifa = rates.services[tipo];
      services[tipo] = {
        base: dolares(tarifa.baseCents),
        bedroom: dolares(tarifa.perBedroomCents),
        bathroom: dolares(tarifa.perBathroomCents),
        sqft: String(tarifa.centsPerSquareFoot),
        minimum: dolares(tarifa.minimumCents),
      };
    }

    const addOns = {} as Borrador['addOns'];
    for (const codigo of CODIGOS_EXTRA) {
      addOns[codigo] = {
        amount: dolares(rates.addOns[codigo]?.unitAmountCents ?? 0),
        max: String(rates.addOns[codigo]?.maxQuantity ?? 1),
      };
    }

    setBorrador({
      services,
      addOns,
      discounts: {
        weekly: String(rates.frequencyDiscounts.weeklyPercent),
        biweekly: String(rates.frequencyDiscounts.biweeklyPercent),
        monthly: String(rates.frequencyDiscounts.monthlyPercent),
      },
      deposit: {
        base: dolares(rates.deposit.baseCents),
        freeMiles: String(rates.deposit.freeRadiusMiles),
        roundTrip: rates.deposit.roundTrip,
        min: dolares(rates.deposit.minCents),
        max: dolares(rates.deposit.maxCents),
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

  /** Lo tecleado, en la forma del contrato. `null` si hay algo que no es un numero. */
  const aContrato = (): PricingRates | null => {
    if (!borrador) return null;

    const services = {} as PricingRates['services'];
    for (const tipo of EDITABLE_SERVICE_TYPES) {
      const campos = borrador.services[tipo];
      services[tipo] = {
        baseCents: aCentavos(campos.base),
        perBedroomCents: aCentavos(campos.bedroom),
        perBathroomCents: aCentavos(campos.bathroom),
        centsPerSquareFoot: Number.parseFloat(campos.sqft || ''),
        minimumCents: aCentavos(campos.minimum),
      };
    }

    const addOns = {} as PricingRates['addOns'];
    for (const codigo of CODIGOS_EXTRA) {
      addOns[codigo] = {
        unitAmountCents: aCentavos(borrador.addOns[codigo].amount),
        maxQuantity: entero(borrador.addOns[codigo].max),
      };
    }

    const candidato: PricingRates = {
      services,
      addOns,
      frequencyDiscounts: {
        weeklyPercent: entero(borrador.discounts.weekly),
        biweeklyPercent: entero(borrador.discounts.biweekly),
        monthlyPercent: entero(borrador.discounts.monthly),
      },
      deposit: {
        baseCents: aCentavos(borrador.deposit.base),
        freeRadiusMiles: entero(borrador.deposit.freeMiles),
        roundTrip: borrador.deposit.roundTrip,
        minCents: aCentavos(borrador.deposit.min),
        maxCents: aCentavos(borrador.deposit.max),
      },
    };

    /*
     * UN CAMPO A MEDIO ESCRIBIR ES NaN, NO CERO, y aqui esta la diferencia
     * entre avisar y estropear: si un NaN se colara como cero, guardar
     * dejaria un precio en cero que nadie escribio y el cotizador empezaria
     * a regalar limpiezas. El esquema no lo atrapa —`z.number()` acepta
     * NaN— asi que se comprueba a mano.
     */
    return todoSonNumeros(candidato) ? candidato : null;
  };

  /**
   * El fallo del esquema, en el idioma de quien mira.
   *
   * NO SE ENSEÑA EL MENSAJE DE ZOD TAL CUAL. Sus textos son tecnicos y van
   * siempre en ingles («Too big: expected number to be <=1000000»), asi que
   * en un panel en español apareceria en ingles y sin decir que campo es.
   *
   * Las reglas del conjunto —las que escribimos nosotros— llevan clave de
   * traduccion en el propio contrato y se traducen tal cual. El resto son
   * numeros fuera de rango, y de esos lo util no es el limite exacto sino
   * QUE CAMPO revisar: casi siempre sobra un cero.
   */
  const mensajeDe = (fallo: { message: string; path: PropertyKey[] }): string => {
    if (fallo.message.startsWith('admin.rates.')) return t(fallo.message);

    const ultimo = String(fallo.path.at(-1) ?? '');
    const campo = ETIQUETA_CAMPO[ultimo];
    return t('admin.rates.outOfRange', {
      field: campo === undefined ? ultimo : t(campo),
    });
  };

  /** Recorre el objeto entero buscando un numero que no lo es. */
  const todoSonNumeros = (valor: unknown): boolean => {
    if (typeof valor === 'number') return Number.isFinite(valor);
    if (typeof valor !== 'object' || valor === null) return true;
    return Object.values(valor).every((v) => todoSonNumeros(v));
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

  const campoServicio = (tipo: EditableServiceType, clave: ClaveServicio, valor: string): void => {
    setBorrador((actual) =>
      actual === null
        ? actual
        : {
            ...actual,
            services: {
              ...actual.services,
              [tipo]: { ...actual.services[tipo], [clave]: valor },
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
        {/*
          LO YA RESERVADO NO CAMBIA. Es la primera pregunta que hace
          cualquiera antes de tocar un precio, y no responderla en la
          pantalla lleva a no tocarlo o a llamar por telefono.
        */}
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

      {/* --- Servicios ------------------------------------------------- */}
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

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {(
                  [
                    ['base', 'admin.rates.base', '$'],
                    ['bedroom', 'admin.rates.perBedroom', '$'],
                    ['bathroom', 'admin.rates.perBathroom', '$'],
                    ['sqft', 'admin.rates.perSquareFoot', '¢'],
                    ['minimum', 'admin.rates.minimum', '$'],
                  ] as const
                ).map(([clave, etiqueta, unidad]) => (
                  <label key={clave} className="block">
                    <span className="ft-label">{t(etiqueta)}</span>
                    <div className="relative">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-500 dark:text-slate-400"
                      >
                        {unidad}
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="ft-input w-full pl-7"
                        value={borrador.services[tipo][clave]}
                        onChange={(evento) => campoServicio(tipo, clave, evento.target.value)}
                      />
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      {/* --- Extras ------------------------------------------------------ */}
      <section className="ft-card space-y-4 p-4">
        <h3 className="font-semibold text-slate-900 dark:text-white">{t('admin.rates.addOns')}</h3>

        <div className="grid gap-3 sm:grid-cols-2">
          {CODIGOS_EXTRA.map((codigo) => (
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

      {/* --- Descuentos por recurrencia ---------------------------------- */}
      <section className="ft-card space-y-4 p-4">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {t('admin.rates.discounts')}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t('admin.rates.discountsHelp')}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ['weekly', 'frequency.WEEKLY'],
              ['biweekly', 'frequency.BIWEEKLY'],
              ['monthly', 'frequency.MONTHLY'],
            ] as const
          ).map(([clave, etiqueta]) => (
            <label key={clave} className="block">
              <span className="ft-label">{t(etiqueta)}</span>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  className="ft-input w-full pr-7"
                  value={borrador.discounts[clave]}
                  onChange={(evento) =>
                    setBorrador((actual) =>
                      actual === null
                        ? actual
                        : {
                            ...actual,
                            discounts: { ...actual.discounts, [clave]: evento.target.value },
                          },
                    )
                  }
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-slate-500 dark:text-slate-400"
                >
                  %
                </span>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* --- Deposito ----------------------------------------------------- */}
      <section className="ft-card space-y-4 p-4">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {t('admin.rates.deposit')}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t('admin.rates.depositHelp')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ['base', 'admin.rates.depositBase', '$'],
              ['freeMiles', 'admin.rates.freeRadius', 'mi'],
              ['min', 'admin.rates.depositMin', '$'],
              ['max', 'admin.rates.depositMax', '$'],
            ] as const
          ).map(([clave, etiqueta, unidad]) => (
            <label key={clave} className="block">
              <span className="ft-label">{t(etiqueta)}</span>
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-slate-500 dark:text-slate-400"
                >
                  {unidad}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="ft-input w-full pl-9"
                  value={borrador.deposit[clave]}
                  onChange={(evento) =>
                    setBorrador((actual) =>
                      actual === null
                        ? actual
                        : {
                            ...actual,
                            deposit: { ...actual.deposit, [clave]: evento.target.value },
                          },
                    )
                  }
                />
              </div>
            </label>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={borrador.deposit.roundTrip}
            onChange={(evento) =>
              setBorrador((actual) =>
                actual === null
                  ? actual
                  : {
                      ...actual,
                      deposit: { ...actual.deposit, roundTrip: evento.target.checked },
                    },
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
            {t('admin.rates.currentVersion', {
              version: meta.version,
              count: meta.versionCount,
            })}
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
