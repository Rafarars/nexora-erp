import { defineConfig, devices } from '@playwright/test';

const WEB_URL = process.env.WEB_URL ?? 'http://localhost:3000';
const API_URL = process.env.API_URL ?? 'http://localhost:3001';

export default defineConfig({
  testDir: './tests',
  globalSetup: './support/global-setup.ts',
  globalTeardown: './support/global-teardown.ts',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    // Solo al reintentar: pesadas de grabar, decisivas para depurar el CI.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'api',
      testDir: './tests/api',
      fullyParallel: true,
      use: { baseURL: API_URL },
    },
    {
      name: 'ui',
      testDir: './tests/ui',
      fullyParallel: true,
      use: { ...devices['Desktop Chrome'], baseURL: WEB_URL },
    },
    {
      // Aislamiento entre empresas: la matriz de ataques y la prueba que la vigila.
      name: 'isolation',
      testDir: './tests/isolation',
      fullyParallel: true,
      use: { baseURL: API_URL },
    },
    {
      // Apaga Postgres: siempre al final o tumbaria a los demas proyectos.
      name: 'resilience',
      testDir: './tests/resilience',
      dependencies: ['api', 'ui', 'isolation'],
      fullyParallel: false,
      workers: 1,
      use: { ...devices['Desktop Chrome'], baseURL: WEB_URL },
    },
  ],
});
