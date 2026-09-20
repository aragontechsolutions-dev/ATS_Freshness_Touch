import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  esbuild: {
    // Nest usa decoradores "legacy"; los tests instancian las clases a mano,
    // por eso no hace falta emitDecoratorMetadata.
    target: 'es2023',
    tsconfigRaw: { compilerOptions: { experimentalDecorators: true } },
  },
});
