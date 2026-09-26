import { useTranslation } from 'react-i18next';
import type { BookingStatus } from '@freshness/types';

/**
 * El color acompaña al texto, nunca lo sustituye: quien no distingue colores
 * necesita poder leer el estado. Por eso el nombre va siempre escrito.
 *
 * El punto de delante es DECORATIVO y por eso va oculto al lector de
 * pantalla. Sirve para encontrar de un vistazo los "en curso" en una lista de
 * veinte, que es algo que se hace mirando, no leyendo.
 */
const TONO: Record<BookingStatus, { chip: string; punto: string }> = {
  PENDING_PAYMENT: {
    chip: 'bg-sun-100 text-sun-800 dark:bg-sun-900 dark:text-sun-200',
    punto: 'bg-sun-600 dark:bg-sun-300',
  },
  CONFIRMED: {
    chip: 'bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200',
    punto: 'bg-brand-600 dark:bg-brand-300',
  },
  IN_PROGRESS: {
    chip: 'bg-brand-200 text-brand-900 dark:bg-brand-800 dark:text-brand-100',
    punto: 'bg-brand-700 dark:bg-brand-200',
  },
  COMPLETED: {
    chip: 'bg-slate-200 text-slate-800 dark:bg-night-600 dark:text-slate-200',
    punto: 'bg-slate-500 dark:bg-slate-300',
  },
  CANCELLED: {
    chip: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
    punto: 'bg-red-600 dark:bg-red-400',
  },
  NO_SHOW: {
    chip: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
    punto: 'bg-red-600 dark:bg-red-400',
  },
};

export function StatusChip({ status }: { status: BookingStatus }) {
  const { t } = useTranslation();
  const { chip, punto } = TONO[status];

  return (
    <span className={`ft-chip ${chip}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${punto}`} />
      {t(`admin.status.${status}`)}
    </span>
  );
}
