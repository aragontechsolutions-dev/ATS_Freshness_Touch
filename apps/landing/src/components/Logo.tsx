/**
 * LOGOTIPO DE FRESHNESS TOUCH
 * ---------------------------
 * Reconstruccion vectorial del isotipo del manual de marca: girasol, tejado
 * y onda, en azul #145788 y amarillo #F9C400.
 *
 * Se dibuja en SVG y no con una imagen porque asi escala sin perder nitidez,
 * pesa unos pocos kilobytes y puede adaptar sus colores al modo oscuro.
 *
 * El texto "Freshness Touch" es texto HTML real, no parte del SVG: lo lee un
 * lector de pantalla, se puede seleccionar y cambia de color con el tema
 * (en modo oscuro "Touch" no puede ser casi negro o desapareceria).
 */

interface LogoMarkProps {
  className?: string;
  /** Texto alternativo; vacio cuando el logotipo ya aporta el nombre al lado. */
  title?: string;
}

const PETALS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

export function LogoMark({ className = 'h-10 w-10', title }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {/*
        Composicion elegida tras comparar tres variantes renderizadas a 36, 56
        y 96 px sobre fondo claro y oscuro: es la unica que sigue siendo
        legible al tamano real de la cabecera. Las versiones con arco
        envolvente y ventana se descartaron porque a 36 px se emborronan.
      */}

      {/* Tejado: el hogar */}
      <path
        d="M27 41 42 25l14 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-brand-700 dark:text-brand-300"
      />

      {/* Onda: frescura y limpieza */}
      <path
        d="M6 52c8-5 15 3 23-1s14-4 29 1"
        fill="none"
        stroke="#f9c400"
        strokeWidth="4.5"
        strokeLinecap="round"
      />

      {/* Girasol: el sello de la marca */}
      <g transform="translate(19 26)">
        {PETALS.map((angle) => (
          <ellipse
            key={angle}
            rx="3.2"
            ry="7"
            cy="-9"
            fill="#f9c400"
            transform={`rotate(${angle})`}
          />
        ))}
        <circle r="6" fill="currentColor" className="text-brand-900 dark:text-brand-950" />
        <circle r="2.6" fill="#f9c400" />
      </g>
    </svg>
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
  sm: { mark: 'h-9 w-9', name: 'text-lg', sub: 'text-[0.55rem]' },
  md: { mark: 'h-11 w-11', name: 'text-xl', sub: 'text-[0.6rem]' },
  lg: { mark: 'h-16 w-16', name: 'text-3xl', sub: 'text-[0.7rem]' },
} as const;

export function Logo({ size = 'sm', withTagline = false, className = '' }: LogoProps) {
  const scale = SIZES[size];

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={scale.mark} />

      <span className="flex flex-col leading-none">
        <span className={`font-display font-extrabold tracking-tight ${scale.name}`}>
          <span className="text-brand-700 dark:text-brand-300">Freshness</span>{' '}
          {/* En modo oscuro no puede ser casi negro: seria invisible. */}
          <span className="text-ink dark:text-white">Touch</span>
        </span>

        <span
          className={`mt-1 font-display font-semibold tracking-[0.28em] text-slate-600
                      uppercase dark:text-slate-400 ${scale.sub}`}
        >
          Cleaning Services
        </span>

        {withTagline && (
          <span className="mt-2 text-sm font-medium text-brand-700 italic dark:text-brand-300">
            Fresh Spaces. A Touch Above.
          </span>
        )}
      </span>
    </span>
  );
}
