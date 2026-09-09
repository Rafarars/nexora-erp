import { expect, test } from '@playwright/test';

test.describe('GET /health', () => {
  test('returns 200 when the database is reachable', async ({ request }) => {
    const response = await request.get('/health');

    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'ok',
      database: { status: 'up' },
    });
  });

  test('reports database latency as a number', async ({ request }) => {
    const body = await (await request.get('/health')).json();

    expect(typeof body.database.latencyMs).toBe('number');
    expect(body.database.latencyMs).toBeGreaterThanOrEqual(0);
  });

  // El CI y la plataforma de despliegue lo consultan: si tarda, dan el
  // servicio por caido.
  test('responds in under one second', async ({ request }) => {
    const startedAt = Date.now();
    const response = await request.get('/health');
    const elapsed = Date.now() - startedAt;

    expect(response.ok()).toBe(true);
    expect(elapsed).toBeLessThan(1000);
  });
});
