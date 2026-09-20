/**
 * Iconos en linea (SVG). Se evita una libreria de iconos para no anadir
 * dependencias ni peso al bundle por unos pocos simbolos.
 */
interface IconProps {
  className?: string;
}

const base = 'h-5 w-5';

export function PhoneIcon({ className = base }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 5.5c0-1.1.9-2 2-2h2.2c.9 0 1.7.6 1.9 1.5l.7 2.6c.2.8-.1 1.6-.8 2l-1.2.8a12.5 12.5 0 0 0 5.3 5.3l.8-1.2c.4-.7 1.2-1 2-.8l2.6.7c.9.2 1.5 1 1.5 1.9v2.2c0 1.1-.9 2-2 2C10.2 20.5 2.5 12.8 2.5 5.5Z"
      />
    </svg>
  );
}

export function MailIcon({ className = base }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path strokeLinecap="round" d="m3 7 8.2 5.6a1.5 1.5 0 0 0 1.6 0L21 7" />
    </svg>
  );
}

export function CheckIcon({ className = base }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

export function SunIcon({ className = base }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path
        strokeLinecap="round"
        d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.5 1.5m11.2 11.2 1.5 1.5M19.1 4.9l-1.5 1.5M6.4 17.6l-1.5 1.5"
      />
    </svg>
  );
}

export function MoonIcon({ className = base }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
      />
    </svg>
  );
}

export function SparkleIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2.5 13.8 8 19.5 9.8 13.8 11.6 12 17.1 10.2 11.6 4.5 9.8 10.2 8 12 2.5Z" />
      <path d="M18.5 15.5 19.4 18l2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.5Z" opacity=".7" />
    </svg>
  );
}

export function ShieldIcon({ className = base }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinejoin="round"
        d="M12 2.8 4.8 5.6v5.9c0 4.4 3 8.2 7.2 9.7 4.2-1.5 7.2-5.3 7.2-9.7V5.6L12 2.8Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.8 12 2.3 2.3 4.1-4.6" />
    </svg>
  );
}

export function MapPinIcon({ className = base }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path strokeLinejoin="round" d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  );
}

export function TagIcon({ className = base }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinejoin="round"
        d="M3.5 11.6V4.5c0-.6.4-1 1-1h7.1c.3 0 .5.1.7.3l8.4 8.4c.4.4.4 1 0 1.4l-7.1 7.1c-.4.4-1 .4-1.4 0L3.8 12.3a1 1 0 0 1-.3-.7Z"
      />
      <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function RefreshIcon({ className = base }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4" />
    </svg>
  );
}
