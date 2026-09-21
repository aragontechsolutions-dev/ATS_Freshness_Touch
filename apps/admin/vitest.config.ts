import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

const resolvePath = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@freshness/types': resolvePath('../../packages/types/src/index.ts'),
      '@freshness/i18n': resolvePath('../../packages/i18n/src/index.ts'),
    },
  },
  test: {
    // El panel es una aplicacion de navegador: sus pruebas necesitan ventana,
    // documento y temporizadores, no el entorno de Node.
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
