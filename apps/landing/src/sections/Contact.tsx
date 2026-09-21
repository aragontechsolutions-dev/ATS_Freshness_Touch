import { useTranslation } from 'react-i18next';
import { company } from '../config/company';
import { MailIcon, PhoneIcon, MapPinIcon } from '../components/Icons';
import { BusinessHoursList } from '../components/BusinessHoursList';
import { Reveal } from '../components/Reveal';
import { useBusinessContact } from '../hooks/useBusinessSettings';

export function Contact() {
  const { t } = useTranslation();
  const contacto = useBusinessContact();

  return (
    <section id="contact" className="py-12 sm:py-16 lg:py-20">
      <div className="ft-container">
        <Reveal className="ft-card overflow-hidden">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-2 lg:p-12">
            <div>
              <h2
                className="ft-rule text-3xl font-bold tracking-tight text-brand-800
                       dark:text-white"
              >
                {t('contact.title')}
              </h2>
              <p className="mt-3 text-slate-600 dark:text-slate-300">{t('contact.subtitle')}</p>

              <a href="#quote" className="ft-btn-primary mt-6">
                {t('common.getQuote')}
              </a>
            </div>

            <dl className="space-y-4 text-sm">
              {/* Las filas de telefono y correo desaparecen si no hay dato.
                  Una etiqueta "Telefono" sin numero debajo solo genera la
                  duda de si la web esta rota. */}
              {contacto.phoneHref && (
                <div className="flex items-start gap-3">
                  <PhoneIcon className="mt-0.5 h-5 w-5 text-brand-700 dark:text-brand-300" />
                  <div>
                    <dt className="font-semibold text-slate-900 dark:text-white">
                      {t('contact.phone')}
                    </dt>
                    <dd>
                      <a href={contacto.phoneHref} className="text-slate-600 dark:text-slate-400">
                        {contacto.phoneDisplay}
                      </a>
                    </dd>
                  </div>
                </div>
              )}

              {contacto.emailHref && (
                <div className="flex items-start gap-3">
                  <MailIcon className="mt-0.5 h-5 w-5 text-brand-700 dark:text-brand-300" />
                  <div>
                    <dt className="font-semibold text-slate-900 dark:text-white">
                      {t('contact.email')}
                    </dt>
                    <dd>
                      <a href={contacto.emailHref} className="text-slate-600 dark:text-slate-400">
                        {contacto.email}
                      </a>
                    </dd>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <MapPinIcon className="mt-0.5 h-5 w-5 text-brand-700 dark:text-brand-300" />
                <div>
                  <dt className="font-semibold text-slate-900 dark:text-white">
                    {t('contact.hours')}
                  </dt>
                  <dd className="text-slate-600 dark:text-slate-400">
                    <BusinessHoursList hours={contacto.settings.hours} />
                  </dd>
                  <dd className="text-slate-600 dark:text-slate-400">
                    {t('contact.serviceArea', { city: company.city, state: company.state })}
                  </dd>
                </div>
              </div>
            </dl>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
