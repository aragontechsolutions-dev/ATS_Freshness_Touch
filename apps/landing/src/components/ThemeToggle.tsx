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
      // 44 pixeles: el minimo recomendado para tocar con el dedo sin fallar.
      className="inline-flex h-11 w-11 items-center justify-center rounded-lg border
                 border-slate-300 text-slate-600 transition-colors hover:bg-slate-100
                 dark:border-night-600 dark:text-slate-300 dark:hover:bg-night-700"
    >
      {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
    </button>
  );
}
