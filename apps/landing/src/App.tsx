import { PaginaLegal } from './components/PaginaLegal';
import { PaginaNoEncontrada } from './components/PaginaNoEncontrada';
import { pantallaPara } from './lib/rutas';
import { useSeo } from './hooks/useSeo';
import { useIdiomaDeLaUrl } from './hooks/useIdiomaDeLaUrl';
import { DatosEstructurados } from './components/DatosEstructurados';
import { PreguntasEstructuradas } from './components/PreguntasEstructuradas';
import { RetirarFotos } from './components/RetirarFotos';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { StickyMobileCta } from './components/StickyMobileCta';
import { Hero } from './sections/Hero';
import { Services } from './sections/Services';
import { ScopeOfWork } from './sections/ScopeOfWork';
import { Gallery } from './sections/Gallery';
import { QuoteCalculator } from './sections/QuoteCalculator';
import { WhyUs } from './sections/WhyUs';
import { About } from './sections/About';
import { ServiceAreas } from './sections/ServiceAreas';
import { Faq } from './sections/Faq';
import { Contact } from './sections/Contact';
import { BusinessSettingsProvider } from './hooks/useBusinessSettings';
import { SiteCopyProvider } from './hooks/useSiteCopy';

/**
 * LAS PANTALLAS QUE NO SON EL SITIO.
 *
 * Retirar las fotos, las condiciones, la privacidad y el 404. Ninguna es una
 * seccion de la portada: quien llega a ellas viene a hacer UNA cosa, y
 * pintarle debajo el cotizador seria intentar venderle mientras lee un
 * contrato.
 *
 * ========================================================================
 * QUE DIRECCION ES CADA UNA SE DECIDE EN `lib/rutas.ts`
 * ========================================================================
 * Fuera de aqui y como funcion pura, porque esa lista llego a estar mal en
 * produccion —`/terms` y `/privacy` devolvian el 404 de Vercel— y ahora hay
 * una prueba que la recorre. Aqui solo queda QUE SE PINTA con cada una.
 *
 * ========================================================================
 * SIGUE SIN HABER LIBRERIA DE RUTAS, Y AHORA HAY QUE EXPLICARLO
 * ========================================================================
 * El comentario que habia aqui decia «el dia que haya tres, se mete». Hay
 * cuatro. Y sigue sin meterse, porque al llegar el momento la cuenta no
 * salio: un enrutador aporta rutas con parametros, navegacion sin recargar e
 * historial, y estas son direcciones fijas a las que se llega desde fuera —un
 * correo, el pie, una pestana nueva— y de las que no se vuelve. Pagar
 * cuarenta kilobytes en el sitio que genera los ingresos por un `switch` de
 * cuatro casos no es una decision tecnica, es una costumbre.
 *
 * LA LINEA QUE SI LO CAMBIA: el dia que una de estas pantallas necesite
 * enlazar a otra sin recargar, o lleve un identificador dentro de la ruta.
 */
export default function App() {
  const pantalla = pantallaPara(window.location.pathname);

  /*
   * EL TITULO, LA DESCRIPCION Y EL CANONICAL DE ESTA PANTALLA.
   *
   * Va aqui arriba y antes de cualquier `return` porque un gancho no puede
   * ir detras de una salida anticipada. Y va en este componente porque es el
   * unico que sabe QUE PANTALLA es: las cuatro compartian las etiquetas de
   * `index.html`, asi que en Google las condiciones de servicio se
   * anunciaban como la portada de una empresa de limpieza.
   */
  useSeo(pantalla);

  /*
   * Y la flecha de atras deshace el cambio de idioma. Hace falta porque el
   * selector usa `pushState` en vez de recargar: ver `useIdiomaDeLaUrl`.
   */
  useIdiomaDeLaUrl();

  /*
   * QUIEN RETIRA SUS FOTOS NO VE NADA MAS: ni cabecera, ni pie, ni una
   * invitacion a pedir precio. Vino a una sola cosa.
   */
  if (pantalla === 'retirarFotos') return <RetirarFotos />;

  /*
   * LAS DEMAS LLEVAN CABECERA Y PIE. Quien lee las condiciones puede querer
   * volver al sitio o llamar, y quien ha caido en un enlace roto, mas.
   */
  if (pantalla !== 'sitio') {
    return (
      <BusinessSettingsProvider>
        {/*
          SIN PREGUNTAS FRECUENTES, y no por simplificar: un bloque `FAQPage`
          en la politica de privacidad declararia preguntas que no estan en
          esa pagina, que es justo lo que las directrices prohiben.
        */}
        <DatosEstructurados />
        <Header />
        {pantalla === 'noEncontrada' ? <PaginaNoEncontrada /> : <PaginaLegal cual={pantalla} />}
        <Footer />
      </BusinessSettingsProvider>
    );
  }

  return (
    /*
     * El telefono, el correo y el horario se leen una sola vez al abrir y se
     * reparten desde aqui. Una peticion para toda la pagina en vez de una por
     * cada sitio donde sale el telefono, que son siete.
     */
    <BusinessSettingsProvider>
      {/*
        Los textos editables se leen tambien una sola vez y se reparten desde
        aqui, por lo mismo: dos secciones los usan, y una peticion por
        seccion serian dos peticiones para la misma respuesta.
      */}
      <SiteCopyProvider>
        {/*
          Va DENTRO de `SiteCopyProvider` porque las preguntas que declara son
          las que se estan pintando, y esas se editan desde el panel.
        */}
        <PreguntasEstructuradas />
        <Header />
        <main className="pb-20 sm:pb-0">
          <Hero />
          <Services />
          <ScopeOfWork />
          <QuoteCalculator />
          <WhyUs />
          {/*
            LA HISTORIA VA DESPUES DE LAS PROMESAS Y ANTES DE LAS FOTOS.
            «Por que nosotros» son cuatro promesas cortas; esto es quien las
            hace. Puesta antes, el visitante lee una carta personal de alguien
            que todavia no le ha dicho a que se dedica; puesta al final, no la
            lee nadie. Aqui cierra el argumento de confianza justo antes de
            que las fotos lo demuestren.
          */}
          <About />
          {/*
            El antes y despues va DESPUES de por que nosotros y antes de las
            zonas: a esta altura el visitante ya sabe que ofrecemos y que
            prometemos, y lo que le falta es verlo. Si estuviera arriba
            retrasaria el cotizador, que es lo que genera los ingresos, y si
            no hay videos configurados la seccion no se pinta.
          */}
          <Gallery />
          <ServiceAreas />
          <Faq />
          <Contact />
        </main>
        <Footer />
        <StickyMobileCta />
      </SiteCopyProvider>
    </BusinessSettingsProvider>
  );
}
