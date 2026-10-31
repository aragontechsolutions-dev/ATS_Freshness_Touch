import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GALLERY_PHOTOS_MAX,
  GALLERY_PHOTO_MAX_BYTES,
  GALLERY_PHOTO_TYPES,
  GALLERY_TITLE_MAX,
  GALLERY_VIDEOS_MAX,
  GallerySchema,
  YOUTUBE_VIDEO_ID_PATTERN,
  type Gallery,
  type Locale,
} from '@freshness/types';
import { ApiClientError, fetchGallery, saveGallery, uploadGalleryImage } from '../lib/api';
import { useToast } from './ToastProvider';
import { copiarAlPortapapeles } from '../lib/portapapeles';
import { SkeletonFormulario } from './Skeletons';
import { AlertIcon, SpinnerIcon, UploadIcon } from './Icons';
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
  /** La ruta de la miniatura, o `null` si no se ha subido ninguna. */
  poster: string | null;
  /** Su direccion, solo para la vista previa. No se manda de vuelta. */
  posterUrl: string | null;
}

/**
 * Una foto ya subida.
 *
 * LA RUTA NO SE EDITA: la puso el servidor. La direccion es solo para la
 * vista previa y tampoco se manda de vuelta. Lo unico que se escribe aqui son
 * los dos titulos.
 */
