import { useTranslation } from 'react-i18next';
import type { Locale, ServiceType } from '@freshness/types';
import { useCatalog } from '../hooks/useCatalog';
import { formatCentsCompact } from '../lib/format';
import { Reveal } from '../components/Reveal';

/**
 * LA FOTO DE CADA SERVICIO.
 *
 * ==========================================================================
 * SON FOTOS DE TRABAJO DE VERDAD, Y ESO ES LO QUE VALEN
 * ==========================================================================
 * Las hizo el equipo con el movil en casas reales. Tienen menos calidad que
 * un banco de imagenes y es exactamente por eso que sirven: en una empresa a
 * la que se le abre la puerta de casa, una foto de archivo con una modelo
 * sonriendo dice «esto puede ser cualquiera». Estas dicen «esto lo hacemos
 * nosotras».
 *
 * VIVEN EN `public/fotos/` Y NO EN EL ALMACEN, al reves que las de la
 * galeria. La diferencia no es un descuido: las de la galeria las PUBLICA la
 * empresa desde el panel y cambian solas, asi que tienen que poder cambiar
 * sin desplegar. Estas tres son parte del diseno de la pagina —si cambian,
 * cambia la pagina— y por eso entran por el repositorio, como el logotipo.
 *
 * Un servicio sin foto aqui NO rompe nada: la tarjeta se pinta sin cabecera,
 * que es lo que hara el comercial y la post-obra el dia que vuelvan.
 *
 * ==========================================================================
 * LA RUTA SE ESCRIBE ENTERA, NO SE ARMA CON UNA PLANTILLA
 * ==========================================================================
 * `/fotos/servicio-estandar-768.webp` y no `/fotos/${base}-768.webp`. Es mas
 * largo de leer y se gana algo que vale mas: la ruta se puede BUSCAR. Con la
 * plantilla, ni un `grep` ni la prueba que vigila estas fotos
 * (`las-fotos-del-sitio-existen.test.ts`) pueden saber que archivos pide el
 * sitio, y una foto borrada del disco se descubre en el navegador.
 *
 * Lo cazo esa misma prueba la primera vez que se escribio.
 */
const FOTO_POR_SERVICIO: Partial<Record<ServiceType, { ancha: string; estrecha: string }>> = {
  STANDARD: {
    estrecha: '/fotos/servicio-estandar-400.webp',
    ancha: '/fotos/servicio-estandar-768.webp',
  },
  DEEP: {
    estrecha: '/fotos/servicio-profunda-400.webp',
    ancha: '/fotos/servicio-profunda-768.webp',
  },
  MOVE_IN_OUT: {
    estrecha: '/fotos/servicio-mudanza-400.webp',
    ancha: '/fotos/servicio-mudanza-768.webp',
  },
};

/**
 * EL ORDEN EN QUE SE ENSENAN, no que servicios hay.
 *
 * Que se ofrece lo decide el catalogo, que ya trae solo los que estan
 * encendidos (ver `offered` en la configuracion de precios). Esta lista
 * ordena, y lo que no este en el catalogo no se pinta aunque aparezca aqui.
 *
 * Desde la etapa 3.4 el cambio de Airbnb, la post-obra y el comercial no se
 * ofrecen: se quitan de aqui tambien, para que la lista no prometa un orden
 * de cosas que no existen.
 */
const SERVICE_ORDER: ServiceType[] = ['STANDARD', 'DEEP', 'MOVE_IN_OUT'];

export function Services() {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage as Locale;
  const { catalog } = useCatalog();

  return (
    <section id="services" className="py-12 sm:py-16 lg:py-20">
      <div className="ft-container">
        <h2
          className="ft-rule text-3xl font-bold tracking-tight text-brand-800
                       dark:text-white"
        >
          {t('services.title')}
        </h2>
        <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
          {t('services.subtitle')}
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICE_ORDER.filter(
            // Mientras el catalogo no ha llegado se pintan las tres, que es
            // lo que evita que la seccion aparezca vacia y luego salte.
            (code) => !catalog || catalog.services.some((service) => service.code === code),
          ).map((code, indice) => {
            const entry = catalog?.services.find((service) => service.code === code);
            const foto = FOTO_POR_SERVICIO[code];

            return (
              <Reveal
                as="article"
                key={code}
                // Cascada corta: si el retardo creciera con cada tarjeta, las
                // ultimas tardarian demasiado en aparecer.
                delayMs={(indice % 3) * 90}
                className="ft-card ft-card-interactive flex flex-col overflow-hidden"
              >
                {/*
                  LA FOTO VA DENTRO DE LA TARJETA Y SIN PADDING, de borde a
                  borde. Con el padding de la tarjeta alrededor quedaria una
                  foto pequena flotando, que se lee como un adorno; a sangre
                  se lee como la cabecera de la tarjeta.

                  `loading="lazy"` AQUI SI, al reves que en la portada: estas
                  tres estan por debajo de la linea de flotacion, asi que
                  pedirlas de inmediato le robaria ancho de banda a la foto
                  que Google cronometra.

                  La proporcion la fija el contenedor para que el texto de
                  debajo no salte cuando la imagen termina de cargar.
                */}
                {foto !== undefined && (
                  <div className="relative aspect-16/9 overflow-hidden">
                    <img
                      src={foto.ancha}
                      srcSet={`${foto.estrecha} 400w, ${foto.ancha} 768w`}
                      sizes="(min-width: 1024px) 22rem, (min-width: 640px) 50vw, 100vw"
                      width={768}
                      height={432}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="flex grow flex-col p-6">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {t(`services.${code}.name`)}
                  </h3>
                  <p className="mt-2 grow text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {t(`services.${code}.description`)}
                  </p>

                  <p className="mt-5 text-sm font-semibold text-brand-700 dark:text-brand-300">
                    {/* El «desde X» sale de la tarifa mas barata que se ofrezca: el minimo facturable ya no existe. */}
                    {entry === undefined
                      ? ' '
                      : entry.instantQuote && entry.fromCents !== null
                        ? `${t('services.startingAt')} ${formatCentsCompact(entry.fromCents, locale)}`
                        : t('services.requiresVisit')}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
