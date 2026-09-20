import logoMark from '../assets/logo-mark.webp';

/**
 * LOGOTIPO DE FRESHNESS TOUCH
 * ---------------------------
 * `LogoMark` es el isotipo oficial de la empresa (girasol, hogar y onda sobre
 * el circulo azul), servido desde el propio dominio.
 *
 * El nombre "Freshness Touch" NO forma parte de la imagen, es texto HTML real.
 * Tres motivos:
 *   1. Lo lee un lector de pantalla y se puede seleccionar y buscar.
 *   2. Cambia de color con el tema: en modo oscuro "Touch" tiene que ser
 *      blanco, porque el casi negro del manual seria invisible.
 *   3. Se mantiene nitido a cualquier tamano y no anade peso de descarga.
 *
 * El lockup horizontal completo (imagen con el nombre incluido) esta en
 * `public/brand/logo-full.webp` para correos, facturas y prensa. No se usa en
 * la interfaz porque lleva fondo blanco y texto negro fijos: en modo oscuro
 * quedaria un recuadro blanco.
 */

interface LogoMarkProps {
  className?: string;
  /** Texto alternativo; vacio cuando el nombre ya aparece al lado. */
  title?: string;
}

export function LogoMark({ className = 'h-10 w-10', title }: LogoMarkProps) {
  return (
    <img
      src={logoMark}
      // El isotipo es decorativo cuando el nombre de la empresa va al lado:
      // anunciarlo dos veces molesta a quien usa lector de pantalla.
      alt={title ?? ''}
      className={className}
      width={256}
      height={256}
      // Esta en la cabecera, siempre visible: no debe cargarse en diferido.
      loading="eager"
      decoding="async"
      draggable={false}
    />
  );
}

interface LogoProps {
  /** Tamano del conjunto. "sm" para cabeceras compactas. */
  size?: 'sm' | 'md' | 'lg';
  /** Muestra el eslogan bajo el nombre. */
  withTagline?: boolean;
  className?: string;
}

const SIZES = {
  sm: {
    mark: 'h-10 w-10 sm:h-11 sm:w-11',
    name: 'text-base sm:text-lg',
    sub: 'text-[0.5rem] sm:text-[0.55rem]',
  },
  md: { mark: 'h-14 w-14', name: 'text-xl', sub: 'text-[0.6rem]' },
  lg: { mark: 'h-20 w-20', name: 'text-3xl', sub: 'text-[0.7rem]' },
} as const;

export function Logo({ size = 'sm', withTagline = false, className = '' }: LogoProps) {
  const scale = SIZES[size];

  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <LogoMark className={`${scale.mark} shrink-0`} />

      <span className="flex flex-col leading-none">
        <span className={`font-display font-extrabold tracking-tight ${scale.name}`}>
          <span className="text-brand-700 dark:text-brand-300">Freshness</span>{' '}
          <span className="text-ink dark:text-white">Touch</span>
        </span>

        {/*
          Filete amarillo y descriptor, como en el manual de marca.
          En pantallas estrechas se oculta: partido en dos lineas quedaba
          descuidado, y ahi la marca ya se reconoce con isotipo y nombre.
        */}
        <span className="mt-1.5 hidden items-center gap-2 sm:flex">
          <span className="h-0.5 w-4 rounded-full bg-sun-400" aria-hidden="true" />
          <span
            className={`font-display font-semibold tracking-[0.24em] text-slate-600
                        uppercase dark:text-slate-400 ${scale.sub}`}
          >
            Cleaning Services
          </span>
        </span>

        {withTagline && (
          <span className="mt-2.5 text-sm font-medium text-brand-700 italic dark:text-brand-300">
            Fresh Spaces. A Touch Above.
          </span>
        )}
      </span>
    </span>
  );
}
