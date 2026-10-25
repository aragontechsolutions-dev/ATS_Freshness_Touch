import { useState } from 'react';
import { youTubeEmbedUrl } from '@freshness/types';
import { PlayIcon } from './Icons';

/**
 * UN VIDEO QUE NO PIDE NADA A GOOGLE HASTA QUE SE PULSA
 * ====================================================
 * Mientras nadie pulse, esto es una tarjeta nuestra: un boton, un triangulo
 * y un titulo. No hay marco, no hay script de YouTube, no hay ninguna
 * peticion a ningun tercero. Al pulsar, se inserta el marco y arranca.
 *
 * ========================================================================
 * POR QUE, Y POR QUE NO ES ESTETICA
 * ========================================================================
 * El sitio no pone ni una cookie, y eso esta escrito como punto fuerte en el
 * dossier legal. Un marco de YouTube cargado de entrada se lo lleva por
 * delante.
 *
 * «youtube-nocookie» no basta. Retiene las COOKIES hasta que se reproduce,
 * pero las pruebas independientes encuentran que el marco escribe un
 * identificador en el almacenamiento del navegador y manda la IP del
 * visitante a Google EN CUANTO CARGA, antes de que nadie pulse play. Google
 * dice que no guarda nada hasta la reproduccion; las pruebas de terceros
 * dicen otra cosa, y no hay forma de comprobarlo desde aqui.
 *
 * Asi que no se discute: no se carga el marco hasta que el visitante lo pide.
 * Entonces es una decision suya, no nuestra, y el «esta web no manda datos a
 * terceros» sigue siendo verdad para quien no pulse.
 *
 * DE PASO PESA MENOS. Un marco de YouTube son cientos de kilobytes de script
 * por cada video de la seccion, y esta seccion esta por debajo del cotizador,
 * que es lo que de verdad genera ingresos.
 *
 * ========================================================================
 * LA MINIATURA ES NUESTRA, NO LA DE YOUTUBE
 * ========================================================================
 * La natural seria la de YouTube (`i.ytimg.com`): gratis, automatica y
 * siempre al dia. Y seria exactamente la peticion a Google que esto evita,
 * encima en cuanto la seccion entra en pantalla, sin que nadie pulse nada.
 *
 * Asi que la portada se sube al almacen propio y se sirve desde nuestro
 * dominio. SIN MINIATURA LA TARJETA FUNCIONA IGUAL: se pinta con los colores
 * de la marca. No es un hueco ni un error, es el estado de partida — y es lo
 * que se ve mientras la empresa no haya subido una.
 */

interface VideoFacadeProps {
  /** Los once caracteres del video. Ya validados por el contrato. */
  videoId: string;
  /** El titulo, si lo tiene. */
  title: string | null;
  /**
   * La portada, servida desde nuestro almacen, o `null` si no hay ninguna.
   *
   * La direccion viene del servidor: aqui no se compone ninguna.
   */
  posterUrl: string | null;
  /** Lo que lee en voz alta un lector de pantalla al llegar al boton. */
  playLabel: string;
  /**
   * Se avisa al pulsar play.
   *
   * Lo usa el carrusel para pararse: sin esto, el video que acabas de poner
   * se iria de la pantalla mientras suena.
   */
  onPlay?: () => void;
}

export function VideoFacade({ videoId, title, posterUrl, playLabel, onPlay }: VideoFacadeProps) {
  const [reproduciendo, setReproduciendo] = useState(false);

  /*
   * El marco entra con `title`, que no es decorativo: un lector de pantalla
   * anuncia los marcos por su titulo, y un marco sin el se lee como «marco»,
   * que no dice nada. Si el video no tiene titulo se usa la etiqueta del
   * boton, que al menos dice que es un video.
   */
  const tituloDelMarco = title ?? playLabel;

  return (
    <figure className="m-0">
      <div className="ft-card relative aspect-video overflow-hidden">
        {reproduciendo ? (
          <iframe
            // Sin la barra de direcciones del navegador, el visitante no ve a
            // donde apunta esto; el origen lo decide el codigo, no el dato.
            src={youTubeEmbedUrl(videoId)}
            title={tituloDelMarco}
            className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            // Google no necesita saber de que pagina nuestra viene el play.
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setReproduciendo(true);
              onPlay?.();
            }}
            // El titulo se pinta debajo, asi que la etiqueta del boton lo
            // repite para que quien navegue a saltos sepa que video es.
            aria-label={title ? `${playLabel}: ${title}` : playLabel}
            className="group absolute inset-0 flex h-full w-full items-center justify-center
                       bg-gradient-to-br from-brand-700 to-brand-900
                       focus-visible:outline-2 focus-visible:outline-offset-2
                       focus-visible:outline-brand-300"
          >
            {posterUrl !== null && (
              <img
                src={posterUrl}
                /*
                  VACIO A PROPOSITO, y es la unica imagen del sitio que lo
                  lleva: es decorativa. El boton que la contiene ya se anuncia
                  con el titulo del video, asi que describirla otra vez haria
                  que un lector de pantalla leyera lo mismo dos veces.
                */
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            )}

            {/* El circulo va por encima de la portada, y con sombra para que
                se vea sobre una imagen clara. */}
            <span
              className="relative flex h-16 w-16 items-center justify-center rounded-full
                         bg-white/95 shadow-lg transition group-hover:scale-110
                         motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            >
              {/* Desplazado a la derecha: un triangulo centrado por su caja se
                  ve descentrado dentro de un circulo. */}
              <PlayIcon className="ml-1 h-7 w-7 text-brand-800" />
            </span>
          </button>
        )}
      </div>

      {title && (
        <figcaption className="mt-2 text-sm text-slate-600 dark:text-slate-400">{title}</figcaption>
      )}
    </figure>
  );
}
