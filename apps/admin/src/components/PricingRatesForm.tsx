import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  OFFERED_ADD_ON_CODES,
  PricingRatesSchema,
  type Locale,
  type OfferedAddOnCode,
  type PricingRates,
} from '@freshness/types';
import { ApiClientError, fetchPricingRates, savePricingRates } from '../lib/api';
import { useToast } from './ToastProvider';
import { SkeletonFormulario } from './Skeletons';
import { AlertIcon, CloseIcon, SpinnerIcon } from './Icons';
import { formatTimestamp } from '../lib/format';

interface PricingRatesFormProps {
  locale: Locale;
  onSessionLost: (reason?: 'expired' | 'noAccess') => void;
}

/**
 * Las columnas de la tabla, en el orden en que se leen. Es el mismo que el de
 * la hoja de calculo del cliente, a proposito: quien mantiene los precios
 * compara las dos pantallas lado a lado.
 */
const COLUMNAS = [
  { campo: 'deep', etiqueta: 'admin.rates.bands.deep' },
  { campo: 'monthly', etiqueta: 'admin.rates.bands.monthly' },
  { campo: 'biweekly', etiqueta: 'admin.rates.bands.biweekly' },
  { campo: 'weekly', etiqueta: 'admin.rates.bands.weekly' },
  { campo: 'windows', etiqueta: 'admin.rates.bands.windows' },
] as const;

type ColumnaTramo = (typeof COLUMNAS)[number]['campo'];

/**
 * Una fila de la tabla, tal y como esta escrita en los campos.
 *
 * TODO CADENAS: vienen de inputs, y un campo a medio escribir («12.») no es
 * un numero todavia.
 */
type FilaTramo = { maxSquareFeet: string } & Record<ColumnaTramo, string>;

interface Borrador {
  /** La tabla de precios por tamano. Una fila por tramo. */
  bands: FilaTramo[];
  addOns: Record<OfferedAddOnCode, { amount: string; max: string }>;
  deposit: string;
  travel: { freeMiles: string; centsPerMile: string; roundTrip: boolean };
}

