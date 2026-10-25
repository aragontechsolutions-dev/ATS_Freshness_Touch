import { REMOVAL_LINK_PATH } from '@freshness/types';
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
 * LA PAGINA DE RETIRADA NO ES UNA SECCION DEL SITIO, ES OTRA PANTALLA.
 *
 * Quien llega aqui viene de un enlace de su correo para hacer UNA cosa, y
 * pintarle debajo el cotizador, los precios y el formulario de reserva seria
 * intentar venderle mientras retira sus fotos. Se le ensena lo que vino a
 * hacer y nada mas.
 *
 * SIN LIBRERIA DE RUTAS. Es la unica ruta aparte que tiene este sitio: meter
 * un enrutador entero —y su peso— para una comparacion de cadenas seria
 * pagar por un problema que no existe. El dia que haya tres, se mete.
 */
export default function App() {
  if (window.location.pathname.replace(/\/$/, '') === REMOVAL_LINK_PATH) {
    return <RetirarFotos />;
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
