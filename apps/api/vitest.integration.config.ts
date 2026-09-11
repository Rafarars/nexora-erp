import { defineConfig } from 'vitest/config';

// Pruebas de contrato contra PostgreSQL: requieren la base levantada y migrada.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.integration.spec.ts'],
    // Comparten una sola base: en paralelo se borrarian las filas entre ellas.
    fileParallelism: false,
  },
});
