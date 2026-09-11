import { defineConfig } from 'vitest/config';

// Solo `modules/`: es la capa sin React, probable sin montar un componente. Si algun
// dia hiciera falta un DOM para probar la logica, es que la logica se fue al componente.
export default defineConfig({
  test: {
    globals: true,
    include: ['src/modules/**/*.spec.ts'],
  },
});
