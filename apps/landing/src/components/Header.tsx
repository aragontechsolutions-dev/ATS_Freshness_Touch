import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { company } from '../config/company';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { CloseIcon, MenuIcon, PhoneIcon } from './Icons';
import { Logo } from './Logo';
import { useScrolled } from '../hooks/useScrolled';
import { useBusinessContact } from '../hooks/useBusinessSettings';
import { hasStaffModifiers, openStaffEntrance } from '../lib/staff-entrance';

const NAV_ITEMS = [
  { href: '#services', key: 'nav.services' },
  { href: '#quote', key: 'nav.quote' },
  { href: '#areas', key: 'nav.areas' },
  { href: '#why-us', key: 'nav.whyUs' },
  { href: '#faq', key: 'nav.faq' },
] as const;

/**
 * Cabecera pensada primero para movil.
 *
 * A 390 pixeles de ancho no caben logotipo, cinco enlaces, telefono, idioma,
 * tema y menu. Las decisiones de recorte, en orden de importancia:
 *   - El logotipo siempre, porque identifica.
 *   - Idioma, tema y menu como ICONOS: la palabra "Menu" se cortaba.
 *   - El telefono se mueve dentro del menu desplegable, donde ademas gana
 *     protagonismo en vez de competir por espacio.
 */
export function Header() {
  const { t } = useTranslation();
  const contacto = useBusinessContact();
  const [open, setOpen] = useState(false);
  const desplazada = useScrolled();

  // Con el menu abierto no se puede desplazar el fondo: en movil resulta
  // desconcertante ver moverse la pagina detras del panel.
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Cerrar con la tecla de escape es lo que espera quien navega con teclado.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header
      // La sombra aparece solo al desplazar: arriba del todo ensucia, y al
      // bajar separa la cabecera del contenido que pasa por debajo.
      className={`sticky top-0 z-40 border-b border-slate-200 bg-canvas/95 backdrop-blur
                  transition-shadow duration-300 dark:border-night-600 dark:bg-night-900/95
                  ${desplazada ? 'ft-header-scrolled' : ''}`}
    >
      <div className="ft-container flex h-16 items-center justify-between gap-2">
        <a
          href="#top"
          aria-label={company.name}
          className="min-w-0 shrink"
          /*
           * PUERTA DE SERVICIO: Shift + Ctrl (o Cmd) + clic abre el panel.
           * No es una medida de seguridad, solo evita enseñar una puerta de
           * personal a los clientes. Ver `lib/staff-entrance.ts`.
           */
          onClick={(event) => {
            if (!hasStaffModifiers(event)) return;
            // Solo se cancela el clic normal si de verdad se va a navegar:
            // sin panel configurado, el logotipo sigue llevando arriba.
            if (openStaffEntrance()) event.preventDefault();
          }}
          /*
           * En macOS, Ctrl + clic abre el menu contextual ANTES de que llegue
           * el clic. Sin esto, el gesto sacaria un menu en vez de abrir el
           * panel. Solo se suprime cuando los modificadores estan pulsados:
           * el menu contextual normal sobre el logotipo sigue funcionando.
           */
          onContextMenu={(event) => {
            if (hasStaffModifiers(event)) event.preventDefault();
          }}
          /*
           * Equivalente de teclado, para quien no usa raton: con el logotipo
           * enfocado, Shift + Ctrl/Cmd + Enter. Un gesto que solo existe con
           * raton dejaria fuera a parte del personal.
           */
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || !hasStaffModifiers(event)) return;
            if (openStaffEntrance()) event.preventDefault();
          }}
        >
          <Logo size="sm" />
        </a>

        <nav className="hidden items-center gap-6 lg:flex" aria-label={t('nav.menu')}>
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-brand-700
                         dark:text-slate-300 dark:hover:text-brand-300"
            >
              {t(item.key)}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Sin telefono configurado no se pinta nada: un enlace `tel:`
              vacio abre la aplicacion del telefono sin numero. */}
          {contacto.phoneHref && (
            <a
              href={contacto.phoneHref}
              className="hidden items-center gap-2 text-sm font-semibold text-slate-700
                         xl:inline-flex dark:text-slate-200"
            >
              <PhoneIcon className="h-4 w-4 text-brand-700 dark:text-brand-300" />
              {contacto.phoneDisplay}
            </a>
          )}

          <LanguageSwitcher />
          <ThemeToggle />

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border
                       border-slate-300 text-slate-700 transition-colors hover:bg-slate-100
                       lg:hidden dark:border-night-600 dark:text-slate-200 dark:hover:bg-night-700"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={t('nav.menu')}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          className="border-t border-slate-200 bg-canvas lg:hidden dark:border-night-600
                     dark:bg-night-900"
          aria-label={t('nav.menu')}
        >
          <ul className="ft-container flex flex-col py-2">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={() => setOpen(false)}
                  // Altura de 48 pixeles: el minimo recomendado para tocar con
                  // el dedo sin fallar.
                  className="flex min-h-12 items-center border-b border-slate-100 text-base
                             font-medium text-slate-700 last:border-0
                             dark:border-night-700 dark:text-slate-200"
                >
                  {t(item.key)}
                </a>
              </li>
            ))}
          </ul>

          {contacto.phoneHref && (
            <div className="ft-container pb-4">
              <a href={contacto.phoneHref} className="ft-btn-secondary w-full">
                <PhoneIcon className="h-4 w-4" />
                {contacto.phoneDisplay}
              </a>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
