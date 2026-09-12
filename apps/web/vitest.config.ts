import { defineConfig } from 'vitest/config';

// `modules/` y la validacion del entorno: codigo sin React, probable sin montar un
// componente. Si algun dia hiciera falta un DOM para probar la logica, se fue al componente.
export default defineConfig({
  test: {
    globals: true,
    include: ['src/modules/**/*.spec.ts', 'src/env.spec.ts'],
  },
});
