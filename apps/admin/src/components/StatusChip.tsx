import { useTranslation } from 'react-i18next';
import type { BookingStatus } from '@freshness/types';

/**
 * El color acompaña al texto, nunca lo sustituye: quien no distingue colores
 * necesita poder leer el estado. Por eso el nombre va siempre escrito.
 */
const TONO: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'bg-sun-100 text-sun-800 dark:bg-sun-900 dark:text-sun-200',
  CONFIRMED: 'bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200',
  IN_PROGRESS: 'bg-brand-200 text-brand-900 dark:bg-brand-800 dark:text-brand-100',
  COMPLETED: 'bg-slate-200 text-slate-800 dark:bg-night-600 dark:text-slate-200',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  NO_SHOW: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
};

export function StatusChip({ status }: { status: BookingStatus }) {
  const { t } = useTranslation();
  return <span className={`ft-chip ${TONO[status]}`}>{t(`admin.status.${status}`)}</span>;
}