/** El nombre de cada campo, para poder decir CUAL revisar. */
const ETIQUETA_CAMPO: Record<string, string> = {
  maxSquareFeet: 'admin.rates.bands.upTo',
  deepCents: 'admin.rates.bands.deep',
  standardMonthlyCents: 'admin.rates.bands.monthly',
  standardBiweeklyCents: 'admin.rates.bands.biweekly',
  standardWeeklyCents: 'admin.rates.bands.weekly',
  windowsAndCabinetsCents: 'admin.rates.bands.windows',
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
    const bands: FilaTramo[] = rates.sizeBands.map((banda) => ({
      maxSquareFeet: String(banda.maxSquareFeet),
      deep: dolares(banda.deepCents),
      monthly: dolares(banda.standardMonthlyCents),
      biweekly: dolares(banda.standardBiweeklyCents),
      weekly: dolares(banda.standardWeeklyCents),
      windows: dolares(banda.windowsAndCabinetsCents),
    }));

    const addOns = {} as Borrador['addOns'];
    for (const codigo of OFFERED_ADD_ON_CODES) {
      addOns[codigo] = {
        amount: dolares(rates.addOns[codigo]?.unitAmountCents ?? 0),
        max: String(rates.addOns[codigo]?.maxQuantity ?? 1),
      };
    }

    setBorrador({
      bands,
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

    const sizeBands = borrador.bands.map((fila) => ({
      maxSquareFeet: entero(fila.maxSquareFeet),
      deepCents: aCentavos(fila.deep),
      standardMonthlyCents: aCentavos(fila.monthly),
      standardBiweeklyCents: aCentavos(fila.biweekly),
      standardWeeklyCents: aCentavos(fila.weekly),
      windowsAndCabinetsCents: aCentavos(fila.windows),
    }));

    const addOns = {} as PricingRates['addOns'];
    for (const codigo of OFFERED_ADD_ON_CODES) {
      addOns[codigo] = {
        unitAmountCents: aCentavos(borrador.addOns[codigo].amount),
        maxQuantity: entero(borrador.addOns[codigo].max),
      };
    }

    const candidato: PricingRates = {
      sizeBands,
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

  const cambiarTramo = (indice: number, cambio: Partial<FilaTramo>): void => {
    setBorrador((actual) =>
      actual === null
        ? actual
        : {
            ...actual,
            bands: actual.bands.map((fila, i) => (i === indice ? { ...fila, ...cambio } : fila)),
          },
    );
  };

  const quitarTramo = (indice: number): void => {
    setBorrador((actual) =>
      actual === null ? actual : { ...actual, bands: actual.bands.filter((_, i) => i !== indice) },
    );
  };

  /**
   * Un tramo nuevo al final, copiando los precios del ultimo.
   *
   * COPIAR Y NO DEJAR EN BLANCO: una tabla de precios crece por el final y
   * cada tramo se parece al anterior. Partir de ceros obliga a teclear seis
   * numeros donde normalmente se cambian dos, y un cero olvidado es una
   * limpieza gratis que nadie ve.
   *
   * El tope si sube, porque dos tramos con el mismo tope no se pueden
   * guardar: el contrato lo rechaza, y mejor que salga ya distinto.
   */
  const anadirTramo = (): void => {
    setBorrador((actual) => {
      if (actual === null) return actual;

      const ultima = actual.bands.at(-1);
      const nueva: FilaTramo = ultima
        ? { ...ultima, maxSquareFeet: String((entero(ultima.maxSquareFeet) || 0) + 100) }
        : {
            maxSquareFeet: '1000',
            deep: '0.00',
            monthly: '0.00',
            biweekly: '0.00',
            weekly: '0.00',
            windows: '0.00',
          };

      return { ...actual, bands: [...actual.bands, nueva] };
    });
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
            {t('admin.rates.bands.title')}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t('admin.rates.bands.help')}
          </p>
        </div>

        {/*
          UNA TABLA, CON LA MISMA FORMA QUE LA HOJA DEL CLIENTE.
          Quien mantiene los precios tiene su hoja de calculo abierta al lado:
          si aqui las columnas estuvieran en otro orden o con otros nombres,
          copiar veintiseis filas seria una invitacion a equivocarse de celda.

          EL DESBORDE HORIZONTAL ES DELIBERADO. Son seis columnas de numeros y
          no caben en un movil; apilarlas en tarjetas haria imposible
          comparar una fila con la de arriba, que es justo como se revisa una
          tabla de precios.
        */}
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-night-600">
                <th scope="col" className="ft-label py-2 pr-3 text-left">
                  {t('admin.rates.bands.upTo')}
                </th>
                {COLUMNAS.map((columna) => (
                  <th key={columna.campo} scope="col" className="ft-label px-2 py-2 text-right">
                    {t(columna.etiqueta)}
                  </th>
                ))}
                <th scope="col" className="w-10 py-2">
                  <span className="sr-only">{t('admin.rates.bands.remove')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {borrador.bands.map((fila, indice) => (
                <tr
                  // El indice como clave, y aqui si es correcto: las filas no
                  // tienen identidad propia —son posiciones de una tabla
                  // ordenada— y lo que las define, el tope, es justo lo que
                  // se esta editando.
                  key={indice}
                  className="border-b border-slate-100 last:border-0 dark:border-night-700"
                >
                  <td className="py-1.5 pr-3">
                    <label>
                      <span className="sr-only">{t('admin.rates.bands.upTo')}</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="ft-input w-24"
                        value={fila.maxSquareFeet}
                        onChange={(evento) =>
                          cambiarTramo(indice, { maxSquareFeet: evento.target.value })
                        }
                      />
                    </label>
                  </td>

                  {COLUMNAS.map((columna) => (
                    <td key={columna.campo} className="px-2 py-1.5">
                      <label className="relative block">
                        <span className="sr-only">{t(columna.etiqueta)}</span>
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2
                                     text-sm text-slate-500 dark:text-slate-400"
                        >
                          $
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="ft-input w-24 pl-6 text-right"
                          value={fila[columna.campo]}
                          onChange={(evento) =>
                            cambiarTramo(indice, { [columna.campo]: evento.target.value })
                          }
                        />
                      </label>
                    </td>
                  ))}

                  <td className="py-1.5 text-right">
                    <button
                      type="button"
                      className="ft-btn-icon"
                      onClick={() => quitarTramo(indice)}
                      aria-label={`${t('admin.rates.bands.remove')} ${fila.maxSquareFeet}`}
                    >
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button type="button" className="ft-btn-ghost" onClick={anadirTramo}>
          {t('admin.rates.bands.add')}
        </button>
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
