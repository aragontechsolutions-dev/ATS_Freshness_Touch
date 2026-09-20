import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Ruta absoluta a partir de una ruta relativa a este archivo. */
const resolvePath = (relative: string): string =>
  fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],

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
    port: 5173,
    strictPort: true,
  },

  build: {
    // Presupuesto de tamano: si un cambio dispara el peso del bundle, avisa.
    chunkSizeWarningLimit: 400,
    sourcemap: false,
  },
});
