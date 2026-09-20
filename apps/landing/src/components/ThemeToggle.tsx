import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { MoonIcon, SunIcon } from './Icons';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useTranslation();

  const label = theme === 'dark' ? t('common.theme.light') : t('common.theme.dark');

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={label}
      aria-label={label}
      className="rounded-lg border border-slate-300 p-2 text-slate-600 transition-colors
                 hover:bg-slate-100 dark:border-night-600 dark:text-slate-300 dark:hover:bg-night-700"
    >
      {theme === 'dark' ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
    </button>
  );
}
