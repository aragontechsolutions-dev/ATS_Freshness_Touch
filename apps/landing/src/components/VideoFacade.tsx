import { useEffect, useState } from 'react';
import { youTubeEmbedUrl } from '@freshness/types';
import { CloseIcon, PlayIcon } from './Icons';

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
  /** Lo mismo para el boton de cerrar. */
  closeLabel: string;
  /**
   * Si esta tarjeta entra en el tabulador.
   *
   * LAS COPIAS DEL CARRUSEL NO ENTRAN. Son el mismo contenido repetido: sin
   * esto, el tabulador pasaria cuatro veces por el mismo boton de play.
   *
   * Se hace asi y no con `inert`, que tambien valdria para el teclado y para
   * el lector, porque `inert` QUITA TAMBIEN EL RATON. Con el puesto, solo se
   * podia reproducir el video de la primera copia —la del extremo
   * izquierdo— y en cualquier otra posicion la tarjeta parecia una foto mas.
   */
  enfocable?: boolean;
  /** Se avisa mientras el video esta abierto, para que el carrusel se pare. */
  onAbierto?: (abierto: boolean) => void;
}

export function VideoFacade({
  videoId,
  title,
  posterUrl,
  playLabel,
  closeLabel,
  enfocable = true,
  onAbierto,
}: VideoFacadeProps) {
  const [reproduciendo, setReproduciendo] = useState(false);

  /*
   * EL AVISO SE DA DESDE EL ESTADO, NO DESDE EL CLIC.
   *
   * Asi la limpieza del efecto avisa tambien cuando la tarjeta desaparece sin
   * que nadie haya cerrado nada —al recalcularse las copias del carrusel, por
   * ejemplo—. Avisando solo en el clic, el carrusel se quedaria creyendo que
   * hay un video abierto que ya no existe, y no volveria a moverse.
   */
  useEffect(() => {
    if (!reproduciendo || !onAbierto) return;

    onAbierto(true);
    return () => {
      onAbierto(false);
    };
  }, [reproduciendo, onAbierto]);

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
          <>
            <iframe
              // Sin la barra de direcciones del navegador, el visitante no ve a
              // donde apunta esto; el origen lo decide el codigo, no el dato.
              src={youTubeEmbedUrl(videoId)}
              title={tituloDelMarco}
              className="absolute inset-0 h-full w-full border-0"
              /*
               * LOS PERMISOS VAN SOLO EN `allow`, NO TAMBIEN EN
               * `allowfullscreen`.
               *
               * Llevar los dos no rompe nada —`allow` gana— pero el navegador
               * lo avisa por consola en cada carga: «Allow attribute will take
               * precedence over allowfullscreen». Una consola con avisos que
               * siempre estan ahi es una consola que nadie mira, y el dia que
               * salga uno de verdad se perdera entre ellos.
               *
               * `allowfullscreen` es el atributo veterano; `allow="fullscreen"`
               * hace lo mismo en todos los navegadores actuales.
               */
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              /*
               * Se manda el ORIGEN, no la pagina. Google no necesita saber de
               * que pagina nuestra viene el play, pero algo tiene que llegarle:
               * un marco sin ningun referente lo rechaza YouTube con su error
               * 153.
               */
              referrerPolicy="strict-origin-when-cross-origin"
            />

            {/*
              LA FORMA DE VOLVER.
              Sin esto, una vez abierto el video no habia manera de regresar a
              la tarjeta: el marco se quedaba puesto para siempre. Y es ademas
              lo que suelta el carrusel, que se para mientras haya un video
              abierto.
            */}
            <button
              type="button"
              onClick={() => {
                setReproduciendo(false);
              }}
              aria-label={closeLabel}
              tabIndex={enfocable ? undefined : -1}
              className="absolute top-2 right-2 z-10 flex h-9 w-9 items-center justify-center
                         rounded-full bg-black/70 text-white transition hover:bg-black/90
                         focus-visible:outline-2 focus-visible:outline-offset-2
                         focus-visible:outline-white"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setReproduciendo(true);
            }}
            // El titulo se pinta debajo, asi que la etiqueta del boton lo
            // repite para que quien navegue a saltos sepa que video es.
            aria-label={title ? `${playLabel}: ${title}` : playLabel}
            tabIndex={enfocable ? undefined : -1}
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
