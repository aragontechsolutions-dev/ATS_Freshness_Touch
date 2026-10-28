import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LEGAL_PATHS } from '@freshness/types';
import { useBusinessContact } from '../hooks/useBusinessSettings';

/**
 * LA PAGINA QUE NO EXISTE
 * =======================
 * Hasta ahora, una direccion equivocada en el sitio devolvia el 404 gris de
 * Vercel: letra negra sobre blanco, un codigo de error y ni una forma de
 * volver. Quien llegaba ahi desde un enlace viejo se iba.
 *
 * ========================================================================
 * LO QUE TIENE QUE HACER UN 404, Y CASI NINGUNO HACE
 * ========================================================================
 * No es decir que la pagina no existe —eso ya lo sabe quien la busca— sino
 * dar el siguiente paso. Aqui hay tres: volver a la portada, pedir precio
 * (que es lo que la mayoria venia a hacer) y el telefono, por si venia a
 * preguntar algo concreto.
 *
 * ========================================================================
 * NOINDEX, Y HACE FALTA EXPLICARLO
 * ========================================================================
 * Con la reescritura general de `vercel.json`, el servidor contesta 200 a
 * cualquier direccion y es esta pantalla la que dice que no existe. Para un
 * buscador eso es un «soft 404»: una pagina que responde bien y no tiene
 * nada. Sin esta etiqueta, Google indexaria cada enlace roto que encuentre
 * como si fuera una pagina mas del sitio.
 *
 * Se pone al montar y SE QUITA AL SALIR: si se quedara puesta, navegar de
 * aqui a la portada dejaria la portada marcada como no indexable.
 */
export function PaginaNoEncontrada() {
  const { t } = useTranslation();
  const contacto = useBusinessContact();
  const whatsapp = contacto.whatsappHref();

  useEffect(() => {
    const etiqueta = document.createElement('meta');
    etiqueta.name = 'robots';
    etiqueta.content = 'noindex';
    document.head.appendChild(etiqueta);

    return () => {
      etiqueta.remove();
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      {/*
        El 404 va grande y decorativo, y por eso `aria-hidden`: a un lector de
        pantalla no le aporta nada un numero suelto, y el titulo que viene
        debajo ya dice lo que pasa.
      */}
      <p
        className="text-6xl font-black tracking-tight text-brand-600/30 dark:text-brand-400/25"
        aria-hidden="true"
      >
        404
      </p>

      <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
        {t('notFound.title')}
      </h1>

      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {t('notFound.body')}
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <a className="ft-btn-primary" href="/">
          {t('notFound.home')}
        </a>
        {/*
          «Pedir precio» es lo que venia a hacer la mayoria, asi que lleva
          directo al cotizador y no a la portada a buscarlo.
        */}
        <a className="ft-btn-outline" href="/#quote">
          {t('notFound.quote')}
        </a>
      </div>

      {/*
        SE ESCRIBE, NO SE LLAMA — y hay una prueba del proyecto que lo exige.
        Un `tel:` abre Skype en un ordenador, no funciona de noche y no deja
        rastro de que alguien estuvo aqui: la empresa no se entera de que
        existio (`docs/33`). WhatsApp si deja la conversacion abierta.

        Y solo si hay numero configurado: el sitio nunca inventa uno.
      */}
      {whatsapp !== null && (
        <p className="mt-8 text-sm text-slate-600 dark:text-slate-400">
          {t('notFound.writeUs')}{' '}
          <a
            className="font-semibold underline"
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('common.whatsapp')}
          </a>
        </p>
      )}

      <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
        <a className="underline" href={LEGAL_PATHS.terms}>
          {t('footer.terms')}
        </a>
        {' · '}
        <a className="underline" href={LEGAL_PATHS.privacy}>
          {t('footer.privacy')}
        </a>
      </p>
    </main>
  );
}
