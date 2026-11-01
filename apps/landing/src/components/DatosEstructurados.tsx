import { useEffect } from 'react';
import { SITE_URL } from '../config/seo';
import { useBusinessContact } from '../hooks/useBusinessSettings';
import { useCatalog } from '../hooks/useCatalog';
import { grafoJsonLd, type PreguntaFrecuente } from '../lib/seo/negocio';

/**
 * EL BLOQUE JSON-LD, CON LOS DATOS DE VERDAD
 * ==========================================
 * No pinta nada: reescribe el `<script type="application/ld+json">` que
 * `index.html` trae con lo minimo, y lo deja con el telefono, el horario y la
 * zona que estan configurados en el panel.
 *
 * ==========================================================================
 * SE REESCRIBE EL QUE YA HAY, NO SE ANADE OTRO
 * ==========================================================================
 * `index.html` lleva un bloque minimo —nombre, direccion del sitio, logotipo,
 * estado— con el MISMO `@id`. Es lo que ve un rastreador que no ejecuta
 * JavaScript. Si esto anadiera un segundo `<script>`, el documento declararia
 * dos veces el mismo negocio y cual gana no esta definido.
 *
 * Con un unico nodo y el mismo `@id`, lo que ocurre es lo correcto: el bloque
 * minimo es verdad, y cuando la API contesta pasa a ser el mismo negocio con
 * mas detalle.
 *
 * ==========================================================================
 * NO SE ESPERA A QUE LLEGUE LA API PARA ESCRIBIR
 * ==========================================================================
 * Se escribe en cuanto se monta, con lo que haya, y se vuelve a escribir
 * cuando llegan los datos. Esperar seria peor: si la API no contesta —y la
 * primera regla de `useBusinessSettings` es que la pagina se pinta igual—, el
 * bloque se quedaria con lo minimo de `index.html`, que ya es verdad, en vez
 * de no existir.
 */
interface DatosEstructuradosProps {
  /**
   * Las preguntas frecuentes, ya con el texto que se esta pintando.
   *
   * SE RECIBEN EN VEZ DE LEERSE AQUI porque viven en `SiteCopyProvider`, que
   * solo envuelve la portada: en las paginas legales y en el 404 ese contexto
   * no existe, y un gancho no se puede llamar a veces. La portada las pasa
   * (ver `PreguntasEstructuradas`); las demas pantallas no pasan nada, que es
   * lo correcto: un bloque `FAQPage` en la politica de privacidad declararia
   * preguntas que no estan en esa pagina.
   */
  preguntas?: readonly PreguntaFrecuente[];
}

const SIN_PREGUNTAS: readonly PreguntaFrecuente[] = [];

export function DatosEstructurados({ preguntas = SIN_PREGUNTAS }: DatosEstructuradosProps) {
  const { settings, phoneDisplay, email } = useBusinessContact();
  const { catalog } = useCatalog();

  /*
   * El telefono en E.164 (`+14045550199`) y no el legible: schema.org pide un
   * numero que se pueda marcar, y `phoneDisplay` lleva parentesis y guiones
   * para que una persona lo lea. `phoneDisplay` se mira solo para saber SI
   * hay numero, que es la misma regla que sigue el resto del sitio.
   */
  const telefono = phoneDisplay === null ? null : settings.phone;

  /* El radio maximo atendido: el mayor limite de las zonas con distancia. */
  const radioMillas = (catalog?.zones ?? []).reduce(
    (max, zona) => (zona.maxMiles !== null && zona.maxMiles > max ? zona.maxMiles : max),
    0,
  );

  const base = catalog?.baseOfOperations ?? null;

  useEffect(() => {
    const nodo = document.getElementById('datos-estructurados');
    /*
     * Si el bloque no esta, NO SE CREA. Su sitio es `index.html`, porque ahi
     * lo ve tambien quien no ejecuta JavaScript; crearlo aqui taparia el
     * hecho de que falta y dejaria el sitio sin datos estructurados para la
     * mitad de los rastreadores sin que nada lo dijera. Hay una prueba que
     * comprueba que `index.html` lo trae.
     */
    if (!nodo) return;

    const grafo = grafoJsonLd(
      {
        sitio: SITE_URL,
        legalName: settings.legalName,
        telefono,
        email,
        horario: settings.hours,
        base,
        radioMillas,
      },
      preguntas,
    );

    nodo.textContent = JSON.stringify(grafo);
  }, [settings, telefono, email, base, radioMillas, preguntas]);

  return null;
}
