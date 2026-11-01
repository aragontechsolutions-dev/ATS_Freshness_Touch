import type { Plugin } from 'vite';
import { robotsTxt, sitemapXml } from './src/lib/seo/ficheros';
import { normalizarSitio } from './src/lib/seo/sitio';

/**
 * EL ENCHUFE QUE ESCRIBE `robots.txt` Y `sitemap.xml`
 * ===================================================
 * Deliberadamente tonto: lee la variable, llama a dos funciones puras y emite
 * dos ficheros. Todo lo que se puede equivocar esta en `lib/seo/ficheros.ts`,
 * que se prueba sin compilar nada.
 *
 * Solo en `build`: en desarrollo no hay rastreadores que atender, y generarlos
 * en cada arranque del servidor solo anadiria ruido al disco.
 *
 * `emitFile` y no `writeFileSync`: asi los ficheros van por el mismo camino
 * que el resto del paquete y acaban en `outDir` sea cual sea, en vez de en una
 * carpeta escrita a mano que el dia que cambie `outputDirectory` en
 * `vercel.json` dejaria de coincidir.
 */
export function seoFiles(): Plugin {
  return {
    name: 'freshness-seo-files',
    apply: 'build',

    generateBundle() {
      /*
       * `process.env` y no `import.meta.env`: esto corre en Node durante el
       * build, no en el navegador. `normalizarSitio` se encarga de que una
       * variable sin poner —local, vista previa de Vercel— caiga en el
       * dominio de produccion en vez de generar basura.
       */
      const sitio = normalizarSitio(process.env.VITE_SITE_URL);
      const ahora = new Date();

      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(sitio) });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(sitio, ahora) });
    },
  };
}
