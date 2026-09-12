import { expect, test } from '@playwright/test';

test.describe('API security headers', () => {
  // Se comprueba en una ruta publica y en una de error: las cabeceras no pueden
  // depender de que la peticion haya ido bien.
  for (const path of ['/health', '/api/v1/does-not-exist']) {
    test(`${path} does not announce the framework and sets defensive headers`, async ({ request }) => {
      const headers = (await request.get(path)).headers();

      expect(headers['x-powered-by']).toBeUndefined();
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    });
  }
});
