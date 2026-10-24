import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GALLERY_TITLE_MAX,
  GALLERY_VIDEOS_MAX,
  GallerySchema,
  YOUTUBE_VIDEO_ID_PATTERN,
  type Gallery,
  type Locale,
} from '@freshness/types';
import { ApiClientError, fetchGallery, saveGallery } from '../lib/api';
import { useToast } from './ToastProvider';
import { SkeletonFormulario } from './Skeletons';
import { AlertIcon, SpinnerIcon } from './Icons';
import { formatTimestamp } from '../lib/format';

interface GalleryFormProps {
  locale: Locale;
  onSessionLost: (reason?: 'expired' | 'noAccess') => void;
}

/**
 * Lo que hay escrito en los campos.
 *
 * Cadenas y nunca `null`, porque vienen de inputs. La conversion a `null`
 * —«sin titulo»— se hace UNA vez, al guardar: si el borrador guardara `null`,
 * habria que decidir en cada tecla si lo escrito cuenta como vacio, y esa
 * decision repartida es como se cuelan las cadenas vacias en la base.
 */
interface Fila {
  videoId: string;
  titleEn: string;
  titleEs: string;
}

/**
 * LA GALERIA DE ANTES Y DESPUES
 * -----------------------------
 * Aqui no se configura un ajuste: SE PUBLICA EL INTERIOR DE LA CASA DE UN
 * CLIENTE. El «antes» es, por definicion, la imagen de su casa sucia.
 *
 * De ahi las cuatro decisiones de la pantalla:
 *
 *   1. EL AVISO DEL PERMISO ESTA ARRIBA Y NO SE PUEDE QUITAR. No es una
 *      casilla de «he leido»: esas se marcan sin leer. Es una advertencia
 *      permanente, porque la pantalla se va a usar muchas veces y la primera
 *      vez es la unica en que alguien lee algo nuevo.
 *
 *   2. SE PEGA LA DIRECCION DEL VIDEO, NO EL IDENTIFICADOR. Nadie tiene a
 *      mano «dQw4w9WgXcQ»; todo el mundo tiene la direccion que copia de
 *      YouTube. El identificador se extrae aqui, y lo que se GUARDA son solo
 *      esos once caracteres, nunca la direccion.
 *
 *   3. RETIRAR ES UN BOTON POR FILA, no una papelera escondida. Lo que mas va
 *      a pasar en esta pantalla es retirar un video porque su propietario
 *      revoco el permiso, y eso tiene que poder hacerse en dos segundos, sin
 *      buscar.
 *
 *   4. LOS DOS IDIOMAS DEL TITULO VAN JUNTOS, uno al lado del otro. Igual que
 *      en los textos del sitio: separarlos es como se acaba escribiendo el
 *      ingles y olvidando el espanol.
 */
