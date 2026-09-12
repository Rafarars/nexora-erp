import { afterEach, describe, expect, it, vi } from 'vitest';

// getEnv guarda el resultado: cada caso importa el modulo de nuevo con su entorno.
async function envWith(values: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value as string);

  return (await import('./env')).getEnv;
}

describe('getEnv', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses the local API outside production', async () => {
    const getEnv = await envWith({ NODE_ENV: 'development', API_URL: undefined });

    expect(getEnv().API_URL).toBe('http://localhost:3001');
  });

  it('requires API_URL in production', async () => {
    const getEnv = await envWith({ NODE_ENV: 'production', API_URL: undefined });

    expect(() => getEnv()).toThrow(/API_URL is required in production/);
  });

  // El accidente clasico: desplegar el frontend apuntando a la API de la maquina local.
  it('refuses a localhost API in production', async () => {
    const getEnv = await envWith({ NODE_ENV: 'production', API_URL: 'http://localhost:3001' });

    expect(() => getEnv()).toThrow(/localhost while NODE_ENV=production/);
  });

  it('accepts a real API in production', async () => {
    const getEnv = await envWith({ NODE_ENV: 'production', API_URL: 'https://api.nexora.example' });

    expect(getEnv().API_URL).toBe('https://api.nexora.example');
  });

  // Validar al importar romperia `next build`, que corre sin las variables de ejecucion.
  it('does not validate on import', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('API_URL', undefined as unknown as string);

    await expect(import('./env')).resolves.toBeDefined();
  });
});
