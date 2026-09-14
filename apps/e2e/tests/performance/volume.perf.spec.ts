import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';

// Guardas de rendimiento sobre la empresa Volumen: 50 clientes, 5.000 facturas y 3.000 cobros
// sembrados. En local miden unos 150, 65 y 95 ms: cada umbral es unas diez veces eso, para que el CI
// solo falle cuando algo se degrada de verdad (una consulta por fila, un indice que se pierde).
const THRESHOLDS_MS = {
  receivables: 1500,
  dashboard: 1000,
  agingExport: 1500,
};

async function volumeToken(request: APIRequestContext): Promise<string> {
  const response = await request.post('/api/v1/auth/login', { data: { email: 'vera@volumen.com', password: 'Nexora-2026!' } });

  return (await response.json()).token;
}

// La mediana de tres tras un calentamiento: una sola medicion la mueve cualquier pausa del proceso.
async function medianMs(call: () => Promise<{ status(): number }>): Promise<number> {
  expect((await call()).status()).toBe(200);

  const times: number[] = [];

  for (let run = 0; run < 3; run += 1) {
    const started = performance.now();
    const response = await call();

    times.push(performance.now() - started);
    expect(response.status()).toBe(200);
  }

  return times.sort((a, b) => a - b)[1];
}

test.describe('performance guards on a tenant with volume', () => {
  test('lists 5,000 receivable invoices under its threshold', async ({ request }) => {
    const headers = { authorization: `Bearer ${await volumeToken(request)}` };
    const { receivables } = await (await request.get('/api/v1/receivables/invoices', { headers })).json();

    expect(receivables).toHaveLength(5000);
    expect(await medianMs(() => request.get('/api/v1/receivables/invoices', { headers }))).toBeLessThan(THRESHOLDS_MS.receivables);
  });

  test('builds the dashboard under its threshold', async ({ request }) => {
    const headers = { authorization: `Bearer ${await volumeToken(request)}` };

    expect(await medianMs(() => request.get('/api/v1/reports/dashboard', { headers }))).toBeLessThan(THRESHOLDS_MS.dashboard);
  });

  test('exports the aging of 50 customers and 5,000 invoices to Excel under its threshold', async ({ request }) => {
    const headers = { authorization: `Bearer ${await volumeToken(request)}` };

    expect(await medianMs(() => request.get('/api/v1/reports/receivables-aging/export?format=xlsx', { headers }))).toBeLessThan(THRESHOLDS_MS.agingExport);
  });
});