interface FilaFoto {
  path: string;
  url: string | null;
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
  const [fotos, setFotos] = useState<FilaFoto[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  /** Que video esta subiendo su miniatura ahora mismo, si alguno. */
  const [subiendoMini, setSubiendoMini] = useState<number | null>(null);
  /**
   * Lo que esta guardado pero NO se esta publicando por no tener permiso.
   *
   * Sin esto el modo estricto seria una trampa: se sube una foto, se guarda,
   * se ve aqui y no aparece en la web, y no hay forma de saber por que.
   */
  /**
   * EL RESPALDO DE COPIAR, cuando el navegador no deja.
   *
   * Un boton de copiar que falla en silencio es de los peores: la persona
   * cree que tiene la ruta, pega, y sale lo de antes. Aqui se guarda lo que
   * no se pudo copiar para ENSENARLO y que se copie a mano.
   */
  const [sinCopiar, setSinCopiar] = useState<string | null>(null);

  const [sinPermiso, setSinPermiso] = useState<{ videoIds: string[]; photoPaths: string[] }>({
    videoIds: [],
    photoPaths: [],
  });
  const [guardado, setGuardado] = useState<Gallery | null>(null);
  const [meta, setMeta] = useState<{ updatedAt: string | null; updatedBy: string | null } | null>(
    null,
  );

  const perdioSesion = onSessionLost;

  /**
   * Copia un texto y avisa de lo que paso.
   *
   * Si el navegador no deja, NO se da por copiado: se ensena el texto para
   * que se pueda seleccionar a mano. Ver `sinCopiar`.
   */
  const copiar = async (texto: string): Promise<void> => {
    if (await copiarAlPortapapeles(texto)) {
      setSinCopiar(null);
      toast.success('admin.gallery.copied');
      return;
    }

    setSinCopiar(texto);
  };

  const cargar = useCallback(async () => {
    setCargando(true);
    setErrorKey(null);

    try {
      const datos = await fetchGallery();
      setFilas(aFilas(datos));
      setSinPermiso(datos.uncovered);
      setFotos(aFilasFoto(datos));
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

    const validado = GallerySchema.safeParse(aContrato(filas, fotos));

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
      setFilas(aFilas(datos));
      setSinPermiso(datos.uncovered);
      setFotos(aFilasFoto(datos));
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
      actual === null
        ? actual
        : [...actual, { videoId: '', titleEn: '', titleEs: '', poster: null, posterUrl: null }],
    );
    setProblema(null);
  };

  /**
   * Sube la miniatura de un video.
   *
   * La anterior NO se borra aqui: se borra al guardar, que es cuando el
   * cambio es de verdad. Si se borrara ahora y luego no se guardara, el video
   * publicado se quedaria apuntando a un archivo que ya no existe.
   */
  const subirMiniatura = async (indice: number, archivo: File): Promise<void> => {
    setProblema(null);

    if (archivo.size > GALLERY_PHOTO_MAX_BYTES) {
      setProblema(t('admin.gallery.errTooBig'));
      return;
    }

    setSubiendoMini(indice);
    try {
      const subida = await uploadGalleryImage(archivo, 'poster');
      setFilas((actual) =>
        actual === null
          ? actual
          : actual.map((fila, i) =>
              i === indice ? { ...fila, poster: subida.path, posterUrl: subida.url } : fila,
            ),
      );
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        (error.statusCode === 401 || error.statusCode === 403)
      ) {
        perdioSesion(error.statusCode === 403 ? 'noAccess' : 'expired');
        return;
      }
      setProblema(
        error instanceof ApiClientError && error.statusCode === 415
          ? t('admin.gallery.errNotAnImage')
          : t('admin.gallery.errUpload'),
      );
    } finally {
      setSubiendoMini(null);
    }
  };

  const quitarMiniatura = (indice: number): void => {
    setFilas((actual) =>
      actual === null
        ? actual
        : actual.map((fila, i) =>
            i === indice ? { ...fila, poster: null, posterUrl: null } : fila,
          ),
    );
    setProblema(null);
  };

  const cambiarFoto = (indice: number, campo: 'titleEn' | 'titleEs', valor: string): void => {
    setFotos((actual) =>
      actual.map((foto, i) => (i === indice ? { ...foto, [campo]: valor } : foto)),
    );
    setProblema(null);
  };

  const quitarFoto = (indice: number): void => {
    setFotos((actual) => actual.filter((_, i) => i !== indice));
    setProblema(null);
  };

  /**
   * Sube el archivo y lo anade a la lista.
   *
   * EL AVISO DE TAMANO VA ANTES DE EMPEZAR A SUBIR. No es confiar en el
   * navegador —el servidor lo rechaza igual—: es no hacer esperar a nadie dos
   * minutos para un «no».
   */
  const subirFoto = async (archivo: File): Promise<void> => {
    setProblema(null);

    if (archivo.size > GALLERY_PHOTO_MAX_BYTES) {
      setProblema(t('admin.gallery.errTooBig'));
      return;
    }

    setSubiendo(true);
    try {
      const subida = await uploadGalleryImage(archivo, 'photo');
      setFotos((actual) => [
        ...actual,
        { path: subida.path, url: subida.url, titleEn: '', titleEs: '' },
      ]);
    } catch (error) {
      if (
        error instanceof ApiClientError &&
        (error.statusCode === 401 || error.statusCode === 403)
      ) {
        perdioSesion(error.statusCode === 403 ? 'noAccess' : 'expired');
        return;
      }
      setProblema(
        error instanceof ApiClientError && error.statusCode === 415
          ? t('admin.gallery.errNotAnImage')
          : t('admin.gallery.errUpload'),
      );
    } finally {
      setSubiendo(false);
    }
  };

  const sinCambios = guardado !== null && igual(aContrato(filas, fotos), guardado);
  const puedeAnadir = filas.length < GALLERY_VIDEOS_MAX;
  const puedeAnadirFoto = fotos.length < GALLERY_PHOTOS_MAX;

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

        {sinPermiso.videoIds.length + sinPermiso.photoPaths.length > 0 && (
          <p
            className="mt-3 flex items-start gap-2 rounded-lg border border-sun-600/40 bg-sun-50
                       p-3 text-sm text-slate-800 dark:border-sun-300/30 dark:bg-night-700
                       dark:text-slate-200"
            role="alert"
          >
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong className="font-semibold">
                {t('admin.gallery.uncovered', {
                  count: sinPermiso.videoIds.length + sinPermiso.photoPaths.length,
                })}
              </strong>{' '}
              {t('admin.gallery.uncoveredHelp')}
            </span>
          </p>
        )}

        {/*
          COPIAR DE GOLPE LO QUE NO TIENE PERMISO.
          Es el paso que faltaba para que el atajo de los permisos sirva de
          algo: la ruta de una foto son treinta y dos caracteres
          hexadecimales que hasta ahora solo estaban dentro de la direccion
          de la imagen. Ver `docs/50`.
        */}
        {sinPermiso.photoPaths.length + sinPermiso.videoIds.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {sinPermiso.photoPaths.length > 0 && (
              <button
                type="button"
                className="ft-btn-ghost"
                onClick={() => void copiar(sinPermiso.photoPaths.join('\n'))}
              >
                {t('admin.gallery.copyUncoveredPhotos', { count: sinPermiso.photoPaths.length })}
              </button>
            )}
            {sinPermiso.videoIds.length > 0 && (
              <button
                type="button"
                className="ft-btn-ghost"
                onClick={() => void copiar(sinPermiso.videoIds.join('\n'))}
              >
                {t('admin.gallery.copyUncoveredVideos', { count: sinPermiso.videoIds.length })}
              </button>
            )}
          </div>
        )}

