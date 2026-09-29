import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    /*
     * ENTORNO DE NODE, NO DE NAVEGADOR.
     *
     * A diferencia del panel, el sitio publico no prueba componentes con
     * estado, asi que no necesita ventana ni documento: se ahorra `jsdom` y
     * las pruebas arrancan en un segundo.
     *
     * Los iconos de los servicios son funciones puras que devuelven marcado, y
     * se comprueban con `renderToStaticMarkup` de `react-dom`, que funciona en
     * Node sin DOM. De ahi el `.tsx` en la lista: hay pruebas con JSX, pero
     * ninguna necesita navegador.
     */
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
