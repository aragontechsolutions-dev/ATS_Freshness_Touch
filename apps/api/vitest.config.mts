import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    /*
     * NestJS resuelve las dependencias del constructor leyendo los metadatos
     * que emiten los decoradores. Ni esbuild ni oxc los emiten, asi que sin
     * este compilador los tests que levantan la aplicacion fallarian al
     * intentar inyectar. Solo afecta a los tests: la compilacion de
     * produccion la sigue haciendo el compilador de TypeScript.
     */
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2023',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Los tests de migraciones levantan un PostgreSQL en WebAssembly y los
    // de HTTP arrancan la aplicacion entera: tardan mas que un test normal.
    testTimeout: 30_000,
  },
});
