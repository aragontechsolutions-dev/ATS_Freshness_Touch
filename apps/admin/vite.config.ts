import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Ruta absoluta a partir de una ruta relativa a este archivo. */
const resolvePath = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),

    /**
     * ========================================================================
     * EL PANEL SE INSTALA COMO APLICACION
     * ========================================================================
     * Quien limpia trabaja desde el movil, de pie en la puerta de una casa.
     * Instalado en la pantalla de inicio se abre de un toque, a pantalla
     * completa y sin la barra del navegador comiendose espacio.
     *
     * SE USA LA HERRAMIENTA EN VEZ DE ESCRIBIR EL SERVICE WORKER A MANO, y es
     * una excepcion deliberada a la costumbre de este proyecto de no anadir
     * dependencias. Un service worker escrito a mano tiene que conocer los
     * nombres con huella que genera el compilador, invalidar la cache vieja
     * en cada despliegue y limpiar lo que sobra. Equivocarse ahi no da un
     * error: deja el panel sirviendo una version antigua PARA SIEMPRE, en el
     * movil de alguien, sin forma de avisarle. Eso no es "unos pocos
     * simbolos": es el problema que esta libreria existe para resolver.
     *
     * ========================================================================
     * LA REGLA QUE NO SE TOCA: LA API NO SE CACHEA NUNCA
     * ========================================================================
     * Este panel sirve datos con sesion —direcciones de clientes, telefonos,
     * codigos de puertas, importes—. Un service worker que guardara respuestas
     * de la API las dejaria en el disco del movil, fuera de la sesion:
     *
     *   - seguirian ahi despues de cerrar sesion;
     *   - en un movil compartido, la siguiente persona podria verlas;
     *   - y el equipo de limpieza veria datos de trabajos que ya no son suyos.
     *
     * Por eso NO hay `runtimeCaching` para la API. Se cachea EXCLUSIVAMENTE el
     * armazon: JavaScript, CSS, fuentes e iconos, que son identicos para todo
     * el mundo y no dicen nada de nadie. Si algun dia hace falta que los
     * trabajos se vean sin cobertura, la respuesta correcta es guardarlos a
     * proposito y borrarlos al cerrar sesion, no dejar que el service worker
     * los recoja de paso.
     */
    VitePWA({
      /*
       * `prompt`, no `autoUpdate`: la version nueva se ofrece, no se impone.
       * Recargar solo mientras alguien rellena un formulario le borra lo
       * escrito, y aqui se rellena estando de pie en casa de un cliente.
       */
      registerType: 'prompt',
      /*
       * NO se usa `includeAssets`. Los archivos de `public/` acaban en la
       * carpeta compilada, asi que el patron `**\/*.png` de abajo ya los
       * recoge; declararlos ademas aqui los mete DOS VECES en la cache, y
       * eran medio megabyte de iconos descargados y guardados por duplicado
       * en el movil de cada persona.
       */

      manifest: {
        name: 'Freshness Touch · Panel',
        short_name: 'Freshness',
        description: 'Agenda, trabajos y configuracion de Freshness Touch',
        lang: 'en',
        /*
         * `standalone`: sin barra de direcciones. Ademas de ganar espacio,
         * hace que se comporte como una aplicacion y no como una pestana que
         * se cierra sin querer al limpiar el navegador.
         */
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        // Los mismos de la identidad visual: azul de marca y blanco roto.
        theme_color: '#145788',
        background_color: '#f7f9fc',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          /*
           * El enmascarable es obligatorio para que Android no dibuje el
           * isotipo dentro de un cuadrado blanco. Lleva el logotipo al 72%
           * sobre el blanco roto, para que el recorte a circulo o a cuadrado
           * redondeado no lo muerda.
           */
          {
            src: '/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      workbox: {
        /*
         * SOLO EL ARMAZON. Ni una ruta de la API entra aqui: son los archivos
         * que el compilador genera con huella en el nombre, iguales para
         * cualquiera que abra el panel.
         */
        globPatterns: ['**/*.{js,css,html,woff2,png,svg}'],
        globIgnores: [
          /*
           * Los iconos del manifiesto los precachea el plugin por su cuenta.
           * Sin esta exclusion entran DOS VECES en el manifiesto de cache:
           * 490 kB de iconos contados por duplicado.
           */
          'pwa-*.png',
          /*
           * LEAFLET NO SE GUARDA, Y ES DELIBERADO. Son 146 kB de libreria de
           * mapas que SIN CONEXION NO PUEDE FUNCIONAR: las teselas vienen de
           * OpenStreetMap por internet, asi que guardar el codigo solo
           * conseguiria pintar un rectangulo gris. Ademas los dos mapas del
           * panel son de configuracion —zonas y sede—, pantallas que se abren
           * unas pocas veces al ano y nunca desde la calle.
           *
           * Se cargan bajo demanda como siempre; quien los abra con cobertura
           * los descarga entonces.
           */
          'assets/leaflet-*.js',
          'assets/leaflet-*.css',
        ],
        /*
         * El panel es una aplicacion de una sola pagina: cualquier ruta se
         * resuelve con el mismo HTML. Sin esto, abrir la app instalada
         * directamente en /settings daria un 404 sin conexion.
         */
        navigateFallback: '/index.html',
        // Las peticiones a la API nunca se responden con el HTML del armazon.
        navigateFallbackDenylist: [/^\/api\//],
        /*
         * Borra las caches de versiones anteriores al activarse. Sin esto, el
         * almacenamiento del movil crece en cada despliegue.
         */
        cleanupOutdatedCaches: true,
        /*
         * El service worker nuevo NO se activa solo: espera a que la persona
         * acepte. Va de la mano de `registerType: 'prompt'`.
         */
        skipWaiting: false,
        clientsClaim: false,
      },

      devOptions: {
        /*
         * Apagado en desarrollo a proposito. Un service worker activo
         * mientras se programa sirve archivos viejos y hace perder tardes
         * enteras persiguiendo cambios que si estaban hechos.
         */
        enabled: false,
      },
    }),
  ],

  resolve: {
    /**
     * Los paquetes internos se consumen directamente desde su codigo fuente
     * TypeScript, no desde su compilado.
     *
     * Motivo: los paquetes se compilan a CommonJS porque la API (NestJS) es
     * CommonJS, y Rollup no puede analizar de forma fiable las exportaciones
     * nombradas de un modulo CommonJS. Apuntando al fuente se evita por
     * completo ese problema de interoperabilidad y, de paso, se obtiene
     * recarga en caliente al editar un paquete compartido.
     *
     * La comprobacion de tipos sigue usando los .d.ts publicados por cada
     * paquete, de modo que no se pierde seguridad de tipos.
     */
    alias: {
      '@freshness/types': resolvePath('../../packages/types/src/index.ts'),
      '@freshness/i18n': resolvePath('../../packages/i18n/src/index.ts'),
    },
  },

  server: {
    port: 5174,
    strictPort: true,
  },

  build: {
    // Presupuesto de tamano: si un cambio dispara el peso del bundle, avisa.
    chunkSizeWarningLimit: 400,
    sourcemap: false,
  },
});
