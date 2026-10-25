import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  galleryPhotoTitle,
  galleryVideoTitle,
  hasGalleryContent,
  toSiteCopyLocale,
} from '@freshness/types';
import { useGallery } from '../hooks/useGallery';
import { Carrusel, type PiezaDelCarrusel } from '../components/Carrusel';
import { VideoFacade } from '../components/VideoFacade';
import { Reveal } from '../components/Reveal';

/**
 * ANTES Y DESPUES
 * ===============
 * Los videos y las fotos que la empresa publica. El contenido lo decide el
 * panel, no el codigo.
 *
 * ========================================================================
 * UNA FILA QUE SE MUEVE, Y NO UNA REJILLA
 * ========================================================================
 * Era una rejilla que crecia hacia abajo con cada pieza: con seis fotos y dos
 * videos empujaba las zonas de servicio y el contacto una pantalla entera
 * hacia abajo. Ahora es UNA fila que se desplaza sola, asi que la seccion
 * ocupa lo mismo con dos piezas que con veinte.
 *
 * Los videos van primero y las fotos despues: un video pesa mas en la
 * decision de quien esta mirando, y es lo que menos gente se espera
 * encontrar.
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

  /*
   * CUANTOS VIDEOS HAY ABIERTOS, PARA PARAR LA FILA.
   *
   * Un contador y no un «hay uno abierto» porque la misma pieza se repite
   * varias veces en el carrusel y se puede abrir en mas de una copia. Con un
   * booleano, cerrar una dejaria la fila andando con la otra sonando.
   *
   * Las dos funciones son estables a proposito: la fachada avisa desde un
   * efecto, y unas funciones nuevas en cada pintado lo harian correr en
   * bucle.
   */
  const [abiertos, setAbiertos] = useState(0);

  const alAbrirse = useCallback((abierto: boolean) => {
    setAbiertos((cuantos) => Math.max(0, cuantos + (abierto ? 1 : -1)));
  }, []);

  if (!hasGalleryContent(gallery)) return null;

  const locale = toSiteCopyLocale(i18n.language);

  const piezas: PiezaDelCarrusel[] = [
    ...gallery.videos.map((video) => ({
      clave: `video-${video.videoId}`,
      nodo: (enfocable: boolean) => (
        <VideoFacade
          videoId={video.videoId}
          title={galleryVideoTitle(video, locale)}
          posterUrl={video.posterUrl}
          playLabel={t('gallery.play')}
          closeLabel={t('gallery.close')}
          enfocable={enfocable}
          onAbierto={alAbrirse}
        />
      ),
    })),
    ...gallery.photos.map((photo) => {
      const titulo = galleryPhotoTitle(photo, locale);

      return {
        clave: `foto-${photo.url}`,
        // Una foto no tiene nada enfocable, asi que no usa el argumento.
        nodo: () => (
          <figure className="m-0">
            <img
              src={photo.url}
              /*
                Con titulo, el titulo; sin el, una descripcion generica. Nunca
                vacio: una foto sin texto alternativo no existe para quien usa
                lector de pantalla, y aqui son la mitad del argumento de venta.
              */
              alt={titulo ?? t('gallery.photoAlt')}
              className="ft-card aspect-video w-full object-cover"
              loading="lazy"
              decoding="async"
            />
            {titulo !== null && (
              <figcaption className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {titulo}
              </figcaption>
            )}
          </figure>
        ),
      };
    }),
  ];

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
            otra parte del sitio. Decirlo ANTES de la fila, no despues.

            Solo si hay videos: las fotos salen de nuestro propio almacen, asi
            que no hay ningun tercero a quien avisar. Ensenar el aviso con una
            galeria de solo fotos seria decirle al visitante que mandamos sus
            datos a alguien cuando no es verdad.
          */}
          {gallery.videos.length > 0 && (
            <p className="mt-2 max-w-2xl text-xs text-slate-500 dark:text-slate-400">
              {t('gallery.thirdPartyNote')}
            </p>
          )}
        </Reveal>

        {/*
          FUERA DEL `Reveal` A PROPOSITO. La animacion de entrada de las
          secciones usa `transform` y `opacity`, y los mandos del carrusel van
          posicionados encima de las fotos: dentro de un elemento con
          `transform` se posicionarian contra el, no contra la fila, y
          acabarian descolocados mientras dura la entrada.
        */}
        <Carrusel
          piezas={piezas}
          pausado={abiertos > 0}
          etiqueta={t('gallery.title')}
          etiquetaAnterior={t('gallery.previous')}
          etiquetaSiguiente={t('gallery.next')}
        />
      </div>
    </section>
  );
}
