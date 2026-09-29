import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SITE_COPY_KEYS,
  SITE_COPY_LONG_MAX,
  SITE_COPY_SHORT_KEYS,
  SITE_COPY_SHORT_MAX,
  SiteCopySchema,
  incompleteSiteCopyKeys,
  siteCopyGroup,
  type Locale,
  type SiteCopy,
  type SiteCopyKey,
  type SiteCopyLocale,
} from '@freshness/types';
import { ApiClientError, fetchSiteCopy, saveSiteCopy } from '../lib/api';
import { useToast } from './ToastProvider';
import { SkeletonFormulario } from './Skeletons';
import { AlertIcon, SpinnerIcon } from './Icons';
import { formatTimestamp } from '../lib/format';

interface SiteCopyFormProps {
  locale: Locale;
  onSessionLost: (reason?: 'expired' | 'noAccess') => void;
}

/**
 * Lo que hay escrito en los campos.
 *
 * Cadenas y nunca `null`, porque vienen de inputs: un input vacio da `''`.
 * La conversion a `null` —«sin configurar»— se hace UNA vez, al guardar. Si
 * el borrador guardara `null`, habria que decidir en cada tecla si lo
 * escrito cuenta como vacio, y esa decision repartida es como se cuelan las
 * cadenas vacias en la base.
 */
type Borrador = Record<SiteCopyKey, { en: string; es: string }>;

const CORTAS = new Set<SiteCopyKey>(SITE_COPY_SHORT_KEYS);

/**
 * Un bloque es UNA promesa o UNA pregunta: su titulo y su cuerpo juntos.
 *
 * La pantalla se organiza asi y no clave por clave porque nadie piensa en
 * «whyUs.insured.title»: piensa en «la promesa del seguro». Sueltos, los
 * veinte campos son una lista de cajas sin decir a que pertenece cada una.
 */
interface Bloque {
  /** La clave corta: el titulo de la promesa o el enunciado de la pregunta. */
  encabezado: SiteCopyKey;
  /** La clave larga: el cuerpo de la tarjeta o la respuesta. */
  cuerpo: SiteCopyKey;
}

/**
 * Arma los bloques emparejando cada clave corta con la larga de su mismo
 * item. Se deriva del contrato en vez de escribirse a mano: una lista
 * paralela seria otra cosa que mantener sincronizada.
 */
function bloques(grupo: 'whyUs' | 'faq'): Bloque[] {
  const delGrupo = SITE_COPY_KEYS.filter((key) => siteCopyGroup(key) === grupo);
  const cortas = delGrupo.filter((key) => CORTAS.has(key));

  return cortas.map((encabezado) => {
    const item = encabezado.slice(0, encabezado.lastIndexOf('.'));
    const cuerpo = delGrupo.find((key) => key.startsWith(`${item}.`) && !CORTAS.has(key));
    // El contrato empareja cada clave corta con una larga; si eso cambiara,
    // es mejor enterarse aqui que pintar media pantalla.
    if (cuerpo === undefined) throw new Error(`La clave ${encabezado} no tiene cuerpo`);
    return { encabezado, cuerpo };
  });
}

function borradorVacio(): Borrador {
  return Object.fromEntries(SITE_COPY_KEYS.map((key) => [key, { en: '', es: '' }])) as Borrador;
}

function aBorrador(copy: SiteCopy): Borrador {
  const borrador = borradorVacio();
  for (const key of SITE_COPY_KEYS) {
    borrador[key] = { en: copy[key]?.en ?? '', es: copy[key]?.es ?? '' };
  }
  return borrador;
}

/** Del borrador al contrato: lo vacio pasa a `null`, y lo vacio del todo se cae. */
function aContrato(borrador: Borrador): SiteCopy {
  const copy: SiteCopy = {};

  for (const key of SITE_COPY_KEYS) {
    const en = borrador[key].en.trim();
    const es = borrador[key].es.trim();
    if (en !== '' || es !== '') {
      copy[key] = { en: en === '' ? null : en, es: es === '' ? null : es };
    }
  }

  return copy;
}

