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

export default function App() {
  return (
    <>
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
    </>
  );
}
