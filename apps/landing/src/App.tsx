import { LEGAL_PATHS, REMOVAL_LINK_PATH } from '@freshness/types';
import { PaginaLegal } from './components/PaginaLegal';
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
import { ServiceAreas } from './sections/ServiceAreas';
import { Faq } from './sections/Faq';
import { Contact } from './sections/Contact';
import { BusinessSettingsProvider } from './hooks/useBusinessSettings';
import { SiteCopyProvider } from './hooks/useSiteCopy';

/**
 * LAS PANTALLAS QUE NO SON EL SITIO.
 *
 * Tres: retirar las fotos, las condiciones y la privacidad. Ninguna es una
 * seccion de la portada. Quien llega a cualquiera de ellas viene a hacer UNA
 * cosa, y pintarle debajo el cotizador y el formulario de reserva seria
 * intentar venderle mientras lee un contrato.
 *
 * ========================================================================
 * SIGUE SIN HABER LIBRERIA DE RUTAS, Y AHORA HAY QUE EXPLICARLO
 * ========================================================================
 * El comentario que habia aqui decia «el dia que haya tres, se mete». Hay
 * tres. Y sigue sin meterse, porque al llegar el momento la cuenta no salio:
 * un enrutador aporta rutas con parametros, navegacion sin recargar e
 * historial, y estas tres son direcciones fijas a las que se llega desde
 * fuera —un correo, el pie, una pestana nueva— y de las que no se vuelve.
 * Pagar cuarenta kilobytes en el sitio que genera los ingresos por un `switch`
 * de tres casos no es una decision tecnica, es una costumbre.
 *
 * LA LINEA QUE SI LO CAMBIA: el dia que una de estas pantallas necesite
 * enlazar a otra sin recargar, o lleve un identificador dentro de la ruta.
 */
const PANTALLAS: Record<string, () => React.JSX.Element> = {
  [REMOVAL_LINK_PATH]: () => <RetirarFotos />,
  [LEGAL_PATHS.terms]: () => <PaginaLegal cual="terms" />,
  [LEGAL_PATHS.privacy]: () => <PaginaLegal cual="privacy" />,
};

export default function App() {
  const ruta = window.location.pathname.replace(/\/$/, '');
  const pantalla = PANTALLAS[ruta];

  /*
   * LAS LEGALES LLEVAN CABECERA Y PIE, la de retirar fotos no. Quien lee las
   * condiciones puede querer volver al sitio o llamar; quien retira sus
   * fotos viene a una sola cosa y no hay que ofrecerle nada mas.
   */
  if (pantalla) {
    if (ruta === REMOVAL_LINK_PATH) return pantalla();

    return (
      <BusinessSettingsProvider>
        <Header />
        {pantalla()}
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
        <Header />
        <main className="pb-20 sm:pb-0">
          <Hero />
          <Services />
          <ScopeOfWork />
          <QuoteCalculator />
          <WhyUs />
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
