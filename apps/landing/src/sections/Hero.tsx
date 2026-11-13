import { useTranslation } from 'react-i18next';
import { CheckIcon, ShieldIcon } from '../components/Icons';

export function Hero() {
  const { t } = useTranslation();
  const points = [t('hero.point1'), t('hero.point2'), t('hero.point3')];

  return (
    <section
      id="top"
      className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white
                                 dark:from-slate-900 dark:to-slate-950"
    >
      <div className="ft-container grid gap-10 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
        <div>
          <p
            className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-3 py-1.5 text-xs
                        font-semibold text-brand-800 dark:bg-night-700 dark:text-sun-300"
          >
            <ShieldIcon className="h-4 w-4" />
            {t('hero.badge')}
          </p>

          <h1
            className="ft-enter mt-5 text-4xl font-extrabold tracking-tight text-brand-800
                       sm:text-5xl dark:text-white"
            style={{ '--ft-delay': '80ms' } as React.CSSProperties}
          >
            {t('hero.title')}
          </h1>

          <p
            className="ft-enter mt-5 max-w-xl text-lg leading-relaxed text-slate-600
                       dark:text-slate-300"
            style={{ '--ft-delay': '160ms' } as React.CSSProperties}
          >
            {t('hero.subtitle')}
          </p>

          <ul
            className="ft-enter mt-6 space-y-2"
            style={{ '--ft-delay': '240ms' } as React.CSSProperties}
          >
            {points.map((point) => (
              <li
                key={point}
                className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300"
              >
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-600 dark:text-brand-300" />
                {point}
              </li>
            ))}
          </ul>

          <div
            className="ft-enter mt-8 flex flex-wrap gap-3"
            style={{ '--ft-delay': '320ms' } as React.CSSProperties}
          >
            <a href="#quote" className="ft-btn-primary">
              {t('hero.primaryCta')}
            </a>
            <a href="#services" className="ft-btn-outline">
              {t('hero.secondaryCta')}
            </a>
          </div>
        </div>

        {/*
          ==================================================================
          LA FOTO DE LA FUNDADORA, Y QUE HABIA ANTES AQUI
          ==================================================================
          Hasta el 13/11/2026 esta columna llevaba una tarjeta con un desglose
          de precio INVENTADO —«limpieza estandar $185», «horno $35»—. Se
          quito por dos motivos, y el segundo pesa mas que el primero:

            1. El cotizador, doscientos pixeles mas abajo, ensena ese mismo
               desglose con los numeros DE VERDAD de quien lo usa. Un ejemplo
               inventado al lado de un calculo real no aporta: compite.
            2. Esta es una empresa a la que se le abre la puerta de casa. En
               ese negocio el argumento mas fuerte no es un precio de ejemplo,
               es que detras hay UNA PERSONA CONCRETA, con nombre y cara. La
               carta de la fundadora ya estaba en el sitio (`about`); lo que
               faltaba era ponerle cara arriba del todo.

          ==================================================================
          ESTA FOTO ES EL ELEMENTO LCP DE LA PAGINA
          ==================================================================
          Es la imagen mas grande sobre la linea de flotacion, asi que es la
          que Google cronometra para Core Web Vitals. De ahi cada atributo:

            - `fetchPriority="high"` y SIN `loading="lazy"`: el navegador la
              pide cuanto antes. Una imagen LCP diferida es el fallo clasico
              que hunde la metrica sin que nada parezca roto.
            - `srcSet` con 420 y 755: un movil descarga 28 KB en vez de 66.
            - El contenedor fija la proporcion y la imagen la rellena. Sin eso
              el texto de debajo salta al cargar la foto, que es CLS — la otra
              metrica que mide Google.
        */}
        <figure className="ft-enter m-0" style={{ '--ft-delay': '400ms' } as React.CSSProperties}>
          <div className="relative aspect-4/5 overflow-hidden rounded-2xl shadow-lg sm:aspect-3/4">
            <img
              src="/fotos/hero-carmen-755.webp"
              srcSet="/fotos/hero-carmen-420.webp 420w, /fotos/hero-carmen-755.webp 755w"
              sizes="(min-width: 1024px) 32rem, 100vw"
              width={755}
              height={1254}
              alt={t('hero.photoAlt')}
              fetchPriority="high"
              decoding="async"
              className="h-full w-full object-cover object-[50%_10%]"
            />
          </div>

          {/*
            EL NOMBRE VA DEBAJO DE LA FOTO, NO ENCIMA.
            La primera version lo montaba sobre la esquina inferior izquierda
            de la imagen, como una tarjeta flotante. En la maqueta quedaba
            bien; en el sitio publicado tapaba el frasco y el brazo, y en
            modo oscuro la tarjeta oscura sobre la foto oscura se leia como
            una mancha. Debajo no tapa nada y se lee igual en los dos modos.

            UNA FOTO DE ALGUIEN CON UNIFORME PODRIA SER DE BANCO DE IMAGENES;
            el nombre y el cargo son lo que la convierten en una persona.
            `about.signature` y no una cadena suelta: el nombre ya vivia en
            la carta, y dos sitios con el mismo nombre acaban diciendo cosas
            distintas.
          */}
          <figcaption className="mt-4 flex items-baseline gap-2">
            <span className="font-bold text-brand-800 dark:text-white">{t('about.signature')}</span>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {t('hero.ownerRole')}
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
