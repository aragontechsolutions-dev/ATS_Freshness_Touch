import { useTranslation } from 'react-i18next';
import { formatLocalTime, groupWeeklyHours, type WeeklyHours } from '@freshness/types';

const LOCALE_TAG: Record<string, string> = { en: 'en-US', es: 'es-US' };

/**
 * HORARIO COMERCIAL EN PANTALLA
 * -----------------------------
 * Se compone a partir de las horas reales, no de una frase traducida.
 *
 * Antes habia un texto suelto en cada idioma ("Monday to Saturday, 8:00 AM -
 * 6:00 PM"). Con el horario ya editable desde el panel eso seria una trampa:
 * la empresa cambiaria su horario, la agenda lo respetaria, y la web seguiria
 * anunciando el viejo hasta que alguien se acordara de reescribir dos textos.
 * Anunciar un horario distinto del que acepta reservas es peor que no
 * anunciar ninguno.
 *
 * Los dias seguidos con el mismo horario se agrupan ("Monday – Friday"), que
 * es como lo diria una persona en vez de recitar siete lineas.
 */
export function BusinessHoursList({ hours }: { hours: WeeklyHours }) {
  const { t, i18n } = useTranslation();
  const tag = LOCALE_TAG[i18n.resolvedLanguage ?? 'en'] ?? 'en-US';

  return (
    <ul className="space-y-0.5">
      {groupWeeklyHours(hours).map((tramo) => {
        const dias =
          tramo.from === tramo.to
            ? t(`contact.day.${tramo.from}`)
            : `${t(`contact.day.${tramo.from}`)} – ${t(`contact.day.${tramo.to}`)}`;

        return (
          <li key={tramo.from}>
            <span className="font-medium">{dias}:</span>{' '}
            {tramo.hours === null
              ? t('contact.closed')
              : `${formatLocalTime(tramo.hours.open, tag)} – ${formatLocalTime(tramo.hours.close, tag)}`}
          </li>
        );
      })}
    </ul>
  );
}
