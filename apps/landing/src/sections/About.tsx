import { useTranslation } from 'react-i18next';
import { Reveal } from '../components/Reveal';

/**
 * NUESTRA HISTORIA
 * ================
 * La carta de la fundadora. Es la única sección del sitio que no argumenta
 * nada: no promete, no compara y no pide nada. Cuenta quién está detrás.
 *
 * ========================================================================
 * POR QUÉ UNA CARTA Y NO CUATRO TARJETAS MÁS
 * ========================================================================
 * `WhyUs` ya hace lo de las tarjetas, y lo hace bien: cuatro promesas
 * cortas, cada una con su icono, pensadas para leerse de un barrido. Partir
 * esta historia en tarjetas la convertiría en lo mismo otra vez, y lo que
 * aquí convence es justo lo contrario: que se lea del tirón, en primera
 * persona y con el nombre de quien lo firma debajo.
 *
 * Por eso es texto corrido en una columna estrecha —unos 65 caracteres por
 * línea, que es lo que el ojo sigue sin perderse— dentro de una tarjeta que
 * la separa del resto de la página.
 *
 * ========================================================================
 * LOS PÁRRAFOS SE RECORREN DE UNA LISTA, NO SE ESCRIBEN UNO A UNO
 * ========================================================================
 * Diez `<p>{t('about.p1')}</p>` seguidos son diez sitios donde olvidarse de
 * uno al añadir el siguiente, y el error no se ve: el párrafo simplemente no
 * sale. Con la lista, lo que falta falla en la prueba de i18n.
 *
 * ========================================================================
 * SIN FOTO, DE MOMENTO
 * ========================================================================
 * Una foto de la fundadora haría más por esta sección que cualquier ajuste
 * de tipografía. No se inventa ninguna: el día que haya una, entra en la
 * columna de la izquierda en pantallas grandes sin tocar el texto.
 */

/** Los diez párrafos de la carta, en orden. Ver la nota de arriba. */
const PARRAFOS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'] as const;

export function About() {
  const { t } = useTranslation();

  return (
    <section id="about" className="py-12 sm:py-16 lg:py-20">
      <div className="ft-container">
        <h2 className="ft-rule text-3xl font-bold tracking-tight text-brand-800 dark:text-white">
          {t('about.title')}
        </h2>

        {/*
          La frase larga de la fundadora va de subtítulo y no de título: un
          `h2` de catorce palabras no se lee en un móvil y pelea con el resto
          de los rótulos de la página.
        */}
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-700 dark:text-slate-300">
          {t('about.lead')}
        </p>

        {/*
          LA TARJETA SE ESTRECHA CON EL TEXTO, no ocupa el contenedor entero.
          Con la tarjeta a todo lo ancho y el texto limitado a 65 caracteres,
          en un monitor queda media tarjeta vacia a la derecha y la carta
          parece descolocada. El dia que haya una foto de la fundadora, es
          ahi donde entra y la tarjeta vuelve a ensancharse.
        */}
        <Reveal as="article" className="ft-card mt-8 max-w-3xl p-6 sm:p-8 lg:p-10">
          {/*
            `max-w-prose` deja la línea en unos 65 caracteres. Sin ese tope, en
            un monitor ancho cada párrafo se convierte en una línea de 200
            caracteres y el ojo pierde el renglón al volver a la izquierda.
          */}
          <div className="max-w-prose space-y-4 text-base leading-relaxed text-slate-700 dark:text-slate-300">
            {PARRAFOS.map((clave) => (
              <p key={clave}>{t(`about.${clave}`)}</p>
            ))}
          </div>

          {/*
            LA FIRMA VA APARTE, con una línea encima. No es un párrafo más: es
            el cierre de una carta, y se lee como tal.
          */}
          <footer className="mt-8 max-w-prose border-t border-brand-100 pt-6 dark:border-night-600">
            <p className="text-base text-slate-700 dark:text-slate-300">{t('about.closing')}</p>
            <p className="mt-2 text-xl font-bold text-brand-800 dark:text-brand-300">
              {t('about.signature')}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t('about.role')}</p>
          </footer>
        </Reveal>
      </div>
    </section>
  );
}
