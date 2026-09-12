import { expect, test } from '@playwright/test';

test('the web app does not announce the framework and cannot be framed', async ({ request }) => {
  const response = await request.get('/login');
  const headers = response.headers();

  expect(response.ok()).toBe(true);
  expect(headers['x-powered-by']).toBeUndefined();
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
});