/**
 * LOS TEXTOS DE LA WEB
 * --------------------
 * Aqui no se configuran ajustes: SE REDACTAN COMPROMISOS. «Estamos
 * asegurados», «todo el equipo pasa verificacion de antecedentes», «si no
 * quedas conforme volvemos en 24 horas». Lo que se escriba en esta pantalla
 * es lo que un cliente va a reclamar.
 *
 * De ahi las tres decisiones de la pantalla:
 *
 *   1. EL TEXTO ACTUAL SE VE SIEMPRE, encima de los campos. Nadie reescribe
 *      bien una promesa sin leer la que hay. Y como el campo vacio significa
 *      «deja el de siempre», sin ensenar cual es «de siempre» el campo vacio
 *      no diria nada.
 *
 *   2. LOS DOS IDIOMAS VAN JUNTOS, uno al lado del otro. Separarlos en dos
 *      pestanas es como se acaba escribiendo el ingles y olvidando el
 *      espanol.
 *
 *   3. SE AVISA DE LOS TEXTOS A MEDIAS, y el aviso esta arriba y en cada
 *      campo. Nadie deja una promesa a medias a proposito: se escribe la
 *      nueva en ingles, se deja el espanol para luego y se olvida. A partir
 *      de ese momento la web promete dos cosas distintas segun el idioma.
 */
