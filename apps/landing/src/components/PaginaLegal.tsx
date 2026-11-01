import { useTranslation } from 'react-i18next';
import {
  PRIVACY_EFFECTIVE_DATE,
  PRIVACY_VERSION,
  TERMS_EFFECTIVE_DATE,
  TERMS_VERSION,
} from '@freshness/types';
import { useBusinessContact } from '../hooks/useBusinessSettings';
import { partirNegritas, type Bloque, type Documento } from '../legal/documento';
import { PRIVACY_EN } from '../legal/privacy-en';
import { PRIVACY_ES } from '../legal/privacy-es';
import { TERMS_EN } from '../legal/terms-en';
import { TERMS_ES } from '../legal/terms-es';

interface PaginaLegalProps {
  cual: 'terms' | 'privacy';
}

/**
 * LAS DOS PAGINAS LEGALES
 * =======================
 * Condiciones y privacidad. Son las que el cliente acepta al reservar, asi
 * que tienen que poder leerse ANTES de reservar y sin perder el formulario:
 * la casilla las abre en una pestana nueva.
 *
 * ========================================================================
 * LA PAGINA ES EL DOCUMENTO
 * ========================================================================
 * No hay una copia en Markdown en otro sitio. Lo que el cliente acepta es
 * esto, asi que esto es el original. Ver `legal/documento.ts`.
 *
 * ========================================================================
 * EL IDIOMA DEL DOCUMENTO SIGUE AL DEL SITIO, Y SE DICE CUAL MANDA
 * ========================================================================
 * Quien lee en espanol ve la traduccion, y el propio documento dice en su
 * penultima seccion que manda la inglesa. No se esconde: un contrato en un
 * idioma que no gobierna y que no lo advierte es peor que no traducirlo.
 */
