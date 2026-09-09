import { expect, test } from '@playwright/test';
import { SystemStatusPage } from '../../pages/system-status.page.js';
import { startDatabase, stopDatabase } from '../../support/infrastructure.js';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

// Apagan PostgreSQL de verdad para comprobar que la alarma suena.
test.describe('Resilience: the database goes down', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(() => {
    stopDatabase();
  });

  // El entorno se restaura aunque las pruebas fallen.
  test.afterAll(() => {
    startDatabase();
  });

  test('the API returns 503 and reports the database as down', async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/health`);

    // Las plataformas deciden por el codigo de estado, no por el cuerpo.
    expect(response.status()).toBe(503);
    expect(await response.json()).toMatchObject({
      status: 'error',
      database: { status: 'down' },
    });
  });

  test('the dashboard turns unhealthy and marks the database as down', async ({
    page,
  }) => {
    const statusPage = new SystemStatusPage(page);
    await statusPage.open();

    expect(await statusPage.isHealthy()).toBe(false);
    await expect(statusPage.apiStatus).toContainText('HTTP 503');
    await expect(statusPage.databaseStatus).toContainText('down');
  });
});

test.describe('Resilience: the database comes back', () => {
  test.describe.configure({ mode: 'serial' });

  test('the system recovers on its own, without restarting the API', async ({
    page,
    request,
  }) => {
    stopDatabase();
    await expect
      .poll(async () => (await request.get(`${API_URL}/health`)).status(), {
        timeout: 30_000,
      })
      .toBe(503);

    startDatabase();

    // Nada se reinicia: la API debe reconectar sola.
    await expect
      .poll(async () => (await request.get(`${API_URL}/health`)).status(), {
        timeout: 60_000,
        intervals: [1_000],
      })
      .toBe(200);

    const statusPage = new SystemStatusPage(page);
    await statusPage.open();
    expect(await statusPage.isHealthy()).toBe(true);
  });
});
