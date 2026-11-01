import { useTranslation } from 'react-i18next';
import { company } from '../config/company';
import { useEnlacesInternos } from '../hooks/useEnlacesInternos';
import { Logo } from './Logo';

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  /*
   * Los enlaces legales en EL IDIOMA QUE SE ESTA LEYENDO. Con la ruta escrita
   * a mano, quien lee `/es` acababa en el contrato en ingles.
   */
  const enlaces = useEnlacesInternos();

  return (
    <footer className="border-t border-slate-200 bg-brand-50 py-10 sm:py-12 dark:border-night-600 dark:bg-night-800/60">
      <div className="ft-container flex flex-col gap-4 text-sm text-slate-600 dark:text-slate-400">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Logo size="md" withTagline />
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              {company.city}, {company.state}
            </p>
          </div>
          <p>
            © {year} {company.name}. {t('footer.rights')}
          </p>
        </div>
        <p className="max-w-3xl text-xs leading-relaxed">{t('footer.legalNote')}</p>

        {/*
          LOS DOS DOCUMENTOS, EN EL PIE Y EN TODAS LAS PAGINAS.
          Las claves llevaban meses escritas en los dos idiomas sin que nadie
          las usara. Van aqui y no escondidas porque un enlace que no se ve no
          cuenta como aviso: lo dijo el Noveno Circuito en Nguyen contra
          Barnes & Noble y lo recoge `docs/40` §5.
        */}
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <a
            className="underline hover:text-brand-700 dark:hover:text-brand-300"
            href={enlaces.terms}
          >
            {t('footer.terms')}
          </a>
          <a
            className="underline hover:text-brand-700 dark:hover:text-brand-300"
            href={enlaces.privacy}
          >
            {t('footer.privacy')}
          </a>
        </nav>
      </div>
    </footer>
  );
}
