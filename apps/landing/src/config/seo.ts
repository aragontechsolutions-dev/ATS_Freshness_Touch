import { normalizarSitio } from '../lib/seo/sitio';

/**
 * LA DIRECCION DEL SITIO, YA NORMALIZADA, PARA EL NAVEGADOR
 * =========================================================
 * El mismo valor que usa el enchufe del build (`vite-seo.ts`), leido por el
 * otro camino: aqui `import.meta.env`, alli `process.env`. Es la unica
 * duplicacion y es inevitable —son dos entornos distintos—, por eso la LOGICA
 * vive en `lib/seo/sitio.ts` y esto es una linea.
 *
 * Sin la variable puesta cae en el dominio de produccion, que es lo que se
 * quiere: un `canonical` desde una vista previa de Vercel hacia produccion es
 * exactamente lo que evita que las vistas previas se indexen.
 */
const CONFIGURADA: string | undefined = import.meta.env.VITE_SITE_URL;

export const SITE_URL = normalizarSitio(CONFIGURADA);