export function SiteCopyForm({ locale, onSessionLost }: SiteCopyFormProps) {
  const { t, i18n } = useTranslation();
  const toast = useToast();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [guardado, setGuardado] = useState<SiteCopy | null>(null);
  const [meta, setMeta] = useState<{ updatedAt: string | null; updatedBy: string | null } | null>(
    null,
  );

  const perdioSesion = onSessionLost;

  /*
   * EL TEXTO DE REFERENCIA SALE DEL PROPIO DICCIONARIO DEL PANEL.
   *
   * La clave que se guarda es la misma que la de traduccion, asi que el
   * texto «de siempre» de cada idioma se pide con un traductor fijado a ese
   * idioma. No hace falta ninguna copia de los textos en esta pantalla, que
   * es justo la clase de copia que se queda desactualizada.
   */
  const enFijo = useMemo(() => i18n.getFixedT('en'), [i18n]);
  const esFijo = useMemo(() => i18n.getFixedT('es'), [i18n]);
  const original = useCallback(
    (key: SiteCopyKey, idioma: SiteCopyLocale): string =>
      idioma === 'en' ? enFijo(key) : esFijo(key),
    [enFijo, esFijo],
  );

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorKey(null);

    try {
      const datos = await fetchSiteCopy();
      setBorrador(aBorrador(datos.copy));
      setGuardado(datos.copy);
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
  }, [perdioSesion]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const enviar = async (evento: FormEvent): Promise<void> => {
    evento.preventDefault();
    setProblema(null);
    if (borrador === null) return;

    const candidato = aContrato(borrador);
    const validado = SiteCopySchema.safeParse(candidato);

    if (!validado.success) {
      /*
       * Los mensajes de Zod son tecnicos y van en ingles. Aqui basta con
       * senalar que hay campos mal: cada uno ya lleva su contador en rojo,
       * que dice exactamente por cuanto se pasa.
       */
      setProblema(t('admin.siteCopy.errInvalid'));
      return;
    }

    setGuardando(true);
    try {
      const datos = await saveSiteCopy(validado.data);
      setBorrador(aBorrador(datos.copy));
      setGuardado(datos.copy);
      setMeta({ updatedAt: datos.updatedAt, updatedBy: datos.updatedBy });
      toast.success('admin.siteCopy.saved');
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

  if (borrador === null) return null;

  const cambiar = (key: SiteCopyKey, idioma: SiteCopyLocale, valor: string): void => {
    setBorrador((actual) =>
      actual === null ? actual : { ...actual, [key]: { ...actual[key], [idioma]: valor } },
    );
    setProblema(null);
  };

  /*
   * El aviso se calcula sobre lo que hay ESCRITO, no sobre lo guardado: avisa
   * mientras se teclea, que es cuando aun se puede arreglar sin volver.
   */
  const aMedias = new Set(incompleteSiteCopyKeys(aContrato(borrador)));
  const sinCambios = guardado !== null && igual(aContrato(borrador), guardado);

  /*
   * LO QUE HAY PUBLICADO AHORA MISMO, que no es ni el borrador ni siempre el
   * texto del codigo: es lo ULTIMO GUARDADO si lo hay, y el del codigo si no.
   *
   * Mostrar el borrador aqui, como se hacia en la primera version, hacia que
   * la referencia desapareciera justo cuando sirve: al teclear. La etiqueta
   * decia «ahora en el sitio» y ensenaba lo que acababas de escribir.
   */
  const publicado = (key: SiteCopyKey, idioma: SiteCopyLocale): string =>
    guardado?.[key]?.[idioma] ?? original(key, idioma);

  return (
    <form className="space-y-6" onSubmit={(evento) => void enviar(evento)}>
      <header>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('admin.siteCopy.title')}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t('admin.siteCopy.intro')}
        </p>
        <p
          className="mt-3 flex items-start gap-2 rounded-lg border border-sun-600/40 bg-sun-50 p-3
                     text-sm text-slate-800 dark:border-sun-300/30 dark:bg-night-700
                     dark:text-slate-200"
          role="note"
        >
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {t('admin.siteCopy.onlyNew')}
        </p>

        {aMedias.size > 0 && (
          <p
            className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-50 p-3
                       text-sm text-red-800 dark:border-red-400/30 dark:bg-night-700
                       dark:text-red-200"
            role="alert"
          >
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong className="font-semibold">
                {t('admin.siteCopy.halfDone', { count: aMedias.size })}
              </strong>{' '}
              {t('admin.siteCopy.halfDoneHelp')}
            </span>
          </p>
        )}
      </header>

      <Grupo
        titulo={t('admin.siteCopy.promises')}
        ayuda={t('admin.siteCopy.promisesHelp')}
        bloques={bloques('whyUs')}
        borrador={borrador}
        publicado={publicado}
        aMedias={aMedias}
        onCambiar={cambiar}
      />

      <Grupo
        titulo={t('admin.siteCopy.faq')}
        ayuda={t('admin.siteCopy.faqHelp')}
        bloques={bloques('faq')}
        borrador={borrador}
        publicado={publicado}
        aMedias={aMedias}
        onCambiar={cambiar}
      />

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
        <button type="submit" className="ft-btn-primary" disabled={guardando || sinCambios}>
          {guardando && <SpinnerIcon className="h-4 w-4" />}
          {t('admin.siteCopy.save')}
        </button>
        {!sinCambios && (
          <button
            type="button"
            className="ft-btn-outline"
            onClick={() => {
              setBorrador(aBorrador(guardado ?? {}));
              setProblema(null);
            }}
            disabled={guardando}
          >
            {t('admin.siteCopy.reset')}
          </button>
        )}
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {meta?.updatedAt === null || meta === null
            ? t('admin.siteCopy.never')
            : meta.updatedBy === null
              ? t('admin.siteCopy.lastChangeUnknown', {
                  when: formatTimestamp(meta.updatedAt, locale),
                })
              : t('admin.siteCopy.lastChange', {
                  when: formatTimestamp(meta.updatedAt, locale),
                  who: meta.updatedBy,
                })}
        </p>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------------ */

function Grupo({
  titulo,
  ayuda,
  bloques: lista,
  borrador,
  publicado,
  aMedias,
  onCambiar,
}: {
  titulo: string;
  ayuda: string;
  bloques: Bloque[];
  borrador: Borrador;
  publicado: (key: SiteCopyKey, idioma: SiteCopyLocale) => string;
  aMedias: Set<SiteCopyKey>;
  onCambiar: (key: SiteCopyKey, idioma: SiteCopyLocale, valor: string) => void;
}) {
  return (
    <section className="ft-card space-y-5 p-4">
      <div>
        <h3 className="font-semibold text-slate-900 dark:text-white">{titulo}</h3>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{ayuda}</p>
      </div>

      {lista.map((bloque) => (
        <BloqueEditable
          key={bloque.encabezado}
          bloque={bloque}
          borrador={borrador}
          publicado={publicado}
          aMedias={aMedias}
          onCambiar={onCambiar}
        />
      ))}
    </section>
  );
}

function BloqueEditable({
  bloque,
  borrador,
  publicado,
  aMedias,
  onCambiar,
}: {
  bloque: Bloque;
  borrador: Borrador;
  publicado: (key: SiteCopyKey, idioma: SiteCopyLocale) => string;
  aMedias: Set<SiteCopyKey>;
  onCambiar: (key: SiteCopyKey, idioma: SiteCopyLocale, valor: string) => void;
}) {
  const { t } = useTranslation();
  const esPregunta = siteCopyGroup(bloque.encabezado) === 'faq';
  const roto = aMedias.has(bloque.encabezado) || aMedias.has(bloque.cuerpo);

  return (
    <article
      className={
        'space-y-4 rounded-lg border p-3 ' +
        (roto
          ? 'border-red-500/50 bg-red-50/50 dark:border-red-400/40 dark:bg-night-700/60'
          : 'border-slate-200 dark:border-night-600')
      }
    >
      {/*
        EL BLOQUE SE IDENTIFICA POR SU TITULO PUBLICADO EN INGLES.
        No hace falta inventar nombres para las cuatro promesas y las seis
        preguntas: el propio titulo dice de cual se trata, y ademas se
        actualiza solo si algun dia se reescribe.
      */}
      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
        {publicado(bloque.encabezado, 'en')}
      </h4>

      <Fila
        clave={bloque.encabezado}
        etiqueta={t(esPregunta ? 'admin.siteCopy.fieldQuestion' : 'admin.siteCopy.fieldTitle')}
        borrador={borrador}
        publicado={publicado}
        aMedias={aMedias.has(bloque.encabezado)}
        onCambiar={onCambiar}
      />
      <Fila
        clave={bloque.cuerpo}
        etiqueta={t(esPregunta ? 'admin.siteCopy.fieldAnswer' : 'admin.siteCopy.fieldBody')}
        borrador={borrador}
        publicado={publicado}
        aMedias={aMedias.has(bloque.cuerpo)}
        onCambiar={onCambiar}
      />
    </article>
  );
}

function Fila({
  clave,
  etiqueta,
  borrador,
  publicado,
  aMedias,
  onCambiar,
}: {
  clave: SiteCopyKey;
  etiqueta: string;
  borrador: Borrador;
  publicado: (key: SiteCopyKey, idioma: SiteCopyLocale) => string;
  aMedias: boolean;
  onCambiar: (key: SiteCopyKey, idioma: SiteCopyLocale, valor: string) => void;
}) {
  const { t } = useTranslation();
  const corta = CORTAS.has(clave);
  const max = corta ? SITE_COPY_SHORT_MAX : SITE_COPY_LONG_MAX;

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        {etiqueta}
        {aMedias && (
          <span className="ml-2 text-red-700 normal-case dark:text-red-300" role="alert">
            {t('admin.siteCopy.halfDoneHere')}
          </span>
        )}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {(['en', 'es'] as const).map((idioma) => {
          const escrito = borrador[clave][idioma];
          const sobra = escrito.trim().length - max;
          const id = `copy-${clave.replace(/\./g, '-')}-${idioma}`;

          return (
            <div key={idioma}>
              <label className="ft-label" htmlFor={id}>
                {t(idioma === 'en' ? 'admin.siteCopy.english' : 'admin.siteCopy.spanish')}
              </label>

              {/*
                LO QUE HAY PUBLICADO, no lo que se esta escribiendo. Es lo que
                permite comparar lo nuevo con lo viejo mientras se redacta, y
                lo que da sentido a dejar el campo vacio.
              */}
              <p className="mb-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                <span className="font-semibold">{t('admin.siteCopy.current')}:</span>{' '}
                {publicado(clave, idioma)}
              </p>

              {corta ? (
                <input
                  id={id}
                  type="text"
                  className="ft-input"
                  value={escrito}
                  placeholder={t('admin.siteCopy.placeholder')}
                  onChange={(evento) => onCambiar(clave, idioma, evento.target.value)}
                />
              ) : (
                <textarea
                  id={id}
                  rows={3}
                  className="ft-input"
                  value={escrito}
                  placeholder={t('admin.siteCopy.placeholder')}
                  onChange={(evento) => onCambiar(clave, idioma, evento.target.value)}
                />
              )}

              <p
                className={
                  'mt-1 text-xs ' +
                  (sobra > 0
                    ? 'font-semibold text-red-700 dark:text-red-300'
                    : 'text-slate-500 dark:text-slate-400')
                }
              >
                {sobra > 0
                  ? t('admin.siteCopy.tooLong', { count: sobra })
                  : t('admin.siteCopy.charCount', { count: escrito.trim().length, max })}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Si dos conjuntos de textos dicen lo mismo, para saber si hay algo que guardar. */
function igual(a: SiteCopy, b: SiteCopy): boolean {
  return SITE_COPY_KEYS.every(
    (key) =>
      (a[key]?.en ?? null) === (b[key]?.en ?? null) &&
      (a[key]?.es ?? null) === (b[key]?.es ?? null),
  );
}
