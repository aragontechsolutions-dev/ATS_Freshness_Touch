/**
 * ICONOS DEL PANEL
 * ----------------
 * SVG en linea, sin libreria de iconos. Es la misma decision que en el sitio
 * publico (`apps/landing/src/components/Icons.tsx`): una libreria son cientos
 * de kilobytes y una dependencia mas que mantener para dibujar treinta
 * simbolos que caben en este archivo.
 *
 * DOS REGLAS QUE NO SE SALTAN:
 *
 * 1. TODOS LLEVAN `aria-hidden`. Un icono en este panel SIEMPRE acompana a un
 *    texto; nunca lo sustituye. Si un lector de pantalla los anunciara,
 *    leeria cada etiqueta dos veces. Donde el boton es solo icono —el tema,
 *    ver la contrasena— la etiqueta va en `aria-label` del boton, no aqui.
 *
 * 2. `currentColor` SIEMPRE, ningun color fijo. Asi el icono hereda el color
 *    del texto al que acompana y el contraste ya verificado en modo claro y
 *    oscuro sigue valiendo sin comprobar nada aparte.
 */
interface IconProps {
  className?: string;
}

const base = 'h-5 w-5';

/** Trazo comun: evita repetir los mismos cinco atributos treinta veces. */
function Trazo({
  className = base,
  children,
  strokeWidth = 1.8,
}: IconProps & { children: React.ReactNode; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/* ------------------------------ Navegacion ------------------------------ */

/** Agenda. */
export function CalendarIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Trazo>
  );
}

/** Mis trabajos. */
export function BriefcaseIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <rect x="2.5" y="7.5" width="19" height="12" rx="2.5" />
      <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M2.5 12.5h19" />
    </Trazo>
  );
}

/** Configuracion. */
export function GearIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 14a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4H21a1.6 1.6 0 0 0-1.5 1Z" />
    </Trazo>
  );
}

/** Avisos. */
export function BellIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5Z" />
      <path d="M13.7 19a2 2 0 0 1-3.4 0" />
    </Trazo>
  );
}

/** Personal. */
export function UsersIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="9" cy="7.5" r="3.5" />
      <path d="M22 20v-1.5a4 4 0 0 0-3-3.9M16.5 4.2a3.5 3.5 0 0 1 0 6.6" />
    </Trazo>
  );
}

/** Cerrar sesion. */
export function SignOutIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <path d="M15 17v1.5a2.5 2.5 0 0 1-2.5 2.5h-6A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3h6A2.5 2.5 0 0 1 15 5.5V7" />
      <path d="M10 12h11m0 0-3.5-3.5M21 12l-3.5 3.5" />
    </Trazo>
  );
}

/** Idioma. */
export function GlobeIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 9h17M3.5 15h17" />
      <path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z" />
    </Trazo>
  );
}

/** Volver. */
export function ArrowLeftIcon({ className }: IconProps) {
  return (
    <Trazo className={className} strokeWidth={2}>
      <path d="M20 12H5m0 0 5.5-5.5M5 12l5.5 5.5" />
    </Trazo>
  );
}

/* --------------------------------- Tema --------------------------------- */

export function SunIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.5 1.5m11.2 11.2 1.5 1.5M19.1 4.9l-1.5 1.5M6.4 17.6l-1.5 1.5" />
    </Trazo>
  );
}

export function MoonIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </Trazo>
  );
}

/* -------------------------------- Avisos -------------------------------- */

/** Aviso correcto. */
export function CheckCircleIcon({ className }: IconProps) {
  return (
    <Trazo className={className} strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.2 2.7 2.7L16 9.5" />
    </Trazo>
  );
}

/** Aviso de fallo. */
export function AlertIcon({ className }: IconProps) {
  return (
    <Trazo className={className} strokeWidth={2}>
      <path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9.5v4M12 17.2h.01" />
    </Trazo>
  );
}

/** Aviso informativo. */
export function InfoIcon({ className }: IconProps) {
  return (
    <Trazo className={className} strokeWidth={2}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.8h.01" />
    </Trazo>
  );
}

