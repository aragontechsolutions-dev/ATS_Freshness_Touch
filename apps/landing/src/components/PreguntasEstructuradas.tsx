import { useMemo } from 'react';
import { useSiteText } from '../hooks/useSiteCopy';
import { CLAVES_DE_PREGUNTAS } from '../lib/seo/preguntas';
import type { PreguntaFrecuente } from '../lib/seo/negocio';
import { DatosEstructurados } from './DatosEstructurados';

/**
 * LOS DATOS ESTRUCTURADOS DE LA PORTADA, CON SUS PREGUNTAS
 * ========================================================
 * Existe por una restriccion de React y no por gusto: `useSiteText` necesita
 * `SiteCopyProvider`, que solo envuelve la portada. En las paginas legales y
 * en el 404 ese contexto no existe, y un gancho no se puede llamar solo a
 * veces. Asi que la portada monta ESTE componente y las demas pantallas
 * montan `DatosEstructurados` directamente, sin preguntas.
 *
 * ==========================================================================
 * EL TEXTO SALE DE `useSiteText`, EL MISMO QUE PINTA LA SECCION
 * ==========================================================================
 * Las seis preguntas se reescriben desde el panel. Si este bloque leyera el
 * paquete de idioma, declararia la respuesta vieja en cuanto la dueña
 * reescribiera una —y declarar contenido que no esta visible en la pagina es
 * exactamente lo que las directrices de datos estructurados prohiben—.
 */
export function PreguntasEstructuradas() {
  const { texto } = useSiteText();

  /*
   * `useMemo` no es por rendimiento: `preguntas` es una dependencia del efecto
   * que escribe el bloque, y un array nuevo en cada render lo haria
   * reescribirse en cada pintado de la portada.
   */
  const preguntas = useMemo<readonly PreguntaFrecuente[]>(
    () =>
      CLAVES_DE_PREGUNTAS.map((claves) => ({
        pregunta: texto(claves.pregunta),
        respuesta: texto(claves.respuesta),
      })),
    [texto],
  );

  return <DatosEstructurados preguntas={preguntas} />;
}