export function GalleryForm({ locale, onSessionLost }: GalleryFormProps) {
  const { t } = useTranslation();
  const toast = useToast();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [guardado, setGuardado] = useState<Gallery | null>(null);
  const [meta, setMeta] = useState<{ updatedAt: string | null; updatedBy: string | null } | null>(
    null,
  );

  const perdioSesion = onSessionLost;

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorKey(null);

    try {
      const datos = await fetchGallery();
      setFilas(aFilas(datos.gallery));
      setGuardado(datos.gallery);
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
    if (filas === null) return;

    const validado = GallerySchema.safeParse(aContrato(filas));

    if (!validado.success) {
      /*
       * Los mensajes de Zod son tecnicos y van en ingles. Aqui basta con
       * senalar que hay filas mal: cada una ya lleva su aviso debajo.
       */
      setProblema(t('admin.gallery.errInvalid'));
      return;
    }

    setGuardando(true);
    try {
      const datos = await saveGallery(validado.data);
      setFilas(aFilas(datos.gallery));
      setGuardado(datos.gallery);
      setMeta({ updatedAt: datos.updatedAt, updatedBy: datos.updatedBy });
      toast.success('admin.gallery.saved');
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

  if (errorKey !== null && filas === null) {
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

  if (filas === null) return null;

  const cambiar = (indice: number, campo: keyof Fila, valor: string): void => {
    setFilas((actual) =>
      actual === null
        ? actual
        : actual.map((fila, i) =>
            i === indice
              ? {
                  ...fila,
                  // Se pega la direccion entera y se queda solo el identificador.
                  [campo]: campo === 'videoId' ? identificadorDeYouTube(valor) : valor,
                }
              : fila,
          ),
    );
    setProblema(null);
  };

  const quitar = (indice: number): void => {
    setFilas((actual) => (actual === null ? actual : actual.filter((_, i) => i !== indice)));
    setProblema(null);
  };

  const anadir = (): void => {
    setFilas((actual) =>
      actual === null ? actual : [...actual, { videoId: '', titleEn: '', titleEs: '' }],
    );
    setProblema(null);
  };

  const sinCambios = guardado !== null && igual(aContrato(filas), guardado);
  const puedeAnadir = filas.length < GALLERY_VIDEOS_MAX;

  return (
    <form className="space-y-6" onSubmit={(evento) => void enviar(evento)}>
      <header>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('admin.gallery.title')}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {t('admin.gallery.intro')}
        </p>

        {/*
          EL AVISO DEL PERMISO, PERMANENTE Y EN ROJO.
          No es una casilla de «he leido»: esas se marcan sin leer. Se publica
          la casa de una persona, y esta pantalla se va a abrir muchas veces.
        */}
        <p
          className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-50 p-3
                     text-sm text-red-800 dark:border-red-400/30 dark:bg-night-700
                     dark:text-red-200"
          role="note"
        >
          <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong className="font-semibold">{t('admin.gallery.consentWarning')}</strong>{' '}
            {t('admin.gallery.consentHelp')}
          </span>
        </p>
      </header>

      {filas.length === 0 ? (
        <p className="ft-card p-4 text-sm text-slate-600 dark:text-slate-400">
          {/* Vacio no es un fallo: es que la seccion no se pinta en la web. */}
          {t('admin.gallery.empty')}
        </p>
      ) : (
        <ul className="list-none space-y-4 p-0">
          {filas.map((fila, indice) => {
            const valido = YOUTUBE_VIDEO_ID_PATTERN.test(fila.videoId);
            const repetido =
              valido && filas.findIndex((otra) => otra.videoId === fila.videoId) !== indice;
            const idCampo = `galeria-video-${String(indice)}`;

            return (
              <li key={`${idCampo}-${fila.videoId}`} className="ft-card space-y-3 p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="min-w-56 flex-1 block">
                    <span className="ft-label">{t('admin.gallery.videoUrl')}</span>
                    <input
                      id={idCampo}
                      type="text"
                      className="ft-input"
                      value={fila.videoId}
                      placeholder={t('admin.gallery.videoUrlPlaceholder')}
                      onChange={(evento) => cambiar(indice, 'videoId', evento.target.value)}
                    />
                  </label>

                  <button
                    type="button"
                    className="ft-btn-outline"
                    onClick={() => quitar(indice)}
                    disabled={guardando}
                  >
                    {t('admin.gallery.remove')}
                  </button>
                </div>

                {fila.videoId !== '' && !valido && (
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300" role="alert">
                    {t('admin.gallery.errVideoId')}
                  </p>
                )}
                {repetido && (
                  <p className="text-xs font-semibold text-red-700 dark:text-red-300" role="alert">
                    {t('admin.gallery.errDuplicate')}
                  </p>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="ft-label">{t('admin.gallery.titleEnglish')}</span>
                    <input
                      type="text"
                      className="ft-input"
                      maxLength={GALLERY_TITLE_MAX}
                      value={fila.titleEn}
                      placeholder={t('admin.gallery.titlePlaceholder')}
                      onChange={(evento) => cambiar(indice, 'titleEn', evento.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="ft-label">{t('admin.gallery.titleSpanish')}</span>
                    <input
                      type="text"
                      className="ft-input"
                      maxLength={GALLERY_TITLE_MAX}
                      value={fila.titleEs}
                      placeholder={t('admin.gallery.titlePlaceholder')}
                      onChange={(evento) => cambiar(indice, 'titleEs', evento.target.value)}
                    />
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <button
          type="button"
          className="ft-btn-outline"
          onClick={anadir}
          disabled={guardando || !puedeAnadir}
          title={puedeAnadir ? undefined : t('admin.gallery.addBlocked')}
        >
          {t('admin.gallery.add')}
        </button>
        {!puedeAnadir && (
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {t('admin.gallery.addBlocked')}
          </p>
        )}
      </div>

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
          {t('admin.gallery.save')}
        </button>
        {!sinCambios && (
          <button
            type="button"
            className="ft-btn-outline"
            onClick={() => {
              setFilas(aFilas(guardado ?? { videos: [] }));
              setProblema(null);
            }}
            disabled={guardando}
          >
            {t('admin.gallery.reset')}
          </button>
        )}
        <p className="text-xs text-slate-600 dark:text-slate-400">
          {meta?.updatedAt === null || meta === null
            ? t('admin.gallery.never')
            : meta.updatedBy === null
              ? t('admin.gallery.lastChangeUnknown', {
                  when: formatTimestamp(meta.updatedAt, locale),
                })
              : t('admin.gallery.lastChange', {
                  when: formatTimestamp(meta.updatedAt, locale),
                  who: meta.updatedBy,
                })}
        </p>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * SACA LOS ONCE CARACTERES DE LO QUE SEA QUE SE HAYA PEGADO.
 *
 * Nadie tiene a mano «dQw4w9WgXcQ»: todo el mundo tiene la direccion que
 * copia de YouTube, y hay cuatro formas distintas de copiarla segun de donde
 * se copie —la barra del navegador, el boton de compartir, el de incrustar, o
 * la direccion corta del movil—.
 *
 * Si esta pantalla exigiera el identificador suelto, acabaria pegandose la
 * direccion entera, el campo se pondria rojo y la conclusion seria «esto no
 * funciona». Asi que se acepta cualquiera de las cuatro y se queda lo unico
 * que se guarda.
 *
 * NO VALIDA: solo recorta. Lo que no encaje se devuelve tal cual, para que el
 * campo lo ensene y el aviso explique por que esta mal. Tragarselo en
 * silencio dejaria el campo vacio sin decir nada, que es peor.
 */
export function identificadorDeYouTube(pegado: string): string {
  const texto = pegado.trim();
  if (texto === '') return '';

  // Ya es un identificador suelto.
  if (YOUTUBE_VIDEO_ID_PATTERN.test(texto)) return texto;

  const formas = [
    /[?&]v=([A-Za-z0-9_-]{11})/, //         watch?v=ID
    /youtu\.be\/([A-Za-z0-9_-]{11})/, //    youtu.be/ID
    /\/embed\/([A-Za-z0-9_-]{11})/, //      /embed/ID
    /\/shorts\/([A-Za-z0-9_-]{11})/, //     /shorts/ID
    /\/live\/([A-Za-z0-9_-]{11})/, //       /live/ID
  ];

  for (const forma of formas) {
    const encontrado = forma.exec(texto);
    if (encontrado?.[1] !== undefined) return encontrado[1];
  }

  return texto;
}

/** Del contrato a los campos. */
function aFilas(gallery: Gallery): Fila[] {
  return gallery.videos.map((video) => ({
    videoId: video.videoId,
    titleEn: video.title.en ?? '',
    titleEs: video.title.es ?? '',
  }));
}

/**
 * De los campos al contrato.
 *
 * Aqui es donde el campo vacio pasa a ser `null`: una sola vez, y en un solo
 * sitio.
 */
function aContrato(filas: Fila[]): Gallery {
  return {
    videos: filas.map((fila) => ({
      videoId: fila.videoId.trim(),
      title: {
        en: fila.titleEn.trim() === '' ? null : fila.titleEn.trim(),
        es: fila.titleEs.trim() === '' ? null : fila.titleEs.trim(),
      },
    })),
  };
}

/** Si dos galerias dicen lo mismo, para saber si hay algo que guardar. */
function igual(a: Gallery, b: Gallery): boolean {
  if (a.videos.length !== b.videos.length) return false;

  return a.videos.every((video, i) => {
    const otro = b.videos[i];
    return (
      otro !== undefined &&
      video.videoId === otro.videoId &&
      (video.title.en ?? null) === (otro.title.en ?? null) &&
      (video.title.es ?? null) === (otro.title.es ?? null)
    );
  });
}
