import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { idiomaDeLaUrl } from '../lib/rutas';

/**
 * LA FLECHA DE ATRAS TIENE QUE DESHACER EL CAMBIO DE IDIOMA
 * =========================================================
 * `cambiarIdioma` usa `pushState` para no recargar la pagina y no perder lo
 * que alguien lleve escrito en el formulario de reserva. El precio de no
 * recargar es este gancho.
 *
 * Sin el, el sintoma es desconcertante y facil de no ver en desarrollo:
 * cambias a espanol, pulsas atras, LA BARRA DE DIRECCIONES VUELVE A `/` Y EL
 * TEXTO SIGUE EN ESPANOL. La pagina y su direccion dicen cosas distintas, y
 * si en ese momento se comparte el enlace, el otro abre algo que no es lo que
 * se estaba viendo.
 *
 * `popstate` es el evento de la flecha de atras y de la de adelante. No salta
 * con `pushState` —solo al navegar por el historial— asi que no se pisa con el
 * propio cambio de idioma.
 */
export function useIdiomaDeLaUrl(): void {
  const { i18n } = useTranslation();

  useEffect(() => {
    const sincronizar = (): void => {
      /*
       * `idiomaDeLaUrl` y NO `destinoPara(...).locale`: la segunda devuelve
       * `null` para `/` —no lleva prefijo— y con eso la vuelta atras de `/es`
       * a `/` dejaba la barra en `/` y el texto en espanol. Ver la nota en
       * `rutas.ts`.
       *
       * `null` queda solo para `/retirar-fotos`, donde el idioma lo eligio la
       * persona y cambiarselo al navegar por el historial seria quitarle su
       * eleccion sin motivo.
       */
      const locale = idiomaDeLaUrl(window.location.pathname);

      if (locale !== null && locale !== i18n.resolvedLanguage) void i18n.changeLanguage(locale);
    };

    window.addEventListener('popstate', sincronizar);
    return () => window.removeEventListener('popstate', sincronizar);
  }, [i18n]);
}
