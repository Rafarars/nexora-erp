import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resuelve los alias de rutas declarados en tsconfig.json, de forma nativa.
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // Las de contrato contra PostgreSQL se piden aparte: `pnpm test:integration`.
    // Asi `pnpm test` sigue corriendo sin base de datos ni Docker.
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.spec.ts'],
  },
});
