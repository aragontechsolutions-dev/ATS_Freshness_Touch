import { useTranslation } from 'react-i18next';
import { galleryVideoTitle, hasGalleryContent, toSiteCopyLocale } from '@freshness/types';
import { useGallery } from '../hooks/useGallery';
import { VideoFacade } from '../components/VideoFacade';
import { Reveal } from '../components/Reveal';

/**
 * ANTES Y DESPUES
 * ===============
 * Los videos que la empresa publica. El contenido lo decide el panel, no el
 * codigo.
 *
 * ========================================================================
 * SI NO HAY NADA, LA SECCION NO EXISTE
 * ========================================================================
 * No se pinta un titulo con un hueco debajo, ni un «proximamente». Devuelve
 * `null` y la portada queda como estaba.
 *
 * Esto no es un detalle de maquetacion, es lo que permite desplegar la
 * seccion ANTES de que exista un solo consentimiento firmado: lo que se
 * publica es el interior de la casa de un cliente, y hasta que ese papel
 * exista no puede haber contenido. Ver
 * `docs/38-fotos-y-videos-antes-y-despues.md`.
 *
 * Y tambien cubre el otro caso: si la API no responde, la galeria llega vacia
 * y aqui no se nota nada.
 */
export function Gallery() {
  const { t, i18n } = useTranslation();
  const gallery = useGallery();

  if (!hasGalleryContent(gallery)) return null;

  const locale = toSiteCopyLocale(i18n.language);

  return (
    <section id="gallery" className="py-12 sm:py-16 lg:py-20">
      <div className="ft-container">
        <Reveal>
          <h2
            className="ft-rule text-3xl font-bold tracking-tight text-brand-800
                       dark:text-white"
          >
            {t('gallery.title')}
          </h2>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
            {t('gallery.subtitle')}
          </p>

          {/*
            AVISO DE QUE EL VIDEO LO SIRVE UN TERCERO.
            Hace falta porque al pulsar se carga un marco de YouTube, y eso
            es una peticion a Google que el visitante no ha pedido en ninguna
            otra parte del sitio. Decirlo ANTES del boton, no despues.
          */}
          <p className="mt-2 max-w-2xl text-xs text-slate-500 dark:text-slate-400">
            {t('gallery.thirdPartyNote')}
          </p>

          <ul className="mt-8 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {gallery.videos.map((video) => (
              <li key={video.videoId}>
                <VideoFacade
                  videoId={video.videoId}
                  title={galleryVideoTitle(video, locale)}
                  playLabel={t('gallery.play')}
                />
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
