import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Las migraciones se prueban levantando un PostgreSQL en WebAssembly:
    // la primera ejecucion tarda mas que un test normal.
    testTimeout: 30_000,
  },
});
