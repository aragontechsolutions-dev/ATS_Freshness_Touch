import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { StickyMobileCta } from './components/StickyMobileCta';
import { Hero } from './sections/Hero';
import { Services } from './sections/Services';
import { QuoteCalculator } from './sections/QuoteCalculator';
import { WhyUs } from './sections/WhyUs';
import { ServiceAreas } from './sections/ServiceAreas';
import { Faq } from './sections/Faq';
import { Contact } from './sections/Contact';
import { BusinessSettingsProvider } from './hooks/useBusinessSettings';

export default function App() {
  return (
    /*
     * El telefono, el correo y el horario se leen una sola vez al abrir y se
     * reparten desde aqui. Una peticion para toda la pagina en vez de una por
     * cada sitio donde sale el telefono, que son siete.
     */
    <BusinessSettingsProvider>
      <Header />
      <main className="pb-20 sm:pb-0">
        <Hero />
        <Services />
        <QuoteCalculator />
        <WhyUs />
        <ServiceAreas />
        <Faq />
        <Contact />
      </main>
      <Footer />
      <StickyMobileCta />
    </BusinessSettingsProvider>
  );
}
