import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Locale } from '@freshness/types';
import { SITE_URL } from '../config/seo';
import type { Pantalla } from '../lib/rutas';
import { aplicarEtiquetas } from '../lib/seo/aplicar';
import { etiquetasDePagina } from '../lib/seo/etiquetas';

/**
 * PONE LAS ETIQUETAS DE LA PANTALLA QUE SE ESTA VIENDO
 * ====================================================
 * Un efecto de tres lineas. Todo lo que decide esta en `lib/seo/`.
 *
 * ==========================================================================
 * SE VUELVE A EJECUTAR AL CAMBIAR DE IDIOMA, Y ESO ES LA MITAD DEL SENTIDO
 * ==========================================================================
 * El titulo y la descripcion estan traducidos. Sin `locale` en las
 * dependencias, alguien que entra en ingles y cambia a espanol se queda con
 * la pestana del navegador en ingles y —peor— con el `og:locale` equivocado:
 * si comparte el enlace en ese momento, la vista previa sale en el idioma que
 * no esta leyendo.
 *
 * ==========================================================================
 * NO HAY LIMPIEZA AL DESMONTAR, Y ES CORRECTO
 * ==========================================================================
 * Un efecto que escribe en la cabecera normalmente tiene que deshacerlo al
 * desmontarse. Aqui no: solo hay UNA pantalla montada a la vez y cada una
 * reescribe las mismas etiquetas al entrar. Deshacerlo dejaria el documento
 * sin titulo durante el intercambio, que es justo cuando un rastreador podria
 * estar mirando.
 */
export function useSeo(pantalla: Pantalla): void {
  const { t, i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? 'en') as Locale;

  useEffect(() => {
    const etiquetas = etiquetasDePagina(pantalla, locale, SITE_URL, t);
    aplicarEtiquetas(etiquetas, locale, SITE_URL, window.location.href);
  }, [pantalla, locale, t]);
}
