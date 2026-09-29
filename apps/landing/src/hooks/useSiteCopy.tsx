import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_SITE_COPY,
  siteCopyText,
  toSiteCopyLocale,
  type SiteCopy,
  type SiteCopyKey,
} from '@freshness/types';
import { fetchSiteCopy } from '../lib/api';

/**
 * LOS TEXTOS DE LA WEB, EN VIVO
 * -----------------------------
 * Las promesas y las preguntas frecuentes se leen de la API al abrir la
 * pagina. Si la empresa no ha reescrito una, se usa la del codigo.
 *
 * EL RESPALDO VA DENTRO DE LA FUNCION, Y ESO ES LO IMPORTANTE. Quien pinta
 * un texto escribe `texto('whyUs.insured.title')` y ya esta: no hay una
 * segunda linea que se pueda olvidar. Si esto devolviera el texto
 * configurado o `null`, tarde o temprano alguien pintaria el `null` y la
 * portada saldria con un hueco.
 *
 * FUNCIONA IGUAL SI LA API NO RESPONDE. No se configura nada, se usan los
 * textos del codigo y la pagina se pinta entera. Es la pagina que genera los
 * ingresos: que no cargue por no saber una frase seria absurdo.
 *
 * MIENTRAS SE CARGA SE ENSENA EL TEXTO DEL CODIGO, no un hueco. El primer
 * pintado es el de siempre y, si hay texto configurado, se sustituye al
 * llegar. Es la eleccion correcta aunque implique un parpadeo: lo que dice
 * el codigo tambien es cierto, solo esta desactualizado.
 */

interface SiteTextos {
  /** El texto de esa clave, ya resuelto y listo para pintar. */
  texto: (key: SiteCopyKey) => string;
}

const SiteCopyContext = createContext<SiteCopy>(DEFAULT_SITE_COPY);

export function SiteCopyProvider({ children }: { children: ReactNode }) {
  const [copy, setCopy] = useState<SiteCopy>(DEFAULT_SITE_COPY);

  useEffect(() => {
    const controller = new AbortController();

    fetchSiteCopy(controller.signal)
      .then(setCopy)
      .catch(() => {
        /*
         * Se traga a proposito. No es un error que el visitante pueda
         * resolver ni deba ver: la pagina sigue con los textos del codigo.
         * El cliente de API ya deja el detalle en la consola.
         */
      });

    return () => controller.abort();
  }, []);

  return <SiteCopyContext.Provider value={copy}>{children}</SiteCopyContext.Provider>;
}

/**
 * Los textos de la web, con el respaldo ya resuelto.
 *
 * El texto se pinta SIEMPRE con las llaves de React, que escapan solo. Nunca
 * con `dangerouslySetInnerHTML`: lo que devuelve esto lo escribio alguien en
 * el panel, y aunque sea una persona de confianza, una cuenta comprometida
 * no debe poder inyectar nada en la pagina publica.
 */
export function useSiteText(): SiteTextos {
  const copy = useContext(SiteCopyContext);
  const { t, i18n } = useTranslation();
  const locale = toSiteCopyLocale(i18n.resolvedLanguage);

  return useMemo(
    () => ({
      /*
       * La clave del texto editable ES la clave de traduccion. Por eso el
       * respaldo cabe en una linea y no hace falta ninguna tabla que
       * mantener sincronizada.
       */
      texto: (key) => siteCopyText(copy, key, locale) ?? t(key),
    }),
    [copy, locale, t],
  );
}