        {/*
          EL RESPALDO. Si el navegador no dejo copiar, el texto se ensena
          aqui para seleccionarlo a mano: quedarse callado dejaria a la
          persona pegando lo que tuviera de antes.
        */}
        {sinCopiar !== null && (
          <div className="mt-3 space-y-2" role="alert">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {t('admin.gallery.copyManual')}
            </p>
            <textarea
              className="ft-input font-mono text-xs"
              readOnly
              rows={Math.min(sinCopiar.split('\n').length, 6)}
              value={sinCopiar}
              onFocus={(evento) => {
                evento.target.select();
              }}
            />
            <button
              type="button"
              className="ft-btn-ghost"
              onClick={() => {
                setSinCopiar(null);
              }}
            >
              {t('admin.gallery.copyClose')}
            </button>
          </div>
        )}
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
                    className="ft-btn-ghost"
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
                {sinPermiso.videoIds.includes(fila.videoId) && (
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                    {t('admin.gallery.notPublished')}
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

                {/* ---------------------------- La miniatura --------------------------- */}
                <div className="border-t border-slate-200 pt-3 dark:border-night-600">
                  <p className="ft-label">{t('admin.gallery.poster')}</p>
                  <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
                    {t('admin.gallery.posterHelp')}
                  </p>

                  {fila.posterUrl !== null ? (
                    <div className="flex flex-wrap items-start gap-3">
                      <img
                        src={fila.posterUrl}
                        alt={t('admin.gallery.posterAlt')}
                        className="aspect-video w-40 rounded-lg object-cover"
                        loading="lazy"
                      />
                      <button
                        type="button"
                        className="ft-btn-ghost"
                        onClick={() => quitarMiniatura(indice)}
                        disabled={guardando}
                      >
                        {t('admin.gallery.removePoster')}
                      </button>
                    </div>
                  ) : (
                    <SubirArchivo
                      etiqueta={t('admin.gallery.uploadPoster')}
                      nombreAccesible={t('admin.gallery.poster')}
                      desactivado={guardando || subiendoMini !== null}
                      onArchivo={(archivo) => void subirMiniatura(indice, archivo)}
                    />
                  )}

                  {subiendoMini === indice && (
                    <p className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <SpinnerIcon className="h-4 w-4" />
                      {t('admin.gallery.uploading')}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div>
        <button
          type="button"
          className="ft-btn-ghost"
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

      {/* --------------------------------- Fotos -------------------------------- */}
      <section className="space-y-4">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">
            {t('admin.gallery.photos')}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {t('admin.gallery.photosHelp')}
          </p>
        </div>

        {fotos.length > 0 && (
          <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2">
            {fotos.map((foto, indice) => (
              <li key={foto.path} className="ft-card space-y-3 p-4">
                {foto.url !== null && (
                  <img
                    src={foto.url}
                    alt={foto.titleEn || foto.titleEs || t('admin.gallery.photoAlt')}
                    className="aspect-video w-full rounded-lg object-cover"
                    loading="lazy"
                  />
                )}

                <div className="grid gap-3">
                  <label className="block">
                    <span className="ft-label">{t('admin.gallery.titleEnglish')}</span>
                    <input
                      type="text"
                      className="ft-input"
                      maxLength={GALLERY_TITLE_MAX}
                      value={foto.titleEn}
                      placeholder={t('admin.gallery.titlePlaceholder')}
                      onChange={(evento) => cambiarFoto(indice, 'titleEn', evento.target.value)}
                    />
                  </label>
                  <label className="block">
                    <span className="ft-label">{t('admin.gallery.titleSpanish')}</span>
                    <input
                      type="text"
                      className="ft-input"
                      maxLength={GALLERY_TITLE_MAX}
                      value={foto.titleEs}
                      placeholder={t('admin.gallery.titlePlaceholder')}
                      onChange={(evento) => cambiarFoto(indice, 'titleEs', evento.target.value)}
                    />
                  </label>
                </div>

                {sinPermiso.photoPaths.includes(foto.path) && (
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                    {t('admin.gallery.notPublished')}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  {/*
                    LA RUTA NO SE ENSENA, SE COPIA. Son treinta y dos
                    caracteres hexadecimales: a la vista solo ensucian la
                    tarjeta, y a mano se teclean mal. Lo que hace falta es
                    llevarselos al campo «Fotos que ampara» del permiso.
                  */}
                  <button
                    type="button"
                    className="ft-btn-ghost"
                    onClick={() => void copiar(foto.path)}
                  >
                    {t('admin.gallery.copyPath')}
                  </button>

                  <button
                    type="button"
                    className="ft-btn-ghost"
                    onClick={() => quitarFoto(indice)}
                    disabled={guardando}
                  >
                    {t('admin.gallery.remove')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <SubirArchivo
          etiqueta={t('admin.gallery.addPhoto')}
          nombreAccesible={t('admin.gallery.addPhoto')}
          desactivado={guardando || subiendo || !puedeAnadirFoto}
          onArchivo={(archivo) => void subirFoto(archivo)}
        />

        {subiendo && (
          <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <SpinnerIcon className="h-4 w-4" />
            {t('admin.gallery.uploading')}
          </p>
        )}
        {!puedeAnadirFoto && (
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {t('admin.gallery.addPhotoBlocked', { count: GALLERY_PHOTOS_MAX })}
          </p>
        )}
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
        <button type="submit" className="ft-btn-primary" disabled={guardando || sinCambios}>
          {guardando && <SpinnerIcon className="h-4 w-4" />}
          {t('admin.gallery.save')}
        </button>
        {!sinCambios && (
          <button
            type="button"
            className="ft-btn-ghost"
            onClick={() => {
              // Las direcciones de vista previa no se pueden recomponer sin
              // volver a preguntar, asi que se recarga la pantalla entera.
              setFilas(null);
              // Las fotos vuelven a lo guardado, pero las direcciones de vista
              // previa no se pueden recomponer sin volver a preguntar, asi que
              // se recarga la pantalla entera. Es la unica forma de que lo que
              // se ve siga siendo lo que hay.
              void cargar();
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

/** Del contrato a los campos de las fotos, con su direccion de vista previa. */
function aFilasFoto(datos: { gallery: Gallery; imageUrls: Record<string, string> }): FilaFoto[] {
  return datos.gallery.photos.map((photo) => ({
    path: photo.path,
    url: datos.imageUrls[photo.path] ?? null,
    titleEn: photo.title.en ?? '',
    titleEs: photo.title.es ?? '',
  }));
}

/** Del contrato a los campos, con la direccion de la miniatura si la tiene. */
function aFilas(datos: { gallery: Gallery; imageUrls: Record<string, string> }): Fila[] {
  return datos.gallery.videos.map((video) => ({
    videoId: video.videoId,
    titleEn: video.title.en ?? '',
    titleEs: video.title.es ?? '',
    poster: video.poster,
    posterUrl: video.poster === null ? null : (datos.imageUrls[video.poster] ?? null),
  }));
}

/**
 * De los campos al contrato.
 *
 * Aqui es donde el campo vacio pasa a ser `null`: una sola vez, y en un solo
 * sitio.
 */
function aContrato(filas: Fila[], fotos: FilaFoto[]): Gallery {
  return {
    videos: filas.map((fila) => ({
      videoId: fila.videoId.trim(),
      title: {
        en: fila.titleEn.trim() === '' ? null : fila.titleEn.trim(),
        es: fila.titleEs.trim() === '' ? null : fila.titleEs.trim(),
      },
      poster: fila.poster,
      /*
       * LA FECHA DE ALTA LA DECIDE EL SERVIDOR, y lo que se mande aqui lo
       * ignora: conserva la que la pieza ya tuviera y solo sella las
       * nuevas. Va en `null` porque el contrato lo exige, no porque esto
       * sepa la respuesta — es el dato con el que se decide a quien
       * molestar por una foto olvidada sin permiso, y eso no puede venir
       * del navegador. Hay una prueba de que reguardar no reinicia el reloj.
       */
      addedAt: null,
    })),
    /*
     * LAS FOTOS VIAJAN SIEMPRE, aunque esta pantalla solo haya tocado los
     * videos. Se manda la galeria entera y lo que no viene se borra: si aqui
     * se devolviera una lista vacia, guardar un video retiraria todas las
     * fotos —y las borraria del almacen— sin que nadie lo hubiera pedido.
     */
    photos: fotos.map((foto) => ({
      path: foto.path,
      title: {
        en: foto.titleEn.trim() === '' ? null : foto.titleEn.trim(),
        es: foto.titleEs.trim() === '' ? null : foto.titleEs.trim(),
      },
      /* Igual que en los videos: la pone el servidor. */
      addedAt: null,
    })),
  };
}

/** Si dos galerias dicen lo mismo, para saber si hay algo que guardar. */
function igual(a: Gallery, b: Gallery): boolean {
  if (a.videos.length !== b.videos.length) return false;
  if (a.photos.length !== b.photos.length) return false;

  const mismosVideos = a.videos.every((video, i) => {
    const otro = b.videos[i];
    return (
      otro !== undefined &&
      video.videoId === otro.videoId &&
      video.poster === otro.poster &&
      mismoTitulo(video.title, otro.title)
    );
  });

  const mismasFotos = a.photos.every((foto, i) => {
    const otra = b.photos[i];
    return otra !== undefined && foto.path === otra.path && mismoTitulo(foto.title, otra.title);
  });

  return mismosVideos && mismasFotos;
}

function mismoTitulo(
  a: { en: string | null; es: string | null },
  b: { en: string | null; es: string | null },
): boolean {
  return (a.en ?? null) === (b.en ?? null) && (a.es ?? null) === (b.es ?? null);
}

/* ------------------------------------------------------------------------ */

interface SubirArchivoProps {
  /** Lo que se lee dentro del boton. */
  etiqueta: string;
  /** El nombre del campo para un lector de pantalla, que puede ser mas largo. */
  nombreAccesible: string;
  desactivado: boolean;
  onArchivo: (archivo: File) => void;
}

/**
 * UN CAMPO DE ARCHIVO QUE PARECE UN BOTON
 * ---------------------------------------
 * El control de archivo del navegador se pinta como «Seleccionar archivo ·
 * Ningun archivo seleccionado»: un texto gris que no parece pulsable, con un
 * aspecto distinto en cada navegador y que no se puede dar estilo.
 *
 * El resultado es que nadie ve que hay que pulsar ahi. Pasa de verdad: se
 * sube una foto, se queda el aviso de «ningun archivo» al lado, y la
 * conclusion es que no ha funcionado.
 *
 * ========================================================================
 * EL CAMPO SIGUE AHI, SOLO QUE NO SE VE
 * ========================================================================
 * `sr-only` lo esconde a la vista PERO NO LO QUITA: sigue existiendo, sigue
 * recibiendo el foco con el tabulador y un lector de pantalla lo sigue
 * anunciando como lo que es, un campo de archivo. Es la diferencia con
 * `display: none`, que lo borraria del todo y dejaria el boton sin nada
 * detras para quien no usa raton.
 *
 * El `<label>` que lo envuelve hace que pulsar el boton abra el selector, y
 * `focus-within` dibuja el anillo de foco en el boton cuando el campo
 * escondido lo tiene — si no, al tabular hasta aqui no se veria nada.
 */
function SubirArchivo({ etiqueta, nombreAccesible, desactivado, onArchivo }: SubirArchivoProps) {
  return (
    <label
      className={
        'ft-btn-ghost focus-within:ring-2 focus-within:ring-brand-400 focus-within:ring-offset-1 ' +
        (desactivado ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')
      }
    >
      <UploadIcon className="h-4 w-4" />
      {etiqueta}
      <input
        type="file"
        className="sr-only"
        aria-label={nombreAccesible}
        accept={GALLERY_PHOTO_TYPES.join(',')}
        disabled={desactivado}
        onChange={(evento) => {
          const archivo = evento.target.files?.[0];
          /*
           * El campo se vacia para que elegir DOS VECES el mismo archivo
           * vuelva a disparar el cambio. Sin esto, subir una foto, quitarla y
           * volver a elegir la misma no haria nada, y no habria forma de
           * saber por que.
           */
          evento.target.value = '';
          if (archivo) onArchivo(archivo);
        }}
      />
    </label>
  );
}
