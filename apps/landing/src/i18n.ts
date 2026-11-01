import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { defaultLocale, resources, supportedLocales } from '@freshness/i18n';
import type { Locale } from '@freshness/types';
import { destinoPara, rutaPara, type Pantalla } from './lib/rutas';
import { paginaDe } from './lib/seo/paginas';

const STORAGE_KEY = 'ft-locale';

function isSupported(value: string | null | undefined): value is Locale {
  return Boolean(value) && (supportedLocales as readonly string[]).includes(value as string);
}

function guardado(): Locale | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isSupported(stored) ? stored : null;
  } catch {
    // localStorage puede estar bloqueado (modo privado): se ignora.
    return null;
  }
}

/**
 * EL IDIOMA INICIAL, Y LA DECISION QUE HAY DETRAS
 * ===============================================
 * Antes era: eleccion guardada > idioma del navegador > ingles. Con el idioma
 * en la direccion (ver `lib/rutas.ts`) ese orden ya no sirve, y conviene
 * explicar por que, porque hay una perdida real.
 *
 * ==========================================================================
 * 1. LA DIRECCION MANDA SOBRE TODO
 * ==========================================================================
 * `/es` es espanol y `/` es ingles, siempre, para todo el mundo. No es un
 * capricho de pureza: si `/` pudiera servir espanol segun quien entre, los dos
 * idiomas volverian a compartir direccion y el espanol seguiria sin existir
 * para un buscador, que es el problema que esta etapa venia a arreglar.
 *
 * Y tambien es lo que hace que compartir un enlace funcione: quien manda
 * `/es` por WhatsApp espera que el otro lo abra en espanol.
 *
 * ==========================================================================
 * 2. UNA ELECCION YA HECHA EN ESTE SITIO SI PUEDE CAMBIAR LA DIRECCION
 * ==========================================================================
 * Quien entro antes y pulso «Espanol» tiene esa eleccion guardada. Al volver
 * a `/`, se le lleva a `/es` —cambiando la direccion, no solo el texto— asi
 * que lo que ve y lo que dice la barra coinciden.
 *
 * Esto es seguro para el SEO por una razon concreta: UN RASTREADOR NO TIENE
 * `localStorage`. Googlebot entra sin nada guardado y siempre ve `/` en
 * ingles.
 *
 * ==========================================================================
 * 3. EL IDIOMA DEL NAVEGADOR YA NO DECIDE NADA EN LA PORTADA, Y SE PIERDE ALGO
 * ==========================================================================
 * Antes, alguien con el movil en espanol que entraba por primera vez en `/`
 * veia el sitio en espanol. Ahora ve ingles hasta que pulsa el selector.
 *
 * Es una perdida y no se disimula. Se acepta por dos motivos:
 *
 *   - Redirigir segun el idioma del navegador es justo lo que las guias de
 *     Google desaconsejan, y produce el mismo problema de antes por otra
 *     puerta: dos contenidos en una direccion.
 *   - Lo que de verdad resuelve ese caso es que `/es` ESTE INDEXADO: quien
 *     busca «limpieza de casas marietta» aterriza directamente en espanol, sin
 *     pasar por la portada inglesa. Eso solo es posible con el idioma en la
 *     direccion, y era imposible antes.
 *
 * El idioma del navegador sigue decidiendo en `/retirar-fotos`, que no se
 * indexa y cuya direccion no puede cambiar porque esta dentro de correos ya
 * enviados.
 */
function detectLocale(pathname: string): { locale: Locale; corregirUrl: Pantalla | null } {
  const destino = destinoPara(pathname);

  // 1. La direccion lo dice: se acabo la discusion.
  if (destino.locale !== null) return { locale: destino.locale, corregirUrl: null };

  const elegido = guardado();

  // 2. Una eleccion previa EN ESTE SITIO, y solo en pantallas indexables.
  if (elegido !== null && elegido !== defaultLocale && paginaDe(destino.pantalla) !== null) {
    return { locale: elegido, corregirUrl: destino.pantalla };
  }

  // 3. Las pantallas sin direccion por idioma siguen con lo de siempre.
  if (paginaDe(destino.pantalla) === null) {
    if (elegido !== null) return { locale: elegido, corregirUrl: null };

    const delNavegador = navigator.language?.split('-')[0];
    return {
      locale: isSupported(delNavegador) ? delNavegador : defaultLocale,
      corregirUrl: null,
    };
  }

  return { locale: defaultLocale, corregirUrl: null };
}

export function persistLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Sin persistencia el idioma dura solo la sesion: comportamiento aceptable.
  }
  document.documentElement.lang = locale;
}

/**
 * Cambia de idioma SIN RECARGAR, y deja la direccion de acuerdo.
 *
 * ==========================================================================
 * `pushState` Y NO `location.assign`
 * ==========================================================================
 * Recargar seria mas simple y romperia algo concreto: alguien a mitad del
 * formulario de reserva —con el tamano de su casa, su codigo postal y su
 * fecha ya puestos— que pulsa el selector de idioma para entender una
 * pregunta, perderia todo lo escrito. El selector de idioma no puede ser un
 * boton que borra lo que llevas hecho.
 *
 * Con `pushState` la direccion cambia, i18next repinta los textos y el estado
 * del formulario sigue donde estaba. Y como entra en el historial, la flecha
 * de atras vuelve al idioma anterior: de eso se encarga `useIdiomaDeLaUrl`.
 *
 * LA CADENA DE CONSULTA Y EL FRAGMENTO SE CONSERVAN. El fragmento porque es
 * la seccion que se esta mirando (`#areas`), y la cadena de consulta porque
 * puede traer de donde vino la visita.
 */
export function cambiarIdioma(locale: Locale, pantalla: Pantalla): void {
  const destino = rutaPara(pantalla, locale);

  if (window.location.pathname !== destino) {
    window.history.pushState(
      null,
      '',
      `${destino}${window.location.search}${window.location.hash}`,
    );
  }

  void i18next.changeLanguage(locale);
  persistLocale(locale);
}

const inicial = detectLocale(window.location.pathname);

/**
 * Si la eleccion guardada pide otra direccion, se corrige ANTES de pintar.
 *
 * `replaceState` y no `pushState`: esto no es una navegacion que la persona
 * haya hecho, asi que no debe quedar en el historial. Con `pushState`, la
 * flecha de atras volveria a `/` y de ahi otra vez a `/es`, dejando a alguien
 * atrapado pulsando atras sin salir del sitio.
 */
if (inicial.corregirUrl !== null) {
  const destino = rutaPara(inicial.corregirUrl, inicial.locale);
  window.history.replaceState(
    null,
    '',
    `${destino}${window.location.search}${window.location.hash}`,
  );
}

void i18next.use(initReactI18next).init({
  resources,
  lng: inicial.locale,
  fallbackLng: defaultLocale,
  supportedLngs: [...supportedLocales],
  interpolation: {
    // React ya escapa el contenido: escapar dos veces romperia los textos.
    escapeValue: false,
  },
  returnNull: false,
});

document.documentElement.lang = inicial.locale;

export default i18next;