/** Cerrar un aviso. */
export function CloseIcon({ className }: IconProps) {
  return (
    <Trazo className={className} strokeWidth={2}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Trazo>
  );
}

/* ------------------------------- Acciones ------------------------------- */

export function PlusIcon({ className }: IconProps) {
  return (
    <Trazo className={className} strokeWidth={2}>
      <path d="M12 5v14M5 12h14" />
    </Trazo>
  );
}

export function PencilIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="M14.5 5.5 18.5 9.5" />
    </Trazo>
  );
}

/** Invitar al panel: un sobre que sale. */
export function SendIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 9.8 21 3Z" />
    </Trazo>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </Trazo>
  );
}

export function RefreshIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4" />
    </Trazo>
  );
}

/** Empezar un trabajo. */
export function PlayIcon({ className }: IconProps) {
  return (
    <Trazo className={className} strokeWidth={2}>
      <path d="M7 4.8v14.4a.8.8 0 0 0 1.2.7l11.3-7.2a.8.8 0 0 0 0-1.4L8.2 4.1a.8.8 0 0 0-1.2.7Z" />
    </Trazo>
  );
}

/** Terminar un trabajo. */
export function CheckIcon({ className }: IconProps) {
  return (
    <Trazo className={className} strokeWidth={2.2}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Trazo>
  );
}

/* --------------------------------- Datos -------------------------------- */

export function UserIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <circle cx="12" cy="8" r="3.8" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </Trazo>
  );
}

export function PhoneIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <path d="M2.5 5.5c0-1.1.9-2 2-2h2.2c.9 0 1.7.6 1.9 1.5l.7 2.6c.2.8-.1 1.6-.8 2l-1.2.8a12.5 12.5 0 0 0 5.3 5.3l.8-1.2c.4-.7 1.2-1 2-.8l2.6.7c.9.2 1.5 1 1.5 1.9v2.2c0 1.1-.9 2-2 2C10.2 20.5 2.5 12.8 2.5 5.5Z" />
    </Trazo>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="m3 7 8.2 5.6a1.5 1.5 0 0 0 1.6 0L21 7" />
    </Trazo>
  );
}

export function MapPinIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </Trazo>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 2" />
    </Trazo>
  );
}

/** Precio y cobro. */
export function CardIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19" />
    </Trazo>
  );
}

/**
 * Llave: acompana a las instrucciones de acceso (codigo de la puerta, donde
 * esta escondida la llave). Ese bloque ya va destacado; el icono lo hace
 * reconocible de un vistazo sin tener que leerlo.
 */
export function KeyIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <circle cx="7.5" cy="16.5" r="3.5" />
      <path d="m10 14 8.5-8.5M16 8l2.5 2.5M19 5l2 2" />
    </Trazo>
  );
}

/** Candado: la pantalla de acceso y las de contrasena. */
export function LockIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </Trazo>
  );
}

/* ------------------------- Ver / ocultar la clave ------------------------ */

export function EyeIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </Trazo>
  );
}

export function EyeOffIcon({ className }: IconProps) {
  return (
    <Trazo className={className}>
      <path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a18 18 0 0 1-3.2 3.9M6.4 7.9A17.6 17.6 0 0 0 2 12s3.6 6 10 6a9.7 9.7 0 0 0 4-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
    </Trazo>
  );
}

/* -------------------------------- Espera -------------------------------- */

/**
 * Rueda de espera para los botones ocupados.
 *
 * GIRA SOLO SI HAY MOVIMIENTO PERMITIDO, como todo lo demas. No es un
 * descuido: quien pidio reducir el movimiento no se queda sin saber que pasa,
 * porque el boton ocupado CAMBIA SU TEXTO ("Guardando…") y se deshabilita. El
 * giro es el adorno; el texto es la informacion. Si fuera al reves —el estado
 * solo visible en el giro— habria que exceptuarlo, y no lo es.
 */
export function SpinnerIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`ft-spin ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