export function PaginaLegal({ cual }: PaginaLegalProps) {
  const { t, i18n } = useTranslation();
  /*
   * Se usa el CONTACTO ya resuelto, no los ajustes crudos: el telefono que
   * hay que ensenar en un documento es el legible, el mismo que ve el
   * visitante en la cabecera, y no la cadena E.164 que se guarda.
   */
  const contacto = useBusinessContact();
  const empresa = datosDeEmpresa(contacto);

  const enEspanol = i18n.language.startsWith('es');
  const documento: Documento =
    cual === 'terms' ? (enEspanol ? TERMS_ES : TERMS_EN) : enEspanol ? PRIVACY_ES : PRIVACY_EN;

  /*
   * LA VERSION Y LA FECHA SE ELIGEN JUNTAS, del mismo documento. Antes la
   * fecha era una sola para los dos, y en cuanto uno cambio sin el otro la
   * pagina habria mentido sobre alguno. Ver `legal.ts`.
   */
  const version = cual === 'terms' ? TERMS_VERSION : PRIVACY_VERSION;
  const fecha = cual === 'terms' ? TERMS_EFFECTIVE_DATE : PRIVACY_EFFECTIVE_DATE;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{documento.titulo}</h1>

      {/*
        LA VERSION Y LA FECHA, ARRIBA Y SIEMPRE. Son lo que permite saber
        despues QUE acepto una persona concreta: en cada reserva se guarda
        este numero.
      */}
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {t('legal.effective', { date: fecha, version: `${String(version)}.0` })}
      </p>

      <div className="mt-8 space-y-5">
        {documento.bloques.map((bloque, indice) => (
          <Pintar key={indice} bloque={bloque} empresa={empresa} />
        ))}
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */

/** Lo justo que necesitan los documentos. Todo opcional: ver `Contacto`. */
interface Empresa {
  legalName: string | null;
  mailingAddress: string | null;
  county: string | null;
  phone: string | null;
  email: string | null;
}

function datosDeEmpresa(contacto: ReturnType<typeof useBusinessContact>): Empresa {
  return {
    legalName: contacto.settings.legalName,
    mailingAddress: contacto.settings.mailingAddress,
    county: contacto.settings.county,
    phone: contacto.phoneDisplay,
    email: contacto.email,
  };
}

/**
 * Sustituye los huecos del texto por los datos del negocio.
 *
 * LO QUE NO ESTA CONFIGURADO NO DEJA UN HUECO NI UN CORCHETE: se reemplaza
 * por una frase que sigue teniendo sentido («los datos de contacto del final
 * de esta pagina»). Publicar un documento con «[TELEFONO]» dentro es peor que
 * no publicarlo.
 */
function rellenar(texto: string, empresa: Empresa, t: (clave: string) => string): string {
  return texto
    .replaceAll('{{company}}', empresa.legalName ?? 'Freshness Touch')
    .replaceAll('{{phone}}', empresa.phone ?? t('legal.fallbackContact'))
    .replaceAll('{{email}}', empresa.email ?? t('legal.fallbackContact'))
    .replaceAll('{{county}}', empresa.county ?? t('legal.fallbackCounty'));
}

function Texto({ texto }: { texto: string }) {
  return (
    <>
      {partirNegritas(texto).map((trozo, indice) =>
        trozo.fuerte ? (
          <strong key={indice} className="font-semibold text-slate-900 dark:text-white">
            {trozo.texto}
          </strong>
        ) : (
          <span key={indice}>{trozo.texto}</span>
        ),
      )}
    </>
  );
}

function Pintar({ bloque, empresa }: { bloque: Bloque; empresa: Empresa }) {
  const { t } = useTranslation();
  const texto = (valor: string): string => rellenar(valor, empresa, t);

  switch (bloque.t) {
    case 'h2':
      return (
        <h2 className="pt-4 text-lg font-bold text-slate-900 dark:text-white">
          <Texto texto={texto(bloque.texto)} />
        </h2>
      );

    case 'h3':
      return (
        <h3 className="pt-2 text-base font-semibold text-slate-900 dark:text-white">
          <Texto texto={texto(bloque.texto)} />
        </h3>
      );

    case 'p':
      return (
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <Texto texto={texto(bloque.texto)} />
        </p>
      );

    case 'ul':
      return (
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {bloque.items.map((item, indice) => (
            <li key={indice}>
              <Texto texto={texto(item)} />
            </li>
          ))}
        </ul>
      );

    case 'ol':
      return (
        <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          {bloque.items.map((item, indice) => (
            <li key={indice}>
              <Texto texto={texto(item)} />
            </li>
          ))}
        </ol>
      );

    case 'nota':
      return (
        <p className="rounded-lg border-l-4 border-brand-600 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 dark:bg-night-800 dark:text-slate-300">
          <Texto texto={texto(bloque.texto)} />
        </p>
      );

    case 'tabla':
      return (
        /* En movil la tabla se desplaza sola en vez de romper la pagina. */
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-md border-collapse text-sm">
            <thead>
              <tr>
                {bloque.cabecera.map((celda, indice) => (
                  <th
                    key={indice}
                    className="border-b border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-900 dark:border-night-600 dark:text-white"
                  >
                    <Texto texto={texto(celda)} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloque.filas.map((fila, indiceFila) => (
                <tr key={indiceFila}>
                  {fila.map((celda, indice) => (
                    <td
                      key={indice}
                      className="border-b border-slate-200 px-2 py-1.5 align-top text-slate-700 dark:border-night-700 dark:text-slate-300"
                    >
                      <Texto texto={texto(celda)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case 'contacto':
      return <Contacto empresa={empresa} />;
  }
}

/**
 * Los datos de la empresa.
 *
 * SE PINTA SOLO LO QUE HAY. Una fila «Teléfono: [TELEFONO]» en un documento
 * legal publicado es peor que no tener la fila.
 */
function Contacto({ empresa }: { empresa: Empresa }) {
  const { t } = useTranslation();

  const filas: { etiqueta: string; valor: string }[] = [
    { etiqueta: t('legal.contact.company'), valor: empresa.legalName ?? '' },
    { etiqueta: t('legal.contact.mail'), valor: empresa.mailingAddress ?? '' },
    { etiqueta: t('legal.contact.phone'), valor: empresa.phone ?? '' },
    { etiqueta: t('legal.contact.email'), valor: empresa.email ?? '' },
  ].filter((fila) => fila.valor !== '');

  if (filas.length === 0) return null;

  return (
    <dl className="rounded-lg border border-slate-200 p-4 text-sm dark:border-night-600">
      {filas.map((fila) => (
        <div key={fila.etiqueta} className="flex flex-wrap gap-x-2 py-0.5">
          <dt className="font-semibold text-slate-900 dark:text-white">{fila.etiqueta}</dt>
          <dd className="m-0 text-slate-700 dark:text-slate-300">{fila.valor}</dd>
        </div>
      ))}
    </dl>
  );
}
